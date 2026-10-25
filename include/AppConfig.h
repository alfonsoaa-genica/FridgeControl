#pragma once
#include <Arduino.h>

// ============================================================================
// Proyecto: FridgeControl - Red de Datos de Cavas
// Cliente: Génica - Planta DALVI
// Autor y Arquitecto del Sistema: Ing. Alfonso Aguirre
// ============================================================================

// Hardware de la Placa y Puertos Seriales Industriales
#if defined(BOARD_WAVESHARE_ESP32S3_RELAY_6CH)
// Placa Industrial Maestro: Waveshare Industrial ESP32-S3 WiFi Relay 6CH con RS-485 Aislado
// Puerto 1: Bus RS-485 Nativo Aislado Half-Duplex (Dedicado a Satélites FridgeIO en 2 hilos)
#define RS485_RX_PIN 18
#define RS485_TX_PIN 17
#define RS485_DE_RE_PIN -1 // Aislamiento galvánico con auto-dirección por hardware

// Puerto 2: Bus RS-422 (4 Hilos) vía MAX3232 DCE y convertidor FA-ISOCON (Dedicado a Cavas KIDE)
#define KIDE_RS422_RX_PIN 5  // Pin 14 de Header H1 (IO05)
#define KIDE_RS422_TX_PIN 4  // Pin 15 de Header H1 (IO04)
#define KIDE_RS422_DE_RE_PIN -1 // Bus 4 hilos Full-Duplex (no requiere pin DE/RE)

#define BOARD_NAME "Waveshare ESP32-S3 Relay 6CH"
#define BOARD_ONBOARD_BUZZER_PIN 21
#define BOARD_RGB_LED_PIN 38
#define BOARD_RELAY_1_PIN 1
#define BOARD_RELAY_2_PIN 2
#define BOARD_RELAY_3_PIN 41
#define BOARD_RELAY_4_PIN 42
#define BOARD_RELAY_5_PIN 45
#define BOARD_RELAY_6_PIN 46

#elif defined(BOARD_ELETECHSUP_ES32D26)
// Tarjeta Industrial de Pruebas: eletechsup ES32D26 (ESP32 DevKit 38 pines)
// Utiliza GPIO 21 como control de dirección DE/RE para el transceptor RS-485
#define RS485_RX_PIN 16
#define RS485_TX_PIN 17
#define RS485_DE_RE_PIN 21
#define KIDE_RS422_RX_PIN 5
#define KIDE_RS422_TX_PIN 4
#define KIDE_RS422_DE_RE_PIN -1
#define BOARD_NAME "eletechsup ES32D26"

#else
// Tarjeta Genérica ESP32 DevKit V1 con transceptor externo auto-switching
#define RS485_RX_PIN 16
#define RS485_TX_PIN 17
#define RS485_DE_RE_PIN -1
#define KIDE_RS422_RX_PIN 5
#define KIDE_RS422_TX_PIN 4
#define KIDE_RS422_DE_RE_PIN -1
#define BOARD_NAME "ESP32 DevKit V1"
#endif
#define RS485_BAUD_DEFAULT 9600
#define KIDE_RS422_BAUD_DEFAULT 9600

// Configuración de Tiempo (NTP / VET UTC-4)
#define TIMEZONE_OFFSET_SEC -14400 // -4 horas (Venezuela)
#define TIMEZONE_DAYLIGHT_SEC 0
#define DEFAULT_NTP_SERVER "pool.ntp.org"

// Perfiles de Red y Seguridad
#define DEFAULT_AP_SSID "FridgeControl_DALVI"
#define DEFAULT_AP_PASS "genica2026"
#define DEFAULT_ADMIN_PIN "1234"

// Parámetros de Tendencias de 24 Horas en RAM (Circular Ring Buffer)
#define TREND_INTERVAL_MS (5 * 60 * 1000) // 5 minutos por muestra
#define MAX_TREND_POINTS 288              // 24 horas = 288 muestras

// Punto de Tendencia en RAM (Solo 8 bytes por muestra)
struct TrendPoint {
  uint32_t ts;      // Timestamp Epoch UNIX (segundos)
  int16_t temp_x10; // Temperatura x10
  int16_t hr_x10;   // Humedad x10 (-1 si no aplica)
};

// Buffer Circular en RAM por Cava (288 puntos * 8 bytes = ~2.3 KB por cava)
struct TrendBuffer {
  TrendPoint points[MAX_TREND_POINTS];
  uint16_t head;
  uint16_t count;

