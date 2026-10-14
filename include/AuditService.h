#pragma once
#include <Arduino.h>
#include <ESPFS.h>
#include <SecurityManager.h>
#include <ESPAsyncWebServer.h>

#define AUDIT_FILE_PATH "/audit/audit.ndjson"
#define MAX_AUDIT_MEMORY_ENTRIES 50

struct AuditRecord {
    uint32_t ts;
    char user[32];
    char action[32];
    char target[16];
    char detail[96];
    char ip[24];
};

class AuditService {
public:
    AuditService(AsyncWebServer* server, fs::FS* fs, SecurityManager* securityManager);
    void begin();

    // Registrar evento de auditoría
    void logEvent(const char* user, const char* action, const char* target, const char* detail, const char* ip);
    
    // Helper desde petición HTTP
    void logRequest(AsyncWebServerRequest* request, const char* action, const char* target, const char* detail);

    void clearLogs();

private:
    AsyncWebServer* _server;
    fs::FS* _fs;
    SecurityManager* _securityManager;

    void registerEndpoints();
};

extern AuditService* g_auditService;
