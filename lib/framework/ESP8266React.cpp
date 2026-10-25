#include <ESP8266React.h>

ESP8266React::ESP8266React(AsyncWebServer* server) :
    _featureService(server),
    _securitySettingsService(server, &ESPFS),
    _wifiSettingsService(server, &ESPFS, &_securitySettingsService),
    _wifiScanner(server, &_securitySettingsService),
    _wifiStatus(server, &_securitySettingsService),
    _apSettingsService(server, &ESPFS, &_securitySettingsService),
    _apStatus(server, &_securitySettingsService, &_apSettingsService),
#if FT_ENABLED(FT_NTP)
    _ntpSettingsService(server, &ESPFS, &_securitySettingsService),
    _ntpStatus(server, &_securitySettingsService),
#endif
#if FT_ENABLED(FT_OTA)
    _otaSettingsService(server, &ESPFS, &_securitySettingsService),
#endif
#if FT_ENABLED(FT_UPLOAD_FIRMWARE)
    _uploadFirmwareService(server, &_securitySettingsService),
#endif
#if FT_ENABLED(FT_UPLOAD_FS)
    _uploadFSService(server, &_securitySettingsService),
#endif
#if FT_ENABLED(FT_MQTT)
    _mqttSettingsService(server, &ESPFS, &_securitySettingsService),
    _mqttStatus(server, &_mqttSettingsService, &_securitySettingsService),
#endif
#if FT_ENABLED(FT_SECURITY)
    _authenticationService(server, &_securitySettingsService),
#endif
    _restartService(server, &_securitySettingsService),
    _factoryResetService(server, &ESPFS, &_securitySettingsService),
    _systemStatus(server, &_securitySettingsService) {
#ifdef PROGMEM_WWW
  // Serve static resources from PROGMEM
  WWWData::registerRoutes(
      [server, this](const String& uri, const String& contentType, const uint8_t* content, size_t len) {
        const bool isIndex = uri.equals("/index.html");
        ArRequestHandlerFunction requestHandler = [contentType, content, len, isIndex](AsyncWebServerRequest* request) {
          AsyncWebServerResponse* response = request->beginResponse(200, contentType, content, len);
          response->addHeader("Content-Encoding", "gzip");
          if (isIndex) {
            response->addHeader("Cache-Control", "no-store, no-cache, must-revalidate");
            response->addHeader("Pragma", "no-cache");
            response->addHeader("Expires", "0");
          }
          request->send(response);
        };
        server->on(uri.c_str(), HTTP_GET, requestHandler);
        // Serving root and non-matching GET requests with "/index.html" (SPA)
        if (uri.equals("/index.html")) {
          server->on("/", HTTP_GET, requestHandler);
          server->onNotFound([requestHandler](AsyncWebServerRequest* request) {
            if (request->method() == HTTP_OPTIONS) {
              request->send(200);
              return;
            }
            if (request->header("Upgrade").equalsIgnoreCase("websocket")) {
              return;
            }
            String url = request->url();
            if (url.indexOf("204") >= 0) {
              request->send(204);
              return;
            }
            if (url.indexOf("hotspot") >= 0 || url.indexOf("connecttest") >= 0 || url.indexOf("ncsi") >= 0) {
              request->send(200, "text/plain", "OK");
              return;
            }
            if (request->method() == HTTP_GET && !url.startsWith("/api") && !url.startsWith("/rest")) {
              requestHandler(request);
              return;
            }
            request->send(404, "application/json", "{\"error\":\"Endpoint no encontrado\"}");
          });
        }
      });
#else
  // Serve static resources from LittleFS (/www/)
  server->serveStatic("/js/", ESPFS, "/www/js/");
  server->serveStatic("/css/", ESPFS, "/www/css/");
  server->serveStatic("/fonts/", ESPFS, "/www/fonts/");
  server->serveStatic("/app/", ESPFS, "/www/app/");
  server->serveStatic("/assets/", ESPFS, "/www/assets/");
  server->serveStatic("/favicon.ico", ESPFS, "/www/favicon.ico");
  server->serveStatic("/", ESPFS, "/www/").setDefaultFile("index.html");

  // Serving all other GET requests with "/www/index.html" (SPA)
  // OPTIONS get a straight up 200 response
  server->onNotFound([](AsyncWebServerRequest* request) {
    if (request->method() == HTTP_OPTIONS) {
      request->send(200);
      return;
    }
    if (request->header("Upgrade").equalsIgnoreCase("websocket")) {
      return;
    }
    String url = request->url();
    if (url.indexOf("204") >= 0) {
      request->send(204);
      return;
    }
    if (url.indexOf("hotspot") >= 0 || url.indexOf("connecttest") >= 0 || url.indexOf("ncsi") >= 0) {
      request->send(200, "text/plain", "OK");
      return;
    }
    if (request->method() == HTTP_GET && !url.startsWith("/api") && !url.startsWith("/rest")) {
      request->send(ESPFS, "/www/index.html");
      return;
    }
    request->send(404, "application/json", "{\"error\":\"Endpoint no encontrado\"}");
  });
#endif

  // Handlers universales para validación de conectividad Wi-Fi (Android, iOS, Windows)
  server->on("/generate_204", HTTP_ANY, [](AsyncWebServerRequest* request) { request->send(204); });
  server->on("/gen_204", HTTP_ANY, [](AsyncWebServerRequest* request) { request->send(204); });
  server->on("/hotspot-detect.html", HTTP_ANY, [](AsyncWebServerRequest* request) { request->send(200, "text/plain", "OK"); });
  server->on("/canonical.html", HTTP_ANY, [](AsyncWebServerRequest* request) { request->send(200, "text/plain", "OK"); });
  server->on("/ncsi.txt", HTTP_ANY, [](AsyncWebServerRequest* request) { request->send(200, "text/plain", "Microsoft NCSI"); });
  server->on("/connecttest.txt", HTTP_ANY, [](AsyncWebServerRequest* request) { request->send(200, "text/plain", "Microsoft Connect Test"); });
  server->on("/redirect", HTTP_ANY, [](AsyncWebServerRequest* request) { request->redirect("/"); });

  // Habilitar CORS por defecto para permitir consumo desde apps y paneles externos
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Accept, Content-Type, Authorization");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
}

void ESP8266React::begin() {
#ifdef ESP32
  ESPFS.begin(true);
#elif defined(ESP8266)
  ESPFS.begin();
#endif
  _wifiSettingsService.begin();
  _apSettingsService.begin();
#if FT_ENABLED(FT_NTP)
  _ntpSettingsService.begin();
#endif
#if FT_ENABLED(FT_OTA)
  _otaSettingsService.begin();
#endif
#if FT_ENABLED(FT_MQTT)
  _mqttSettingsService.begin();
#endif
#if FT_ENABLED(FT_SECURITY)
  _securitySettingsService.begin();
#endif
}

void ESP8266React::loop() {
  _wifiSettingsService.loop();
  _apSettingsService.loop();
#if FT_ENABLED(FT_OTA)
  _otaSettingsService.loop();
#endif
#if FT_ENABLED(FT_MQTT)
  _mqttSettingsService.loop();
#endif
}