  void add(uint32_t timestamp, float temp, float hr, bool has_hr) {
    points[head].ts = timestamp;
    points[head].temp_x10 = (int16_t)(temp * 10.0f);
    points[head].hr_x10 = has_hr ? (int16_t)(hr * 10.0f) : -1;
    head = (head + 1) % MAX_TREND_POINTS;
    if (count < MAX_TREND_POINTS)
      count++;
  }
};

// Métricas de Diagnóstico de Enlace Modbus RS-485
struct ModbusDiagnostics {
  uint32_t tx_frames;    // Total de consultas enviadas
  uint32_t rx_success;   // Total de respuestas válidas
  uint32_t timeouts;     // Respuestas fallidas por tiempo de espera
  uint32_t crc_errors;   // Tramas corruptas o con ruido
  uint16_t last_rtt_ms;  // Último tiempo de respuesta (milisegundos)
  float quality_percent; // Porcentaje de éxito de enlace

  void recordTx() { tx_frames++; }
  void recordSuccess(uint16_t rtt) {
    rx_success++;
    last_rtt_ms = rtt;
    quality_percent = (tx_frames > 0)
                          ? ((float)rx_success / (float)tx_frames) * 100.0f
                          : 100.0f;
  }
  void recordTimeout() {
    timeouts++;
    quality_percent = (tx_frames > 0)
                          ? ((float)rx_success / (float)tx_frames) * 100.0f
                          : 0.0f;
  }
  void recordCrcError() {
    crc_errors++;
    quality_percent = (tx_frames > 0)
                          ? ((float)rx_success / (float)tx_frames) * 100.0f
                          : 0.0f;
  }
};

// Enumeración de Estados de Torreta Andon
enum TowerLightState {
  TOWER_GREEN = 0,        // Frío normal, puerta cerrada
  TOWER_YELLOW_WARN = 1,  // Puerta abierta silenciosa (> 90 s)
  TOWER_YELLOW_ALARM = 2, // Puerta abierta con buzzer (> 180 s)
  TOWER_YELLOW_ACK = 3,   // Puerta abierta con ACK en atención
  TOWER_RED_ALARM = 4,    // Pérdida de frío con buzzer
  TOWER_RED_ACK = 5,      // Pérdida de frío con ACK en atención
  TOWER_COMM_ERROR = 6    // Fallo de comunicación RS-485
};

// Estructura de Nodo Satélite de Señalización (FridgeIO / ES32D26)
#define MAX_SIGNALING_NODES 8

struct SignalingNode {
  uint8_t modbus_id;  // 100, 102, 104, 106, 108...
  bool online;        // true si responde a las consultas Modbus
  uint32_t last_seen; // Timestamp de última respuesta válida

  // Mapeo de Canales hacia IDs de Cava ("C1", "C6A", etc. Vacío si no asignado)
  char cava_a_id[8];
  char cava_b_id[8];

  // Entradas Digitales Leídas de Campo (1 = Activo / Cerrado, 0 = Inactivo /
  // Abierto)
  bool door_closed_a; // DI 1: Reed Switch Puerta Cava A (1=Cerrada, 0=Abierta)
  bool door_closed_b; // DI 2: Reed Switch Puerta Cava B (1=Cerrada, 0=Abierta)
  bool ack_pressed_a; // DI 3: Botón Físico ACK Cava A (1=Pulsado)
  bool ack_pressed_b; // DI 4: Botón Físico ACK Cava B (1=Pulsado)
  bool kide_alarm_a;  // DI 5: Contacto Alarma KIDE A (1=OK, 0=Alarma)
  bool kide_alarm_b;  // DI 6: Contacto Alarma KIDE B (1=OK, 0=Alarma)

  // Salidas a Relé Comandadas (1 = Relé Activado, 0 = Apagado)
  bool green_a;  // DO 1: Luz Verde Cava A
  bool yellow_a; // DO 2: Luz Amarilla Cava A
  bool red_a;    // DO 3: Luz Roja Cava A
  bool buzzer_a; // DO 4: Buzzer Cava A
  bool green_b;  // DO 5: Luz Verde Cava B
  bool yellow_b; // DO 6: Luz Amarilla Cava B
  bool red_b;    // DO 7: Luz Roja Cava B
  bool buzzer_b; // DO 8: Buzzer Cava B

  // Temperaturas de Respaldo 1-Wire (DS18B20 en satélite)
  bool enable_1wire;    // true si el satélite tiene el bus 1-Wire activo (Coil 8)
  float temp_backup_a;  // Temperatura sonda 1-Wire Cava A (-999 si desconectada)
  float temp_backup_b;  // Temperatura sonda 1-Wire Cava B (-999 si desconectada)

