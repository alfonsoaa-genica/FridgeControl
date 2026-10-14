# Guía de Integración MQTT & Arquitectura de Tópicos para FUXA SCADA

## 1. Concepto Fundamental
Toda la jerarquía de comunicación MQTT del sistema se deriva de un único parámetro configurable:
* **Tópico Principal / Raíz (`base_topic`)**: por defecto `genica/dalvi/cavas` (configurable a voluntad, ej: `planta1/lacteos/cavas`).

A partir de este tópico base, el Maestro construye y administra automáticamente el árbol completo de telemetría, eventos en tiempo real y comandos de control bidireccional.

---

## 2. Mapa Completo de Tópicos Derivados

```text
{base_topic}/
├── maestro/
│   ├── status                     <-- LWT (Last Will): "online" / "offline"
│   └── telemetria                 <-- Estado de salud del ESP32-S3 Maestro
│
├── cavas/
│   ├── {cava_id}/
│   │   ├── telemetria             <-- Telemetría periódica de variables y relés de frío
│   │   ├── eventos                <-- Publicación instantánea por disparo/normalización de alarmas
│   │   ├── torreta                <-- Estado de señalización luminosa y acústica en cava
│   │   └── cmd/
│   │       └── setpoint           <-- [SUSCRITO] Comando remoto para cambiar consigna (SP)
│
└── nodos/
    ├── {node_id}/
    │   ├── telemetria             <-- Estado periódico de entradas, salidas y sondas de respaldo
    │   ├── eventos                <-- Publicación instantánea por cambio físico (puerta, pulsador)
    │   └── cmd                    <-- [SUSCRITO] Comando para Lamp Test o forzado de relé
```

---

## 3. Especificación Detallada de Tópicos y Cargas Útiles (JSON)

### A. Tópicos de Cavas (Controladores KIDE)

#### 1. Telemetría Periódica de Cava
* **Tópico:** `{base_topic}/cavas/{cava_id}/telemetria`
* **Ejemplo de Tópico:** `genica/dalvi/cavas/cavas/C1/telemetria`
* **Frecuencia:** Cada 3 segundos.
* **Payload JSON:**
```json
{
  "cava": "C1",
  "descripcion": "Cava Conservacion Lacteos 1",
  "tipo": "conservacion",
  "temp_pv": 4.2,
  "temp_sp": 4.0,
  "temp_evap": -2.1,
  "hr_pv": null,
  "hr_sp": null,
  "has_humidity": false,
  "cooling": 1,
  "fan": 1,
  "defrost": 0,
  "heating": 0,
  "humidifier": 0,
  "exhaust": 0,
  "door_closed": true,
  "kide_alarm": false,
  "comm_status": "ONLINE",
  "rtt_ms": 18,
  "quality_pct": 100.0,
  "ts": 1776126250,
  "datetime": "2026-10-13 20:25:00"
}
```

#### 2. Eventos y Alarmas en Tiempo Real de Cava
* **Tópico:** `{base_topic}/cavas/{cava_id}/eventos`
* **Disparo:** Inmediato al cambiar de estado (no espera al ciclo de 3s).
* **Payload JSON:**
```json
{
  "cava": "C1",
  "evento": "ALERTA_PUERTA_ABIERTA",
  "severidad": "WARNING",
  "mensaje": "Puerta abierta ha superado los 90 segundos",
  "puerta_cerrada": false,
  "duracion_segundos": 95,
  "ack_activo": false,
  "ts": 1776126255
}
```
*Eventos posibles:*
* `PUERTA_ABIERTA` / `PUERTA_NORMALIZADA`
* `ALARMA_PUERTA_CRITICA` (> 180s con sirena)
* `ALARMA_TEMPERATURA_ALTA` / `TEMPERATURA_NORMALIZADA`
* `FALLO_HARDWARE_KIDE` (contacto seco disparado)
* `SILENCIADO_OPERADOR_ACK` (pulsador presionado en cava)
* `PERDIDA_COMUNICACION_BUS` / `COMUNICACION_RESTABLECIDA`

#### 3. Estado de Torreta de Cava
* **Tópico:** `{base_topic}/cavas/{cava_id}/torreta`
* **Payload JSON:**
```json
{
  "cava": "C1",
  "luz_verde": true,
  "luz_amarilla": false,
  "luz_roja": false,
  "buzzer": false,
  "estado": "NORMAL",
  "valvula_solenoide_na": "ENERGIZADA_CERRADA"
}
```

#### 4. Comando de Cambio de Setpoint Remoto (Desde FUXA)
* **Tópico:** `{base_topic}/cavas/{cava_id}/cmd/setpoint`
* **Ejemplo:** `genica/dalvi/cavas/cavas/C1/cmd/setpoint`
* **Formato Aceptado:**
  * Opción JSON: `{"setpoint": 3.5}` o `{"sp": 3.5}`
  * Opción Valor Plano: `3.5`

