#include "FridgeMqttService.h"
#include <ArduinoJson.h>
#include <time.h>
#include <esp_log.h>

static const char* TAG = "FridgeMqttService";

FridgeMqttService::FridgeMqttService(espMqttClient* mqttClient, FridgeSettingsService* settingsService)
    : _mqttClient(mqttClient), _settingsService(settingsService), _lastPublishMs(0) {
}

void FridgeMqttService::begin() {
    if (!_mqttClient) return;

    _mqttClient->onMessage([this](const espMqttClientTypes::MessageProperties& properties, 
                                  const char* topic, const uint8_t* payload, 
                                  size_t len, size_t index, size_t total) {
        this->onMqttMessage(properties, topic, payload, len, index, total);
    });

    _mqttClient->onConnect([this](bool sessionPresent) {
        ESP_LOGI(TAG, "Conectado al broker MQTT. Suscribiendo a tópicos derivados de control...");
        const char* base = _settingsService ? _settingsService->getMqttBaseTopic() : "genica/dalvi/cavas";
        char subSetpoint[128];
        char subNodeCmd[128];
        snprintf(subSetpoint, sizeof(subSetpoint), "%s/cavas/+/cmd/setpoint", base);
        snprintf(subNodeCmd, sizeof(subNodeCmd), "%s/nodos/+/cmd", base);
        _mqttClient->subscribe(subSetpoint, 1);
        _mqttClient->subscribe(subNodeCmd, 1);

        // Publicar estado LWT en línea
        char lwtTopic[128];
        snprintf(lwtTopic, sizeof(lwtTopic), "%s/maestro/status", base);
        _mqttClient->publish(lwtTopic, 1, true, "online");
    });
}

void FridgeMqttService::loop() {
    if (!_mqttClient || !_mqttClient->connected()) return;

    unsigned long ahora = millis();
    if (ahora - _lastPublishMs >= 3000) { // Publicación periódica cada 3 segundos
        _lastPublishMs = ahora;
        publishAllTelemetry();
    }
}

void FridgeMqttService::publishAllTelemetry() {
    if (!_settingsService) return;

    // 1. Telemetría de Cavas
    size_t count = _settingsService->getCavaCount();
    for (size_t i = 0; i < count; i++) {
        CavaState* c = _settingsService->getCavaById(_settingsService->getCavas()[i].id);
        if (c) publishTelemetry(*c);
    }

    // 2. Telemetría de Nodos Satélites FridgeIO
    size_t nodeCount = _settingsService->getSignalingNodeCount();
    for (size_t i = 0; i < nodeCount; i++) {
        publishNodeTelemetry(_settingsService->getSignalingNodes()[i]);
    }

    // 3. Telemetría del Maestro
    publishMasterTelemetry();
}

void FridgeMqttService::publishTelemetry(const CavaState& cava) {
    if (!_mqttClient || !_mqttClient->connected()) return;

    const char* base = _settingsService ? _settingsService->getMqttBaseTopic() : "genica/dalvi/cavas";
    char topic[128];
    snprintf(topic, sizeof(topic), "%s/cavas/%s/telemetria", base, cava.id);

    JsonDocument doc;
    doc["cava"] = cava.id;
    doc["descripcion"] = cava.descripcion;
    doc["tipo"] = (cava.tipo == CAVA_CONSERVACION) ? "conservacion" : "maduracion";
    doc["temp_pv"] = serialized(String(cava.temp_pv, 1));
    doc["temp_sp"] = serialized(String(cava.temp_sp, 1));
    doc["temp_evap"] = serialized(String(cava.temp_evap, 1));

    if (cava.has_humidity) {
        doc["hr_pv"] = serialized(String(cava.hr_pv, 1));
        doc["hr_sp"] = serialized(String(cava.hr_sp, 1));
        doc["has_humidity"] = true;
    } else {
        doc["hr_pv"] = nullptr;
        doc["hr_sp"] = nullptr;
        doc["has_humidity"] = false;
    }

    doc["cooling"] = cava.cooling_active ? 1 : 0;
    doc["fan"] = cava.fan_active ? 1 : 0;
    doc["defrost"] = cava.defrost_active ? 1 : 0;
    doc["heating"] = cava.heating_active ? 1 : 0;
    doc["humidifier"] = cava.humid_active ? 1 : 0;
    doc["exhaust"] = cava.exhaust_active ? 1 : 0;

    doc["door_closed"] = cava.door_closed;
    doc["kide_alarm"] = cava.kide_hw_alarm_contact;
    doc["alarm_temp_high"] = cava.alarm_temp_high ? 1 : 0;
    doc["alarm_hr_low"]    = cava.alarm_hr_low ? 1 : 0;
    doc["alarm_hr_high"]   = cava.alarm_hr_high ? 1 : 0;
    doc["alarm_active"]    = cava.alarm_active ? 1 : 0;

    doc["comm_status"] = cava.comm_online ? "ONLINE" : "FAULT";
    doc["comm_ok"] = cava.comm_online ? 1 : 0;
    doc["rtt_ms"] = cava.diag.last_rtt_ms;
    doc["quality_pct"] = serialized(String(cava.diag.quality_percent, 1));

    time_t now = time(nullptr);
    doc["ts"] = (uint32_t)now;

    char timeStr[32];
    struct tm timeinfo;
    if (localtime_r(&now, &timeinfo)) {
        strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
        doc["datetime"] = timeStr;
    }

    char buffer[512];
    serializeJson(doc, buffer, sizeof(buffer));
    _mqttClient->publish(topic, 0, false, buffer);
}

