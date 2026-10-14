#include "FridgeSettingsService.h"
#include <ArduinoJson.h>
#include <AsyncJson.h>
#include "ModbusEngine.h"
#include "AuditService.h"

#define CAVAS_CONFIG_FILE "/config/cavas.json"
#define SIGNALING_CONFIG_FILE "/config/signaling.json"

FridgeSettingsService::FridgeSettingsService(AsyncWebServer* server, fs::FS* fs, SecurityManager* securityManager)
    : _server(server), _fs(fs), _securityManager(securityManager), _cavaCount(0), _signalingNodeCount(0) {
    memset(_cavas, 0, sizeof(_cavas));
    memset(_signalingNodes, 0, sizeof(_signalingNodes));
    strncpy(_mqttBaseTopic, "genica/dalvi/cavas", sizeof(_mqttBaseTopic) - 1);
}

void FridgeSettingsService::begin() {
    loadSettings();
    loadSignalingSettings();
    syncCavaSignalingAssociations();
    loadTrendsFromFiles();
    registerEndpoints();
}

void FridgeSettingsService::clearAllCavas() {
    _cavaCount = 0;
    memset(_cavas, 0, sizeof(_cavas));
    saveSettings();
}

bool FridgeSettingsService::addOrUpdateDiscoveredCava(uint8_t modbus_id, const char* model, float temp, float hr) {
    for (size_t i = 0; i < _cavaCount; i++) {
        if (_cavas[i].modbus_id == modbus_id) {
            // Ya existe: actualizar valores
            _cavas[i].temp_pv = temp;
            if (hr > 0) _cavas[i].hr_pv = hr;
            _cavas[i].comm_online = true;
            return false; // Ya existía
        }
    }

    if (_cavaCount >= MAX_CAVAS) return false;

    CavaState& c = _cavas[_cavaCount];
    memset(&c, 0, sizeof(CavaState));

    c.modbus_id = modbus_id;
    snprintf(c.id, sizeof(c.id), "C%u", modbus_id);

    bool isMaduracion = (strcmp(model, "KIDEMATIC_970") == 0) || (hr > 0);
    c.tipo = isMaduracion ? CAVA_MADURACION : CAVA_CONSERVACION;
    c.has_humidity = isMaduracion;

    snprintf(c.descripcion, sizeof(c.descripcion), "Cava %u - %s", modbus_id, isMaduracion ? "Maduración" : "Conservación");

    c.temp_pv = temp;
    c.temp_sp = isMaduracion ? 12.0f : 4.0f;
    c.temp_alarm_delta = 2.5f;
    c.temp_alarm_delay_sec = 300;
    c.door_grace_sec = 90;
    c.door_buzzer_sec = 180;
    c.ack_grace_sec = 600;

    if (isMaduracion) {
        c.hr_pv = hr;
        c.hr_sp = 85.0f;
        c.hr_alarm_low = 80.0f;
        c.hr_alarm_high = 90.0f;
    }

    c.comm_online = true;
    c.trends.head = 0;
    c.trends.count = 0;

    _cavaCount++;
    saveSettings();
    return true; // Nueva cava agregada
}

CavaState* FridgeSettingsService::getCavaById(const char* id) {
    for (size_t i = 0; i < _cavaCount; i++) {
        if (strcmp(_cavas[i].id, id) == 0) return &_cavas[i];
    }
    return nullptr;
}

void FridgeSettingsService::initDefaultCavas() {
    _cavaCount = 0;

    // Cava 1 - Conservación (Modbus ID 1)
    CavaState& c1 = _cavas[_cavaCount++];
    memset(&c1, 0, sizeof(CavaState));
    strncpy(c1.id, "C1", sizeof(c1.id) - 1);
    strncpy(c1.descripcion, "Cava 1 - Conservación", sizeof(c1.descripcion) - 1);
    c1.modbus_id = 1;
    c1.tipo = CAVA_CONSERVACION;
    c1.has_humidity = false;
    c1.temp_sp = 4.0f;
    c1.temp_alarm_delta = 2.5f;
    c1.temp_alarm_delay_sec = 300;
    c1.door_grace_sec = 90;
    c1.door_buzzer_sec = 180;
    c1.ack_grace_sec = 600;
    c1.comm_online = true;

    // Cava 2 - Conservación (Modbus ID 2)
    CavaState& c2 = _cavas[_cavaCount++];
    memset(&c2, 0, sizeof(CavaState));
    strncpy(c2.id, "C2", sizeof(c2.id) - 1);
    strncpy(c2.descripcion, "Cava 2 - Conservación", sizeof(c2.descripcion) - 1);
    c2.modbus_id = 2;
    c2.tipo = CAVA_CONSERVACION;
    c2.has_humidity = false;
    c2.temp_sp = 4.0f;
    c2.temp_alarm_delta = 2.5f;
    c2.temp_alarm_delay_sec = 300;
    c2.door_grace_sec = 90;
    c2.door_buzzer_sec = 180;
    c2.ack_grace_sec = 600;
    c2.comm_online = true;

    saveSettings();
}

