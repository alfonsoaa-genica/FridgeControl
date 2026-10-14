# Especificación Técnica y Arquitectura de Señalización Luminosa (Andon) y Detección de Puertas
## Red de Supervisión de Cavas — Génica Planta DALVI
**Proyecto:** FridgeControl (Maestro Modbus RTU & Gateway IoT)  
**Autor y Dirección Técnica:** Ing. Alfonso Aguirre  
**Fecha:** Octubre 2026  
**Ubicación en Repositorio:** [`FridgeControl/doc/DISENO_SENALIZACION_LUMINOSA_Y_PUERTAS.md`](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/DISENO_SENALIZACION_LUMINOSA_Y_PUERTAS.md)  
**Documento Complementario:** [`FridgeControl/doc/ANALISIS_TECNICO_RED_DATOS_CAVAS.md`](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/doc/ANALISIS_TECNICO_RED_DATOS_CAVAS.md)

---

## 1. Justificación y Alcance Operativo

En las naves de refrigeración y maduración de planta DALVI (Génica), el tránsito continuo de montacargas, transpaletas y operadores genera dos riesgos críticos para el aseguramiento de la calidad del producto y la eficiencia energética:
1. **Pérdida de frío por puertas mal cerradas:** Descuido en el cierre de puertas frigoríficas tras maniobras de carga/descarga, lo que genera entrada masiva de calor y humedad, escarcha excesiva en evaporadores y sobrecarga de compresores.
2. **Latencia en la detección de fallas:** El personal en pasillo no tiene visibilidad inmediata del estado de la cava a menos que consulte una pantalla SCADA o abra el tablero del controlador.

El objetivo de este subsistema es dotar a cada cava de una **señalización visual y acústica de alta visibilidad (tipo Andon)** en la parte superior/dintel de la puerta, combinada con un **sensor magnético industrial (Reed switch)** para supervisión de cierre y un **botón físico de reconocimiento (ACK)** para forzar la presencia del operador en sitio.

---

## 2. Hardware Homologado

### 2.1. Torretas Andon Industriales Articuladas (12V - 24V DC + Buzzer)
* **Referencia Homologada:** Torreta industrial de 3 niveles con base articulada abatible y zumbador integrado (Formato tipo Jowwcen / Baomain LTA-502TJ).
* **Costo referencial:** ~$89.99 USD por paquete de 6 unidades (**$15.00 USD por cava**).
* **Óptica:** 3 lentes cilíndricos continuos (Rojo superior, Amarillo intermedio, Verde inferior) con visibilidad de 360°.
* **Base Articulada (Abatible 90°):** Permite fijación directa en pared vertical, dintel plano o vigas inclinadas sin requerir escuadras ni herrajes adicionales. Ofrece absorción mecánica ante roces accidentales de escaleras o cargas elevadas.
* **Alarma Sonora Integrada:** Buzzer piezoeléctrico de alto decibelio en la base para alertar al personal incluso sobre el ruido de fondo de compresores y montacargas.
* **Tensión de Trabajo:** Rango universal **12V a 24V DC**, compatible con las fuentes de alimentación estándar de tablero.

```
                 TORRETA INDUSTRIAL CON BASE ARTICULADA
                 
                     ┌──────────────────┐
                     │   MÓDULO ROJO    │ ◄─── Alarma Pérdida de Frío (SP violado)
                     ├──────────────────┤
                     │ MÓDULO AMARILLO  │ ◄─── Alarma Puerta Mal Cerrada (> 90 s)
                     ├──────────────────┤
                     │   MÓDULO VERDE   │ ◄─── Cava Normal / Frío y Humedad OK
                     ├──────────────────┤
                     │  BUZZER ACÚSTICO │ ◄─── Zumbador de alta potencia
                     │ (Base Ranurada)  │      (Disparo por tiempo prolongado o emergencia)
                     └────────┬─────────┘
                              │
                        [ RÓTULA / EJE  ] ◄─── Articulación abatible 0° a 90°
                        [ DE INCLINACIÓN]
                              │
                      [ BASE CUADRADA ] ◄─── Fijación por 4 tornillos directos
```

