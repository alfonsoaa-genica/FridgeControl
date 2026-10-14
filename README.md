# FridgeControl & FridgeIO — Ecosistema de Supervisión de Cavas
### Génica — Planta DALVI | Dirección Técnica: Ing. Alfonso Aguirre
**Fecha:** Octubre 2026  

---

## 1. Visión General del Repositorio

Este repositorio contiene el sistema integral de supervisión, telemetría y señalización para las cavas de refrigeración y maduración de la planta DALVI (Génica), compuesto por dos firmwares complementarios:

1. **`FridgeControl` (Raíz del Repositorio):**  
   Gateway IoT y Maestro Modbus RTU sobre ESP32. Interroga a los controladores KIDE (KP-100 y Secmatic-970) y a los satélites `FridgeIO`. Aloja un servidor web con SPA en **React** (LittleFS), WebSockets, buffer circular de 24h en memoria RAM, escáner de red (*Auto-Discovery*) con métricas de calidad de enlace ($Q\%$) y cliente MQTT conectado a la red corporativa.
2. **`FridgeIO` ([`FridgeControl/FridgeIO/`](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/FridgeIO)):**  
   Firmware determinista para satélites industriales de campo en placa **eletechsup ES32D26** (carril DIN). Actúa como esclavo Modbus RTU puro (IDs 100, 102, 104, 106, 108) controlando 2 cavas contiguas con 8 relés de potencia para torretas luminosas y buzzers, y 8 entradas optoacopladas para switches magnéticos de puerta, botones físicos de reconocimiento (ACK) y contactos de alarma de los KIDE. Gestión administrativa 100% remota sobre el bus RS-485.

---

## 2. Índice de Documentación Técnica

* 📄 **[Estado del Proyecto, Bitácora y Roadmap](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/ESTADO_DEL_PROYECTO_Y_ROADMAP.md):**  
  Seguimiento integral de arquitectura, hitos completados y próximos pasos de desarrollo.
* 📄 **[Diseño de Señalización Luminosa y Puertas (Andon & ISA-18.2)](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/DISENO_SENALIZACION_LUMINOSA_Y_PUERTAS.md):**  
  Especificación de torretas articuladas 12-24V con buzzer, cableado, topología en línea sobre el bus RS-485 existente, botón físico de ACK y filosofía de re-alarma.
* 📄 **[Análisis Técnico y Red de Datos de Cavas](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/ANALISIS_TECNICO_RED_DATOS_CAVAS.md):**  
  Desacoplamiento de LonWorks, escáner de autodescubrimiento Modbus RTU, métricas de calidad ($Q\%$), tendencias de 24h en RAM y perfiles KIDE.
* 📄 **[Manual Técnico de FridgeIO](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/FridgeIO/README.md):**  
  Diccionario completo de registros Modbus RTU (Coils, Discrete Inputs, Holding Registers de administración y diagnósticos).

---

### Para compilar y subir el Maestro `FridgeControl` (Waveshare ESP32-S3 Relay 6CH):
```powershell
# Frontend React (SPA integrada en memoria Flash mediante WWWData.h)
cd interface
npm run build
cd ..

# Firmware ESP32-S3
pio run -e waveshare_esp32s3_relay_6ch -t upload --upload-port COM24
```

### Para compilar y subir el Esclavo Satélite `FridgeIO` (eletechsup ES32D26):
```powershell
pio run -d FridgeIO -t upload --upload-port COM20
```

---

## 4. Arquitectura de Software y Servicios Destacados

* 🛡️ **Auditoría de Operaciones (FDA 21 CFR Part 11 / HACCP):** Registro persistente en `/audit/audit.ndjson` (con autorotación a 120 KB) de cambios de setpoint, parámetros de alarma ISA-18.2, altas/bajas de cavas y comandos de prueba de relés con trazabilidad de IP, usuario y marca de tiempo.
* 🌐 **Sincronización Horaria WiFi NTP:** El sistema no depende de módulos RTC físicos I2C (DS3231); sincroniza la hora local y UTC contra servidores NTP a través de la red WiFi corporativa.
* 📂 **Explorador de Archivos LittleFS (`/files`):** Navegación visual, descarga y gestión de almacenamiento flash interno.
* 🖥️ **Modo Kiosk Pantalla Completa:** Botón interactivo de pantalla completa integrado en la barra de navegación para tablets y dispositivos móviles en planta.
