#include <Arduino.h>
#include <Preferences.h>
#include <ModbusRTUSlave.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "Config.h"

// ============================================================================
// Proyecto: FridgeIO - Satélite Industrial Modbus RTU
// Gestión Administrativa 100% Remota sobre Bus RS-485
// Hardware: eletechsup ES32D26 / ES32A08
// Autor:    Ing. Alfonso Aguirre
// ============================================================================

Preferences prefs;

// Instancia del bus 1-Wire y sensor Dallas DS18B20 en GPIO 4
OneWire oneWire(PIN_ONEWIRE);
DallasTemperature sensors(&oneWire);
bool activeEnable1Wire = false;
unsigned long last1WireCycleTime = 0;
unsigned long last1WireConversionTime = 0;
bool conversionInProgress = false;

// Variables de Temporizador Autónomo No Bloqueante en Hardware
uint32_t lampTestEndTime = 0;
bool lampTestActive = false;
uint32_t relayPulseEndTime[8] = {0};
bool lastCoilsState[8] = {false};

// Vectores Modbus
bool coils[16] = {false};            // 0..7: Relés físicos | 8: 1-Wire | 9: Start Test | 10: Stop Test
bool discreteInputs[8] = {false};    // 8 Entradas digitales (Switches, ACK, Alarmas Kide)
uint16_t holdingRegisters[8] = {0};  // Parámetros administrativos (ID, Baudrate, Timeout)
uint16_t inputRegisters[8] = {0};    // Registros de diagnóstico (Uptime, Polls, Latencia, Temp Respaldo A/B)

// Instancia del esclavo Modbus RTU sobre Serial (UART0) con pin DE en GPIO 21
ModbusRTUSlave modbus(Serial, PIN_RS485_DE);

// Variables administrativas activas
uint8_t activeSlaveId = DEFAULT_SLAVE_ID;
uint32_t activeBaudrate = DEFAULT_BAUDRATE;
uint16_t activeTimeoutSec = 15;

// Variables de diagnóstico y watchdog
uint32_t totalPollCount = 0;
uint32_t lastMasterPollTime = 0;
bool commWatchdogTripped = false;

// Variables de debounce para entradas digitales (10 ms)
static uint8_t lastRawInputs = 0xFF;
static uint32_t lastDebounceTime = 0;
const uint32_t DEBOUNCE_DELAY_MS = 15;

// Heartbeat LED (GPIO 2)
bool heartbeatState = false;
unsigned long lastHeartbeatTime = 0;
const unsigned long HEARTBEAT_INTERVAL_MS = 500;

// ============================================================================
// FUNCIONES DE HARDWARE: REGISTROS DE DESPLAZAMIENTO
// ============================================================================

// Escribe un byte en el registro 74HC595 para accionar los 8 relés físicos
void writeRelays(uint8_t relayStateByte) {
    digitalWrite(PIN_RCLK_595, LOW);
    shiftOut(PIN_SER_595, PIN_SRCLK_595, MSBFIRST, relayStateByte);
    digitalWrite(PIN_RCLK_595, HIGH);
}

// Lee un byte del registro 74HC165 de las 8 entradas optoacopladas NPN
uint8_t readDigitalInputsRaw() {
    uint8_t value = 0;

    digitalWrite(PIN_CLK_165, LOW);
    delayMicroseconds(1);

    // Pulso de carga paralela
    digitalWrite(PIN_SH_165, LOW);
    delayMicroseconds(5);
    digitalWrite(PIN_SH_165, HIGH);

    for (int i = 0; i < 8; ++i) {
        if (digitalRead(PIN_QH_165)) {
            value |= (1 << (7 - i)); // MSB primero
        }
        digitalWrite(PIN_CLK_165, HIGH);
        delayMicroseconds(1);
        digitalWrite(PIN_CLK_165, LOW);
        delayMicroseconds(1);
    }

    // Restaura estado del LED Heartbeat en GPIO 2 (compartido con PIN_CLK_165)
    digitalWrite(PIN_CLK_165, heartbeatState);

    return value;
}