### 2.2. Controlador de E/S Satélite: eletechsup ES32D26 / ES32A08
* **Capacidad por Módulo:** Controla de forma 100% independiente **dos cavas contiguas**.
* **Recursos On-Board:**
  * **8 Salidas a Relé de Potencia (10A / 250V AC o 30V DC):** 4 relés por cada cava (Verde, Amarillo, Rojo, Buzzer).
  * **8 Entradas Digitales Optoacopladas (3-24V NPN):**
    * DI 1: Reed Switch Puerta Cava A
    * DI 2: Reed Switch Puerta Cava B
    * DI 3: Pulsador Físico ACK Cava A
    * DI 4: Pulsador Físico ACK Cava B
    * DI 5: Contacto de Alarma Físico KIDE Cava A (Borna 7 OK)
    * DI 6: Contacto de Alarma Físico KIDE Cava B
    * DI 7-8: Reservas para presostato o fallo térmico.
  * **Puerto RS-485 Nativo:** Con transceptor industrial y control DE/RE en GPIO 21.
  * **Display de 4 Dígitos de 7 Segmentos:** Muestra alternada de temperatura local de ambas cavas.
  * **Soporte de Carril DIN:** Carcasa estanca con fijación a carril DIN estándar de 35 mm.

### 2.3. Sensores y Pulsadores de Campo
* **Sensor de Puerta:** Switch magnético blindado de uso pesado para puertas frigoríficas industriales (aluminio fundido IP67, separación de 20 a 40 mm).
* **Botón de Reconocimiento (ACK):** Pulsador industrial de 22 mm IP65 de retorno por muelle, instalado junto al marco de la puerta de cada cava.

---

## 3. Filosofía Operativa y Jerarquía de Señalización (Estándar ISA-18.2)

### 3.1. Máquina de Estados con Presencia Física Obligatoria (Botón ACK)

```
      [ PUERTA ABIERTA > 90 s ]          [ PÉRDIDA DE FRÍO (PV >= SP + Δ) ]
                  │                                      │
                  ▼                                      ▼
      ┌───────────────────────┐              ┌───────────────────────┐
      │  Luz AMARILLA FIJA    │              │  Luz ROJA PARPADEANDO │
      │  (Aviso silencioso)   │              │   + BUZZER CONTINUO   │
      └───────────┬───────────┘              └───────────┬───────────┘
                  │                                      │
             ¿t > 180 s?                                 │
                  │                                      │
                  ▼                                      │
      ┌───────────────────────┐                          │
      │ Luz AMARILLA FLASH    │                          │
      │   + BUZZER ACTIVO     │                          │
      └───────────┬───────────┘                          │
                  │                                      │
                  └──────────────────┬───────────────────┘
                                     │
                        Operador CAMINA a la Cava
                        y pulsa el BOTÓN FÍSICO ACK
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │    ESTADO EN ATENCIÓN       │
                      │ • Buzzer: SE SILENCIA       │
                      │ • Luz: Pasa a FIJA          │
                      │ • Temporizador Snooze: 10 m │
                      └──────────────┬──────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      ▼                             ▼
              ¿Problema RESUELTO?          ¿Pasaron 10 min sin
            (Puerta cerrada / Temp OK)      resolver el problema?
                      │                             │
                      ▼                             ▼
             ┌─────────────────┐           ┌─────────────────┐
             │ LUZ VERDE FIJA  │           │   RE-ALARMA     │
             │ Normalidad Total│           │ • Buzzer Vuelve │
             └─────────────────┘           │   a Dispararse  │
                                           └─────────────────┘
```

### 3.2. Matriz de Estados de la Torreta

| Color | Comportamiento | Buzzer | Causa Disparadora | Significado en Planta |
| :---: | :---: | :---: | :--- | :--- |
| **VERDE** | Fijo continuo | OFF | Cava en rango, puerta cerrada y enlace RS-485 OK. | Operación óptima y normal. |
| **AMARILLO**| Fijo continuo | OFF | Puerta abierta entre $90\text{ s}$ y $180\text{ s}$. | Alerta preventiva visual para cierre. |
| **AMARILLO**| Parpadeo rápido | **ON** | Puerta abierta por más de $180\text{ s}$ (3 min) sin ACK. | Alarma sonora: penetración térmica activa. |
| **AMARILLO**| Fijo continuo | OFF | Puerta abierta $> 180\text{ s}$ con **ACK pulsado**. | Operador en sitio atendiendo maniobra. |
| **ROJO** | Parpadeo rápido | **ON** | Desviación de temperatura ($PV \ge SP + \Delta$) sin ACK. | Alarma crítica de frío: riesgo de producto. |
| **ROJO** | Fijo continuo | OFF | Desviación de temperatura con **ACK pulsado**. | Falla reconocida por el técnico en sitio. |
| **ROJO** | Intermitente | OFF | Pérdida de comunicación Modbus con el KIDE. | Alerta técnica de pérdida de telemetría. |

---

## 4. Mapa de Direccionamiento Modbus RTU (Satélites ES32D26)

