#pragma once
#include <Arduino.h>

// ============================================================================
// Proyecto: FridgeIO - Satélite Modbus RTU Esclavo de E/S y Señalización
// Cliente:  Génica - Planta DALVI
// Hardware: Placa Industrial eletechsup ES32D26 / ES32A08 (ESP32 DevKit 38
// pines) Bus:      RS-485 Diferencial (Modbus RTU Esclavo)
// ============================================================================

// ----------------------------------------------------------------------------
// ASIGNACIÓN DE PINES HARDWARE (PLACA ES32D26)
// ----------------------------------------------------------------------------

// Salidas a Relé (Shift Register 74HC595 - 8 Canales de Potencia)
#define PIN_SER_595 12   // Datos serie
#define PIN_OE_595 13    // Habilitación de salidas (Activo en LOW)
#define PIN_RCLK_595 23  // Latch / Reloj de registro
#define PIN_SRCLK_595 22 // Reloj de desplazamiento

// Entradas Digitales (Shift Register 74HC165 - 8 Entradas Optoacopladas NPN)
#define PIN_QH_165 15 // Salida de datos serie
#define PIN_CLK_165 2 // Reloj síncrono (compartido con LED azul)
#define PIN_SH_165 0  // Shift / Load (Carga paralela)

// Puerto RS-485 (Conectado a UART0 en placa eletechsup ES32D26 con DE en GPIO
// 21)
#define PIN_RS485_RX 3  // U0RXD
#define PIN_RS485_TX 1  // U0TXD
#define PIN_RS485_DE 21 // Control de dirección TX/RX (DE/RE) en GPIO 21

// ----------------------------------------------------------------------------
// PARÁMETROS ADMINISTRATIVOS POR DEFECTO
// ----------------------------------------------------------------------------
#define DEFAULT_SLAVE_ID 100  // ID base (100, 102, 104, 106, 108)
#define DEFAULT_BAUDRATE 9600 // 9600 bps (8N1)
#define COMM_WATCHDOG_TIMEOUT_MS                                               \
  15000 // 15 segundos sin tramas del maestro = Comm Lost

// ----------------------------------------------------------------------------
// MAPA DE ASIGNACIÓN FÍSICA DE CANALES (2 CAVAS POR CONTROLADOR)
// ----------------------------------------------------------------------------

// Relés (Coils 0 a 7 / 00001 a 00008)
enum RelayChannel {
  RELAY_CAVA_A_GREEN = 0,  // DO 1: Luz Verde Cava A
  RELAY_CAVA_A_YELLOW = 1, // DO 2: Luz Amarilla Cava A
  RELAY_CAVA_A_RED = 2,    // DO 3: Luz Roja Cava A
  RELAY_CAVA_A_BUZZER = 3, // DO 4: Buzzer Acústico Cava A
  RELAY_CAVA_B_GREEN = 4,  // DO 5: Luz Verde Cava B
  RELAY_CAVA_B_YELLOW = 5, // DO 6: Luz Amarilla Cava B
  RELAY_CAVA_B_RED = 6,    // DO 7: Luz Roja Cava B
  RELAY_CAVA_B_BUZZER = 7  // DO 8: Buzzer Acústico Cava B
};

// Entradas Digitales (Discrete Inputs 0 a 7 / 10001 a 10008)
enum DigitalInputChannel {
  DI_CAVA_A_REED_DOOR =
      0, // DI 1: Reed Switch Puerta Cava A (1=Cerrada, 0=Abierta)
  DI_CAVA_B_REED_DOOR =
      1, // DI 2: Reed Switch Puerta Cava B (1=Cerrada, 0=Abierta)
  DI_CAVA_A_ACK_BUTTON = 2, // DI 3: Pulsador Físico ACK Cava A (1=Pulsado)
  DI_CAVA_B_ACK_BUTTON = 3, // DI 4: Pulsador Físico ACK Cava B (1=Pulsado)
  DI_CAVA_A_KIDE_ALARM =
      4, // DI 5: Contacto Seco Alarma KIDE A (1=OK, 0=Alarma)
  DI_CAVA_B_KIDE_ALARM =
      5,          // DI 6: Contacto Seco Alarma KIDE B (1=OK, 0=Alarma)
  DI_SPARE_1 = 6, // DI 7: Reserva / Presostato / Auxiliar
  DI_SPARE_2 = 7  // DI 8: Reserva / Térmico / Auxiliar
};

// Registros de Retención Administrativos (Holding Registers / 40001+)
enum AdminHoldingRegister {
  REG_ADMIN_SLAVE_ID = 0, // 40001: Dirección Esclavo Modbus (1 - 247)
  REG_ADMIN_BAUDRATE_CODE =
      1, // 40002: Código Baudrate (0=9600, 1=19200, 2=38400)
  REG_ADMIN_COMM_TIMEOUT_SEC =
      2, // 40003: Tiempo Watchdog de bus (segundos, 0=deshabilitado)
  REG_ADMIN_SAVE_EEPROM =
      3,                // 40004: Escribir 0x55AA para guardar config en NVS
  REG_ADMIN_REBOOT = 4, // 40005: Escribir 0xDEAD para reiniciar el módulo
  REG_ADMIN_LAMP_TEST_SEC =
      5 // 40006: Duración de Lamp Test en segundos (por defecto 5s)
};

// Bus 1-Wire para Sondas de Temperatura de Respaldo (DS18B20)
#define PIN_ONEWIRE 4 // GPIO 4 (Libre en placa eletechsup)
#define COIL_ENABLE_1WIRE                                                      \
  8 // Coil Virtual 8: 1=Habilitar 1-Wire con persistencia NVS, 0=Deshabilitar
#define COIL_CMD_LAMP_TEST                                                     \
  9 // Coil Virtual 9: 1=Disparo de Lamp Test autónomo (temporizado en esclavo)
#define COIL_CMD_STOP_TEST                                                     \
  10 // Coil Virtual 10: 1=Cancelar prueba y restablecer a modo automático

// Registros de Entrada de Diagnóstico (Input Registers / 30001+)
enum DiagnosticInputRegister {
  REG_DIAG_UPTIME_SEC_HI = 0,  // 30001: Tiempo de encendido Uptime (High word)
  REG_DIAG_UPTIME_SEC_LO = 1,  // 30002: Tiempo de encendido Uptime (Low word)
  REG_DIAG_TOTAL_POLLS_HI = 2, // 30003: Tramas Modbus recibidas (High word)
  REG_DIAG_TOTAL_POLLS_LO = 3, // 30004: Tramas Modbus recibidas (Low word)
  REG_DIAG_LAST_COMM_AGO_MS =
      4, // 30005: Milisegundos desde última trama del maestro
  REG_DIAG_FIRMWARE_VERSION =
      5, // 30006: Versión de firmware (ej. 100 = v1.0.0)
  REG_DIAG_TEMP_BACKUP_A =
      6, // 30007: Temp Respaldo Cava A (décimas °C, -999 = sin sonda)
  REG_DIAG_TEMP_BACKUP_B =
      7 // 30008: Temp Respaldo Cava B (décimas °C, -999 = sin sonda)
};
