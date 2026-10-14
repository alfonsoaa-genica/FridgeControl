#include <UploadFSService.h>

UploadFSService::UploadFSService(AsyncWebServer* server, SecurityManager* securityManager) :
    _securityManager(securityManager) {
  server->on(UPLOAD_FS_PATH,
             HTTP_POST,
             std::bind(&UploadFSService::uploadComplete, this, std::placeholders::_1),
             std::bind(&UploadFSService::handleUpload,
                       this,
                       std::placeholders::_1,
                       std::placeholders::_2,
                       std::placeholders::_3,
                       std::placeholders::_4,
                       std::placeholders::_5,
                       std::placeholders::_6));
#ifdef ESP8266
  Update.runAsync(true);
#endif
}

void UploadFSService::handleUpload(AsyncWebServerRequest* request,
                                    const String& filename,
                                    size_t index,
                                    uint8_t* data,
                                    size_t len,
                                    bool final) {
  if (!index) {
    Authentication authentication = _securityManager->authenticateRequest(request);
    if (AuthenticationPredicates::IS_ADMIN(authentication)) {
      Serial.println(F("[UPLOAD-FS] Iniciando flasheo de imagen LittleFS..."));
#ifdef ESP32
      int cmd = U_SPIFFS;
      size_t maxSpace = UPDATE_SIZE_UNKNOWN;
#elif defined(ESP8266)
      int cmd = U_FS;
      size_t maxSpace = request->contentLength() > 0 ? request->contentLength() : 0xFFFFFFFF;
#endif
      if (Update.begin(maxSpace, cmd)) {
        request->onDisconnect(UploadFSService::handleEarlyDisconnect);
      } else {
        Update.printError(Serial);
        handleError(request, 500);
      }
    } else {
      handleError(request, 403);
    }
  }

  if (!request->_tempObject) {
    if (Update.write(data, len) != len) {
      Update.printError(Serial);
      handleError(request, 500);
    }
    if (final) {
      if (!Update.end(true)) {
        Update.printError(Serial);
        handleError(request, 500);
      }
    }
  }
}

void UploadFSService::uploadComplete(AsyncWebServerRequest* request) {
  if (!request->_tempObject) {
    Serial.println(F("[UPLOAD-FS] Imagen LittleFS flasheada con éxito. Reiniciando dispositivo..."));
    request->onDisconnect(RestartService::restartNow);
    AsyncWebServerResponse* response = request->beginResponse(200);
    request->send(response);
  }
}

void UploadFSService::handleError(AsyncWebServerRequest* request, int code) {
  if (request->_tempObject) {
    return;
  }
  request->_tempObject = new int(code);
  AsyncWebServerResponse* response = request->beginResponse(code);
  request->send(response);
}

void UploadFSService::handleEarlyDisconnect() {
#ifdef ESP32
  Update.abort();
#elif defined(ESP8266)
  Update.end();
#endif
  Serial.println(F("[UPLOAD-FS] Abortado por desconexión temprana."));
}

