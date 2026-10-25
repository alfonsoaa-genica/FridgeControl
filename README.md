# FridgeControl & FridgeIO — Ecosistema de Supervisión de Cavas
### Génica — Planta DALVI | Dirección Técnica: Ing. Alfonso Aguirre
**Fecha:** Octubre 2026  

---

## 1. Visión General del Repositorio

Este repositorio contiene el sistema integral de supervisión, telemetría y señalización para las cavas de refrigeración y maduración de la planta DALVI (Génica), compuesto por dos firmwares industriales complementarios:

1. **`FridgeControl` (Raíz del Repositorio):**  
   Gateway IoT y Maestro Modbus sobre **Waveshare Industrial ESP32-S3 WiFi Relay 6CH** (Flash 8 MB). Implementa una **arquitectura de doble puerto serial independiente y aislado galvánicamente**:
   * **Puerto 1 (RS-485 Nativo / Half-Duplex):** Pines `GPIO 17` (TX) y `GPIO 18` (RX), dedicado exclusivamente a la red de satélites auxiliares `FridgeIO` (IDs $100..247$).
   * **Puerto 2 (RS-422 4-Hilos / Full-Duplex):** Pines `GPIO 4` (TX) y `GPIO 5` (RX) en conector H1, convertidor de niveles MAX3232 (DCE) y transceptor aislado **AutomationDirect FA-ISOCON**, dedicado exclusivamente a los controladores de Cavas KIDE (**KP-100** y **KIDEMATIC 970**, IDs $1..99$).
   * Aloja un servidor web con SPA en **React** (embebida en PROGMEM), WebSockets de telemetría en tiempo real, buffer circular de tendencias de 24h en memoria RAM, dos sistemas independientes de escaneo/autodescubrimiento (*Auto-Discovery*), dos paneles de métricas de calidad de enlace ($Q\%$) y cliente MQTT conectado a la red corporativa.

2. **`FridgeIO` ([`FridgeControl/FridgeIO/`](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/FridgeIO)):**  
   Firmware determinista para satélites auxiliares industriales de campo en placa **eletechsup ES32D26 / ES32A08** (carril DIN). Actúa como esclavo Modbus RTU puro (IDs 100, 102, 104, 106, 108) controlando 2 cavas contiguas con 8 relés de potencia para torretas luminosas Andon y buzzers, y 8 entradas optoacopladas para switches magnéticos de puerta, botones físicos de reconocimiento (ACK ISA-18.2) y contactos de alarma de los KIDE. Gestión administrativa 100% remota sobre el bus RS-485.

---

## 2. Arquitectura de Hardware y Doble Bus Serial

```
                     ┌────────────────────────────────────────┐
                     │   FRIDGECONTROL (MAESTRO INDUSTRIAL)   │
                     │  Waveshare ESP32-S3 Relay 6CH (8 MB)   │
                     └───────────────────┬────────────────────┘
                                         │
         ┌───────────────────────────────┴───────────────────────────────┐
         ▼ (Puerto 2: RS-422 4-Hilos Full-Duplex)                        ▼ (Puerto 1: RS-485 2-Hilos Half-Duplex)
   RED DE CAVAS (KIDE)                                           RED DE AUXILIARES (FRIDGEIO)
   • Hardware: UART2 (GPIO 4 TX / GPIO 5 RX)                     • Hardware: UART1 (GPIO 17 TX / GPIO 18 RX)
   • Aislamiento: MAX3232 + AutomationDirect FA-ISOCON           • Aislamiento: Transceptor Nativo Aislado
   • Dispositivos: IDs 1..99                                     • Dispositivos: IDs 100..247
   • Cola de Comandos: _queueKide (Setpoints Temp y HR)          • Cola de Comandos: _queueFridgeIO (Relés, Torretas)
   • Escaneo: startKideScan()                                    • Escaneo: startFridgeIOScan()
   • Diagnóstico: Métricas RS-422 (Cavas)                        • Diagnóstico: Métricas RS-485 (Auxiliares)
         │                                                             │
         ├── Cava 3 (ID: 3, KIDEMATIC 970) ───────────────┐            └── Satélite FridgeIO (ID: 100 / ES32D26)
         │   (Temp + Humedad Relativa)                    │                ├── Canal A: DO 1..4 (Torreta 3), DI 1 (Puerta), DI 3 (ACK)
         └── Cava 4 (ID: 4, KIDEMATIC 970) ───────────────┼────────────────└── Canal B: DO 5..8 (Torreta 4), DI 2 (Puerta), DI 4 (ACK)
             (Temp + Humedad Relativa)                    │
                                              ASOCIACIÓN POR SOFTWARE
                                            (Persistente en LittleFS)
```

