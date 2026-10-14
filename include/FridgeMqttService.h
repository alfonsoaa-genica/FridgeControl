#pragma once

#include <Arduino.h>
#include <espMqttClient.h>
#include "AppConfig.h"
#include "ModbusEngine.h"
#include "FridgeSettingsService.h"

class FridgeMqttService {
public:
    FridgeMqttService(espMqttClient* mqttClient, FridgeSettingsService* settingsService);
    void begin();
    void loop();

    void setMqttClient(espMqttClient* client) { _mqttClient = client; }

    void publishTelemetry(const CavaState& cava);
    void publishNodeTelemetry(const SignalingNode& node);
    void publishMasterTelemetry();
    void publishAllTelemetry();

private:
    espMqttClient* _mqttClient;
    FridgeSettingsService* _settingsService;
    unsigned long _lastPublishMs;

    void onMqttMessage(const espMqttClientTypes::MessageProperties& properties, 
                       const char* topic, const uint8_t* payload, 
                       size_t len, size_t index, size_t total);
};
