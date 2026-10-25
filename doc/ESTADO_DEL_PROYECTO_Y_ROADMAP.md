# Estado del Proyecto, Bitácora y Roadmap Técnico
## Sistema de Supervisión, Telemetría y Señalización de Cavas
### Génica — Planta DALVI | Octubre 2026
**Dirección Técnica:** Ing. Alfonso Aguirre  
**Ecosistema:** FridgeControl (Maestro Gateway) + FridgeIO (Satélites de Campo)

---

## 1. Resumen Ejecutivo de la Arquitectura

El ecosistema desacopla el monitoreo de frío de la antigua pasarela LonWorks y brinda una solución integral **OT/IT (Industria 4.0)**:

```
                                  RED CORPORATIVA GÈNICA
                    ┌────────────────────────┴────────────────────────┐
                    ▼                                                 ▼
             BROKER MOSQUITTO                                   SCADA FUXA
         (Telemetría MQTT JSON)                            (Dashboards & InfluxDB)
                    ▲
                    │ WiFi / Ethernet
   ═════════════════╪═════════════════════════════════════════════════════════════════════
   NIVEL CAMPO / OT │ ARQUITECTURA DE DOBLE PUERTO SERIAL DEDICADO E INDEPENDIENTE
                    ▼
         [ FRIDGECONTROL (MAESTRO INDUSTRIAL) ]
         Waveshare Industrial ESP32-S3 Relay 6CH (COM24)
         • Puerto 1 (RS-485 Nativo / Half-Duplex): TX: GPIO 17, RX: GPIO 18, Auto-Dirección
         • Puerto 2 (RS-422 4-Hilos / Full-Duplex): TX: GPIO 4, RX: GPIO 5 vía MAX3232 -> FA-ISOCON
         • WebServer React SPA (Flash WWWData) | Auto-Discovery | Buffer 24h RAM
                    │
         ┌──────────┴───────────────────────────────────────────────────┐
         ▼ (Puerto 2: RS-422 a 4 Hilos)                                 ▼ (Puerto 1: RS-485 Half-Duplex)
   BUS KIDE (CAVAS)                                             BUS SATÉLITES FRIDGEIO
   ┌──────────────────────┬──────────────────────┐              ┌──────────────────────────────┐
   ▼                      ▼                      ▼              ▼                              ▼
[ KIDE KP-100 ]     [ KIDEMATIC-970 ]     [ OTRAS CAVAS ] [ ES32D26 (I/O) ]             [ ES32D26 (I/O) ]
 ID 1..10 (Frío)     ID 2.. (Maduración)   ID 3..          ID 100 (Cavas 1-2)            ID 102 (Cavas 3-4)
 B5: Modbus RTU      Serial: Modbus RTU                    4 DO + 4 DI por Cava          4 DO + 4 DI por Cava
 Borna 7: Alarma     Salida 01: Relé                                      │
                                                          ┌───────────────┴───────────────┐
                                                          ▼                               ▼
                                                  Torretas Andon                 Reed Switches Puerta
                                                  12-24V Articuladas             + Botón Físico ACK (ISA-18.2)
```

---

## 2. Estado Actual de los Equipos en Banco de Pruebas

### 2.1. Maestro Gateway: `FridgeControl`
* **Hardware Físico:** **Waveshare Industrial ESP32-S3 WiFi Relay 6CH** (`COM24`).
* **Puerto RS-485:** Aislamiento galvánico on-board con control automático de dirección (`GPIO 17` TX, `GPIO 18` RX). Jumper de terminación 120R y LEDs de tráfico TX/RX.
* **Estado:** **FIRMWARE Y FILESYSTEM FLASHEADOS CON ÉXITO EN BANCO**.
  * **Firmware:** Subido vía esptool por USB-Serial nativo en `COM24`.
  * **Filesystem (LittleFS):** Web SPA React comprimida, fuentes, manifiestos y configuraciones subidas al 100% (`uploadfs`).
* **Nuevas Funcionalidades Integradas:**
  * Supervisión continua de nodos de señalización `FridgeIO` (lectura de Discrete Inputs 10001..10008 cada 500 ms).
  * Máquina de estados **ISA-18.2** (tiempos de puerta abierta, alertas acústicas por buzzer, temporizador de 10 min de silencio tras botón físico de ACK).
  * Auto-descubrimiento en bus: identifica controladores KIDE (KP-100 / Secmatic-970) y satélites `FRIDGE_IO` en rango 100d.
  * Mapeo dinámico y persistente de cavas asociadas a los canales A y B de cada satélite (`/config/signaling.json`).
  * Endpoints REST: `GET /rest/signaling/nodes`, `POST /rest/signaling/mapping`, y campos de señalización en `GET /rest/cavas` y WebSockets.

---

### 2.2. Esclavo Satélite: `FridgeIO`
* **Hardware Físico:** **eletechsup ES32D26 / ES32A08** (`COM20`).
* **Estado:** **FIRMWARE v1.0.0 FLASHEADO CON ÉXITO EN BANCO**.
* **Métricas:** Consumo ultra-optimizado (Flash: **21.6%**, RAM: **6.6%**, arranque < 200 ms).
* **Funcionalidades:**
  * Esclavo Modbus RTU puro (ID 100 por defecto).
  * Control de 8 salidas a relé de 10A (Luz Verde, Amarilla, Roja y Buzzer para Cava A y Cava B).
  * Lectura de 8 entradas optoacopladas NPN con filtro antirrebote de 15 ms.
  * Gestión administrativa 100% remota sobre RS-485 (Holding Registers 40001 a 40005: cambio de ID, watchdog y reboot).

---