void FridgeSettingsService::initTemplateCavas(size_t count) {
    if (count > MAX_CAVAS) count = MAX_CAVAS;
    if (count == 0) count = 1;
    _cavaCount = 0;
    memset(_cavas, 0, sizeof(_cavas));

    for (size_t i = 0; i < count; i++) {
        uint8_t mid = i + 1;
        CavaState& c = _cavas[_cavaCount++];
        memset(&c, 0, sizeof(CavaState));
        snprintf(c.id, sizeof(c.id), "C%u", mid);
        snprintf(c.descripcion, sizeof(c.descripcion), "Cava %u - Conservación", mid);
        c.modbus_id = mid;
        c.tipo = CAVA_CONSERVACION;
        c.has_humidity = false;
        c.temp_sp = 4.0f;
        c.temp_alarm_delta = 2.5f;
        c.temp_alarm_delay_sec = 300;
        c.door_grace_sec = 90;
        c.door_buzzer_sec = 180;
        c.ack_grace_sec = 600;
        c.comm_online = false;
        c.trends.head = 0;
        c.trends.count = 0;
    }
    saveSettings();
}

bool FridgeSettingsService::addOrUpdateCava(const CavaState& cava) {
    for (size_t i = 0; i < _cavaCount; i++) {
        if (strcmp(_cavas[i].id, cava.id) == 0 || _cavas[i].modbus_id == cava.modbus_id) {
            strncpy(_cavas[i].id, cava.id, sizeof(_cavas[i].id) - 1);
            strncpy(_cavas[i].descripcion, cava.descripcion, sizeof(_cavas[i].descripcion) - 1);
            _cavas[i].modbus_id = cava.modbus_id;
            _cavas[i].tipo = cava.tipo;
            _cavas[i].has_humidity = cava.has_humidity;
            if (cava.temp_sp != 0) _cavas[i].temp_sp = cava.temp_sp;
            if (cava.temp_alarm_delta != 0) _cavas[i].temp_alarm_delta = cava.temp_alarm_delta;
            if (cava.temp_alarm_delay_sec != 0) _cavas[i].temp_alarm_delay_sec = cava.temp_alarm_delay_sec;
            if (cava.door_grace_sec != 0) _cavas[i].door_grace_sec = cava.door_grace_sec;
            if (cava.door_buzzer_sec != 0) _cavas[i].door_buzzer_sec = cava.door_buzzer_sec;
            if (cava.ack_grace_sec != 0) _cavas[i].ack_grace_sec = cava.ack_grace_sec;
            if (cava.hr_sp != 0) _cavas[i].hr_sp = cava.hr_sp;
            if (cava.hr_alarm_low != 0) _cavas[i].hr_alarm_low = cava.hr_alarm_low;
            if (cava.hr_alarm_high != 0) _cavas[i].hr_alarm_high = cava.hr_alarm_high;
            saveSettings();
            syncCavaSignalingAssociations();
            return true;
        }
    }

    if (_cavaCount >= MAX_CAVAS) return false;

    _cavas[_cavaCount] = cava;
    _cavas[_cavaCount].trends.head = 0;
    _cavas[_cavaCount].trends.count = 0;
    _cavaCount++;
    saveSettings();
    syncCavaSignalingAssociations();
    return true;
}

bool FridgeSettingsService::removeCava(const char* id) {
    for (size_t i = 0; i < _cavaCount; i++) {
        if (strcmp(_cavas[i].id, id) == 0) {
            for (size_t j = i; j < _cavaCount - 1; j++) {
                _cavas[j] = _cavas[j + 1];
            }
            _cavaCount--;
            saveSettings();
            syncCavaSignalingAssociations();
            return true;
        }
    }
    return false;
}

