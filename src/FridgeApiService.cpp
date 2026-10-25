#include "FridgeApiService.h"
#include <ArduinoJson.h>
#include <AsyncJson.h>
#include <time.h>
#include "ModbusEngine.h"
#include "AuditService.h"

FridgeApiService::FridgeApiService(AsyncWebServer* server, SecurityManager* securityManager, FridgeSettingsService* settingsService)
    : _server(server), _securityManager(securityManager), _settingsService(settingsService),
      _ws("/ws"), _traceWs("/ws/modbus-trace") {
}

void FridgeApiService::begin() {
    modbusEngine.setTraceCallback([this](const char* bus, const char* direction, const uint8_t* frame, size_t length, bool overflow) {
        broadcastModbusTrace(bus, direction, frame, length, overflow);
    });
    registerEndpoints();
    registerWebSocket();
    registerTraceWebSocket();
}

void FridgeApiService::cleanupClients() {
    _ws.cleanupClients();
    _traceWs.cleanupClients();
}

void FridgeApiService::registerEndpoints() {
    // 1. GET /rest/cavas (Estado en tiempo real de todas las cavas descubiertas)
    _server->on("/rest/cavas", HTTP_GET, [this](AsyncWebServerRequest* request) {
        JsonDocument doc;
        JsonArray arr = doc["cavas"].to<JsonArray>();

        size_t count = _settingsService->getCavaCount();
        CavaState* cavas = _settingsService->getCavas();

        for (size_t i = 0; i < count; i++) {
            CavaState& c = cavas[i];
            JsonObject obj = arr.add<JsonObject>();
            obj["id"] = c.id;
            obj["descripcion"] = c.descripcion;
            obj["modbus_id"] = c.modbus_id;
            obj["tipo"] = (c.tipo == CAVA_CONSERVACION) ? "conservacion" : "maduracion";
            obj["has_humidity"] = c.has_humidity;
            obj["controller_model"] = (c.controller_model == KIDEMATIC_970) ? "KIDEMATIC_970" : "KIDE_KP100";
            obj["controller_name"] = (c.controller_model == KIDEMATIC_970) ? "Kidematic 970" : "KP-100";

            obj["temp_pv"] = serialized(String(c.temp_pv, 1));
            obj["temp_sp"] = serialized(String(c.temp_sp, 1));
            obj["temp_evap"] = serialized(String(c.temp_evap, 1));
            obj["temp_diff"] = serialized(String(c.temp_diff, 1));

            if (c.has_humidity) {
                obj["hr_pv"] = serialized(String(c.hr_pv, 1));
                obj["hr_sp"] = serialized(String(c.hr_sp, 1));
                obj["hr_diff"] = serialized(String(c.hr_diff, 1));
            } else {
                obj["hr_pv"] = nullptr;
                obj["hr_sp"] = nullptr;
                obj["hr_diff"] = nullptr;
            }

            obj["alarm_temp_high"] = c.alarm_temp_high;
            obj["alarm_hr_low"] = c.alarm_hr_low;
            obj["alarm_hr_high"] = c.alarm_hr_high;
            obj["alarm_active"] = c.alarm_active;

            obj["cooling_active"] = c.cooling_active;
            obj["fan_active"] = c.fan_active;
            obj["defrost_active"] = c.defrost_active;
            obj["heating_active"] = c.heating_active;
            obj["humid_active"] = c.humid_active;
            obj["exhaust_active"] = c.exhaust_active;

            obj["online"] = c.comm_online;
            obj["last_seen"] = c.last_seen;
            obj["quality_percent"] = serialized(String(c.diag.quality_percent, 1));

            // Supervisión de Puerta y Señalización
            obj["door_closed"] = c.door_closed;
            obj["ack_pressed"] = c.ack_pressed;
            obj["kide_hw_alarm"] = c.kide_hw_alarm_contact;
            obj["tower_state"] = (int)c.tower_state;
            obj["buzzer_active"] = c.buzzer_active;
            obj["signaling_node_id"] = c.signaling_node_id;
            char chStr[2] = { c.signaling_channel, '\0' };
            obj["signaling_channel"] = chStr;

            // Parámetros de Alarma ISA-18.2
            obj["door_grace_sec"] = c.door_grace_sec;
            obj["door_buzzer_sec"] = c.door_buzzer_sec;
            obj["ack_grace_sec"] = c.ack_grace_sec;
            obj["temp_alarm_delta"] = c.temp_alarm_delta;
            obj["temp_alarm_delay_sec"] = c.temp_alarm_delay_sec;
        }

        String res;
        serializeJson(doc, res);
        request->send(200, "application/json", res);
    });

    // 2. GET /rest/history (Buffer circular de 24h en RAM)
    _server->on("/rest/history", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (!request->hasParam("cava")) {
            request->send(400, "application/json", "{\"error\":\"Falta parámetro cava (ej: ?cava=C1)\"}");
            return;
        }

        String cavaId = request->getParam("cava")->value();
        CavaState* c = _settingsService->getCavaById(cavaId.c_str());
        if (!c) {
            request->send(404, "application/json", "{\"error\":\"Cava no encontrada\"}");
            return;
        }

        TrendBuffer& tb = c->trends;
        uint16_t startIdx = (tb.count < MAX_TREND_POINTS) ? 0 : tb.head;
        bool isConservacion = (c->tipo == CAVA_CONSERVACION && !c->has_humidity);

        // Streaming directo NDJSON (Newline Delimited JSON)
        AsyncResponseStream* response = request->beginResponseStream("application/x-ndjson");
        for (uint16_t i = 0; i < tb.count; i++) {
            uint16_t idx = (startIdx + i) % MAX_TREND_POINTS;
            const TrendPoint& pt = tb.points[idx];

            if (isConservacion || pt.hr_x10 < 0) {
                response->printf("{\"ts\":%u,\"tp\":%.1f,\"hr\":null}\n", pt.ts, pt.temp_x10 / 10.0f);
            } else {
                response->printf("{\"ts\":%u,\"tp\":%.1f,\"hr\":%.1f}\n", pt.ts, pt.temp_x10 / 10.0f, pt.hr_x10 / 10.0f);
            }
        }
        request->send(response);
    });

    // 3. POST /rest/setpoint (Modificación de Consignas)
    AsyncCallbackJsonWebHandler* setpointHandler = new AsyncCallbackJsonWebHandler("/rest/setpoint", [this](AsyncWebServerRequest* request, JsonVariant& json) {
        JsonDocument doc = json.as<JsonObject>();
        const char* pin = doc["pin"];

        bool isAdmin = false;
        if (pin && strcmp(pin, DEFAULT_ADMIN_PIN) == 0) {
            isAdmin = true;
        } else if (_securityManager) {
            Authentication auth = _securityManager->authenticateRequest(request);
            if (AuthenticationPredicates::IS_ADMIN(auth)) {
                isAdmin = true;
            }
        }

        if (!isAdmin) {
            request->send(403, "application/json", "{\"error\":\"Acceso denegado: Se requiere perfil de Administrador o Mantenedor\"}");
            return;
        }

        const char* cava = doc["cava"];
        const char* var = doc["variable"];
        float val = doc["value"];

        bool ok = false;
        if (strcmp(var, "temp") == 0) {
            ok = modbusEngine.queueWriteSetpointTemp(cava, val);
        } else if (strcmp(var, "hr") == 0) {
            ok = modbusEngine.queueWriteSetpointHR(cava, val);
        }

        if (ok) {
            if (g_auditService) {
                char detailBuf[96];
                if (strcmp(var, "temp") == 0) {
                    snprintf(detailBuf, sizeof(detailBuf), "Consigna Temp modificada a %.1f °C", val);
                } else {
                    snprintf(detailBuf, sizeof(detailBuf), "Consigna Humedad modificada a %.1f %%", val);
                }
                g_auditService->logRequest(request, "SETPOINT_CHANGE", cava, detailBuf);
            }
            request->send(200, "application/json", "{\"success\":true,\"message\":\"Consigna encolada hacia el bus Modbus\"}");
        } else {
            request->send(500, "application/json", "{\"error\":\"Fallo al encolar comando Modbus\"}");
        }
    });
    _server->addHandler(setpointHandler);

    // 5. MÓDULO DE DIAGNÓSTICO: Auto-Descubrimiento (Escaneo de Red Dinámico con Abort)
    _server->on("/rest/diagnostic/scan", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (request->hasParam("abort", true) && request->getParam("abort", true)->value() == "true") {
            modbusEngine.stopBusScan();
            request->send(200, "application/json", "{\"status\":\"scanning_aborted\"}");
            return;
        }

        uint8_t startId = 1;
        uint8_t endId = 32;
        if (request->hasParam("start", true)) startId = request->getParam("start", true)->value().toInt();
        if (request->hasParam("end", true)) endId = request->getParam("end", true)->value().toInt();

        if (request->hasParam("reset", true) && request->getParam("reset", true)->value() == "true") {
            _settingsService->clearAllCavas();
            modbusEngine.setCavas(_settingsService->getCavas(), 0);
        }

        String targetStr = request->hasParam("target", true) ? request->getParam("target", true)->value() : "all";
        if (targetStr == "kide") {
            modbusEngine.startKideScan(startId, endId);
        } else if (targetStr == "fridge_io" || targetStr == "auxiliares") {
            modbusEngine.startFridgeIOScan(startId, endId);
        } else {
            modbusEngine.startBusScan(startId, endId);
        }
        request->send(200, "application/json", "{\"status\":\"scanning_started\",\"target\":\"" + targetStr + "\",\"start\":" + String(startId) + ",\"end\":" + String(endId) + "}");
    });

    _server->on("/rest/diagnostic/scan/abort", HTTP_POST, [](AsyncWebServerRequest* request) {
        modbusEngine.stopBusScan();
        request->send(200, "application/json", "{\"status\":\"scanning_aborted\"}");
    });

    _server->on("/rest/diagnostic/scan", HTTP_GET, [](AsyncWebServerRequest* request) {
        String scanResults = modbusEngine.getScanResultsJson();
        request->send(200, "application/json", scanResults);
    });

        // MÓDULO DE DIAGNÓSTICO: Estadísticas de Salud de Bus (TX, RX, CRC, RTT, Q%)
    _server->on("/rest/diagnostic/stats", HTTP_GET, [this](AsyncWebServerRequest* request) {
        JsonDocument doc;

        // 1. Estadísticas Globales Bus KIDE (Puerto 2 / RS-422)
        JsonObject kideBus = doc["bus_kide"].to<JsonObject>();
        const ModbusDiagnostics& kb = modbusEngine.getKideBusDiagnostics();
        kideBus["port"] = 2;
        kideBus["mode"] = "RS-422 Full-Duplex (KIDE Cavas)";
        kideBus["baud"] = KIDE_RS422_BAUD_DEFAULT;
        kideBus["tx_frames"] = kb.tx_frames;
        kideBus["rx_success"] = kb.rx_success;
        kideBus["timeouts"] = kb.timeouts;
        kideBus["crc_errors"] = kb.crc_errors;
        kideBus["last_rtt_ms"] = kb.last_rtt_ms;
        kideBus["quality_percent"] = serialized(String(kb.quality_percent, 1));

        // 2. Estadísticas Globales Bus Auxiliares FridgeIO (Puerto 1 / RS-485)
        JsonObject fioBus = doc["bus_fridge_io"].to<JsonObject>();
        const ModbusDiagnostics& fb = modbusEngine.getFridgeIOBusDiagnostics();
        fioBus["port"] = 1;
        fioBus["mode"] = "RS-485 Half-Duplex (Auxiliares FridgeIO)";
        fioBus["baud"] = RS485_BAUD_DEFAULT;
        fioBus["tx_frames"] = fb.tx_frames;
        fioBus["rx_success"] = fb.rx_success;
        fioBus["timeouts"] = fb.timeouts;
        fioBus["crc_errors"] = fb.crc_errors;
        fioBus["last_rtt_ms"] = fb.last_rtt_ms;
        fioBus["quality_percent"] = serialized(String(fb.quality_percent, 1));

        JsonArray arr = doc["stats"].to<JsonArray>();

        size_t cavaCount = _settingsService->getCavaCount();
        CavaState* cavas = _settingsService->getCavas();
        for (size_t i = 0; i < cavaCount; i++) {
            JsonObject obj = arr.add<JsonObject>();
            obj["cava_id"] = cavas[i].id;
            obj["cava"] = cavas[i].id;
            obj["modbus_id"] = cavas[i].modbus_id;
            obj["type"] = "KIDE";
            obj["controller_name"] = (cavas[i].controller_model == KIDEMATIC_970) ? "KIDEMATIC 970" : "KP-100";
            obj["online"] = cavas[i].comm_online;
            obj["tx_frames"] = cavas[i].diag.tx_frames;
            obj["rx_success"] = cavas[i].diag.rx_success;
            obj["timeouts"] = cavas[i].diag.timeouts;
            obj["crc_errors"] = cavas[i].diag.crc_errors;
            obj["rtt_ms"] = cavas[i].diag.last_rtt_ms;
            obj["quality_percent"] = serialized(String(cavas[i].diag.quality_percent, 1));
        }

        size_t nodeCount = _settingsService->getSignalingNodeCount();
        SignalingNode* nodes = _settingsService->getSignalingNodes();
        for (size_t i = 0; i < nodeCount; i++) {
            JsonObject obj = arr.add<JsonObject>();
            obj["cava_id"] = String(nodes[i].cava_a_id) + "/" + String(nodes[i].cava_b_id);
            obj["cava"] = "Auxiliar " + String(nodes[i].modbus_id);
            obj["cava_a"] = nodes[i].cava_a_id;
            obj["cava_b"] = nodes[i].cava_b_id;
            obj["modbus_id"] = nodes[i].modbus_id;
            obj["type"] = "FRIDGE_IO";
            obj["online"] = nodes[i].online;
            obj["tx_frames"] = nodes[i].diag.tx_frames;
            obj["rx_success"] = nodes[i].diag.rx_success;
            obj["timeouts"] = nodes[i].diag.timeouts;
            obj["crc_errors"] = nodes[i].diag.crc_errors;
            obj["rtt_ms"] = nodes[i].diag.last_rtt_ms;
            obj["quality_percent"] = serialized(String(nodes[i].diag.quality_percent, 1));
        }

        String res;
        serializeJson(doc, res);
        request->send(200, "application/json", res);
    });

    // 6. MÓDULO DE DIAGNÓSTICO: Ping Rápido (150 ms) y Diagnóstico Dual Cava + Compañero FridgeIO
    _server->on("/rest/diagnostic/ping", HTTP_POST, [this](AsyncWebServerRequest* request) {
        // Opción A: Diagnóstico por Cava (Kide + Satélite Compañero FridgeIO)
        if (request->hasParam("cava", true)) {
            String cavaId = request->getParam("cava", true)->value();
            auto diag = modbusEngine.pingCavaAndCompanion(cavaId.c_str());

            JsonDocument doc;
            doc["cava_id"] = diag.cava_id;
            doc["kide_id"] = diag.kide_id;
            doc["kide_online"] = diag.kide_online;
            doc["kide_rtt_ms"] = diag.kide_rtt_ms;
            doc["temp_pv"] = serialized(String(diag.temp_pv, 1));
            if (diag.hr_pv > 0) doc["hr_pv"] = serialized(String(diag.hr_pv, 1));

            doc["companion_node_id"] = diag.companion_node_id;
            char chStr[2] = { diag.companion_channel, '\0' };
            doc["companion_channel"] = chStr;
            doc["companion_online"] = diag.companion_online;
            doc["companion_rtt_ms"] = diag.companion_rtt_ms;

            doc["diagnosis"] = diag.diagnosis_summary;

            String res;
            serializeJson(doc, res);
            request->send(200, "application/json", res);
            return;
        }

        // Opción B: Ping Individual por ID de Bus (Timeout rápido de 150 ms, sin congelar la UI)
        uint8_t id = 1;
        if (request->hasParam("id", true)) id = request->getParam("id", true)->value().toInt();

        PingResult pr = modbusEngine.pingSlave(id);
        if (pr.success) {
            if (strcmp(pr.detected_model, "FRIDGE_IO") == 0) {
                _settingsService->addOrUpdateSignalingNode(pr.id);
                modbusEngine.setSignalingNodes(_settingsService->getSignalingNodes(), _settingsService->getSignalingNodeCount());
            } else {
                _settingsService->addOrUpdateDiscoveredCava(pr.id, pr.detected_model, pr.temp_pv, pr.hr_pv);
                modbusEngine.setCavas(_settingsService->getCavas(), _settingsService->getCavaCount());
            }
        }

        JsonDocument doc;
        doc["id"] = pr.id;
        doc["success"] = pr.success;
        doc["rtt_ms"] = pr.rtt_ms;
        doc["model"] = pr.detected_model;
        doc["temp_pv"] = serialized(String(pr.temp_pv, 1));
        if (pr.hr_pv > 0) doc["hr_pv"] = serialized(String(pr.hr_pv, 1));

        String res;
        serializeJson(doc, res);
        request->send(200, "application/json", res);
    });
}

