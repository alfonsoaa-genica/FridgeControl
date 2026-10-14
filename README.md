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

## 3. Instrucciones de Compilación y Flasheo

### Para compilar y subir el Maestro `FridgeControl`:
```powershell
pio run -e eletechsup_es32d26 -t upload
```

### Para compilar y subir el Esclavo Satélite `FridgeIO`:
```powershell
pio run -d FridgeIO -t upload
```