bool FridgeSettingsService::loadSettings() {
    if (!_fs || !_fs->exists(CAVAS_CONFIG_FILE)) {
        initDefaultCavas();
        return true;
    }

    File f = _fs->open(CAVAS_CONFIG_FILE, "r");
    if (!f) {
        initDefaultCavas();
        return true;
    }

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) {
        initDefaultCavas();
        return true;
    }

    JsonArray arr = doc["cavas"];
    if (arr.isNull() || arr.size() == 0) {
        initDefaultCavas();
        return true;
    }

    size_t idx = 0;
    for (JsonObject obj : arr) {
        if (idx >= MAX_CAVAS) break;
        const char* cid = obj["id"];
        const char* desc = obj["descripcion"];
        if (cid) strncpy(_cavas[idx].id, cid, sizeof(_cavas[idx].id) - 1);
        if (desc) strncpy(_cavas[idx].descripcion, desc, sizeof(_cavas[idx].descripcion) - 1);
        _cavas[idx].modbus_id = obj["modbus_id"] | (idx + 1);
        _cavas[idx].tipo = (obj["tipo"] == "maduracion") ? CAVA_MADURACION : CAVA_CONSERVACION;
        _cavas[idx].has_humidity = obj["has_humidity"] | (_cavas[idx].tipo == CAVA_MADURACION);
        _cavas[idx].temp_sp = obj["temp_sp"] | (_cavas[idx].has_humidity ? 12.0f : 5.0f);
        _cavas[idx].temp_alarm_delta = obj["temp_alarm_delta"] | 2.5f;
        _cavas[idx].temp_alarm_delay_sec = obj["temp_alarm_delay_sec"] | 300;
        _cavas[idx].door_grace_sec = obj["door_grace_sec"] | 90;
        _cavas[idx].door_buzzer_sec = obj["door_buzzer_sec"] | 180;
        _cavas[idx].ack_grace_sec = obj["ack_grace_sec"] | 600;
        _cavas[idx].hr_sp = obj["hr_sp"] | 85.0f;
        _cavas[idx].hr_alarm_low = obj["hr_alarm_low"] | 80.0f;
        _cavas[idx].hr_alarm_high = obj["hr_alarm_high"] | 90.0f;
        _cavas[idx].trends.head = 0;
        _cavas[idx].trends.count = 0;
        idx++;
    }
    _cavaCount = idx;
    return true;
}

bool FridgeSettingsService::saveSettings() {
    if (!_fs) return false;

    JsonDocument doc;
    JsonArray arr = doc["cavas"].to<JsonArray>();

    for (size_t i = 0; i < _cavaCount; i++) {
        JsonObject obj = arr.add<JsonObject>();
        obj["id"] = _cavas[i].id;
        obj["descripcion"] = _cavas[i].descripcion;
        obj["modbus_id"] = _cavas[i].modbus_id;
        obj["tipo"] = (_cavas[i].tipo == CAVA_CONSERVACION) ? "conservacion" : "maduracion";
        obj["has_humidity"] = _cavas[i].has_humidity;
        obj["temp_sp"] = _cavas[i].temp_sp;
        obj["temp_alarm_delta"] = _cavas[i].temp_alarm_delta;
        obj["temp_alarm_delay_sec"] = _cavas[i].temp_alarm_delay_sec;
        obj["door_grace_sec"] = _cavas[i].door_grace_sec;
        obj["door_buzzer_sec"] = _cavas[i].door_buzzer_sec;
        obj["ack_grace_sec"] = _cavas[i].ack_grace_sec;
        obj["hr_sp"] = _cavas[i].hr_sp;
        obj["hr_alarm_low"] = _cavas[i].hr_alarm_low;
        obj["hr_alarm_high"] = _cavas[i].hr_alarm_high;
    }

    File f = _fs->open(CAVAS_CONFIG_FILE, "w");
    if (!f) return false;
    serializeJson(doc, f);
    f.close();
    return true;
}