void FridgeApiService::broadcastCavasState() {
    if (_ws.count() == 0) return;

    JsonDocument doc;
    doc["type"] = "CAVAS_UPDATE";
    JsonArray arr = doc["cavas"].to<JsonArray>();

    size_t count = _settingsService->getCavaCount();
    CavaState* cavas = _settingsService->getCavas();

    for (size_t i = 0; i < count; i++) {
        CavaState& c = cavas[i];
        JsonObject obj = arr.add<JsonObject>();
        obj["id"] = c.id;
        obj["temp"] = serialized(String(c.temp_pv, 1));
        obj["sp"]   = serialized(String(c.temp_sp, 1));
        if (c.has_humidity) {
            obj["hr"]    = serialized(String(c.hr_pv, 1));
            obj["hr_sp"] = serialized(String(c.hr_sp, 1));
        }
        obj["alarm"]   = c.alarm_active;
        obj["cooling"] = c.cooling_active;
        obj["fan"]     = c.fan_active;
        obj["defrost"] = c.defrost_active;
        if (c.tipo == CAVA_MADURACION) {
            obj["heat"]    = c.heating_active;
            obj["humid"]   = c.humid_active;
            obj["exhaust"] = c.exhaust_active;
        }
        obj["door"]   = c.door_closed;
        obj["ack"]    = c.ack_pressed;
        obj["tower"]  = (int)c.tower_state;
        obj["buzzer"] = c.buzzer_active;
        obj["online"] = c.comm_online;
    }

    String output;
    serializeJson(doc, output);
    _ws.textAll(output);
}