### Pines de Expansión en Cabezal H1 (Waveshare ESP32-S3):
* **Pin 13:** `GND` (Referencia común con módulo MAX3232)
* **Pin 14:** `GPIO 5` (`IO05` $\rightarrow$ RXD de UART2 desde TXD del MAX3232)
* **Pin 15:** `GPIO 4` (`IO04` $\rightarrow$ TXD de UART2 hacia RXD del MAX3232)
* **Pin 4 / 5:** `3.3V` (Alimentación lógica VCC)

---

## 3. Proyecto Piloto: Cavas 3 y 4 con KIDEMATIC 970
* **Cavas Configuradas (Red RS-422):**
  * **Cava 3 (`C3`):** Modbus ID 3, Controlador **KIDEMATIC 970** (Maduración: Temp + HR).
  * **Cava 4 (`C4`):** Modbus ID 4, Controlador **KIDEMATIC 970** (Maduración: Temp + HR).
  * Parámetros: Consigna Temp $12.0^\circ\text{C}$, Consigna HR $85\%$, alarmas ISA-18.2 activas.
* **Módulo Auxiliar Asociado por Software (Red RS-485):**
  * **Satélite `FridgeIO` (ID 100):**
    * **Canal A $\rightarrow$ Cava 3:** Luz Verde, Amarilla, Roja, Buzzer 3, Reed switch puerta 3, Botón ACK 3.
    * **Canal B $\rightarrow$ Cava 4:** Luz Verde, Amarilla, Roja, Buzzer 4, Reed switch puerta 4, Botón ACK 4.
  * Asociación 100% persistente en Flash (`/config/signaling.json`) y reconfigurable vía REST (`POST /rest/signaling/mapping`).

---

## 4. Índice de Documentación Técnica

* 📄 **[Estado del Proyecto, Bitácora y Roadmap](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/ESTADO_DEL_PROYECTO_Y_ROADMAP.md):**  
  Seguimiento integral de arquitectura dual, validación en banco con FA-ISOCON, esquema de particiones de 8 MB y bitácora de hitos.
* 📄 **[Esquema Eléctrico Oficial Waveshare ESP32-S3 Relay 6CH (PDF)](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/ESP32-S3-Relay-6CH_Schematic.pdf):**  
  Diagrama esquemático de fábrica con el pinout del cabezal H1 y el circuito de aislamiento del RS-485 nativo.
* 📄 **[Diseño de Señalización Luminosa y Puertas (Andon & ISA-18.2)](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/DISENO_SENALIZACION_LUMINOSA_Y_PUERTAS.md):**  
  Especificación de torretas articuladas 12-24V con buzzer, cableado en bus de 2 hilos, botón físico de ACK y filosofía de re-alarma.
* 📄 **[Análisis Técnico y Red de Datos de Cavas](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/ANALISIS_TECNICO_RED_DATOS_CAVAS.md):**  
  Desacoplamiento de LonWorks, escáner de autodescubrimiento Modbus RTU, métricas de calidad ($Q\%$), tendencias de 24h en RAM y perfiles KIDE.
* 📄 **[Manual Técnico de FridgeIO](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/FridgeIO/README.md):**  
  Diccionario completo de registros Modbus RTU (Coils, Discrete Inputs, Holding Registers de administración y diagnósticos).

---

## 5. Instrucciones de Compilación y Grabación

### Para compilar y subir el Maestro `FridgeControl` (Waveshare ESP32-S3 Relay 6CH):
```powershell
# 1. Compilar Frontend React (SPA integrada en memoria Flash mediante WWWData.h)
cd interface
npm run build
cd ..

# 2. Compilar y flashear Firmware ESP32-S3 por USB (COM24)
pio run -e waveshare_esp32s3_relay_6ch -t upload --upload-port COM24
```

### Para compilar y subir el Esclavo Satélite `FridgeIO` (eletechsup ES32D26):
```powershell
pio run -d FridgeIO -t upload --upload-port COM20
```

---

## 6. Arquitectura de Software y Servicios Destacados

* 🛡️ **Auditoría de Operaciones (FDA 21 CFR Part 11 / HACCP):** Registro persistente en `/audit/audit.ndjson` (con autorotación a 120 KB) de cambios de setpoint, parámetros de alarma ISA-18.2, altas/bajas de cavas y comandos de prueba de relés con trazabilidad de IP, usuario y marca de tiempo.
* 🔄 **Tabla de Particiones Simétricas de 8 MB (`partitions_8MB.csv`):** Dos particiones OTA de 3.0 MB cada una (`app0` y `app1`) que garantizan actualizaciones de firmware vía Web sin límites ni errores de tamaño.
* 🌐 **Sincronización Horaria WiFi NTP:** El sistema sincroniza la hora local y UTC contra servidores NTP a través de la red WiFi corporativa.
* 📂 **Explorador de Archivos LittleFS (`/files`):** Navegación visual, descarga y gestión de almacenamiento flash interno.
* 🖥️ **Modo Kiosk Pantalla Completa:** Botón interactivo de pantalla completa integrado en la barra de navegación para tablets y dispositivos móviles en planta.