void FridgeSettingsService::registerEndpoints() {
    _server->on("/rest/cavas/config", HTTP_GET, [this](AsyncWebServerRequest* request) {
        JsonDocument doc;
        JsonArray arr = doc["cavas"].to<JsonArray>();

        for (size_t i = 0; i < _cavaCount; i++) {
            JsonObject obj = arr.add<JsonObject>();
            obj["id"] = _cavas[i].id;
            obj["descripcion"] = _cavas[i].descripcion;
            obj["modbus_id"] = _cavas[i].modbus_id;
            obj["tipo"] = (_cavas[i].tipo == CAVA_CONSERVACION) ? "conservacion" : "maduracion";
            obj["has_humidity"] = _cavas[i].has_humidity;
            obj["temp_sp"] = _cavas[i].temp_sp;
            obj["temp_alarm_delta"] = _cavas[i].temp_alarm_delta;
            obj["temp_alarm_delay_sec"] = _cavas[i].temp_alarm_delay_sec;
            obj["door_grace_sec"] = _cavas[i].door_grace_sec;
            obj["door_buzzer_sec"] = _cavas[i].door_buzzer_sec;
            obj["ack_grace_sec"] = _cavas[i].ack_grace_sec;
            obj["hr_sp"] = _cavas[i].hr_sp;
            obj["hr_alarm_low"] = _cavas[i].hr_alarm_low;
            obj["hr_alarm_high"] = _cavas[i].hr_alarm_high;
        }

        String res;
        serializeJson(doc, res);
        request->send(200, "application/json", res);
    });

    // POST /rest/cavas/save (Crear o Actualizar Cava)
    _server->on("/rest/cavas/save", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (!request->hasParam("id", true)) {
            request->send(400, "application/json", "{\"error\":\"Falta id de cava\"}");
            return;
        }

        String cid = request->getParam("id", true)->value();
        String origId = request->hasParam("original_id", true) ? request->getParam("original_id", true)->value() : cid;
        uint8_t modbus_id = request->hasParam("modbus_id", true) ? (uint8_t)request->getParam("modbus_id", true)->value().toInt() : 1;
        String desc = request->hasParam("descripcion", true) ? request->getParam("descripcion", true)->value() : cid;
        String tipoStr = request->hasParam("tipo", true) ? request->getParam("tipo", true)->value() : "conservacion";
        bool has_humidity = request->hasParam("has_humidity", true) ? (request->getParam("has_humidity", true)->value() == "true" || request->getParam("has_humidity", true)->value() == "1") : (tipoStr == "maduracion");

        // Buscar existente
        CavaState* existing = getCavaById(origId.c_str());
        if (!existing) {
            for (size_t i = 0; i < _cavaCount; i++) {
                if (_cavas[i].modbus_id == modbus_id) {
                    existing = &_cavas[i];
                    break;
                }
            }
        }

        if (existing) {
            strncpy(existing->id, cid.c_str(), sizeof(existing->id) - 1);
            strncpy(existing->descripcion, desc.c_str(), sizeof(existing->descripcion) - 1);
            existing->modbus_id = modbus_id;
            existing->tipo = (tipoStr == "maduracion") ? CAVA_MADURACION : CAVA_CONSERVACION;
            existing->has_humidity = has_humidity;
            if (request->hasParam("temp_sp", true)) existing->temp_sp = request->getParam("temp_sp", true)->value().toFloat();
            if (request->hasParam("temp_alarm_delta", true)) existing->temp_alarm_delta = request->getParam("temp_alarm_delta", true)->value().toFloat();
            if (request->hasParam("hr_sp", true)) existing->hr_sp = request->getParam("hr_sp", true)->value().toFloat();
        } else {
            if (_cavaCount >= MAX_CAVAS) {
                request->send(400, "application/json", "{\"error\":\"Límite máximo de cavas alcanzado (16)\"}");
                return;
            }
            CavaState& c = _cavas[_cavaCount++];
            memset(&c, 0, sizeof(CavaState));
            strncpy(c.id, cid.c_str(), sizeof(c.id) - 1);
            strncpy(c.descripcion, desc.c_str(), sizeof(c.descripcion) - 1);
            c.modbus_id = modbus_id;
            c.tipo = (tipoStr == "maduracion") ? CAVA_MADURACION : CAVA_CONSERVACION;
            c.has_humidity = has_humidity;
            c.temp_sp = request->hasParam("temp_sp", true) ? request->getParam("temp_sp", true)->value().toFloat() : (has_humidity ? 12.0f : 4.0f);
            c.temp_alarm_delta = request->hasParam("temp_alarm_delta", true) ? request->getParam("temp_alarm_delta", true)->value().toFloat() : 2.5f;
            c.temp_alarm_delay_sec = 300;
            c.door_grace_sec = 90;
            c.door_buzzer_sec = 180;
            c.ack_grace_sec = 600;
            c.hr_sp = request->hasParam("hr_sp", true) ? request->getParam("hr_sp", true)->value().toFloat() : 85.0f;
            c.hr_alarm_low = 80.0f;
            c.hr_alarm_high = 90.0f;
            c.trends.head = 0;
            c.trends.count = 0;
        }

        saveSettings();
        syncCavaSignalingAssociations();
        modbusEngine.setCavas(_cavas, _cavaCount);

        if (g_auditService) {
            String actDetail = String(desc) + " (Modbus ID " + String(modbus_id) + ")";
            g_auditService->logRequest(request, "CAVA_CONFIG", cid.c_str(), actDetail.c_str());
        }

        request->send(200, "application/json", "{\"status\":\"ok\",\"cava_id\":\"" + cid + "\"}");
    });

    // POST /rest/cavas/delete (Eliminar Cava de la Configuración)
    _server->on("/rest/cavas/delete", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (!request->hasParam("id", true)) {
            request->send(400, "application/json", "{\"error\":\"Falta parámetro id\"}");
            return;
        }
        String id = request->getParam("id", true)->value();
        if (removeCava(id.c_str())) {
            modbusEngine.setCavas(_cavas, _cavaCount);
            if (g_auditService) {
                g_auditService->logRequest(request, "CAVA_DELETE", id.c_str(), "Cava eliminada de la configuración");
            }
            request->send(200, "application/json", "{\"status\":\"ok\",\"deleted\":\"" + id + "\"}");
        } else {
            request->send(404, "application/json", "{\"error\":\"Cava no encontrada\"}");
        }
    });

    // POST /rest/cavas/init_template (Inicializar Plantilla de 1 a N Cavas Correlativas)
    _server->on("/rest/cavas/init_template", HTTP_POST, [this](AsyncWebServerRequest* request) {
        size_t count = 4;
        if (request->hasParam("count", true)) {
            count = request->getParam("count", true)->value().toInt();
        }
        initTemplateCavas(count);
        modbusEngine.setCavas(_cavas, _cavaCount);
        if (g_auditService) {
            String tmplMsg = "Plantilla de " + String(_cavaCount) + " cavas generada";
            g_auditService->logRequest(request, "TEMPLATE_INIT", "ALL", tmplMsg.c_str());
        }
        request->send(200, "application/json", "{\"status\":\"ok\",\"count\":" + String(_cavaCount) + "}");
    });

    // POST /rest/cavas/update_meta (Renombrar / Actualizar Metadatos)
    _server->on("/rest/cavas/update_meta", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (!request->hasParam("cava_id", true)) {
            request->send(400, "application/json", "{\"error\":\"Falta cava_id\"}");
            return;
        }
        String cavaId = request->getParam("cava_id", true)->value();
        CavaState* c = getCavaById(cavaId.c_str());
        if (!c) {
            request->send(404, "application/json", "{\"error\":\"Cava no encontrada\"}");
            return;
        }

        if (request->hasParam("new_id", true)) {
            String newId = request->getParam("new_id", true)->value();
            if (newId.length() > 0) strncpy(c->id, newId.c_str(), sizeof(c->id) - 1);
        }
        if (request->hasParam("descripcion", true)) {
            strncpy(c->descripcion, request->getParam("descripcion", true)->value().c_str(), sizeof(c->descripcion) - 1);
        }
        if (request->hasParam("modbus_id", true)) {
            c->modbus_id = request->getParam("modbus_id", true)->value().toInt();
        }
        if (request->hasParam("tipo", true)) {
            String tipo = request->getParam("tipo", true)->value();
            c->tipo = (tipo == "maduracion") ? CAVA_MADURACION : CAVA_CONSERVACION;
        }
        if (request->hasParam("has_humidity", true)) {
            String hh = request->getParam("has_humidity", true)->value();
            c->has_humidity = (hh == "true" || hh == "1");
        }

        saveSettings();
        syncCavaSignalingAssociations();
        modbusEngine.setCavas(_cavas, _cavaCount);

        if (g_auditService) {
            String metaMsg = "Nombre: " + String(c->descripcion) + " | Tipo: " + (c->tipo == CAVA_MADURACION ? "Maduración" : "Conservación");
            g_auditService->logRequest(request, "CAVA_META", c->id, metaMsg.c_str());
        }

        request->send(200, "application/json", "{\"status\":\"ok\",\"cava_id\":\"" + String(c->id) + "\"}");
    });

    // POST /rest/cavas/alarm_config (Ajuste de tiempos y deltas de alarma ISA-18.2)
    _server->on("/rest/cavas/alarm_config", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (!request->hasParam("cava_id", true)) {
            request->send(400, "application/json", "{\"error\":\"Falta cava_id\"}");
            return;
        }

        String cavaId = request->getParam("cava_id", true)->value();
        CavaState* c = getCavaById(cavaId.c_str());
        if (!c) {
            request->send(404, "application/json", "{\"error\":\"Cava no encontrada\"}");
            return;
        }

        if (request->hasParam("door_grace_sec", true)) {
            c->door_grace_sec = request->getParam("door_grace_sec", true)->value().toInt();
        }
        if (request->hasParam("door_buzzer_sec", true)) {
            c->door_buzzer_sec = request->getParam("door_buzzer_sec", true)->value().toInt();
        }
        if (request->hasParam("ack_grace_sec", true)) {
            c->ack_grace_sec = request->getParam("ack_grace_sec", true)->value().toInt();
        }
        if (request->hasParam("temp_alarm_delta", true)) {
            c->temp_alarm_delta = request->getParam("temp_alarm_delta", true)->value().toFloat();
        }
        if (request->hasParam("temp_alarm_delay_sec", true)) {
            c->temp_alarm_delay_sec = request->getParam("temp_alarm_delay_sec", true)->value().toInt();
        }

        saveSettings();
        if (g_auditService) {
            String almMsg = "Tiempos ISA-18.2: Puerta=" + String(c->door_grace_sec) + "s, Buzzer=" + String(c->door_buzzer_sec) + "s, Delta=" + String(c->temp_alarm_delta, 1) + "°C";
            g_auditService->logRequest(request, "ALARM_CONFIG", cavaId.c_str(), almMsg.c_str());
        }
        request->send(200, "application/json", "{\"status\":\"ok\",\"cava_id\":\"" + cavaId + "\"}");
    });

    // GET /rest/signaling/nodes (Listado de nodos de señalización detectados y configurados)
    _server->on("/rest/signaling/nodes", HTTP_GET, [this](AsyncWebServerRequest* request) {
        JsonDocument doc;
        JsonArray arr = doc["nodes"].to<JsonArray>();

        for (size_t i = 0; i < _signalingNodeCount; i++) {
            SignalingNode& n = _signalingNodes[i];
            JsonObject obj = arr.add<JsonObject>();
            obj["modbus_id"] = n.modbus_id;
            obj["online"] = n.online;
            obj["last_seen"] = n.last_seen;
            obj["cava_a"] = n.cava_a_id;
            obj["cava_b"] = n.cava_b_id;

            // Entradas Canal A
            obj["door_closed_a"] = n.door_closed_a;
            obj["ack_pressed_a"] = n.ack_pressed_a;
            obj["kide_alarm_a"]  = n.kide_alarm_a;

            // Entradas Canal B
            obj["door_closed_b"] = n.door_closed_b;
            obj["ack_pressed_b"] = n.ack_pressed_b;
            obj["kide_alarm_b"]  = n.kide_alarm_b;

            // Salidas Canal A
            obj["green_a"]  = n.green_a;
            obj["yellow_a"] = n.yellow_a;
            obj["red_a"]    = n.red_a;
            obj["buzzer_a"] = n.buzzer_a;

            // Salidas Canal B
            obj["green_b"]  = n.green_b;
            obj["yellow_b"] = n.yellow_b;
            obj["red_b"]    = n.red_b;
            obj["buzzer_b"] = n.buzzer_b;

            // Respaldo 1-Wire DS18B20
            obj["enable_1wire"]   = n.enable_1wire;
            obj["temp_backup_a"]  = serialized(String(n.temp_backup_a, 1));
            obj["temp_backup_b"]  = serialized(String(n.temp_backup_b, 1));

            obj["quality_percent"] = serialized(String(n.diag.quality_percent, 1));
        }

        String res;
        serializeJson(doc, res);
        request->send(200, "application/json", res);
    });

    // POST /rest/signaling/mapping (Asociar canales de un nodo a IDs de cava)
    _server->on("/rest/signaling/mapping", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (!request->hasParam("node_id", true)) {
            request->send(400, "application/json", "{\"error\":\"Falta node_id\"}");
            return;
        }

        uint8_t nodeId = request->getParam("node_id", true)->value().toInt();
        String cavaA = request->hasParam("cava_a", true) ? request->getParam("cava_a", true)->value() : "";
        String cavaB = request->hasParam("cava_b", true) ? request->getParam("cava_b", true)->value() : "";

        if (mapSignalingChannels(nodeId, cavaA.c_str(), cavaB.c_str())) {
            saveSignalingSettings();
            syncCavaSignalingAssociations();
            request->send(200, "application/json", "{\"status\":\"ok\",\"node_id\":" + String(nodeId) + "}");
        } else {
            request->send(404, "application/json", "{\"error\":\"Nodo no encontrado\"}");
        }
    });

    // POST /rest/signaling/commission (Comisionar satélite ID 100 y asignarle nuevo ID y cavas)
    _server->on("/rest/signaling/commission", HTTP_POST, [this](AsyncWebServerRequest* request) {
        uint8_t currentId = request->hasParam("current_id", true) ? request->getParam("current_id", true)->value().toInt() : 100;
        if (!request->hasParam("new_id", true)) {
            request->send(400, "application/json", "{\"error\":\"Falta new_id\"}");
            return;
        }

        uint8_t newId = request->getParam("new_id", true)->value().toInt();
        String cavaA = request->hasParam("cava_a", true) ? request->getParam("cava_a", true)->value() : "";
        String cavaB = request->hasParam("cava_b", true) ? request->getParam("cava_b", true)->value() : "";

        if (commissionSignalingNode(currentId, newId, cavaA.c_str(), cavaB.c_str())) {
            request->send(200, "application/json", "{\"status\":\"ok\",\"message\":\"Esclavo comisionado con éxito\",\"new_id\":" + String(newId) + "}");
        } else {
            request->send(500, "application/json", "{\"error\":\"Fallo al comunicar o comisionar el esclavo por RS-485\"}");
        }
    });

    // POST /rest/signaling/test (Prueba de lámparas y control manual de relés)
    _server->on("/rest/signaling/test", HTTP_POST, [this](AsyncWebServerRequest* request) {
        if (!request->hasParam("node_id", true)) {
            request->send(400, "application/json", "{\"error\":\"Falta node_id\"}");
            return;
        }

        uint8_t nodeId = request->getParam("node_id", true)->value().toInt();
        SignalingNode* n = getSignalingNodeById(nodeId);
        if (!n) {
            request->send(404, "application/json", "{\"error\":\"Nodo no encontrado\"}");
            return;
        }

        // Cada prueba manual dura exactamente 5 segundos
        uint32_t durationSec = 5;

        String mode = request->hasParam("mode", true) ? request->getParam("mode", true)->value() : "lamp_test";

        if (mode == "lamp_test") {
            // Disparar prueba de lámparas autónoma en hardware del esclavo vía Coil 9 (5s en hardware)
            modbusEngine.queueWriteCoil(nodeId, 9, true);
        } else if (mode == "all_off" || mode == "stop_test") {
            // Cancelar prueba en el esclavo vía Coil 10 y restablecer a modo normal
            modbusEngine.queueWriteCoil(nodeId, 10, true);
        } else if (mode == "toggle_bit" && request->hasParam("bit_index", true)) {
            uint8_t bitIdx = (uint8_t)request->getParam("bit_index", true)->value().toInt();
            // Disparar pulso individual al esclavo: el esclavo arranca su cronómetro de 5s para este relé
            modbusEngine.queueWriteCoil(nodeId, bitIdx, true);
        } else if (mode == "custom" && request->hasParam("coils_byte", true)) {
            uint8_t coilsByte = (uint8_t)(request->getParam("coils_byte", true)->value().toInt() & 0xFF);
            uint16_t coilMask = (uint16_t)coilsByte;
            if (n->enable_1wire) coilMask |= (1 << 8);
            modbusEngine.queueWriteCoilsMask(nodeId, coilMask, 9);
        }

        request->send(200, "application/json", "{\"status\":\"ok\",\"node_id\":" + String(nodeId) + ",\"mode\":\"" + mode + "\",\"duration_sec\":" + String(durationSec) + "}");
    });
}

