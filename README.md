# FridgeControl & FridgeIO — Ecosistema de Supervisión de Cavas
### Génica — Planta DALVI | Dirección Técnica: Ing. Alfonso Aguirre
**Fecha:** Octubre 2026  

---

## 1. Visión General del Repositorio

Este repositorio contiene el sistema integral de supervisión, telemetría y señalización para las cavas de conservación y maduración de la planta DALVI (Génica). Todas las cavas incluidas en este proyecto utilizan **agua helada y unidades FanCoil**; no tienen compresores propios. El sistema supervisa sus variables y alarmas a través de los controladores KIDE, sin controlar una planta de compresión. La solución está compuesta por dos firmwares industriales complementarios:

1. **`FridgeControl` (Raíz del Repositorio):**  
   Gateway IoT y Maestro Modbus sobre **Waveshare Industrial ESP32-S3 WiFi Relay 6CH** (Flash 8 MB). Implementa una **arquitectura de doble puerto serial independiente y aislado galvánicamente**:
   * **Puerto 1 (RS-485 Nativo / Half-Duplex):** Dedicado exclusivamente a la red de satélites auxiliares `FridgeIO` (IDs $100..247$).
   * **Puerto 2 (RS-422 4-Hilos / Full-Duplex):** Conectado mediante el convertidor de niveles MAX3232 (DCE) y el transceptor aislado **AutomationDirect FA-ISOCON**, dedicado exclusivamente a los controladores de Cavas KIDE (**KP-100** y **KIDEMATIC 970**, IDs $1..99$).
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
   • Hardware: UART2                                               • Hardware: UART1
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
* 📄 **[Resumen de Alarmas ISA-18.2](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/RESUMEN_ALARMAS_ISA18_2.md):**
  Síntesis de umbrales, prioridades, reconocimiento local y puntos de atención identificados para las pruebas del sistema.
* 📄 **[Análisis Técnico y Red de Datos de Cavas](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/ANALISIS_TECNICO_RED_DATOS_CAVAS.md):**  
  Desacoplamiento de LonWorks, escáner de autodescubrimiento Modbus RTU, métricas de calidad ($Q\%$), tendencias de 24h en RAM y perfiles KIDE.
* 📄 **[Manual Técnico de FridgeIO](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/FridgeIO/README.md):**  
  Diccionario completo de registros Modbus RTU (Coils, Discrete Inputs, Holding Registers de administración y diagnósticos).

---

## 5. Instrucciones de Compilación y Grabación

### Compilar el Maestro `FridgeControl` (Waveshare ESP32-S3 Relay 6CH)
```powershell
# Compilar Frontend React (SPA integrada en memoria Flash mediante WWWData.h)
cd interface
npm run build
cd ..

# Compilar firmware y generar .pio/build/waveshare_esp32s3_relay_6ch/firmware.bin
pio run -e waveshare_esp32s3_relay_6ch

# Generar .pio/build/waveshare_esp32s3_relay_6ch/littlefs.bin
pio run -e waveshare_esp32s3_relay_6ch -t buildfs
```

El hook de PlatformIO sincroniza y comprime `interface/build` en `data/www` durante `buildfs` y `uploadfs`. Para grabar en la placa, ejecutar explícitamente:
```powershell
pio run -e waveshare_esp32s3_relay_6ch -t upload --upload-port COM24
pio run -e waveshare_esp32s3_relay_6ch -t uploadfs --upload-port COM24
```

En el entorno Waveshare, la SPA se sirve desde `WWWData.h` integrado en el firmware (`PROGMEM_WWW=1`). Por eso, para actualizar la interfaz hay que compilar y cargar `firmware.bin`; cargar solo `littlefs.bin` no cambia las pantallas. La página inicial se sirve con cabeceras que impiden reutilizarla desde caché. LittleFS sigue alojando la configuración y los datos locales del sistema.

### Para compilar y subir el Esclavo Satélite `FridgeIO` (eletechsup ES32D26):
```powershell
pio run -d FridgeIO -t upload --upload-port COM20
```

### Consola de diagnóstico Modbus
Conecta el monitor serie USB del Maestro Waveshare en `COM24` a `115200` baudios. La consola muestra cada trama transmitida (`TX`), recibida (`RX`) y el resultado de la transacción en hexadecimal:
* `P1 FridgeIO RS-485`: auxiliares FridgeIO.
* `P2 Cavas KIDE RS-422`: controladores de cavas.

