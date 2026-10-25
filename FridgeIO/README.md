# FridgeIO — Satélite Industrial Modbus RTU de E/S y Señalización
### Proyecto FridgeControl | Génica — Planta DALVI
**Autor:** Ing. Alfonso Aguirre  
**Hardware Target:** Tarjeta Industrial eletechsup ES32D26 / ES32A08 (ESP32 DevKit 38 pines)  
**Protocolo:** Modbus RTU Esclavo sobre bus físico RS-485 diferencial  
**Firmware Version:** v1.2.0 (Temporizadores Autónomos de Hardware)

---

## 1. Descripción del Proyecto

**FridgeIO** es el firmware de los satélites de campo diseñados para montarse en el punto medio entre dos cavas contiguas. Cada placa **ES32D26** actúa como un esclavo Modbus RTU puro (sin WiFi, sin web servers, determinista y de arranque instantáneo < 100 ms) encargado de:
* Accionar las torretas luminosas y zumbadores de 2 cavas completas (8 relés de potencia).
* Leer los sensores magnéticos (Reed switch) de puertas y botones físicos de ACK (8 entradas optoacopladas NPN).
* Ejecutar **temporizadores autónomos no bloqueantes en hardware** (5 segundos de pulso por relé y 5 segundos de Lamp Test) para que el esclavo sea el dueño absoluto de sus tiempos.
* Leer sondas de temperatura de respaldo Dallas DS18B20 mediante el bus de sensores de respaldo (protocolo 1-Wire), para disponer de una lectura independiente del controlador frigorífico principal.
* Gestionar la configuración administrativa remota **100% a través del bus RS-485**.

---

## 2. Distribución y Agrupamiento Funcional ("De 2 en 2")

Cada satélite atiende **2 Cavas contiguas (Canal A y Canal B)**. Por diseño de ingeniería de planta, todas las entradas y salidas físicas están agrupadas **de dos en dos por cada función**:

| Función Operativa | Canal A (Cava 1) | Canal B (Cava 2) | Tipo Físico en Placa | Lógica Eléctrica |
| :--- | :---: | :---: | :--- | :--- |
| **Supervisión de Puertas** | **Entrada 1** (DI 0) | **Entrada 2** (DI 1) | Contacto Magnético (Reed switch) | 1 = Puerta Cerrada, 0 = Puerta Abierta |
| **Pulsadores Físicos de Silencio** | **Entrada 3** (DI 2) | **Entrada 4** (DI 3) | Pulsador NA exterior en puerta | 1 = Pulsado (ACK Silencio), 0 = Reposo |
| **Contactos de Alarma KIDE** | **Entrada 5** (DI 4) | **Entrada 6** (DI 5) | Contacto Seco Relé Auxiliar Kide | 1 = Normal (OK), 0 = Disparado |
| **Entradas Auxiliares** | **Entrada 7** (DI 6) | **Entrada 8** (DI 7) | Reserva / Presostatos | 1 = Activo, 0 = Inactivo |

---

## 3. Mapa Completo de Registros Modbus RTU

### 3.1. Salidas a Relé y Comandos de Hardware (Coils / Funciones 01, 05, 15)

Cada relé físico cuenta con un **cronómetro autónomo en hardware de 5.000 ms**. Al recibir un pulso manual, el esclavo enciende el relé, mantiene el tiempo exacto con precisión de microcontrolador y lo apaga por sí mismo, actualizando su coil local para que el Maestro lea el cambio de estado.

