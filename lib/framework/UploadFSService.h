#ifndef UploadFSService_h
#define UploadFSService_h

#include <Arduino.h>

#ifdef ESP32
#include <Update.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#include <ESPAsyncTCP.h>
#include <Updater.h>
#endif

#include <ESPAsyncWebServer.h>
#include <SecurityManager.h>
#include <RestartService.h>

#define UPLOAD_FS_PATH "/rest/uploadFS"

class UploadFSService {
 public:
  UploadFSService(AsyncWebServer* server, SecurityManager* securityManager);

 private:
  SecurityManager* _securityManager;
  void handleUpload(AsyncWebServerRequest* request,
                    const String& filename,
                    size_t index,
                    uint8_t* data,
                    size_t len,
                    bool final);
  void uploadComplete(AsyncWebServerRequest* request);
  void handleError(AsyncWebServerRequest* request, int code);
  static void handleEarlyDisconnect();
};

#endif  // end UploadFSService_h

