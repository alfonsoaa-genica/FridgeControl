#include <APSettingsService.h>

APSettingsService::APSettingsService(AsyncWebServer* server, FS* fs, SecurityManager* securityManager) :
    _httpEndpoint(APSettings::read, APSettings::update, this, server, AP_SETTINGS_SERVICE_PATH, securityManager),
    _fsPersistence(APSettings::read, APSettings::update, this, fs, AP_SETTINGS_FILE),
    _dnsServer(nullptr),
    _lastManaged(0),
    _reconfigureAp(false),
    _apStartTime(0),
    _apActive(false),
    _apAutoStopped(false) {
  addUpdateHandler([&](const String& originId) { reconfigureAP(); }, false);
}

void APSettingsService::begin() {
  _fsPersistence.readFromFS();
  startAP();
}

void APSettingsService::reconfigureAP() {
  _lastManaged = millis();
  _reconfigureAp = false;
  _apAutoStopped = false;
  startAP();
}

void APSettingsService::loop() {
  // Durante el escaneo Wi-Fi activo, suspender toda gestión del AP y consultas DNS
  if (WiFi.scanComplete() == -1) {
    return;
  }
  unsigned long currentMillis = millis();
  unsigned long manageElapsed = (unsigned long)(currentMillis - _lastManaged);
  if (manageElapsed >= 2000) {
    _lastManaged = currentMillis;
    manageAP();
  }
  handleDNS();
}

void APSettingsService::manageAP() {
  WiFiMode_t currentWiFiMode = WiFi.getMode();

  // Si el modo configurado es AP_MODE_NEVER, apagar y no molestar
  if (_state.provisionMode == AP_MODE_NEVER) {
    if (_apActive || (currentWiFiMode & WIFI_AP)) {
      stopAP();
      _apActive = false;
      _apAutoStopped = true;
    }
    _reconfigureAp = false;
    return;
  }

  // Si se solicitó arrancar / reconfigurar el AP
  if (_reconfigureAp) {
    _reconfigureAp = false;
    _apAutoStopped = false;
    startAP();
    return;
  }

  // Si el AP ya fue apagado automáticamente (por los 5 minutos o por conectar al router),
  // se mantiene apagado en modo sigilo hasta que se llame reconfigureAP()
  if (_apAutoStopped) {
    return;
  }

  // Si el AP aún no está activo, iniciarlo
  if (!_apActive) {
    startAP();
    return;
  }

  // --- REGLA: El AP funciona por lo menos 5 minutos, a menos que se conecte vía Wi-Fi con el router ---

  // 1. Conexión con router Wi-Fi establecida: Apagar SoftAP de inmediato
  if (_state.provisionMode != AP_MODE_ALWAYS && WiFi.status() == WL_CONNECTED) {
    Serial.println(F("[AP] Conexión Wi-Fi con router establecida. Apagando SoftAP para modo sigiloso."));
    stopAP();
    _apActive = false;
    _apAutoStopped = true;
    return;
  }

  // 2. Si un técnico o usuario está conectado al SoftAP, mantenerlo vivo mientras esté conectado
  if (WiFi.softAPgetStationNum() > 0) {
    return;
  }

  // 3. Ventana mínima de 5 minutos (300.000 ms) sin clientes ni router
  unsigned long tiempoActivoAP = millis() - _apStartTime;
  const unsigned long TIEMPO_MINIMO_AP_MS = 300000UL;

  if (_state.provisionMode != AP_MODE_ALWAYS && tiempoActivoAP >= TIEMPO_MINIMO_AP_MS) {
    Serial.println(F("[AP] Ventana de 5 minutos transcurrida sin clientes ni router. Apagando SoftAP para sigilo."));
    stopAP();
    _apActive = false;
    _apAutoStopped = true;
    return;
  } else {
    // Recordatorio periódico en consola cada 60s
    static unsigned long ultimoAviso = 0;
    if (millis() - ultimoAviso >= 60000UL) {
      ultimoAviso = millis();
      unsigned long restantes = (TIEMPO_MINIMO_AP_MS - tiempoActivoAP) / 1000;
      Serial.printf("[AP] Ventana de cortesía activa (%lu seg restantes). Esperando conexión de técnico o router...\n", restantes);
    }
  }
}

void APSettingsService::startAP() {
  Serial.println(F("Starting software access point"));
  _apStartTime = millis();
  _apActive = true;
  _apAutoStopped = false;
#ifdef ESP32
  WiFi.mode(WIFI_AP_STA);
#endif
  if (_state.localIP == IPAddress(0, 0, 0, 0)) {
    _state.localIP = IPAddress(192, 168, 30, 1);
    _state.gatewayIP = IPAddress(192, 168, 30, 1);
    _state.subnetMask = IPAddress(255, 255, 255, 0);
  }
  if (_state.channel < 1 || _state.channel > 13) {
    _state.channel = 1;
  }
  WiFi.softAPConfig(_state.localIP, _state.gatewayIP, _state.subnetMask);
  WiFi.softAP(_state.ssid.c_str(), _state.password.c_str(), _state.channel, _state.ssidHidden, _state.maxClients);
  Serial.printf("[AP] Red iniciada: SSID='%s' | IP=%s | Canal=%d\n", 
                _state.ssid.c_str(), WiFi.softAPIP().toString().c_str(), _state.channel);

  if (!_dnsServer) {
    IPAddress apIp = WiFi.softAPIP();
    _dnsServer = new DNSServer;
    _dnsServer->start(DNS_PORT, "*", apIp);
  }
}

void APSettingsService::stopAP() {
  if (_dnsServer) {
    Serial.println(F("Stopping captive portal"));
    _dnsServer->stop();
    delete _dnsServer;
    _dnsServer = nullptr;
  }
  Serial.println(F("Stopping software access point"));
  WiFi.softAPdisconnect(true);
  _apActive = false;
}

void APSettingsService::handleDNS() {
  if (_dnsServer) {
    _dnsServer->processNextRequest();
  }
}

APNetworkStatus APSettingsService::getAPNetworkStatus() {
  WiFiMode_t currentWiFiMode = WiFi.getMode();
  bool apActive = currentWiFiMode == WIFI_AP || currentWiFiMode == WIFI_AP_STA;
  if (apActive && _state.provisionMode != AP_MODE_ALWAYS && WiFi.status() == WL_CONNECTED) {
    return APNetworkStatus::LINGERING;
  }
  return apActive ? APNetworkStatus::ACTIVE : APNetworkStatus::INACTIVE;
}