// ============================================================================
// GESTIÓN ADMINISTRATIVA PERSISTENTE (NVS / EEPROM)
// ============================================================================

void loadConfigFromNVS() {
    bool opened = prefs.begin("fridgeio", false); // false = read/write para inicializar namespace si no existe
    if (opened) {
        activeSlaveId = prefs.getUChar("slave_id", DEFAULT_SLAVE_ID);
        uint8_t bCode = prefs.getUChar("baud_code", 0);
        activeTimeoutSec = prefs.getUShort("timeout_sec", 15);
        activeEnable1Wire = prefs.getBool("en_1wire", false);
        prefs.end();

        if (activeSlaveId < 1 || activeSlaveId > 247) activeSlaveId = DEFAULT_SLAVE_ID;
        if (bCode == 1) activeBaudrate = 19200;
        else if (bCode == 2) activeBaudrate = 38400;
        else activeBaudrate = 9600;
    } else {
        activeSlaveId = DEFAULT_SLAVE_ID;
        activeBaudrate = DEFAULT_BAUDRATE;
        activeTimeoutSec = 15;
        activeEnable1Wire = false;
    }

    // Inicializar estado del Coil Virtual 1-Wire (Coil 8)
    coils[COIL_ENABLE_1WIRE] = activeEnable1Wire;
    if (activeEnable1Wire) {
        sensors.begin();
        sensors.setWaitForConversion(false);
    }

    // Inicializar registros de holding con los valores cargados
    holdingRegisters[REG_ADMIN_SLAVE_ID] = activeSlaveId;
    holdingRegisters[REG_ADMIN_BAUDRATE_CODE] = 0;
    holdingRegisters[REG_ADMIN_COMM_TIMEOUT_SEC] = activeTimeoutSec;
    holdingRegisters[REG_ADMIN_SAVE_EEPROM] = 0;
    holdingRegisters[REG_ADMIN_REBOOT] = 0;
}

void checkAdministrativeCommands() {
    // 1. Comando de Guardar en NVS (Escribir 0x55AA en 40004)
    if (holdingRegisters[REG_ADMIN_SAVE_EEPROM] == 0x55AA) {
        holdingRegisters[REG_ADMIN_SAVE_EEPROM] = 0; // Limpiar bandera

        uint8_t newId = (uint8_t)(holdingRegisters[REG_ADMIN_SLAVE_ID] & 0xFF);
        uint8_t newBCode = (uint8_t)(holdingRegisters[REG_ADMIN_BAUDRATE_CODE] & 0x03);
        uint16_t newTimeout = holdingRegisters[REG_ADMIN_COMM_TIMEOUT_SEC];

        if (newId >= 1 && newId <= 247) {
            prefs.begin("fridgeio", false);
            prefs.putUChar("slave_id", newId);
            prefs.putUChar("baud_code", newBCode);
            prefs.putUShort("timeout_sec", newTimeout);
            prefs.end();
        }
    }

    // 2. Comando de Reinicio por Software (Escribir 0xDEAD en 40005)
    if (holdingRegisters[REG_ADMIN_REBOOT] == 0xDEAD) {
        delay(100);
        ESP.restart();
    }
}

// ============================================================================
// CONFIGURACIÓN (SETUP)
// ============================================================================

void setup() {
    // Cargar parámetros administrativos de NVS
    loadConfigFromNVS();

    // Configurar pines del 74HC595 (Relés)
    digitalWrite(PIN_OE_595, HIGH); // Apagado por seguridad en arranque
    pinMode(PIN_OE_595, OUTPUT);
    pinMode(PIN_SER_595, OUTPUT);
    pinMode(PIN_RCLK_595, OUTPUT);
    pinMode(PIN_SRCLK_595, OUTPUT);
    writeRelays(0x00);              // Todos los relés apagados
    digitalWrite(PIN_OE_595, LOW);  // Habilitar salidas

    // Configurar pines del 74HC165 (Entradas Digitales)
    pinMode(PIN_QH_165, INPUT);
    pinMode(PIN_CLK_165, OUTPUT);
    pinMode(PIN_SH_165, OUTPUT);

    // Inicializar puerto RS-485 sobre UART0 (GPIO 3 RX, GPIO 1 TX)
    Serial.begin(activeBaudrate, SERIAL_8N1);

    // Configurar tablas de registros Modbus RTU
    modbus.configureCoils(coils, 16); // 0..7 relés físicos | 8 Coil virtual 1-Wire
    modbus.configureDiscreteInputs(discreteInputs, 8);
    modbus.configureHoldingRegisters(holdingRegisters, 8);
    modbus.configureInputRegisters(inputRegisters, 8);

    // Iniciar esclavo Modbus
    modbus.begin(activeSlaveId, activeBaudrate);
    lastMasterPollTime = millis();
}

