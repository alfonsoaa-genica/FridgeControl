# Estado del Proyecto, Bitácora y Roadmap Técnico
## Sistema de Supervisión, Telemetría y Señalización de Cavas
### Génica — Planta DALVI | Octubre 2026
**Dirección Técnica:** Ing. Alfonso Aguirre  
**Ecosistema:** FridgeControl (Maestro Gateway) + FridgeIO (Satélites de Campo)

---

## 1. Resumen Ejecutivo de la Arquitectura

Todas las cavas incluidas en este proyecto son de **agua helada y utilizan FanCoils**. No existen compresores propios en las cavas; FridgeControl supervisa las variables de los controladores KIDE y las alarmas del proceso FanCoil, pero no controla la producción central de agua helada ni equipos de compresión.

El ecosistema desacopla el monitoreo de las cavas de la antigua pasarela LonWorks y brinda una solución integral **OT/IT (Industria 4.0)**:

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
* **Estado de banco (25 de octubre de 2026):** El firmware Maestro con la SPA actualizada fue compilado y cargado mediante la web; el usuario confirmó que la interfaz se veía correctamente. Después se renombró en pantalla el bus de sensores y se eliminaron de las fichas de cavas el enlace RS-485 y la temperatura del evaporador. El firmware más reciente se recompiló correctamente y queda pendiente de carga.
  * La SPA se sirve desde `WWWData.h` en PROGMEM (`PROGMEM_WWW=1`); para actualizarla se debe cargar el firmware, no solo `littlefs.bin`.
  * `littlefs.bin` también se generó correctamente, pero no es el mecanismo de actualización de la SPA para este entorno. LittleFS conserva su función de almacenamiento de configuración y datos.
  * La página inicial del firmware añade cabeceras anti-caché para evitar que el navegador mantenga una versión antigua de la interfaz.
* **Nuevas Funcionalidades Integradas:**
  * Supervisión continua de nodos de señalización `FridgeIO` (lectura de Discrete Inputs 10001..10008 cada 500 ms).
  * Máquina de estados **ISA-18.2** (tiempos de puerta abierta y alertas acústicas por buzzer). El ACK local silencia mientras la causa persiste; la señalización queda reconocida hasta que la condición se normaliza.
  * Auto-descubrimiento en bus: identifica controladores KIDE (KP-100 / Secmatic-970) y satélites `FRIDGE_IO` en rango 100d.
  * Mapeo dinámico y persistente de cavas asociadas a los canales A y B de cada satélite (`/config/signaling.json`).
  * Consola web de trazas Modbus en hexadecimal (TX/RX) sobre WebSocket en tiempo real.
  * Pausa de monitoreo mediante cierre de la conexión WebSocket dedicada a trazas; reanudar abre una nueva conexión. La consola limita el histórico a 500 tramas en memoria.
  * Mantenimiento de auxiliares separado en **Proyecto → Equipos Auxiliares**: permite asociar los canales A y B a cavas existentes, revisar estados de campo, probar salidas y consultar métricas RS-485. **Diagnóstico Modbus** se reserva para escaneo, ping, métricas KIDE y consola HEX.
  * Bus de sensores de respaldo DS18B20 en mantenimiento auxiliar: habilitación persistente, cantidad de sondas detectadas y temperaturas por canal con resolución de 0.01 °C. El usuario confirmó que la lectura de temperatura ya funciona. El nombre de pantalla no expone el detalle de implementación del protocolo.
  * El FridgeIO ejecuta localmente la señalización de puertas, alarmas y ACK. El Maestro transmite estados de proceso/NOCOMM y lee por FC01 los estados efectivos de las ocho salidas para reportarlos.
  * En **Cavas en Vivo** se retiraron los indicadores de desescarche y vapor, que no aplican a las cavas de agua helada con FanCoils, así como el pie de enlace RS-485 y temperatura de evaporador. En las pantallas de cavas se evita exponer el detalle del bus de comunicación. También se simplificó el texto visible de mantenimiento para no exponer nombres ni rutas de archivos `.json`.
  * Endpoints REST: `GET /rest/signaling/nodes`, `POST /rest/signaling/mapping`, y campos de señalización en `GET /rest/cavas` y WebSockets.
  * Aprovisionamiento local WiFi/MQTT con `data/config/wifiSettings.json` y `data/config/mqttSettings.json`, excluidos de Git y derivados de plantillas sin credenciales. En ESP32, se migran a NVS en el primer arranque; NVS prevalece después de cargas nuevas de LittleFS. Los formularios WiFi y MQTT permiten importar/exportar cada JSON y guardar cambios al equipo.

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
    * Asignación: Exclusiva para controladores KIDE que supervisan los FanCoils de las cavas de agua helada (KP-100, Secmatic-970, IDs ..99$).
* **Validación Eléctrica y Funcional en Banco:**
  * **Comportamiento de LEDs en FA-ISOCON:**
    * *Línea abierta (sin carga):* LED TX titila por sondeo activo del ESP32; LED RX queda encendido fijo por entradas diferenciales flotantes sin carga.
    * *Prueba de Loopback:* Al puentear TX+ con RX+ y TX- con RX-, la polarización del transmisor apaga el LED RX en reposo (Mark state) y ambos LEDs (TX/RX) destellan simultáneamente con cada trama Modbus enviada por el ESP32.
  * **Confirmación:** Cadena física y lógica 100% operativa sin contención de bus ni colisiones entre satélites y cavas.

---

