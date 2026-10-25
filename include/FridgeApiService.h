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
    void broadcastModbusTrace(const char* bus, const char* direction, const uint8_t* frame, size_t length, bool overflow);
    void cleanupClients();

private:
    AsyncWebServer* _server;
    SecurityManager* _securityManager;
    FridgeSettingsService* _settingsService;
    AsyncWebSocket _ws;
    AsyncWebSocket _traceWs;

    void registerEndpoints();
    void registerWebSocket();
    void registerTraceWebSocket();
};