  // Métricas de Diagnóstico del Nodo
  ModbusDiagnostics diag;

  // Control de Prueba Manual / Lamp Test
  uint32_t override_until; // Timestamp millis() hasta el que se mantiene activo el test
  uint8_t override_coils;  // Coils forzados manualmente durante el test

  uint8_t packCoilsByte() const {
    if (override_until > 0 && millis() < override_until) {
      return override_coils;
    }
    uint8_t b = 0;
    if (green_a)
      b |= (1 << 0);
    if (yellow_a)
      b |= (1 << 1);
    if (red_a)
      b |= (1 << 2);
    if (buzzer_a)
      b |= (1 << 3);
    if (green_b)
      b |= (1 << 4);
    if (yellow_b)
      b |= (1 << 5);
    if (red_b)
      b |= (1 << 6);
    if (buzzer_b)
      b |= (1 << 7);
    return b;
  }
};

// Modelo de Controlador KIDE en Cava
enum KideControllerModel {
  KIDE_KP100 = 0,        // Modelo KP-100 (Solo Frío / Conservación)
  KIDEMATIC_970 = 1      // Modelo Kidematic 970 (Frío + Humedad / Maduración)
};

// Enumeración de Tipo de Cava
enum CavaType {
  CAVA_CONSERVACION = 0, // KIDE KP-100 (Solo Temperatura)
  CAVA_MADURACION = 1    // KIDEMATIC-970 (Temperatura y Humedad)
};

// Estructura de Estado de Cava en Tiempo Real
struct CavaState {
  char id[8];           // "C1", "C6A", "C2", etc.
  char descripcion[64]; // "Cava 1 - Conservación"
  uint8_t modbus_id;    // 1, 6, 16, 2, etc.
  CavaType tipo;        // Conservación o Maduración
  KideControllerModel controller_model; // KIDE_KP100 o KIDEMATIC_970
  bool has_humidity;    // true para C2, false para C1, C6A, C8, C9

  // Variables Analógicas (Proceso y Consignas)
  float temp_pv;   // Temperatura Cámara (°C)
  float temp_sp;   // Setpoint Temperatura (°C)
  float temp_evap; // Temperatura Evaporador (°C)
  float temp_diff; // Histéresis Temperatura (°C)

  float hr_pv;   // Humedad Relativa Activa (% HR)
  float hr_sp;   // Setpoint Humedad Relativa (% HR)
  float hr_diff; // Histéresis Humedad (% HR)

  // Límites y Umbrales de Alarma
  float temp_alarm_delta; // Desviación máxima sobre SP (+°C)
  float hr_alarm_low;     // Límite inferior de humedad (% HR)
  float hr_alarm_high;    // Límite superior de humedad (% HR)

  // Banderas de Alarma Activa
  bool alarm_temp_high;
  bool alarm_hr_low;
  bool alarm_hr_high;
  bool alarm_active;

  // Actuadores y Salidas Digitales
  bool cooling_active; // VSL / Compresor / Frío
  bool fan_active;     // Ventiladores evaporador
  bool defrost_active; // Desescarche en curso
  bool heating_active; // Resistencias de calor (Maduración)
  bool humid_active;   // Inyección de vapor (Maduración)
  bool exhaust_active; // Extracción / Renovación (Maduración)

  // Supervisión de Puerta y Botón Físico de ACK (ISA-18.2)
  bool door_closed;         // true: cerrada, false: abierta
  uint32_t door_open_epoch; // Momento de apertura en millis()
  uint16_t door_grace_sec;  // Cortesía silenciosa (defecto: 90 s)
  uint16_t door_buzzer_sec; // Disparo de buzzer (defecto: 180 s)
  bool ack_pressed;         // true si el operario pulsó ACK en sitio
  uint32_t ack_timestamp;   // Momento en que se pulsó ACK en millis()
  uint16_t ack_grace_sec;   // Tiempo de gracia post-ACK (defecto: 600 s / 10 min)
  uint32_t temp_high_epoch; // Momento en que temp_pv superó umbral (millis)
  uint16_t temp_alarm_delay_sec; // Retardo de confirmación de alta temp (defecto: 300 s / 5 min)
  bool kide_hw_alarm_contact; // true: OK (cerrado), false: Alarma física abierta

  // Estado físico de la torreta y buzzer
  TowerLightState tower_state;
  bool buzzer_active;

