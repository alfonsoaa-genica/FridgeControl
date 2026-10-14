#include "FileManagerService.h"
#include <ArduinoJson.h>
#include <LittleFS.h>

static void scanGenericDir(fs::FS &fsSystem, const String& path, JsonArray& array, const String& storageTag) {
    File dir = fsSystem.open(path);
    if (!dir || !dir.isDirectory()) return;

    File file = dir.openNextFile();
    while (file) {
        String fname = file.name();
        String fullPath = fname;
        if (!fullPath.startsWith("/")) {
            fullPath = (path == "/" ? "" : path) + "/" + fname;
        }

        if (file.isDirectory()) {
            // Omitir recursos web internos
            if (fullPath.startsWith("/www")) {
                file.close();
                file = dir.openNextFile();
                continue;
            }
            scanGenericDir(fsSystem, fullPath, array, storageTag);
        } else {
            // Filtrar archivos .gz temporales
            if (fullPath.endsWith(".gz") || fullPath.startsWith("/www")) {
                file.close();
                file = dir.openNextFile();
                continue;
            }

            JsonObject item = array.add<JsonObject>();
            item["name"] = fullPath;
            item["size"] = (uint32_t)file.size();
            item["storage"] = storageTag;
        }
        file.close();
        file = dir.openNextFile();
    }
    dir.close();
}

FileManagerService::FileManagerService(AsyncWebServer* server, fs::FS* fs, SecurityManager* securityManager)
    : _server(server), _fs(fs), _securityManager(securityManager) {
}

void FileManagerService::begin() {
    registerEndpoints();
}

void FileManagerService::registerEndpoints() {
    // 1. GET /api/files/list (?storage=all|littlefs|sd)
    _server->on("/api/files/list", HTTP_GET, [this](AsyncWebServerRequest* request) {
        JsonDocument doc;
        JsonArray array = doc.to<JsonArray>();

        String storageParam = "littlefs";
        if (request->hasParam("storage")) {
            storageParam = request->getParam("storage")->value();
            storageParam.toLowerCase();
        }

        if (storageParam == "all" || storageParam == "littlefs") {
            if (_fs) {
                scanGenericDir(*_fs, "/", array, "littlefs");

                // Verificar explícitamente si /trends o /config existen y no quedaron indexados
                bool trendsIncluded = false;
                bool configIncluded = false;
                for (JsonObject item : array) {
                    String n = item["name"].as<String>();
                    if (n.startsWith("/trends")) trendsIncluded = true;
                    if (n.startsWith("/config")) configIncluded = true;
                }
                if (!trendsIncluded && _fs->exists("/trends")) {
                    scanGenericDir(*_fs, "/trends", array, "littlefs");
                }
                if (!configIncluded && _fs->exists("/config")) {
                    scanGenericDir(*_fs, "/config", array, "littlefs");
                }
            }
        }

        // Si consultan SD, retornar vacío en placas sin MicroSD conectada
        if (storageParam == "sd") {
            // array permanece vacío
        }

        String res;
        serializeJson(doc, res);
        request->send(200, "application/json", res);
    });

    // 2. GET /api/files/download (?name=...)
    _server->on("/api/files/download", HTTP_GET, [this](AsyncWebServerRequest* request) {
        if (!request->hasParam("name")) {
            request->send(400, "text/plain", "Falta parámetro 'name'");
            return;
        }
        String path = request->getParam("name")->value();
        if (!path.startsWith("/")) path = "/" + path;

        if (_fs && _fs->exists(path)) {
            request->send(*_fs, path, "application/octet-stream", true);
            return;
        }

        request->send(404, "text/plain", "Archivo no encontrado");
    });

    // 3. DELETE /api/files/delete (?name=...)
    _server->on("/api/files/delete", HTTP_DELETE, [this](AsyncWebServerRequest* request) {
        if (!request->hasParam("name")) {
            request->send(400, "application/json", "{\"error\":\"Falta parámetro 'name'\"}");
            return;
        }
        String path = request->getParam("name")->value();
        if (!path.startsWith("/")) path = "/" + path;

        if (_fs && _fs->exists(path)) {
            if (_fs->remove(path)) {
                request->send(200, "application/json", "{\"status\":\"ok\"}");
            } else {
                request->send(500, "application/json", "{\"error\":\"No se pudo borrar el archivo en LittleFS\"}");
            }
            return;
        }

        request->send(404, "application/json", "{\"error\":\"Archivo no encontrado\"}");
    });

    // 4. POST /api/files/upload
    _server->on("/api/files/upload", HTTP_POST, 
        [](AsyncWebServerRequest* request) {
            request->send(200, "application/json", "{\"status\":\"ok\"}");
        },
        [this](AsyncWebServerRequest* request, String filename, size_t index, uint8_t *data, size_t len, bool final) {
            static File uploadFile;
            if (index == 0) {
                String path = filename;
                if (!path.startsWith("/")) path = "/" + path;
                if (_fs) uploadFile = _fs->open(path, FILE_WRITE);
            }
            if (uploadFile && len > 0) {
                uploadFile.write(data, len);
            }
            if (final) {
                if (uploadFile) uploadFile.close();
            }
        }
    );

    // 5. GET /api/files/sd/status
    _server->on("/api/files/sd/status", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        doc["present"] = false;
        doc["mounted"] = false;
        doc["capacity_ok"] = false;
        doc["card_type"] = "NONE";
        doc["status"] = "No Detectada";
        doc["total_bytes"] = 0;
        doc["used_bytes"] = 0;
        doc["total_mb"] = 0.0f;
        doc["used_mb"] = 0.0f;

        String res;
        serializeJson(doc, res);
        request->send(200, "application/json", res);
    });

    // 6. POST /api/files/sd/format y mount
    _server->on("/api/files/sd/format", HTTP_POST, [](AsyncWebServerRequest* request) {
        request->send(200, "application/json", "{\"status\":\"error\",\"message\":\"MicroSD no instalada\"}");
    });
    _server->on("/api/files/sd/mount", HTTP_POST, [](AsyncWebServerRequest* request) {
        request->send(200, "application/json", "{\"status\":\"error\",\"mounted\":false,\"card_status\":\"No Detectada\"}");
    });
}
