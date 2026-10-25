# Análisis Técnico y Arquitectura de Integración
## Red de Datos de Cavas — Génica Planta DALVI
**Proyecto:** FridgeControl (Maestro Modbus RTU & Gateway IoT)  
**Autor y Dirección Técnica:** Ing. Alfonso Aguirre  
**Fecha:** Octubre 2026  
**Ubicación en Proyecto:** [`FridgeControl/doc/ANALISIS_TECNICO_RED_DATOS_CAVAS.md`](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/ANALISIS_TECNICO_RED_DATOS_CAVAS.md)

---

## 1. Alcance y Filosofía del Sistema

Todas las cavas de este proyecto son de **agua helada y utilizan FanCoils**; no tienen compresores propios. FridgeControl supervisa la red de datos de los controladores KIDE y las variables asociadas a cada cava/FanCoil. La generación y distribución central de agua helada, así como cualquier sistema de compresión externo, no forman parte del alcance de control de este proyecto.

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


---

## 7. Topología Híbrida de Bus: Puente 2 Hilos (Satélites) a 4 Hilos (Controladores KIDE con ADM489)

### 7.1. Diagnóstico de Campo y Convivencia de Capa Física
Durante el análisis de campo de las cavas de DALVI se determinó una dualidad tecnológica fundamental:
1. **Controladores KIDE (KP-100 y KIDEMATIC-970):** Implementan interfaz de comunicación serial a **4 hilos** (Full-Duplex RS-422 / RS-485 con pares independientes $TX+/TX-$ y $RX+/RX-$).
2. **Red de Supervisores Auxiliares (`FridgeIO`):** Utilizan el estándar moderno industrial a **2 hilos** (Half-Duplex diferencial $A+/B-$).

### 7.2. Solución: Puente de Capa Física Transparente
* **Alimentación Eléctrica del Puente (+5V):** Tanto el transceptor RS-485 de 2 hilos (con auto-switchover) como el driver diferencial ADM489 de 4 hilos se alimentan con **+5V DC tomados directamente desde el propio maestro** (placa Waveshare ESP32-S3), garantizando referencia de masa (GND) unificada para las líneas TTL y niveles de excursión diferencial óptimos bajo la norma EIA-485/EIA-422.

Para evitar el re-cableado destructivo o invasivo de las cámaras frigoríficas y sin modificar el firmware del maestro ESP32-S3:
* El maestro **Waveshare ESP32-S3** emite y recibe tramas Modbus por su puerto RS-485 de 2 hilos ($A+/B-$).
* Los satélites de señalización **FridgeIO** se conectan directamente sobre este bus de 2 hilos.
* En paralelo al bus de 2 hilos se conecta un **transceptor con auto-switchover** (conmutación automática de dirección de flujo) que extrae las líneas serie lógicas a nivel **TTL (TX y RX)**.
* Estas líneas TTL alimentan directamente a un driver diferencial **ADM489** (Full-Duplex de 4 hilos), cuyas salidas $Y/Z$ ($TX+/TX-$) y entradas $A/B$ ($RX+/RX-$) se conectan al tendido original de 4 hilos de los KIDE.
* Las respuestas de los controladores KIDE retornan por el ADM489 hacia el transceptor auto-switchover, que las reinyecta al bus de 2 hilos hacia el ESP32-S3.

```
 [ ESP32-S3 MAESTRO ]
  (RS-485 2 Hilos A+/B-)
           │
           ├────────────────────────────► [ Satélites FridgeIO (ES32D26) ] (2 Hilos A+/B-)
           │
           ▼
 [ Transceptor 2H con Auto-Switchover ]
           │ TTL (TX / RX)
           ▼
 [ Driver Full-Duplex ADM489 ]
           │ 4 Hilos (TX+/TX- , RX+/RX-)
           ▼
 [ Controladores KIDE KP-100 / KIDEMATIC-970 ]
```

### 7.3. Ventajas Técnicas
* **Cero impacto en firmware:** ModbusEngine sigue operando sobre una única UART no bloqueante.
* **Integridad del cableado de planta:** Se preserva el tendido y apantallamiento de 4 hilos existente en las cavas.
* **Aislamiento y robustez:** Cada segmento opera en su condición de impedancia óptima con terminadores de 120 Ω.


---

## 8. Procedimiento de Intervención en Campo, Desacoplamiento del WEB-700 y Plan de Pruebas

### 8.1. Estrategia de Intervención en Punto Medio (Daisychain en Bornera Exterior)
Para realizar las pruebas de comunicación en caliente sin alterar la topología de la red de cavas:
1. **Bornera de Paso en Daisychain:** Se interviene la línea de 4 hilos en un punto medio accesible del cableado mediante una bornera exterior en paso continuo (*in-and-out*), evitando ramales en estrella (*stubs*) que degraden la señal.
2. **Conexión al Puente ADM489 con CAT-6E:** Se utilizan tramos cortos de cable CAT-6E respetando la asignación estricta por pares trenzados:
   * **Par 1 (TX):** Hacia entradas +/RX-$ de los controladores KIDE.
   * **Par 2 (RX):** Desde salidas +/TX-$ de los controladores KIDE.
   * **Masa / Drenaje:** Conectado a la referencia común (GND) para inmunidad ante ruido industrial de modo común.
3. **Cero Terminación en Punto Medio:** El módulo ADM489 operará con sus resistencias de terminación de 120 $\Omega$ desactivadas, ya que las terminaciones deben ubicarse exclusivamente en los dos extremos físicos de la línea.

### 8.2. Desacoplamiento de la Pasarela del WEB-700 y Terminación de 100 Ω
* **Aislamiento Físico en Gabinete:** Se desconecta la pasarela serial previa que comunicaba los controladores con el sistema Tridium Niagara / WEB-700. Esto erradica colisiones de tramas y contienda en el bus durante el barrido de *Auto-Discovery* de FridgeControl.
* **Bornera Terminal de 100 Ω:** En el borne del gabinete donde se extrae la pasarela (ahora extremo de línea), se instala una bornera fabricada expresamente con una resistencia de terminación de **\,\Omega$**. Al coincidir con la impedancia característica ($) del cableado CAT-6E, absorbe las reflexiones de onda terminales y mantiene la red original 100% intacta y balanceada.

### 8.3. Oportunidad de Reutilización de la Pasarela Serial Legacy
* Tras el aislamiento preventivo de la pasarela retirada del WEB-700, se procederá a su diagnóstico en mesa técnica de laboratorio (revisión de marca, modelo, rango de alimentación DC, diagrama de bornes y configuración de terminación/polarización interna).
* Si se confirma que es un convertidor industrial transparente RS-232/TTL a RS-422 de 4 hilos en carril DIN, podrá ser homologado para su aprovechamiento en la instalación final de DALVI, optimizando la inversión y reduciendo componentes adicionales.