| Dirección Coil | Canal Físico | Asignación en Cavas | Función y Comportamiento |
| :---: | :---: | :--- | :--- |
| `00001` (0) | Relé 1 | **Cava A** — Luz Verde | Estado normal, gobernado por FSM local |
| `00002` (1) | Relé 2 | **Cava A** — Luz Amarilla | Advertencia/alarma de puerta según temporización local |
| `00003` (2) | Relé 3 | **Cava A** — Luz Roja | Alarma de proceso o NOCOMM |
| `00004` (3) | Relé 4 | **Cava A** — Sirena / Buzzer | Alarma no reconocida de puerta/proceso |
| `00005` (4) | Relé 5 | **Cava B** — Luz Verde | Estado normal, gobernado por FSM local |
| `00006` (5) | Relé 6 | **Cava B** — Luz Amarilla | Advertencia/alarma de puerta según temporización local |
| `00007` (6) | Relé 7 | **Cava B** — Luz Roja | Alarma de proceso o NOCOMM |
| `00008` (7) | Relé 8 | **Cava B** — Sirena / Buzzer | Alarma no reconocida de puerta/proceso |
| `00009` (8) | Virtual | **Bus de sensores de respaldo** | `1` = Habilita lectura periódica de sondas DS18B20 en GPIO 4 (Persistente en NVS) |
| `00010` (9) | Comando | **Prueba de Lámparas** | Escribir `1` dispara Lamp Test de 5 segundos en los 8 relés físicos |
| `00011` (10) | Comando | **Cancelar / Stop Test** | Escribir `1` aborta de inmediato cualquier prueba y apaga relés |
| `00012` (11) | Virtual | **Alarma proceso A** | Estado de alarma de proceso recibido del Maestro |
| `00013` (12) | Virtual | **Alarma NOCOMM A** | KIDE A sin comunicación (estado recibido del Maestro) |
| `00014` (13) | Virtual | **Alarma proceso B** | Estado de alarma de proceso recibido del Maestro |
| `00015` (14) | Virtual | **Alarma NOCOMM B** | KIDE B sin comunicación (estado recibido del Maestro) |
| `00016`–`00023` (15–22) | Comando | **Prueba individual de relé** | Pulso de prueba local de 5 segundos por salida |

---

### 3.2. Entradas Digitales (Discrete Inputs / Función 02)
Lectura de sensores y pulsadores de campo con filtro antirrebote de 10 ms (1 = Activo / Contacto Cerrado a Masa, 0 = Inactivo / Abierto):

| Dirección Input | Borna Física | Asignación en Cavas | Sensor / Dispositivo en Campo |
| :---: | :---: | :--- | :--- |
| `10001` (0) | DI 1 | **Cava A** | Switch Magnético (Reed) Puerta (1 = Cerrada, 0 = Abierta) |
| `10002` (1) | DI 2 | **Cava B** | Switch Magnético (Reed) Puerta (1 = Cerrada, 0 = Abierta) |
| `10003` (2) | DI 3 | **Cava A** | Pulsador Físico de ACK (1 = Pulsado en sitio) |
| `10004` (3) | DI 4 | **Cava B** | Pulsador Físico de ACK (1 = Pulsado en sitio) |
| `10005` (4) | DI 5 | **Cava A** | Contacto Seco Alarma KIDE (1 = OK / 0 = Disparado) |
| `10006` (5) | DI 6 | **Cava B** | Contacto Seco Alarma KIDE (1 = OK / 0 = Disparado) |
| `10007` (6) | DI 7 | Reserva | Entrada Auxiliar Cava A |
| `10008` (7) | DI 8 | Reserva | Entrada Auxiliar Cava B |

---

### 3.3. Parámetros Administrativos Remotos (Holding Registers / Funciones 03, 06, 16)
Permite comisionar el módulo desde el Gateway o desde una laptop con conversor USB-RS485:

| Dirección | Registro | Rango / Valores | Descripción y Procedimiento |
| :---: | :--- | :---: | :--- |
| `40001` (0) | `REG_ADMIN_SLAVE_ID` | `1` a `247` | ID Modbus activo (ej. 100, 102, 104, 106, 108). |
| `40002` (1) | `REG_ADMIN_BAUDRATE_CODE` | `0`, `1`, `2` | `0` = 9600 bps (Defecto), `1` = 19200 bps, `2` = 38400 bps. |
| `40003` (2) | `REG_ADMIN_COMM_TIMEOUT_SEC` | `0` a `300` | Watchdog de bus (Defecto: 15 s). Si se corta el bus, silencia sirenas. |
| `40004` (3) | `REG_ADMIN_SAVE_EEPROM` | `0x55AA` (21930) | **Comando de Guardado:** Persiste ID, Baudrate y Timeout en memoria Flash NVS. |
| `40005` (4) | `REG_ADMIN_REBOOT` | `0xDEAD` (57005) | **Comando de Reinicio:** Reinicia el ESP32 para aplicar cambios. |
| `40006` (5) | `REG_ADMIN_LAMP_TEST_SEC` | `1` a `60` | Duración de la prueba de lámparas en segundos (Defecto: 5 s). |
| `40007` (6) | `DOOR_GRACE_A` | segundos | Retardo de advertencia de puerta del canal A, recibido del Maestro. |
| `40008` (7) | `DOOR_CRITICAL_A` | segundos | Retardo crítico de puerta del canal A, recibido del Maestro. |
| `40009` (8) | `DOOR_GRACE_B` | segundos | Retardo de advertencia de puerta del canal B, recibido del Maestro. |
| `40010` (9) | `DOOR_CRITICAL_B` | segundos | Retardo crítico de puerta del canal B, recibido del Maestro. |

