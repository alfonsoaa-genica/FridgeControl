# Análisis Técnico y Arquitectura de Integración
## Red de Datos de Cavas — Génica Planta DALVI
**Proyecto:** FridgeControl (Maestro Modbus RTU & Gateway IoT)  
**Autor y Dirección Técnica:** Ing. Alfonso Aguirre  
**Fecha:** Octubre 2026  
**Ubicación en Proyecto:** [`FridgeControl/doc/ANALISIS_TECNICO_RED_DATOS_CAVAS.md`](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/ANALISIS_TECNICO_RED_DATOS_CAVAS.md)

---

## 1. Alcance y Filosofía del Sistema

El objetivo primordial del proyecto **FridgeControl** es la toma de control y monitoreo exclusivo de la **red de datos de las cavas** en la planta DALVI de Génica, desacoplándola totalmente de la antigua pasarela LonWorks del panel de frío secundario.

La arquitectura distribuye las responsabilidades con máxima eficiencia:
* **Capa Edge / Campo (ESP32-WROOM-32D):**
  * Maestro **Modbus RTU** exclusivo sobre bus RS-485 físico.
  * Interrogación continua de variables: Temperatura ($PV_{Temp}$), Humedad ($PV_{HR}$), Setpoints ($SP$) y actuadores.
  * **Módulo de Diagnóstico y Descubrimiento Modbus (Auto-Discovery & Troubleshooting):**
    * Exploración inicial de la red para descubrir qué IDs están conectados físicamente.
    * Métricas de salud de señal por cava: Tramas enviadas, recibidas, errores de CRC, timeouts, latencia RTT y porcentaje de éxito de enlace ($Q\%$).
    * Diagnóstico de ruido eléctrico, cables invertidos o terminadores faltantes.
  * **Sistema de Alarmas Industriales Integrado:**
    * Alarma de Temperatura Alta (Pérdida de Setpoint por Elevación): Disparo si $PV_{Temp} > SP_{Temp} + \Delta_{Alarma}$.
    * Alarma de Humedad Relativa (Banda Lo-Hi): Control estricto de banda psicrométrica para maduración.
  * Servidor Web SPA (React) local embebido con vista global de tarjetas, modo primer plano para smartphones de 6" y pestaña de diagnóstico para técnicos.
  * **Tendencia Local de 24 Horas en Buffer Circular en RAM:** Array circular en memoria volátil de 288 puntos fijos por cava. Cero desgaste de Flash y respuesta instantánea.
* **Capa de Seguridad (RBAC):** Modificación de Setpoints y herramientas de diagnóstico restringidas al **Administrador / Mantenedor**. El **Operador** cuenta con perfil de **Solo Lectura (*Read-Only*)**.
* **Capa Corporativa SCADA & Persistencia (Ecosistema Nexus):**
  * **Broker MQTT:** Distribución en tiempo real de telemetría y alarmas hacia FUXA SCADA.
  * **SCADA FUXA:** Dashboard corporativo de supervisión y gestión de planta.
  * **InfluxDB:** Base de datos de series temporales como repositorio único y permanente de datos históricos a largo plazo.

---

## 2. Módulo de Diagnóstico y Descubrimiento de Red (RS-485)

Para simplificar la puesta en marcha inicial en DALVI y brindar una potente herramienta de resolución de problemas (*troubleshooting*), el firmware incorpora un subsistema de diagnóstico avanzado:

