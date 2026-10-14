# Documentación Técnica y Funcional: Diagramas de Tendencia de 24 Horas en NDJSON

## 1. Resumen Ejecutivo
El sistema **FridgeControl** incorpora un subsistema de adquisición y graficación de series temporales de 24 horas continuas para cada cava frigorífica supervisada. Para garantizar la estabilidad del microcontrolador ESP32-S3 y evitar la fragmentación de memoria (heap exhaustion), los datos históricos se transmiten mediante **NDJSON (Newline Delimited JSON)** en streaming directo.

---

## 2. Documentación Técnica

### 2.1. Arquitectura de Almacenamiento en RAM (Circular Ring Buffer)
* **Ubicación en memoria:** Memoria SRAM estática interna del ESP32 (sin acceso a flash en cada muestra para evitar desgaste de memoria no volátil).
* **Frecuencia de Muestreo (`TREND_INTERVAL_MS`):** 5 minutos (300.000 ms) exactos, sincronizados por el lazo de adquisición cíclica de Modbus.
* **Capacidad del Búfer (`MAX_TREND_POINTS`):** 288 muestras por cava.
  $$\text{Duración total} = 288 \text{ muestras} \times 5 \text{ minutos} = 1.440 \text{ minutos} = 24.0 \text{ horas}$$
* **Huella de Memoria por Muestra (`TrendPoint`):** 8 bytes.
  ```cpp
  struct TrendPoint {
    uint32_t ts;      // Epoch UNIX timestamp (4 bytes)
    int16_t temp_x10; // Temperatura con resolución 0.1 °C (2 bytes)
    int16_t hr_x10;   // Humedad con resolución 0.1 % o -1 si no aplica (2 bytes)
  };
  ```
* **Consumo Total de RAM:** $\approx 2.3 \text{ KB}$ por cava ($\approx 36.8 \text{ KB}$ para 16 cavas simultáneas), dejando más del 70% de la RAM del ESP32 libre para la pila TCP/IP y el servidor web.

### 2.2. Protocolo de Transmisión: Streaming NDJSON
* **Endpoint HTTP:** `GET /rest/history?cava={id}`
* **Content-Type:** `application/x-ndjson`
* **Mecanismo de Salida en Firmware:** `AsyncResponseStream` de `ESPAsyncWebServer`. La transmisión se realiza en bloques TCP streaming sin acumular un único string gigante en memoria.

#### Esquema de Línea NDJSON:
Cada muestra histórica se emite en una única línea terminada por salto de línea (`\n`):

1. **Cava de Conservación (o sin control de humedad):**
   ```json
   {"ts":1773489600,"tp":4.2,"hr":null}
   {"ts":1773489900,"tp":4.3,"hr":null}
   {"ts":1773490200,"tp":4.1,"hr":null}
   ```
   * `"tp"`: Número decimal con 1 cifra (Temperatura de Proceso en °C).
   * `"hr"`: `null` explícito.

2. **Cava de Maduración (con control activo de humedad):**
   ```json
   {"ts":1773489600,"tp":12.1,"hr":84.8}
   {"ts":1773489900,"tp":12.0,"hr":85.0}
   {"ts":1773490200,"tp":12.2,"hr":85.2}
   ```
   * `"tp"`: Temperatura en °C.
   * `"hr"`: Humedad Relativa en %.

### 2.3. Consumo en Frontend (React / Axios)
La función `fetchCavaHistory` solicita el flujo como texto plano, divide las líneas por el delimitador `\n`, descarta líneas vacías y parsea cada línea con `JSON.parse(line)`.
* **Ventaja:** Si la conexión se interrumpe durante la transmisión de los 288 puntos, el frontend puede graficar las líneas recibidas hasta el momento sin lanzar un error de sintaxis JSON.

---

## 3. Documentación Funcional (Experiencia de Operador)

### 3.1. Acceso al Modo Enfoque (Zoom de Cava)
* En la pantalla principal **Cavas en Vivo** (`/cavas/dashboard`), cada tarjeta de cava dispone de un botón de **Pantalla Completa / Enfoque** (`FocusIcon`).
* Al hacer clic, se abre una ventana modal de alto contraste diseñada especialmente para terminales táctiles industriales y pantallas móviles de 6 pulgadas.

### 3.2. Comportamiento Diferenciado por Tipo de Cava

| Característica | Cava de Conservación (`conservacion`) | Cava de Maduración (`maduracion`) |
| :--- | :--- | :--- |
| **Dígitos Gigantes Superiores** | Solo Temperatura PV (°C) con su consigna SP. | Temperatura PV (°C) y Humedad Relativa PV (% HR) lado a lado. |
| **Curva de Temperatura** | **Sí** (Línea sólida azul `#1976d2`). | **Sí** (Línea sólida azul `#1976d2`). |
| **Línea de Consigna Temp (SP)** | **Sí** (Línea ámbar discontinua `#ff9800`). | **Sí** (Línea ámbar discontinua `#ff9800`). |
| **Curva de Humedad Relativa** | **Oculta** (No distrae al operador). | **Sí** (Línea discontinua verde azulado `#00897b`). |
| **Eje Y Izquierdo** | Escala de Temperatura (°C) auto-escalada dinámicamente. | Escala de Temperatura (°C). |
| **Eje Y Derecho** | No visible. | Escala de Humedad Relativa (% HR). |
| **Leyenda Inferior** | Indica total de muestras NDJSON, curva Temp y SP. | Indica muestras NDJSON, curva Temp, SP Temp, y curva HR. |
| **Eje X Temporal** | Rango visible: Desde **"Hace 24h"** hasta **"Ahora"**. | Rango visible: Desde **"Hace 24h"** hasta **"Ahora"**. |

### 3.3. Auto-Escalado Dinámico del Diagrama
Para evitar que temperaturas bajo cero (ej. cavas de congelación a -18°C) o variaciones sutiles (ej. conservación entre 2°C y 6°C) queden fuera de la gráfica o aplanadas:
* El gráfico calcula automáticamente el mínimo y máximo de las 24 horas y ajusta la escala Y vertical con un margen de holgura.
* Si el operador modifica la consigna (SP), la línea de referencia se reubica instantáneamente en el valor seleccionado.