  // Asociación con Nodo de Señalización
  uint8_t signaling_node_id; // ID del nodo FridgeIO asociado (ej. 100). 0 si no
                             // asignado
  char signaling_channel;    // 'A' o 'B'

  // Salud de Comunicaciones Modbus
  bool comm_online;     // true si responde; false si hay timeout
  uint32_t last_seen;   // Timestamp de última respuesta válida
  uint16_t comm_errors; // Contador de fallos consecutivos

  // Métricas de Diagnóstico de Línea
  ModbusDiagnostics diag;

  // Buffer Circular de Tendencias en RAM (24h)
  TrendBuffer trends;

  void evaluateAlarms() {
    if (!comm_online) {
      alarm_temp_high = false;
      alarm_hr_low = false;
      alarm_hr_high = false;
      alarm_active = false;
      temp_high_epoch = 0;
      return;
    }

    float effDelta = (temp_alarm_delta > 0.0f) ? temp_alarm_delta : 2.5f;
    bool overTemp = (temp_pv >= (temp_sp + effDelta));
    if (overTemp) {
      if (temp_high_epoch == 0) temp_high_epoch = millis();
      uint32_t elapsed = (millis() - temp_high_epoch) / 1000;
      alarm_temp_high = (elapsed >= temp_alarm_delay_sec);
    } else {
      temp_high_epoch = 0;
      alarm_temp_high = false;
    }

    if (has_humidity) {
      alarm_hr_low = (hr_pv <= hr_alarm_low);
      alarm_hr_high = (hr_pv >= hr_alarm_high);
    } else {
      alarm_hr_low = false;
      alarm_hr_high = false;
    }

    alarm_active = alarm_temp_high || alarm_hr_low || alarm_hr_high;
  }

  void updateSignalingLogic(uint32_t now_ms) {
    if (!comm_online) {
      tower_state = TOWER_COMM_ERROR;
      buzzer_active = false;
      return;
    }

    // Lógica de apertura de puerta
    uint32_t door_open_duration =
        (!door_closed) ? ((now_ms - door_open_epoch) / 1000) : 0;
    bool door_exceeded =
        (!door_closed &&
         door_open_duration >= (door_grace_sec > 0 ? door_grace_sec : 90));
    bool door_critical =
        (!door_closed &&
         door_open_duration >= (door_buzzer_sec > 0 ? door_buzzer_sec : 180));

    // Evaluación de ACK y re-alarma post 10 minutos
    uint16_t effective_ack_grace = (ack_grace_sec > 0) ? ack_grace_sec : 600;
    bool ack_valid = false;
    if (ack_pressed && (!door_closed || alarm_temp_high)) {
      uint32_t ack_elapsed_sec = (now_ms - ack_timestamp) / 1000;
      if (ack_elapsed_sec < effective_ack_grace) {
        ack_valid =
            true; // Sigue vigente el silencio por presencia del operador
      } else {
        ack_pressed = false; // Expiró el tiempo de atención: Re-alarma
      }
    } else if (door_closed && !alarm_temp_high) {
      ack_pressed = false; // Condición normalizada: Reset automático
    }

    // Jerarquía de luces y buzzer
    if (!comm_online) {
      // Sin comunicación con controlador KIDE: no activar luz verde en falso
      tower_state = TOWER_COMM_ERROR;
      buzzer_active = false;
    } else if (alarm_temp_high || alarm_hr_low || alarm_hr_high ||
        !kide_hw_alarm_contact) {
      // Alarma Crítica de Frío o Fallo de Hardware
      tower_state = ack_valid ? TOWER_RED_ACK : TOWER_RED_ALARM;
      buzzer_active = !ack_valid;
    } else if (door_critical) {
      // Alarma Crítica de Puerta Abierta (> 3 min)
      tower_state = ack_valid ? TOWER_YELLOW_ACK : TOWER_YELLOW_ALARM;
      buzzer_active = !ack_valid;
    } else if (door_exceeded) {
      // Advertencia Preventiva de Puerta (90 a 180 s)
      tower_state = TOWER_YELLOW_WARN;
      buzzer_active = false;
    } else {
      // Operación Normal con Kide en línea
      tower_state = TOWER_GREEN;
      buzzer_active = false;
    }
  }
};

// Comando de Escritura Asíncrono en Cola Prioritaria
struct ModbusWriteCommand {
  uint8_t modbus_id;
  uint16_t register_address;
  int16_t raw_value;
  bool is_coil;
  bool is_multiple_coils;
  uint16_t count;
};