```
+-------------------------------------------------------------------------+
|            MÓDULO DE DIAGNÓSTICO Y DESCUBRIMIENTO MODBUS RTU             |
|                                                                         |
|  [ 1. AUTO-DESCUBRIMIENTO DE ESCLAVOS (Network Scanner) ]               |
|  • Barrido configurable de IDs (ej. 1 a 32 o 1 a 247).                  |
|  • Detección automática del perfil del equipo:                           |
|    - KIDE KP-100: Responde a 30001 (Temp), 30002 (Evap).               |
|    - KIDEMATIC-970: Responde adicionalmente con 30002 (% HR).           |
|  • Reporta tabla en vivo: ID, Tipo Detectado, Latencia RTT, Temp Actual. |
|                                                                         |
|  [ 2. MÉTRICAS DE CALIDAD DE ENLACE POR CAVA (Quality Metrics) ]         |
|  • TX Frames:       Total de solicitudes enviadas al esclavo.           |
|  • RX OK:           Total de tramas respondidas íntegramente.           |
|  • Timeouts:        Veces que el esclavo no respondió tras 150 ms.       |
|  • CRC Errors:      Picos de ruido eléctrico o corrupción de trama.     |
|  • Latencia RTT:    Tiempo medio de respuesta (ej. 28 ms).              |
|  • Calidad de Red:  Q% = (RX_OK / TX_Total) * 100%                      |
|                                                                         |
|  [ 3. DIAGNÓSTICO DE PROBLEMAS FÍSICOS DE CAMPO ]                       |
|  • Si Q% < 80%:      "Ruido industrial inducido o terminador 120Ω ausente"|
|  • Si Q% = 0% individual: "Controlador apagado, cable cortado o ID errado" |
|  • Si Q% = 0% general:    "Bus RS-485 abierto o polaridad A/B invertida"  |
+-------------------------------------------------------------------------+
```

### 2.1. Endpoints de Diagnóstico para la Interfaz y SCADA
* `POST /rest/diagnostic/scan`: Inicia el barrido en un rango de IDs con parámetros `{"start_id": 1, "end_id": 32}`.
* `GET /rest/diagnostic/scan`: Retorna el estado del escaneo y la lista de equipos encontrados.
* `GET /rest/diagnostic/stats`: Retorna las estadísticas acumuladas de comunicaciones de todas las cavas (TX, RX, Timeouts, CRC, Latencia, $Q\%$).
* `POST /rest/diagnostic/ping`: Ejecuta un ping individual a una dirección específica para depuración puntual en bornes de la cava.

---

## 3. Gestión de Alarmas y Límites de Proceso

* **Alarma de Temperatura Alta (Pérdida de Setpoint por Elevación):** Disparo cuando $PV_{Temp} \ge SP_{Temp} + \Delta_{Alarma}$ (configurable, ej. $+2.5^\circ\text{C}$).
* **Alarma de Humedad Relativa (Banda Lo-Hi):** Para cavas de maduración (disparo si $PV_{HR} \le HR_{Low}$ o $PV_{HR} \ge HR_{High}$).

---

## 4. Tendencias de 24 Horas en Memoria RAM (Circular Ring Buffer)

* **288 Puntos Móviles por Cava (Muestreo cada 5 min):** 8 bytes por punto (`Timestamp`, `Temp_x10`, `HR_x10`).
* Consumo total de RAM: **~14 KB** para todas las cavas combinadas.
* Cero escrituras continuas en Flash (protección absoluta de la vida útil del chip).

---

## 5. Especificación de Controladores en la Red

* **Cavas de Conservación (C1, C6A, C8, C9) — KIDE KP-100:** Bornera B5 (Pines 25/26), registros 30001 ($PV_{Temp}$), 30002 ($PV_{Evap}$), 40101 ($SP_{Temp}$), coils 00001–00003.
* **Cavas de Maduración (C2...) — KIDEMATIC-970:** Bornera serie (Pines 24 a 27 con puente A y B), registros 30001 ($PV_{Temp}$), 30002 ($PV_{HR}$), 40101 ($SP_{Temp}$), 40102 ($SP_{HR}$), coils 00001–00005.

---

## 6. Arquitectura Frontend React: Cards, Focus Mode y Diagnóstico

* **Vista General (Cards Grid):** Tarjetas con temperatura, estado de relés y salud de enlace.
* **Modo Primer Plano (Smartphones de 6"):** Vista a pantalla completa para ajuste táctil de Setpoints, estados de fancoils y gráfico de tendencia interactiva de 24 horas.
* **Pestaña de Diagnóstico de Red:** Panel para técnicos de planta con escáner interactivo del bus, calidad de enlace por cava ($Q\%$) y latencias.
