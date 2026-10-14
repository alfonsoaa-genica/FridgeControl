#include "AuditService.h"
#include <ArduinoJson.h>
#include <time.h>

AuditService* g_auditService = nullptr;

AuditService::AuditService(AsyncWebServer* server, fs::FS* fs, SecurityManager* securityManager)
    : _server(server), _fs(fs), _securityManager(securityManager) {
    g_auditService = this;
}

void AuditService::begin() {
    if (_fs) {
        if (!_fs->exists("/audit")) {
            _fs->mkdir("/audit");
        }
    }
    registerEndpoints();
}

void AuditService::logEvent(const char* user, const char* action, const char* target, const char* detail, const char* ip) {
    if (!_fs) return;

    time_t now = time(nullptr);
    if (now < 100000) {
        now = (time_t)(millis() / 1000);
    }

    // Rotación preventiva si el archivo supera los 120 KB
    if (_fs->exists(AUDIT_FILE_PATH)) {
        File checkF = _fs->open(AUDIT_FILE_PATH, "r");
        if (checkF) {
            size_t sz = checkF.size();
            checkF.close();
            if (sz > 120 * 1024) {
                // Respaldar a .old y crear nuevo
                _fs->remove("/audit/audit.old.ndjson");
                _fs->rename(AUDIT_FILE_PATH, "/audit/audit.old.ndjson");
            }
        }
    }

    File f = _fs->open(AUDIT_FILE_PATH, "a");
    if (!f) return;

    JsonDocument doc;
    doc["ts"] = (uint32_t)now;
    doc["user"] = user ? user : "admin";
    doc["action"] = action ? action : "UNKNOWN";
    doc["target"] = target ? target : "-";
    doc["detail"] = detail ? detail : "";
    doc["ip"] = ip ? ip : "-";

    serializeJson(doc, f);
    f.print("\n");
    f.close();

    Serial.printf("[AUDIT] [%s] %s -> %s: %s (IP: %s)\n", 
                  user ? user : "admin", 
                  action ? action : "", 
                  target ? target : "", 
                  detail ? detail : "",
                  ip ? ip : "");
}

void AuditService::logRequest(AsyncWebServerRequest* request, const char* action, const char* target, const char* detail) {
    String username = "admin";
    if (_securityManager) {
        Authentication auth = _securityManager->authenticateRequest(request);
        if (auth.user && auth.user->username.length() > 0) {
            username = auth.user->username;
        }
    }

    String ip = "127.0.0.1";
    if (request && request->client()) {
        ip = request->client()->remoteIP().toString();
    }

    logEvent(username.c_str(), action, target, detail, ip.c_str());
}

void AuditService::clearLogs() {
    if (_fs && _fs->exists(AUDIT_FILE_PATH)) {
        _fs->remove(AUDIT_FILE_PATH);
    }
}

void AuditService::registerEndpoints() {
    // 1. GET /rest/audit (Obtener últimos registros en orden cronológico inverso)
    _server->on("/rest/audit", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (!_fs || !_fs->exists(AUDIT_FILE_PATH)) {
            request->send(200, "application/json", "{\"events\":[]}");
            return;
        }

        File f = _fs->open(AUDIT_FILE_PATH, "r");
        if (!f) {
            request->send(200, "application/json", "{\"events\":[]}");
            return;
        }

        // Leemos hasta 150 líneas
        std::vector<String> lines;
        lines.reserve(150);
        while (f.available()) {
            String line = f.readStringUntil('\n');
            line.trim();
            if (line.length() > 0) {
                if (lines.size() >= 150) {
                    lines.erase(lines.begin());
                }
                lines.push_back(line);
            }
        }
        f.close();

        // Armamos el JSON devuelto en orden del más reciente al más antiguo
        AsyncResponseStream* response = request->beginResponseStream("application/json");
        response->print("{\"events\":[");
        bool first = true;
        for (int i = (int)lines.size() - 1; i >= 0; i--) {
            if (!first) response->print(",");
            response->print(lines[i]);
            first = false;
        }
        response->print("]}");
        request->send(response);
    });

    // 2. GET /rest/audit/download (Descarga de bitácora en NDJSON / archivo)
    _server->on("/rest/audit/download", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (!_fs || !_fs->exists(AUDIT_FILE_PATH)) {
            request->send(404, "text/plain", "No hay registros de auditoría aún");
            return;
        }
        AsyncWebServerResponse* res = request->beginResponse(*_fs, AUDIT_FILE_PATH, "application/x-ndjson", true);
        res->addHeader("Content-Disposition", "attachment; filename=\"audit_trail.ndjson\"");
        request->send(res);
    });

    // 3. POST /rest/audit/clear (Borrar bitácora - Exclusivo Admin)
    _server->on("/rest/audit/clear", HTTP_POST, [this](AsyncWebServerRequest* request) {
        bool isAdmin = false;
        if (_securityManager) {
            Authentication auth = _securityManager->authenticateRequest(request);
            isAdmin = AuthenticationPredicates::IS_ADMIN(auth);
        } else {
            isAdmin = true;
        }

        if (!isAdmin) {
            request->send(403, "application/json", "{\"error\":\"Se requiere perfil Administrador\"}");
            return;
        }

        clearLogs();
        logRequest(request, "AUDIT_CLEARED", "SYSTEM", "Bitácora de auditoría reiniciada");
        request->send(200, "application/json", "{\"status\":\"ok\"}");
    });
}