### 2.3. Doble Puerto Serial y Validación en Banco (Octubre 2026)
* **Arquitectura de Puertos Independientes:**
  * **Puerto 1 (RS-485 / 2 hilos / Half-Duplex):**
    * Pines: GPIO 17 (TX), GPIO 18 (RX).
    * Transceptor: Integrado en placa Waveshare, con aislamiento galvánico y control automático de flujo/dirección.
    * Asignación: Exclusiva para la red de satélites FridgeIO (módulos eletechsup ES32D26 / ES32A08, IDs $\ge 100$).
  * **Puerto 2 (RS-422 / 4 hilos / Full-Duplex):**
    * Pines: GPIO 4 (TX), GPIO 5 (RX) tomados del cabezal de expansión H1 (Pin 13 GND, Pin 14 IO05/RX, Pin 15 IO04/TX).
    * Cadena de Conversión: ESP32 (3.3V TTL) $\rightarrow$ Módulo MAX3232 (RS-232) $\rightarrow$ Convertidor Aislado **AutomationDirect FA-ISOCON** $\rightarrow$ Bornera RS-422 (TX+, TX-, RX+, RX-).
    * Asignación: Exclusiva para controladores de refrigeración de cavas KIDE (KP-100, Secmatic-970, IDs ..99$).
* **Validación Eléctrica y Funcional en Banco:**
  * **Comportamiento de LEDs en FA-ISOCON:**
    * *Línea abierta (sin carga):* LED TX titila por sondeo activo del ESP32; LED RX queda encendido fijo por entradas diferenciales flotantes sin carga.
    * *Prueba de Loopback:* Al puentear TX+ con RX+ y TX- con RX-, la polarización del transmisor apaga el LED RX en reposo (Mark state) y ambos LEDs (TX/RX) destellan simultáneamente con cada trama Modbus enviada por el ESP32.
  * **Confirmación:** Cadena física y lógica 100% operativa sin contención de bus ni colisiones entre satélites y cavas.

---

## 3. Bitácora de Hitos Completados

| Fecha | Componente | Hito Alcanzado |
| :---: | :--- | :--- |
| **Oct 2026** | **Análisis de Red** | Desacoplamiento de LonWorks y especificación de registros Modbus RTU para KIDE KP-100 y Secmatic-970. |
| **Oct 2026** | **Señalización Andon** | Homologación de torretas articuladas 12-24V con buzzer y lógica de prioridades (Verde / Amarillo / Rojo). |
| **Oct 2026** | **Alarm Management** | Integración del estándar ISA-18.2 con pulsador físico de ACK en sitio y re-alarma de 10 min. |
| **Oct 2026** | **FridgeIO Firmware** | Creación y flasheo de firmware esclavo Modbus RTU en placa ES32D26 física (`COM20`). |
| **Oct 2026** | **Hardware Maestro** | Homologación del Waveshare Industrial ESP32-S3 Relay 6CH con RS-485 aislado (`COM24`). |
| **Oct 2026** | **Supervisión de Nodos** | Implementación en `ModbusEngine` del ciclo de sondeo de satélites `FridgeIO` y máquina de estados de torretas. |
| **Oct 2026** | **Topología Híbrida** | Especificación del puente de capa física (2 hilos a 4 hilos) con auto-switchover y driver ADM489 para compatibilidad con controladores KIDE. |
| **Oct 2026** | **Flasheo Total Maestro** | **Grabación exitosa de Firmware y Filesystem (LittleFS) en el Waveshare ESP32-S3 (`COM24`)**. |

---

## 4. Plan de Despliegue en Campo y Próximos Pasos

1. **Intervención y Prueba de Conexión en Campo (Cavas DALVI):**
   * **Punto Medio:** Conectar el puente híbrido ADM489 mediante bornera exterior en daisychain continuo con tramos cortos de CAT-6E (sin terminador en punto medio).
   * **Gabinete WEB-700:** Desconectar la pasarela serial legacy y cerrar ese extremo de línea instalando la bornera terminal con resistencia de \,\Omega$.
   * **Auto-Discovery:** Ejecutar escaneo desde la interfaz web de FridgeControl para verificar la respuesta inmediata de los KIDE KP-100 y KIDEMATIC-970.
2. **Diagnóstico del Convertidor Serial Legacy:**
   * Evaluar en mesa técnica la pasarela retirada del WEB-700 (RS-232 a RS-422 de 4 hilos) para su posible homologación y aprovechamiento como driver definitivo en carril DIN.
3. **Prueba de Señalización Andon con Satélites FridgeIO:**
   * Conectar los satélites eletechsup ES32D26 al bus de 2 hilos del maestro, validando tiempos de puerta abierta, torretas luminosas y botón físico de ACK (ISA-18.2).


1. **Conexión Física de Banco:**
   * Conectar par trenzado RS-485 entre:
     * Bornas **A+** y **B-** del **Waveshare ESP32-S3** (Maestro, COM24).
     * Bornas **A+** y **B-** del **eletechsup ES32D26** (Esclavo FridgeIO, COM20).
2. **Prueba de Enlace y Auto-Descubrimiento:**
   * Abrir el monitor serie del Maestro (`COM24`) o conectarse a su punto de acceso WiFi / Web UI (`http://fridgecontrol.local` o IP asignada).
   * Verificar la detección automática del nodo satélite ID 100 (`FRIDGE_IO`).
3. **Prueba Funcional de Relés y Entradas:**
   * Simular apertura de puerta en la entrada DI 1 del satélite (puenteando a GND) y verificar que tras 90 s se active la luz amarilla.
   * Probar el botón de ACK en DI 3 y verificar el silenciamiento y la persistencia del estado en el Maestro.