> **Comisionamiento Remoto por RS-485:**  
> 1. Escribir el nuevo ID (ej. `102`) en el registro `40001`.
> 2. Escribir `21930` (`0x55AA`) en `40004` (guarda en memoria flash permanente).
> 3. Escribir `57005` (`0xDEAD`) en `40005` (reinicia el módulo para tomar el nuevo ID).

---

### 3.4. Diagnóstico de Salud y Bus de Sensores de Respaldo (Input Registers / Función 04)

| Dirección | Registro | Tipo | Descripción |
| :---: | :--- | :---: | :--- |
| `30001` (0) | `UPTIME_SEC_HI` | uint16 | Tiempo de encendido del módulo (Palabra alta de segundos). |
| `30002` (1) | `UPTIME_SEC_LO` | uint16 | Tiempo de encendido del módulo (Palabra baja de segundos). |
| `30003` (2) | `POLLS_COUNT_HI` | uint16 | Total de solicitudes Modbus atendidas (Palabra alta). |
| `30004` (3) | `POLLS_COUNT_LO` | uint16 | Total de solicitudes Modbus atendidas (Palabra baja). |
| `30005` (4) | `LAST_COMM_AGO_MS` | uint16 | Milisegundos transcurridos desde la última trama válida del maestro. |
| `30006` (5) | `FIRMWARE_VERSION` | uint16 | Versión del firmware (`120` = v1.2.0). |
| `30007` (6) | `TEMP_BACKUP_A` | int16 | Temperatura del sensor de respaldo del canal A en centésimas de °C (ej. `425` = 4.25°C; `-32768` = inválida o no disponible). |
| `30008` (7) | `TEMP_BACKUP_B` | int16 | Temperatura del sensor de respaldo del canal B en centésimas de °C (ej. `-1850` = -18.50°C; `-32768` = inválida o no disponible). |
| `30009` (8) | `1WIRE_ENABLED` | uint16 | Estado de habilitación del bus de sensores de respaldo (`1` = habilitado, `0` = deshabilitado). |
| `30010` (9) | `1WIRE_DEVICE_COUNT` | uint16 | Cantidad de sensores DS18B20 detectados en el bus de sensores de respaldo. |

Las temperaturas y el diagnóstico se leen mediante **FC04 (Read Input Registers)**. El valor se redondea a dos decimales para transmitirlo como entero con signo; la resolución física del DS18B20 sigue dependiendo de su configuración interna.

El FridgeIO ejecuta localmente la temporización de puerta, el reconocimiento ACK y la salida de relés. El Maestro envía por coils 11–14 las banderas de alarma de proceso y NOCOMM, y actualiza los retardos en holding registers 6–9. ACK silencia el buzzer y deja fija la luz de la alarma reconocida hasta que el estado de alarma recibido se normalice.

---

## 4. Asignación de Pines Hardware (eletechsup ES32D26)

```text
           +---------------------------------------+
           |       ESP32 DevKit (38 Pines)         |
           +---------------------------------------+
           | GPIO 1 (TX0)   --> RS-485 DI          |
           | GPIO 3 (RX0)   <-- RS-485 RO          |
           | GPIO 21        --> RS-485 DE/RE       |
           | GPIO 4         <-> Bus de sensores de respaldo DS18B20 (protocolo 1-Wire) |
           | GPIO 13        --> 74HC595 SER (Data) |
           | GPIO 12        --> 74HC595 RCLK (Latch|
           | GPIO 14        --> 74HC595 SRCLK (Clk)|
           | GPIO 27        --> 74HC595 OE (Output)|
           | GPIO 32        <-- 74HC165 QH (Data)  |
           | GPIO 33        --> 74HC165 SH (Latch) |
           | GPIO 25        --> 74HC165 CLK (Clock)|
           +---------------------------------------+
```

---

## 5. Reglas de Fail-Safe de Seguridad
1. **Autonomía ante pérdida del Maestro:** Si se pierde el bus RS-485, el FridgeIO conserva el último estado recibido de alarma de proceso/NOCOMM y continúa evaluando puertas, ACK y salidas localmente. El watchdog no cancela alarmas activas.
2. **Arranque Seguro:** Al energizarse la placa, el pin `OE` del 74HC595 se mantiene en nivel ALTO hasta que los registros de salida se limpian a cero, garantizando que **ningún relé conmute en falso durante el encendido**.