void FridgeMqttService::publishNodeTelemetry(const SignalingNode& node) {
    if (!_mqttClient || !_mqttClient->connected()) return;

    const char* base = _settingsService ? _settingsService->getMqttBaseTopic() : "genica/dalvi/cavas";
    char topic[128];
    snprintf(topic, sizeof(topic), "%s/nodos/%u/telemetria", base, node.modbus_id);

    JsonDocument doc;
    doc["node_id"] = node.modbus_id;
    doc["online"] = node.online;
    doc["calidad_pct"] = serialized(String(node.diag.quality_percent, 1));
    doc["rtt_ms"] = node.diag.last_rtt_ms;
    doc["cava_a"] = node.cava_a_id;
    doc["cava_b"] = node.cava_b_id;

    JsonObject in = doc["entradas"].to<JsonObject>();
    in["puerta_a"] = node.door_closed_a;
    in["ack_a"] = node.ack_pressed_a;
    in["kide_alarm_a"] = node.kide_alarm_a;
    in["puerta_b"] = node.door_closed_b;
    in["ack_b"] = node.ack_pressed_b;
    in["kide_alarm_b"] = node.kide_alarm_b;

    JsonObject out = doc["reles"].to<JsonObject>();
    out["rele_1_verde_a"] = node.green_a;
    out["rele_2_amarillo_a"] = node.yellow_a;
    out["rele_3_rojo_a"] = node.red_a;
    out["rele_4_sirena_a"] = node.buzzer_a;
    out["rele_5_verde_b"] = node.green_b;
    out["rele_6_amarillo_b"] = node.yellow_b;
    out["rele_7_rojo_b"] = node.red_b;
    out["rele_8_sirena_b"] = node.buzzer_b;

    if (node.enable_1wire) {
        doc["temp_backup_a"] = serialized(String(node.temp_backup_a, 1));
        doc["temp_backup_b"] = serialized(String(node.temp_backup_b, 1));
    }

    doc["ts"] = (uint32_t)time(nullptr);

    char buffer[512];
    serializeJson(doc, buffer, sizeof(buffer));
    _mqttClient->publish(topic, 0, false, buffer);
}

void FridgeMqttService::publishMasterTelemetry() {
    if (!_mqttClient || !_mqttClient->connected()) return;

    const char* base = _settingsService ? _settingsService->getMqttBaseTopic() : "genica/dalvi/cavas";
    char topic[128];
    snprintf(topic, sizeof(topic), "%s/maestro/telemetria", base);

    JsonDocument doc;
    doc["dispositivo"] = "FridgeControl ESP32-S3 Master";
    doc["uptime_sec"] = millis() / 1000;
    doc["heap_free"] = esp_get_free_heap_size();
    doc["cavas_totales"] = _settingsService ? _settingsService->getCavaCount() : 0;
    doc["nodos_totales"] = _settingsService ? _settingsService->getSignalingNodeCount() : 0;

    char buffer[256];
    serializeJson(doc, buffer, sizeof(buffer));
    _mqttClient->publish(topic, 0, false, buffer);
}

void FridgeMqttService::onMqttMessage(const espMqttClientTypes::MessageProperties& properties, 
                                     const char* topic, const uint8_t* payload, 
                                     size_t len, size_t index, size_t total) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload, len);
    if (err) return;

    const char* targetCava = doc["cava"] | doc["target"];
    if (!targetCava) return;

    if (!doc["temp_sp"].isNull()) {
        float sp = doc["temp_sp"];
        modbusEngine.queueWriteSetpointTemp(targetCava, sp);
        ESP_LOGI(TAG, "Setpoint Temp recibido vía MQTT para %s: %.1f °C", targetCava, sp);
    } else if (doc["variable"] == "temp" && !doc["value"].isNull()) {
        float sp = doc["value"];
        modbusEngine.queueWriteSetpointTemp(targetCava, sp);
        ESP_LOGI(TAG, "Setpoint Temp recibido vía MQTT para %s: %.1f °C", targetCava, sp);
    }

    if (!doc["hr_sp"].isNull()) {
        float sp = doc["hr_sp"];
        modbusEngine.queueWriteSetpointHR(targetCava, sp);
        ESP_LOGI(TAG, "Setpoint HR recibido vía MQTT para %s: %.1f %%", targetCava, sp);
    } else if (doc["variable"] == "hr" && !doc["value"].isNull()) {
        float sp = doc["value"];
        modbusEngine.queueWriteSetpointHR(targetCava, sp);
        ESP_LOGI(TAG, "Setpoint HR recibido vía MQTT para %s: %.1f %%", targetCava, sp);
    }
}
