#include <WiFiScanner.h>

WiFiScanner::WiFiScanner(AsyncWebServer* server, SecurityManager* securityManager) {
  server->on(SCAN_NETWORKS_SERVICE_PATH,
             HTTP_GET,
             securityManager->wrapRequest(std::bind(&WiFiScanner::scanNetworks, this, std::placeholders::_1),
                                          AuthenticationPredicates::IS_ADMIN));
  server->on(LIST_NETWORKS_SERVICE_PATH,
             HTTP_GET,
             securityManager->wrapRequest(std::bind(&WiFiScanner::listNetworks, this, std::placeholders::_1),
                                          AuthenticationPredicates::IS_ADMIN));
};

void WiFiScanner::scanNetworks(AsyncWebServerRequest* request) {
  // 1. Responder 202 de inmediato sobre el canal del SoftAP
  // para que el cliente reciba la confirmación TCP antes de que la radio conmute canales.
  request->send(202);

  int16_t status = WiFi.scanComplete();
  if (status == -1) {
    // Escaneo ya en curso en segundo plano
    return;
  }

#ifdef ESP32
  // 2. Deferir el inicio del escaneo 120ms en tarea FreeRTOS de un solo uso
  // para garantizar que el paquete HTTP 202 y su ACK hayan viajado por el canal del AP.
  xTaskCreate([](void* param) {
    vTaskDelay(pdMS_TO_TICKS(120));
    int16_t currentStatus = WiFi.scanComplete();
    if (currentStatus != -1) {
      WiFi.disconnect(false); // Aborta cualquier intento previo de STA sin resetear el SoftAP
      WiFi.scanDelete();
      // Escaneo rápido: 40ms por canal (~520ms total en 13 canales)
      // Mantiene las balizas del SoftAP dentro del umbral de tolerancia de clientes
      WiFi.scanNetworks(true, false, false, 40);
    }
    vTaskDelete(NULL);
  }, "wifi_scan", 4096, NULL, 1, NULL);
#elif defined(ESP8266)
  WiFi.scanDelete();
  WiFi.scanNetworks(true, false, false, 60);
#endif
}

void WiFiScanner::listNetworks(AsyncWebServerRequest* request) {
  int numNetworks = WiFi.scanComplete();
  if (numNetworks > -1) {
    AsyncJsonResponse* response = new AsyncJsonResponse(false);
    JsonObject root = response->getRoot();
    JsonArray networks = root["networks"].to<JsonArray>();
    for (int i = 0; i < numNetworks; i++) {
      JsonObject network = networks.add<JsonObject>();
      network["rssi"] = WiFi.RSSI(i);
      network["ssid"] = WiFi.SSID(i);
      network["bssid"] = WiFi.BSSIDstr(i);
      network["channel"] = WiFi.channel(i);
#ifdef ESP32
      network["encryption_type"] = (uint8_t)WiFi.encryptionType(i);
#elif defined(ESP8266)
      network["encryption_type"] = convertEncryptionType(WiFi.encryptionType(i));
#endif
    }
    response->setLength();
    request->send(response);
  } else {
    // Si numNetworks == -1 (escaneo en curso) o -2 (aún no listo), solo responder 202
    // NUNCA reiniciar el escaneo aquí para no generar un bucle infinito que ahogue al SoftAP
    request->send(202);
  }
}

#ifdef ESP8266
/*
 * Convert encryption type to standard used by ESP32 rather than the translated form which the esp8266 libaries expose.
 *
 * This allows us to use a single set of mappings in the UI.
 */
uint8_t WiFiScanner::convertEncryptionType(uint8_t encryptionType) {
  switch (encryptionType) {
    case ENC_TYPE_NONE:
      return AUTH_OPEN;
    case ENC_TYPE_WEP:
      return AUTH_WEP;
    case ENC_TYPE_TKIP:
      return AUTH_WPA_PSK;
    case ENC_TYPE_CCMP:
      return AUTH_WPA2_PSK;
    case ENC_TYPE_AUTO:
      return AUTH_WPA_WPA2_PSK;
  }
  return -1;
}
#endif