### 2.4. Proyecto Piloto: Cavas 3 y 4 con KIDEMATIC 970 y Asociación a Satélite FridgeIO
* **Cavas del Piloto (Puerto 2 / RS-422 vía MAX3232 + FA-ISOCON):**
  * **Cava 3:** Modbus ID 3, Controlador **KIDEMATIC 970** (Maduración: Temp + Humedad Relativa activa).
  * **Cava 4:** Modbus ID 4, Controlador **KIDEMATIC 970** (Maduración: Temp + Humedad Relativa activa).
  * **Parámetros Térmicos:** Setpoint Temp $12.0^\circ\text{C}$, Setpoint Humedad $85\%$, alarmas ISA-18.2 activas.
* **Módulo Auxiliar Asociado por Software (Puerto 1 / RS-485 Nativo Waveshare):**
  * **Satélite `FridgeIO` (ID 100 / eletechsup ES32D26):**
    * **Canal A $\rightarrow$ Cava 3:** DO 1..4 (Verde, Amarillo, Rojo, Buzzer 3), DI 1 (Puerta 3), DI 3 (Botón ACK 3).
    * **Canal B $\rightarrow$ Cava 4:** DO 5..8 (Verde, Amarillo, Rojo, Buzzer 4), DI 2 (Puerta 4), DI 4 (Botón ACK 4).
  * **Configuración Dinámica:** Asociación 100% persistente en Flash (`/config/signaling.json`) y reconfigurable vía REST (`POST /rest/signaling/mapping`).
* **Sistemas Separados en Firmware:**
  * **Dos Colas Asíncronas:** `_queueFridgeIO` y `_queueKide` (sin contención ni bloqueo mutuo).
  * **Dos Sistemas de Auto-Descubrimiento:** `startKideScan()` (IDs 1..99 en RS-422) y `startFridgeIOScan()` (IDs 100..247 en RS-485).
  * **Dos Paneles de Diagnóstico:** Métricas completas de salud de bus en `/rest/diagnostic/stats` (`bus_kide` y `bus_fridge_io`).

---

### 2.5. Diferenciación Visual y Operativa en la Interfaz Web (SPA)
* **Separación Estricta de Capas Físicas en UI:**
  * **Red RS-422 (Exclusiva para Cavas KIDE):**
    * *Ventana de Edición / Registro:* Subtítulo explícito `Red RS-422 (Controladores KIDE Exclusivamente)`.
    * *Campo ID Modbus:* Helper text actualizado a `Dirección RS-422 (1..99)`.
    * *Selector Directo:* Opciones concisas sin desbordamiento: **`KP-100`** y **`KIDEMATIC 970`**.
    * *Tabla de Diagnóstico:* Panel dedicado **"Métricas de Calidad de Enlace RS-422 (Cavas KIDE)"** con badge de hardware `RS-422 Full-Duplex (Puerto 2: GPIO 4 TX / GPIO 5 RX)`.
  * **Red RS-485 (Exclusiva para Auxiliares FridgeIO):**
    * *Panel de Señalización:* Módulos auxiliares eletechsup ES32D26 (IDs $\ge 100$).
    * *Tabla de Diagnóstico Separada:* Panel dedicado **"Métricas de Calidad de Enlace RS-485 (Auxiliares FridgeIO)"** con badge de hardware `RS-485 Half-Duplex (Puerto 1: GPIO 17 TX / GPIO 18 RX)`. Muestra ID de nodo auxiliar y tags de cavas asociadas (Canal A / Canal B).

---

## 3. Bitácora de Hitos Completados

| Fecha | Componente | Hito Alcanzado |
| :---: | :--- | :--- |
| **Oct 2026** | **Análisis de Red** | Desacoplamiento de LonWorks y especificación de registros Modbus RTU para KIDE KP-100 y Secmatic-970. |
| **Oct 2026** | **Señalización Andon** | Homologación de torretas articuladas 12-24V con buzzer y lógica de prioridades (Verde / Amarillo / Rojo). |
| **Oct 2026** | **Alarm Management** | Integración de la gestión de alarmas ISA-18.2 con ACK físico local, señalización autónoma y reconocimiento mantenido hasta normalizar la causa. |
| **Oct 2026** | **FridgeIO Firmware** | Creación y flasheo de firmware esclavo Modbus RTU en placa ES32D26 física (`COM20`). |
| **Oct 2026** | **Hardware Maestro** | Homologación del Waveshare Industrial ESP32-S3 Relay 6CH con RS-485 aislado (`COM24`). |
| **Oct 2026** | **Supervisión de Nodos** | Implementación en `ModbusEngine` del ciclo de sondeo de satélites `FridgeIO` y máquina de estados de torretas. |
| **Oct 2026** | **Topología Híbrida** | Especificación del puente de capa física (2 hilos a 4 hilos) con auto-switchover y driver ADM489 para compatibilidad con controladores KIDE. |
| **Oct 2026** | **Flasheo Total Maestro** | **Grabación exitosa de Firmware y Filesystem (LittleFS) en el Waveshare ESP32-S3 (`COM24`)**. |
| **25 Oct 2026** | **Alarmas autónomas y sondas auxiliares** | FridgeIO ejecuta señalización/ACK localmente, publica readback de salidas y diagnósticos DS18B20; Maestro consulta estados de relés y temperaturas. |
| **25 Oct 2026** | **Actualización de interfaz** | Se retiraron estados no aplicables de desescarche/vapor, se ocultaron referencias a archivos en pantallas y el usuario confirmó la actualización tras cargar el firmware Maestro integrado. |
| **25 Oct 2026** | **Ajuste de pantallas de cavas** | Se retiró el pie de comunicación y evaporador de Cavas en Vivo y se armonizó en la documentación el nombre visible del bus de sensores de respaldo. Firmware recompilado; carga pendiente. |

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