Para aislar limpiamente los controladores Kide de los módulos de señalización, los satélites se ubican en el rango **base 100d**:

| Satélite Físico | Dirección Modbus | Cavas Atendidas | Kide Asociados |
| :---: | :---: | :---: | :---: |
| **Satélite 1** | **ID 100** | Cava 1 y Cava 2 | KIDE ID 1 & KIDE ID 2 |
| **Satélite 2** | **ID 102** | Cava 3 y Cava 4 | KIDE ID 3 & KIDE ID 4 |
| **Satélite 3** | **ID 104** | Cava 5 y Cava 6 | KIDE ID 5 & KIDE ID 6 |
| **Satélite 4** | **ID 106** | Cava 7 y Cava 8 | KIDE ID 7 & KIDE ID 8 |
| **Satélite 5** | **ID 108** | Cava 9 y Cava 10 | KIDE ID 9 & KIDE ID 10 |

### 4.1. Mapa de Registros Estándar por Satélite (Base 100, 102, 104...)

#### Entradas Digitales (Discrete Inputs - Función 02 / Coils):
* `10001` (DI 1): Reed Switch Puerta Cava A (0 = Abierta, 1 = Cerrada)
* `10002` (DI 2): Reed Switch Puerta Cava B (0 = Abierta, 1 = Cerrada)
* `10003` (DI 3): Pulsador Físico ACK Cava A (1 = Pulsado / Activo)
* `10004` (DI 4): Pulsador Físico ACK Cava B (1 = Pulsado / Activo)
* `10005` (DI 5): Contacto Físico de Alarma KIDE Cava A (0 = Alarma / Relé abierto, 1 = OK)
* `10006` (DI 6): Contacto Físico de Alarma KIDE Cava B (0 = Alarma / Relé abierto, 1 = OK)

#### Salidas a Relé (Coils - Función 01 y 05/15):
* `00001` (DO 1): Luz Verde Torreta Cava A
* `00002` (DO 2): Luz Amarilla Torreta Cava A
* `00003` (DO 3): Luz Roja Torreta Cava A
* `00004` (DO 4): Buzzer Torreta Cava A
* `00005` (DO 5): Luz Verde Torreta Cava B
* `00006` (DO 6): Luz Amarilla Torreta Cava B
* `00007` (DO 7): Luz Roja Torreta Cava B
* `00008` (DO 8): Buzzer Torreta Cava B

---

## 5. Topología Física de Cableado y Distribución en Planta

### 5.1. Ubicación Centralizada por Par de Cavas (Punto Medio)
El módulo ES32D26 se instala en una caja estanca IP65 colocada a media altura en la pared exterior **en el punto medio exacto** entre las dos cavas contiguas:
* Distancia hacia Puerta Cava A: **~3 a 5 metros**.
* Distancia hacia Puerta Cava B: **~3 a 5 metros**.
* Manguera de campo: Una única manguera apantallada de 7 u 8 hilos de $0.5\text{ mm}^2$ por cava para alimentar la torreta (V/A/R/Buzzer/0V) y retornar el Reed switch y botón ACK.

### 5.2. Estrategia de Inserción en Línea del Bus RS-485 (Reutilización de Cable)
Para evitar tendidos de retorno o derivaciones en estrella (T-stubs), se intercepta el cable RS-485 existente en la bandeja portacables:

```
BANDEJA PORTACABLES / PASILLO DE CAVAS EN PLANTA DALVI
═════════════════════════════════════════════════════════════════════════════════════►

       [ CAVA 1 ]                       [ EN MEDIO ]                       [ CAVA 2 ]
     ┌────────────┐                  ┌────────────────┐                  ┌────────────┐
     │ KIDE KP100 │                  │ ES32D26 (I/O)  │                  │ KIDE KP100 │
     │  (Cava 1)  │                  │ (Cavas 1 y 2)  │                  │  (Cava 2)  │
     └─────┬──────┘                  └───────┬────────┘                  └─────┬──────┘
           │                                 │                                 │
           │ ◄──── Cable Existente ────────► │ ◄──── Nuevo Tramo Puente ─────► │
           │                                 │                                 │
           ▼                                 ▼                                 ▼
        Bus RS-485                       Bus RS-485                        Bus RS-485
     (Llega de Gateway                (Entra y sale por                 (Continúa hacia
      o Cava anterior)                 Bornas A/B del ES32D26)           la Cava 3...)
```

#### Ventajas de este método:
1. **Reutilización:** Se aprovecha el cable que ya recorre la bandeja desde la Cava 1 y se reconduce a la caja central del ES32D26.
2. **Daisy-Chain Lineal 100% Puro:** El bus avanza en una sola dirección física sin bucles:
   $$\text{KIDE 1} \longrightarrow \text{ES32D26 (ID 100)} \longrightarrow \text{KIDE 2} \longrightarrow \text{ES32D26 (ID 102)} \dots$$