---

### B. Tópicos de Nodos Satélites (FridgeIO)

#### 1. Telemetría Periódica de Nodo Satélite
* **Tópico:** `{base_topic}/nodos/{node_id}/telemetria`
* **Ejemplo:** `genica/dalvi/cavas/nodos/100/telemetria`
* **Frecuencia:** Cada 3 segundos.
* **Payload JSON:**
```json
{
  "node_id": 100,
  "online": true,
  "calidad_bus_pct": 100.0,
  "rtt_ms": 21,
  "cava_a": "C1",
  "cava_b": "C2",
  "entradas": {
    "puerta_cerrada_a": true,
    "pulsador_ack_a": false,
    "contacto_kide_a": false,
    "puerta_cerrada_b": true,
    "pulsador_ack_b": false,
    "contacto_kide_b": false
  },
  "reles": {
    "rele_1_verde_a": false,
    "rele_2_amarillo_a": false,
    "rele_3_rojo_a": false,
    "rele_4_buzzer_a": false,
    "rele_5_verde_b": false,
    "rele_6_amarillo_b": false,
    "rele_7_rojo_b": false,
    "rele_8_buzzer_b": false
  },
  "sondas_1wire": {
    "habilitado": true,
    "temp_respaldo_a": 4.1,
    "temp_respaldo_b": -18.2
  },
  "ts": 1776126250
}
```

#### 2. Eventos Inmediatos de Entrada Física
* **Tópico:** `{base_topic}/nodos/{node_id}/eventos`
* **Disparo:** Transición instantánea en optoacopladores (74HC165).
* **Payload JSON:**
```json
{
  "node_id": 100,
  "canal": "A",
  "cava": "C1",
  "evento": "PULSADOR_ACK_ACCIONADO",
  "estado": true,
  "ts": 1776126260
}
```

#### 3. Comando de Control Remoto de Relés / Test (Desde FUXA)
* **Tópico:** `{base_topic}/nodos/{node_id}/cmd`
* **Comando Lamp Test (5 segundos):**
```json
{
  "action": "lamp_test",
  "duration_sec": 5
}
```
* **Comando Cancelar / Apagar Test:**
```json
{
  "action": "stop_test"
}
```
* **Comando Conmutar Relé Específico (5 segundos ON y luego OFF):**
```json
{
  "action": "toggle_relay",
  "relay": 1,
  "duration_sec": 5
}
```

---

### C. Tópicos del Maestro (Diagnóstico de Sistema)

#### 1. Disponibilidad LWT (Last Will and Testament)
* **Tópico:** `{base_topic}/maestro/status`
* **Valores:** `"online"` (publicado con Retain al conectar) / `"offline"` (publicado automáticamente por el Broker si el Maestro pierde energía o Wi-Fi).

#### 2. Telemetría de Infraestructura del Maestro
* **Tópico:** `{base_topic}/maestro/telemetria`
* **Payload JSON:**
```json
{
  "dispositivo": "FridgeControl Master ESP32-S3",
  "ip": "192.168.10.35",
  "rssi_dbm": -58,
  "heap_libre_bytes": 198420,
  "uptime_segundos": 84210,
  "cavas_totales": 12,
  "nodos_totales": 6,
  "nodos_online": 6,
  "bus_calidad_promedio": 99.8
}
```

---

## 4. Guía de Configuración en FUXA SCADA

1. **Configurar el Dispositivo MQTT en FUXA:**
   * En **Settings > Devices**, crear un dispositivo de tipo **MQTT**.
   * Host: IP de tu Broker (ej. `192.168.10.10` o Broker Nexus).
   * Puerto: `1883`.

2. **Crear Tags vinculados a Cavas (Lectura de JSON):**
   * **Tag:** `C1_Temp_PV`
     * Address: `genica/dalvi/cavas/cavas/C1/telemetria`
     * Type: `Number`
     * Parser JSON Path: `$.temp_pv`
   * **Tag:** `C1_Temp_SP`
     * Address: `genica/dalvi/cavas/cavas/C1/telemetria`
     * Parser JSON Path: `$.temp_sp`
   * **Tag:** `C1_Compresor_Activo`
     * Address: `genica/dalvi/cavas/cavas/C1/telemetria`
     * Parser JSON Path: `$.cooling`
   * **Tag:** `C1_Puerta_Cerrada`
     * Address: `genica/dalvi/cavas/cavas/C1/telemetria`
     * Parser JSON Path: `$.door_closed`

3. **Crear Tag para Comando de Escritura de Setpoint desde FUXA:**
   * **Tag:** `C1_Set_SP`
     * Address (Publish): `genica/dalvi/cavas/cavas/C1/cmd/setpoint`
     * Type: `Number`
     * Payload template: `{"setpoint": {{value}}}`
