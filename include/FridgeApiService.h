#pragma once

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <SecurityManager.h>
#include "FridgeSettingsService.h"
#include "ModbusEngine.h"

class FridgeApiService {
public:
    FridgeApiService(AsyncWebServer* server, SecurityManager* securityManager, FridgeSettingsService* settingsService);
    void begin();

    AsyncWebSocket* getWebSocket() { return &_ws; }
    size_t getWsClientCount() const { return _ws.count(); }
    void broadcastCavasState();
    void cleanupClients();

private:
    AsyncWebServer* _server;
    SecurityManager* _securityManager;
    FridgeSettingsService* _settingsService;
    AsyncWebSocket _ws;

    void registerEndpoints();
    void registerWebSocket();
};