bool FridgeSettingsService::commissionSignalingNode(uint8_t currentId, uint8_t newId, const char* cavaA, const char* cavaB) {
    if (!modbusEngine.commissionSignalingSlave(currentId, newId)) {
        return false;
    }

    SignalingNode* existing = getSignalingNodeById(currentId);
    if (existing) {
        existing->modbus_id = newId;
        if (cavaA) strncpy(existing->cava_a_id, cavaA, sizeof(existing->cava_a_id) - 1);
        if (cavaB) strncpy(existing->cava_b_id, cavaB, sizeof(existing->cava_b_id) - 1);
        existing->online = true;
    } else {
        addOrUpdateSignalingNode(newId);
        mapSignalingChannels(newId, cavaA, cavaB);
    }

    saveSignalingSettings();
    syncCavaSignalingAssociations();
    modbusEngine.setSignalingNodes(_signalingNodes, _signalingNodeCount);

    return true;
}

SignalingNode* FridgeSettingsService::getSignalingNodeById(uint8_t modbus_id) {
    for (size_t i = 0; i < _signalingNodeCount; i++) {
        if (_signalingNodes[i].modbus_id == modbus_id) return &_signalingNodes[i];
    }
    return nullptr;
}

bool FridgeSettingsService::addOrUpdateSignalingNode(uint8_t modbus_id) {
    for (size_t i = 0; i < _signalingNodeCount; i++) {
        if (_signalingNodes[i].modbus_id == modbus_id) {
            _signalingNodes[i].online = true;
            return false; // Ya existía
        }
    }

    if (_signalingNodeCount >= MAX_SIGNALING_NODES) return false;

    SignalingNode& n = _signalingNodes[_signalingNodeCount];
    memset(&n, 0, sizeof(SignalingNode));
    n.modbus_id = modbus_id;
    n.online = true;

    // Asignación por defecto sugerida (ej. 100 -> C1 y C2, 102 -> C3 y C4...)
    uint8_t baseCavaNum = (modbus_id >= 100) ? ((modbus_id - 100) + 1) : 1;
    snprintf(n.cava_a_id, sizeof(n.cava_a_id), "C%u", baseCavaNum);
    snprintf(n.cava_b_id, sizeof(n.cava_b_id), "C%u", baseCavaNum + 1);

    _signalingNodeCount++;
    saveSignalingSettings();
    syncCavaSignalingAssociations();
    return true;
}