La traza se activa para el entorno Waveshare mediante `FT_MODBUS_SERIAL_TRACE` y no depende del colector de datos Nexus.
El botón **Pausar monitoreo** cierra la conexión WebSocket dedicada a las trazas, por lo que el navegador deja de recibirlas hasta reanudar. La consola conserva un máximo de 500 tramas en memoria; el resto de la supervisión web continúa funcionando.

### Configuración local de WiFi y MQTT
Las pantallas **WiFi** y **MQTT** permiten importar y exportar sus ajustes JSON. Para aprovisionar un equipo nuevo desde el proyecto:
1. Copia `data/config/wifiSettings.example.json` como `data/config/wifiSettings.json` y `data/config/mqttSettings.example.json` como `data/config/mqttSettings.json`.
2. Completa localmente SSID, contraseñas y parámetros del broker. Los archivos reales están excluidos de Git.
3. Compila y sube el filesystem. En el primer arranque, el firmware importa esos archivos y guarda la configuración en NVS.

Después del primer arranque, NVS prevalece sobre los JSON del filesystem. Por ello, subir un filesystem nuevo no reemplaza las credenciales guardadas; los cambios posteriores se realizan desde las pantallas WiFi/MQTT y se guardan también en NVS. Si el equipo ya arrancó antes de copiar los JSON locales, importa cada archivo en su pantalla y presiona **Guardar**. Los JSON de ejemplo no contienen credenciales.

### Última validación (25 de octubre de 2026)
La interfaz React compiló correctamente y se generaron los recursos de producción. Para el Waveshare, el firmware `waveshare_esp32s3_relay_6ch/firmware.bin` con la SPA integrada en `WWWData.h` se cargó mediante la web y el usuario confirmó que la interfaz actualizada aparece correctamente. Después se cambió el nombre visible de 1-Wire a **Bus de sensores de respaldo**; el firmware actual se recompiló con ese último texto y queda pendiente cargarlo.

La imagen `littlefs.bin` también se generó correctamente, pero no es la imagen que actualiza la SPA de esta placa. La compilación de LittleFS no equivale a una carga ni sustituye la actualización del firmware integrado.

Cambios de interfaz confirmados:
* **Cavas en Vivo:** retirados los estados de desescarche y vapor; se conservan los indicadores pertinentes de frío y ventilador.
* **Mantenimiento de Cavas, WiFi y MQTT:** eliminadas de las pantallas las menciones a nombres y rutas de archivos `.json`.
* La pantalla inicial del firmware integrado evita la caché para que el navegador solicite la versión vigente de la SPA.

### Mantenimiento de Equipos Auxiliares de Cava (FridgeIO)
Desde **Proyecto → Equipos Auxiliares**, cada satélite FridgeIO tiene una ficha propia con asociación de canales **A** y **B**, estado de campo, pruebas de salidas y métricas RS-485. Incluye habilitación y diagnóstico del bus de sensores de respaldo DS18B20, cantidad de sondas detectadas y temperatura de respaldo por canal en °C con dos decimales. Las asociaciones se guardan de forma persistente vía `POST /rest/signaling/mapping`. La pantalla **Diagnóstico Modbus** queda para escaneo, ping, métricas KIDE y consola HEX.

Flujo recomendado en planta:
1. Crear/validar primero las cavas en `cavas.json`.
2. Capturar el satélite nuevo con el escáner RS-485.
3. En **Equipos Auxiliares**, seleccionar las cavas de Canal A y Canal B y guardar la asociación.
4. Verificar las asignaciones, estado, pruebas de campo y métricas RS-485 en esa pantalla.

---

## 6. Arquitectura de Software y Servicios Destacados

* 🛡️ **Auditoría de Operaciones (FDA 21 CFR Part 11 / HACCP):** Registro persistente en `/audit/audit.ndjson` (con autorotación a 120 KB) de cambios de setpoint, parámetros de alarma ISA-18.2, altas/bajas de cavas y comandos de prueba de relés con trazabilidad de IP, usuario y marca de tiempo.
* 🔄 **Tabla de Particiones Simétricas de 8 MB (`partitions_8MB.csv`):** Dos particiones OTA de 3.0 MB cada una (`app0` y `app1`) que garantizan actualizaciones de firmware vía Web sin límites ni errores de tamaño.
* 🌐 **Sincronización Horaria WiFi NTP:** El sistema sincroniza la hora local y UTC contra servidores NTP a través de la red WiFi corporativa.
* 📂 **Explorador de Archivos LittleFS (`/files`):** Navegación visual, descarga y gestión de almacenamiento flash interno.
* 🖥️ **Modo Kiosk Pantalla Completa:** Botón interactivo de pantalla completa integrado en la barra de navegación para tablets y dispositivos móviles en planta.