void FridgeApiService::broadcastModbusTrace(const char* bus, const char* direction, const uint8_t* frame, size_t length, bool overflow) {
    if (_traceWs.count() == 0) return;

    char hex[3 * 256 + 1];
    size_t offset = 0;
    for (size_t i = 0; i < length && offset + 3 <= sizeof(hex); ++i) {
        const int written = snprintf(hex + offset, sizeof(hex) - offset, i == 0 ? "%02X" : " %02X", frame[i]);
        if (written <= 0) return;
        offset += static_cast<size_t>(written);
    }

    JsonDocument doc;
    doc["type"] = "MODBUS_TRACE";
    doc["bus"] = bus;
    doc["direction"] = direction;
    doc["uptime_ms"] = millis();
    doc["length"] = length;
    doc["hex"] = hex;
    doc["overflow"] = overflow;

    String output;
    serializeJson(doc, output);
    _traceWs.textAll(output);
}

void FridgeApiService::registerWebSocket() {
    _ws.onEvent([this](AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
        if (type == WS_EVT_CONNECT) {
            log_i("Cliente WebSocket conectado desde %s, id: %u", client->remoteIP().toString().c_str(), client->id());
            broadcastCavasState();
        } else if (type == WS_EVT_DISCONNECT) {
            log_i("Cliente WebSocket desconectado, id: %u", client->id());
        }
    });
    _server->addHandler(&_ws);
}

void FridgeApiService::registerTraceWebSocket() {
    _traceWs.onEvent([](AsyncWebSocket*, AsyncWebSocketClient* client, AwsEventType type, void*, uint8_t*, size_t) {
        if (type == WS_EVT_CONNECT) {
            log_i("Consola de trazas Modbus conectada, id: %u", client->id());
        } else if (type == WS_EVT_DISCONNECT) {
            log_i("Consola de trazas Modbus desconectada, id: %u", client->id());
        }
    });
    _server->addHandler(&_traceWs);
}