bool FridgeSettingsService::mapSignalingChannels(uint8_t modbus_id, const char* cava_a_id, const char* cava_b_id) {
    SignalingNode* n = getSignalingNodeById(modbus_id);
    if (!n) return false;

    if (cava_a_id) strncpy(n->cava_a_id, cava_a_id, sizeof(n->cava_a_id) - 1);
    if (cava_b_id) strncpy(n->cava_b_id, cava_b_id, sizeof(n->cava_b_id) - 1);
    return true;
}

bool FridgeSettingsService::loadSignalingSettings() {
    if (!_fs || !_fs->exists(SIGNALING_CONFIG_FILE)) {
        // Si no existe archivo previo, inicializar con el nodo de prueba por defecto ID 100
        addOrUpdateSignalingNode(100);
        return true;
    }

    File f = _fs->open(SIGNALING_CONFIG_FILE, "r");
    if (!f) return false;

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) return false;

    JsonArray arr = doc["nodes"];
    if (arr.isNull()) return false;

    size_t idx = 0;
    for (JsonObject obj : arr) {
        if (idx >= MAX_SIGNALING_NODES) break;
        _signalingNodes[idx].modbus_id = obj["modbus_id"] | (100 + (idx * 2));
        const char* ca = obj["cava_a"];
        const char* cb = obj["cava_b"];
        if (ca) strncpy(_signalingNodes[idx].cava_a_id, ca, sizeof(_signalingNodes[idx].cava_a_id) - 1);
        if (cb) strncpy(_signalingNodes[idx].cava_b_id, cb, sizeof(_signalingNodes[idx].cava_b_id) - 1);
        _signalingNodes[idx].online = false;
        idx++;
    }
    _signalingNodeCount = idx;
    return true;
}

