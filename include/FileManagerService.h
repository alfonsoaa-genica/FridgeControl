#pragma once
#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <FS.h>
#include <SecurityManager.h>

class FileManagerService {
public:
    FileManagerService(AsyncWebServer* server, fs::FS* fs, SecurityManager* securityManager);
    void begin();

private:
    AsyncWebServer* _server;
    fs::FS* _fs;
    SecurityManager* _securityManager;

    void registerEndpoints();
    void appendDirFiles(const char* dirPath, String& json, bool& isFirst);
};