// ============================================================================
// BUCLE PRINCIPAL (LOOP - TIEMPO REAL DETERMINISTA)
// ============================================================================

void loop() {
    uint32_t now = millis();

    // 0. Latido visual del microcontrolador (Heartbeat LED)
    if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatTime = now;
        heartbeatState = !heartbeatState;
    }

    // 1. Lectura de Entradas Digitales con Filtro Antirrebote (Debounce)
    uint8_t rawInputByte = readDigitalInputsRaw();
    if (rawInputByte != lastRawInputs) {
        lastDebounceTime = now;
        lastRawInputs = rawInputByte;
    }

    if ((now - lastDebounceTime) >= DEBOUNCE_DELAY_MS) {
        // En la placa ES32D26, las entradas optoacopladas NPN son activas en LOW (0 = Entrada activa a masa)
        // Invertimos la lógica para que en Modbus: 1 = Entrada activa / Contacto cerrado
        for (int i = 0; i < 8; i++) {
            discreteInputs[i] = !(rawInputByte & (1 << i));
        }
    }

    // 2. Procesamiento del protocolo Modbus RTU sobre Serial (UART0)
    bool hadPoll = modbus.poll();
    if (hadPoll) {
        totalPollCount++;
        lastMasterPollTime = now;
        commWatchdogTripped = false;
        // Destello en el LED de estado para confirmación visual física de poll atendido
        heartbeatState = !heartbeatState;
        digitalWrite(PIN_CLK_165, heartbeatState);
    }

    // 3. Gestión del Coil Virtual 1-Wire persistente (Coil 8)
    if (coils[COIL_ENABLE_1WIRE] != activeEnable1Wire) {
        activeEnable1Wire = coils[COIL_ENABLE_1WIRE];
        prefs.begin("fridgeio", false);
        prefs.putBool("en_1wire", activeEnable1Wire);
        prefs.end();
        if (activeEnable1Wire) {
            sensors.begin();
            sensors.setWaitForConversion(false);
        }
    }

    // 4. Ciclo de lectura 1-Wire asíncrono no bloqueante (DS18B20 en GPIO 4)
    if (activeEnable1Wire) {
        if (!conversionInProgress && (now - last1WireCycleTime >= 2000)) {
            sensors.requestTemperatures();
            conversionInProgress = true;
            last1WireConversionTime = now;
            last1WireCycleTime = now;
        } else if (conversionInProgress && (now - last1WireConversionTime >= 750)) {
            conversionInProgress = false;
            float tA = sensors.getTempCByIndex(0);
            float tB = sensors.getTempCByIndex(1);

            if (tA != DEVICE_DISCONNECTED_C && tA > -55.0f && tA < 125.0f) {
                inputRegisters[REG_DIAG_TEMP_BACKUP_A] = (int16_t)(tA * 10.0f);
            } else {
                inputRegisters[REG_DIAG_TEMP_BACKUP_A] = (uint16_t)-999;
            }

            if (tB != DEVICE_DISCONNECTED_C && tB > -55.0f && tB < 125.0f) {
                inputRegisters[REG_DIAG_TEMP_BACKUP_B] = (int16_t)(tB * 10.0f);
            } else {
                inputRegisters[REG_DIAG_TEMP_BACKUP_B] = (uint16_t)-999;
            }
        }
    } else {
        inputRegisters[REG_DIAG_TEMP_BACKUP_A] = (uint16_t)-999;
        inputRegisters[REG_DIAG_TEMP_BACKUP_B] = (uint16_t)-999;
    }

    // 4b. Temporizadores Autónomos de Hardware en el Esclavo (100% control local de retardos)
    if (coils[COIL_CMD_STOP_TEST]) {
        coils[COIL_CMD_STOP_TEST] = false;
        lampTestActive = false;
        lampTestEndTime = 0;
        for (int i = 0; i < 8; i++) {
            coils[i] = false;
            lastCoilsState[i] = false;
            relayPulseEndTime[i] = 0;
        }
    }

    if (coils[COIL_CMD_LAMP_TEST]) {
        coils[COIL_CMD_LAMP_TEST] = false;
        uint16_t dur = holdingRegisters[REG_ADMIN_LAMP_TEST_SEC];
        if (dur == 0) dur = 5; // Por defecto 5 segundos
        lampTestEndTime = now + (dur * 1000UL);
        lampTestActive = true;
    }

    if (lampTestActive && now >= lampTestEndTime) {
        lampTestActive = false;
        lampTestEndTime = 0;
    }

    // Temporizador autónomo de 5 segundos para cualquier relé individual activado
    for (int i = 0; i < 8; i++) {
        if (coils[i] && !lastCoilsState[i]) {
            // Se activó el relé: arranca el cronómetro de 5 segundos en el esclavo
            relayPulseEndTime[i] = now + 5000UL;
        }
        lastCoilsState[i] = coils[i];

        if (relayPulseEndTime[i] > 0) {
            if (now >= relayPulseEndTime[i]) {
                // Al terminar el retardo: el esclavo apaga el relé y limpia el coil internamente
                coils[i] = false;
                lastCoilsState[i] = false;
                relayPulseEndTime[i] = 0;
            }
        }
    }

    // 5. Watchdog de Comunicación del Bus RS-485 (Fail-Safe de Seguridad)
    if (activeTimeoutSec > 0) {
        uint32_t elapsedNoComm = now - lastMasterPollTime;
        if (elapsedNoComm > (activeTimeoutSec * 1000UL)) {
            if (!commWatchdogTripped) {
                commWatchdogTripped = true;
                // FAIL-SAFE: En caso de corte del bus RS-485, silenciamos los buzzers automáticamente
                // para evitar contaminación acústica indefinida en planta, manteniendo luces de estado.
                coils[RELAY_CAVA_A_BUZZER] = false;
                coils[RELAY_CAVA_B_BUZZER] = false;
            }
        }
    }

    // 6. Escritura de Salidas Físicas a Relé (Hardware)
    uint8_t relayByte = 0;
    if (lampTestActive) {
        relayByte = 0xFF; // Durante Lamp Test todos los 8 relés físicos ON a nivel de hardware local
    } else {
        for (int i = 0; i < 8; i++) {
            if (coils[i]) {
                relayByte |= (1 << i);
            }
        }
    }
    writeRelays(relayByte);

    // 7. Actualización de Registros de Diagnóstico (Input Registers)
    uint32_t uptimeSec = now / 1000;
    inputRegisters[REG_DIAG_UPTIME_SEC_HI]    = (uint16_t)(uptimeSec >> 16);
    inputRegisters[REG_DIAG_UPTIME_SEC_LO]    = (uint16_t)(uptimeSec & 0xFFFF);
    inputRegisters[REG_DIAG_TOTAL_POLLS_HI]   = (uint16_t)(totalPollCount >> 16);
    inputRegisters[REG_DIAG_TOTAL_POLLS_LO]   = (uint16_t)(totalPollCount & 0xFFFF);
    inputRegisters[REG_DIAG_LAST_COMM_AGO_MS] = (uint16_t)min((uint32_t)65535, (now - lastMasterPollTime));
    inputRegisters[REG_DIAG_FIRMWARE_VERSION] = 100; // v1.0.0

    // 8. Atender comandos de gestión administrativa remota (Guardar NVS, Reboot)
    checkAdministrativeCommands();
}
