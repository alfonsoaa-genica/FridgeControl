/*
  ========================================================================
  FridgeControl - Maestro Modbus RTU & Gateway IoT para Cavas Industriales
  Cliente:     Génica - Planta DALVI
  Autor:       Ing. Alfonso Aguirre
  Plataforma:  ESP32-WROOM-32D (4MB Flash, esp32doit-devkit-v1)
  Protocolo:   Modbus RTU sobre RS-485 diferencial (UART2: GPIO 16 / 17)
  Supervisión: FUXA SCADA + InfluxDB en Servidor Nexus
  Framework:   ESP8266React (AsyncWebServer, WebSocket, Security, NTP, MQTT)
  ========================================================================
*/

#include <Arduino.h>
#include <LittleFS.h>
#include <ESP8266React.h>
#include <ESPmDNS.h>
#include "AppConfig.h"
#include "FridgeSettingsService.h"
#include "FridgeApiService.h"
#include "FridgeMqttService.h"
#include "FileManagerService.h"
#include "AuditService.h"
#include "ModbusEngine.h"

// Servidor Web y Framework ESP8266React
AsyncWebServer server(80);
ESP8266React esp8266React(&server);

// Servicios de aplicación del ecosistema de cavas
FridgeSettingsService fridgeSettingsService(&server, esp8266React.getFS(), esp8266React.getSecurityManager());
FridgeApiService fridgeApiService(&server, esp8266React.getSecurityManager(), &fridgeSettingsService);
FridgeMqttService fridgeMqttService(nullptr, &fridgeSettingsService);
FileManagerService fileManagerService(&server, esp8266React.getFS(), esp8266React.getSecurityManager());
AuditService auditService(&server, esp8266React.getFS(), esp8266React.getSecurityManager());

// Control de bucles de temporización
static unsigned long ultimoBroadcastWs = 0;
static unsigned long ultimoCleanupWs = 0;
static unsigned long ultimoVolcadoTendencias = 0;

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n========================================================");
    Serial.println("  INICIANDO FRIDGECONTROL v1.0 (ESP32 / Modbus RTU)     ");
    Serial.println("       SUPERVISIÓN DE CAVAS - GÉNICA PLANTA DALVI       ");
    Serial.println("========================================================");

    // 1. Inicializar LittleFS para persistencia de configuraciones
    if (!LittleFS.begin(true)) {
        Serial.println("[MAIN] ¡Advertencia: LittleFS no montado!");
    } else {
        Serial.println("[MAIN] LittleFS montado correctamente.");
    }

    // 2. Inicializar motor Modbus RTU Master determinista
    modbusEngine.begin();
    fridgeSettingsService.begin();
    auditService.begin();

    // 3. Conectar callbacks reactivos de auto-descubrimiento en tiempo real
    modbusEngine.onSlaveDiscovered([](uint8_t id, const char* model, float temp, float hr) {
        if (strcmp(model, "FRIDGE_IO") == 0 || id >= 100) {
            Serial.printf("[AUTO-DISCOVERY] Satélite de Señalización detectado ID %u (FridgeIO)\n", id);
            fridgeSettingsService.addOrUpdateSignalingNode(id);
            modbusEngine.setSignalingNodes(fridgeSettingsService.getSignalingNodes(), fridgeSettingsService.getSignalingNodeCount());
        } else {
            Serial.printf("[AUTO-DISCOVERY] Esclavo detectado ID %u (%s) -> Temp: %.1f°C, HR: %.1f%%\n",
                          id, model, temp, hr);
            fridgeSettingsService.addOrUpdateDiscoveredCava(id, model, temp, hr);
            modbusEngine.setCavas(fridgeSettingsService.getCavas(), fridgeSettingsService.getCavaCount());
        }
    });

    modbusEngine.onScanCompleted([](size_t totalFound) {
        Serial.printf("[AUTO-DISCOVERY] Barrido finalizado. Cavas: %u, Nodos Señalización: %u. Polling activo.\n",
                      fridgeSettingsService.getCavaCount(), fridgeSettingsService.getSignalingNodeCount());
    });

    modbusEngine.setCavas(fridgeSettingsService.getCavas(), fridgeSettingsService.getCavaCount());
    modbusEngine.setSignalingNodes(fridgeSettingsService.getSignalingNodes(), fridgeSettingsService.getSignalingNodeCount());
    Serial.printf("[MODBUS] Motor RS-485 activo (%s). %u cavas, %u nodos FridgeIO registrados.\n", 
                  BOARD_NAME, fridgeSettingsService.getCavaCount(), fridgeSettingsService.getSignalingNodeCount());

    // Si no existen cavas previas en LittleFS, ejecutar barrido inicial automático
    if (fridgeSettingsService.getCavaCount() == 0) {
        Serial.println("[AUTO-SCAN] No hay cavas configuradas en almacenamiento persistente.");
        Serial.println("[AUTO-SCAN] Iniciando barrido inicial automático por la red RS-485 (IDs 1 al 16)...");
        modbusEngine.startBusScan(1, 16);
    }

    // 4. Inicializar framework Web, Seguridad, NTP, MQTT y Endpoints REST/WS
    esp8266React.begin();

#if FT_ENABLED(FT_MQTT)
    fridgeMqttService.setMqttClient(esp8266React.getMqttClient());
#endif

    fridgeApiService.begin();
    fridgeMqttService.begin();
    fileManagerService.begin();
    server.begin();
    Serial.println("[WEB] Framework ESP8266React, Administrador de Archivos y servicios activos.");

    // 5. Iniciar respondedor mDNS (http://fridgecontrol.local)
    if (MDNS.begin("fridgecontrol")) {
        MDNS.addService("http", "tcp", 80);
        Serial.println("[MDNS] Disponible en red corporativa: http://fridgecontrol.local");
    }

    Serial.println("\n========================================================");
    Serial.println("  SISTEMA OPERATIVO Y LISTO PARA SUPERVISIÓN DE CAVAS   ");
    Serial.println("========================================================\n");
}

void loop() {
    // 0. Atender tareas de red, NTP y servidor del framework
    esp8266React.loop();

    // 1. Ciclo de adquisición Modbus RTU continuo y no bloqueante
    modbusEngine.update();

    // 2. Telemetría MQTT hacia Nexus / FUXA / InfluxDB
    fridgeMqttService.loop();

    // 3. Transmisión periódica WebSocket en tiempo real hacia móviles de 6" (cada 1s)
    unsigned long ahora = millis();
    if (ahora - ultimoBroadcastWs >= 1000) {
        ultimoBroadcastWs = ahora;
        fridgeApiService.broadcastCavasState();
    }

    // 4. Limpieza de clientes WebSocket inactivos
    if (ahora - ultimoCleanupWs >= 5000) {
        ultimoCleanupWs = ahora;
        fridgeApiService.cleanupClients();
    }

    // 5. Volcado por lotes de tendencias a LittleFS cada hora (3600000 ms)
    if (ahora - ultimoVolcadoTendencias >= 3600000) {
        ultimoVolcadoTendencias = ahora;
        fridgeSettingsService.saveTrendsToFiles();
    }
}
