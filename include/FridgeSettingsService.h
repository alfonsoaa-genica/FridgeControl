#pragma once
#include <Arduino.h>
#include <ESPFS.h>
#include <SecurityManager.h>
#include <ESPAsyncWebServer.h>
#include "AppConfig.h"

#define MAX_CAVAS 16

class FridgeSettingsService {
public:
    FridgeSettingsService(AsyncWebServer* server, fs::FS* fs, SecurityManager* securityManager);
    void begin();
    
    CavaState* getCavas() { return _cavas; }
    size_t getCavaCount() const { return _cavaCount; }
    CavaState* getCavaById(const char* id);
    
    bool saveSettings();
    bool loadSettings();
    void initDefaultCavas();
    void initTemplateCavas(size_t count);
    bool addOrUpdateCava(const CavaState& cava);
    bool removeCava(const char* id);

    // Persistencia y Backup en LittleFS de Tendencias Históricas (NDJSON)
    void saveTrendsToFiles();
    void loadTrendsFromFiles();
    void saveCavaTrends(const char* cavaId);
    void loadCavaTrends(CavaState& cava);

    // Auto-Descubrimiento y Auto-Población Dinámica
    bool addOrUpdateDiscoveredCava(uint8_t modbus_id, const char* model, float temp, float hr);
    void clearAllCavas();

    // Gestión de Nodos de Señalización (FridgeIO)
    SignalingNode* getSignalingNodes() { return _signalingNodes; }
    size_t getSignalingNodeCount() const { return _signalingNodeCount; }
    SignalingNode* getSignalingNodeById(uint8_t modbus_id);
    bool addOrUpdateSignalingNode(uint8_t modbus_id);
    bool mapSignalingChannels(uint8_t modbus_id, const char* cava_a_id, const char* cava_b_id);
    bool commissionSignalingNode(uint8_t currentId, uint8_t newId, const char* cavaA, const char* cavaB);
    bool saveSignalingSettings();
    bool loadSignalingSettings();
    void syncCavaSignalingAssociations();

    const char* getMqttBaseTopic() const { return _mqttBaseTopic; }
    void setMqttBaseTopic(const char* baseTopic);

private:
    AsyncWebServer* _server;
    fs::FS* _fs;
    SecurityManager* _securityManager;

    char _mqttBaseTopic[64];

    CavaState _cavas[MAX_CAVAS];
    size_t _cavaCount;

    SignalingNode _signalingNodes[MAX_SIGNALING_NODES];
    size_t _signalingNodeCount;

    void registerEndpoints();
};