bool FridgeSettingsService::saveSignalingSettings() {
    if (!_fs) return false;

    JsonDocument doc;
    JsonArray arr = doc["nodes"].to<JsonArray>();

    for (size_t i = 0; i < _signalingNodeCount; i++) {
        JsonObject obj = arr.add<JsonObject>();
        obj["modbus_id"] = _signalingNodes[i].modbus_id;
        obj["cava_a"] = _signalingNodes[i].cava_a_id;
        obj["cava_b"] = _signalingNodes[i].cava_b_id;
    }

    File f = _fs->open(SIGNALING_CONFIG_FILE, "w");
    if (!f) return false;
    serializeJson(doc, f);
    f.close();
    return true;
}

void FridgeSettingsService::syncCavaSignalingAssociations() {
    // Limpia asignaciones previas en las cavas
    for (size_t i = 0; i < _cavaCount; i++) {
        _cavas[i].signaling_node_id = 0;
        _cavas[i].signaling_channel = 0;
    }

    // Mapea según los nodos de señalización activos
    for (size_t n = 0; n < _signalingNodeCount; n++) {
        SignalingNode& node = _signalingNodes[n];
        if (strlen(node.cava_a_id) > 0) {
            CavaState* ca = getCavaById(node.cava_a_id);
            if (ca) {
                ca->signaling_node_id = node.modbus_id;
                ca->signaling_channel = 'A';
            }
        }
        if (strlen(node.cava_b_id) > 0) {
            CavaState* cb = getCavaById(node.cava_b_id);
            if (cb) {
                cb->signaling_node_id = node.modbus_id;
                cb->signaling_channel = 'B';
            }
        }
    }
}