3. **Derivación Nula ($0\text{ cm}$):** Cero rebotes reflexivos de señal; máxima velocidad y robustez eléctrica.

---

## 6. Integración en el Firmware y Supervisión SCADA

### 6.1. Extensión de Estructuras en [`AppConfig.h`](file:///c:/Users/aguir/Documents/PlatformIO/Projects/FridgeControl/include/AppConfig.h)

```cpp
// Estados de Torreta Andon
enum TowerLightState {
    TOWER_GREEN       = 0, // Frío normal, puerta cerrada
    TOWER_YELLOW_WARN = 1, // Puerta abierta silenciosa (> 90 s)
    TOWER_YELLOW_ALARM= 2, // Puerta abierta con buzzer (> 180 s)
    TOWER_YELLOW_ACK  = 3, // Puerta abierta con ACK en atención
    TOWER_RED_ALARM   = 4, // Pérdida de frío con buzzer
    TOWER_RED_ACK     = 5, // Pérdida de frío con ACK en atención
    TOWER_COMM_ERROR  = 6  // Fallo de comunicación RS-485
};

// Parámetros de Puerta y Señalización por Cava
struct CavaState {
    // ... parámetros existentes de temperatura, humedad y actuadores ...

    // Supervisión de Puerta y ACK
    bool door_closed;              // true: cerrada, false: abierta
    uint32_t door_open_epoch;      // Momento de apertura (ms)
    uint16_t door_grace_sec;       // Cortesía silenciosa (defecto: 90 s)
    uint16_t door_buzzer_sec;      // Disparo de buzzer (defecto: 180 s)
    bool ack_pressed;              // true si el operario pulsó ACK en sitio
    uint32_t ack_timestamp;        // Momento en que se pulsó ACK (ms)
    uint16_t ack_grace_sec;        // Tiempo de gracia post-ACK (defecto: 600 s / 10 min)

    // Contacto Físico de Alarma KIDE
    bool kide_hw_alarm_contact;    // true: OK (cerrado), false: Alarma de hardware abierta

    // Estado físico de la torreta
    TowerLightState tower_state;
    bool buzzer_active;

    void updateSignalingLogic(uint32_t now_ms) {
        if (!comm_online) {
            tower_state = TOWER_COMM_ERROR;
            buzzer_active = false;
            return;
        }

        // Lógica de apertura de puerta
        uint32_t door_open_duration = (!door_closed) ? ((now_ms - door_open_epoch) / 1000) : 0;
        bool door_exceeded = (!door_closed && door_open_duration >= door_grace_sec);
        bool door_critical = (!door_closed && door_open_duration >= door_buzzer_sec);

        // Evaluación de ACK y re-alarma post 10 minutos
        bool ack_valid = false;
        if (ack_pressed && (!door_closed || alarm_temp_high)) {
            uint32_t ack_elapsed_sec = (now_ms - ack_timestamp) / 1000;
            if (ack_elapsed_sec < ack_grace_sec) {
                ack_valid = true; // Sigue vigente el silencio por presencia del operador
            } else {
                ack_pressed = false; // Expiró el tiempo de atención: Re-alarma
            }
        } else if (door_closed && !alarm_temp_high) {
            ack_pressed = false; // Se resolvió el problema: Reset automático
        }

        // Jerarquía de luces y buzzer
        if (alarm_temp_high || alarm_hr_high || alarm_hr_low || !kide_hw_alarm_contact) {
            // Alarma Crítica de Frío o Hardware
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
            // Operación Normal
            tower_state = TOWER_GREEN;
            buzzer_active = false;
        }
    }
};
```

### 6.2. Telemetría MQTT hacia SCADA FUXA e InfluxDB (Trazabilidad HACCP)
Cada transición de estado se publica automáticamente por MQTT:
* `fridgecontrol/cava/{id}/door`: `"CLOSED"` o `"OPEN"`
* `fridgecontrol/cava/{id}/door_open_sec`: Tiempo transcurrido de apertura.
* `fridgecontrol/cava/{id}/tower_state`: `"GREEN"`, `"YELLOW"`, `"RED"`.
* `fridgecontrol/cava/{id}/buzzer`: `"ON"` o `"OFF"`.
* `fridgecontrol/cava/{id}/ack_event`: Timestamp de presencia del operador en sitio (para cálculo del tiempo de reacción MTTA en reportes de auditoría de planta).