void FridgeSettingsService::saveCavaTrends(const char* cavaId) {
    if (!_fs) return;
    CavaState* c = getCavaById(cavaId);
    if (!c || c->trends.count == 0) return;

    if (!_fs->exists("/trends")) {
        _fs->mkdir("/trends");
    }

    char path[32];
    snprintf(path, sizeof(path), "/trends/%s.ndjson", c->id);
    File f = _fs->open(path, "w");
    if (!f) return;

    TrendBuffer& tb = c->trends;
    uint16_t startIdx = (tb.count < MAX_TREND_POINTS) ? 0 : tb.head;
    bool isConservacion = (c->tipo == CAVA_CONSERVACION && !c->has_humidity);

    char line[64];
    for (uint16_t i = 0; i < tb.count; i++) {
        uint16_t idx = (startIdx + i) % MAX_TREND_POINTS;
        const TrendPoint& pt = tb.points[idx];

        if (isConservacion || pt.hr_x10 < 0) {
            snprintf(line, sizeof(line), "{\"ts\":%u,\"tp\":%.1f,\"hr\":null}\n", pt.ts, pt.temp_x10 / 10.0f);
        } else {
            snprintf(line, sizeof(line), "{\"ts\":%u,\"tp\":%.1f,\"hr\":%.1f}\n", pt.ts, pt.temp_x10 / 10.0f, pt.hr_x10 / 10.0f);
        }
        f.print(line);
    }
    f.close();
}

void FridgeSettingsService::loadCavaTrends(CavaState& cava) {
    if (!_fs) return;
    char path[32];
    snprintf(path, sizeof(path), "/trends/%s.ndjson", cava.id);
    if (!_fs->exists(path)) return;

    File f = _fs->open(path, "r");
    if (!f) return;

    cava.trends.head = 0;
    cava.trends.count = 0;

    while (f.available()) {
        String line = f.readStringUntil('\n');
        line.trim();
        if (line.length() == 0) continue;

        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, line);
        if (!err) {
            uint32_t ts = doc["ts"] | 0;
            float tp = doc["tp"] | 0.0f;
            float hr = doc["hr"] | -1.0f;
            bool hasHr = !doc["hr"].isNull();
            cava.trends.add(ts, tp, hr, hasHr);
        }
    }
    f.close();
}

void FridgeSettingsService::saveTrendsToFiles() {
    for (size_t i = 0; i < _cavaCount; i++) {
        saveCavaTrends(_cavas[i].id);
    }
}

void FridgeSettingsService::loadTrendsFromFiles() {
    for (size_t i = 0; i < _cavaCount; i++) {
        loadCavaTrends(_cavas[i]);
    }
}

