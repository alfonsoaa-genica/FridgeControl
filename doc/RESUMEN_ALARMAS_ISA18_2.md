# Resumen de alarmas y señalización ISA-18.2

**Aplicación:** FridgeControl / FridgeIO — supervisión de cavas  
**Actualizado:** 25 de octubre de 2026  
**Documento de diseño ampliado:** [Diseño de Señalización Luminosa y Puertas](./DISENO_SENALIZACION_LUMINOSA_Y_PUERTAS.md)

## Alcance

Todas las cavas cubiertas por este proyecto son de **agua helada y utilizan FanCoils**. No existen compresores propios en las cavas ni el sistema los controla. FridgeControl supervisa las variables reportadas por los controladores KIDE y las alarmas asociadas al proceso del FanCoil; no supervisa ni controla una planta de compresión.

Este documento resume la filosofía de alarmas implementada para las cavas: detección de puerta abierta, desviaciones de temperatura y humedad, contacto de alarma del controlador KIDE, reconocimiento local y señalización Andon. La solución toma ISA-18.2 como referencia de gestión de alarmas; este resumen no constituye una declaración de certificación ni de conformidad integral con el estándar.

## Umbrales y temporizaciones de fábrica

Los siguientes valores son los valores predeterminados de cada cava. Los tiempos de puerta y los parámetros térmicos se pueden ajustar desde **Proyecto → Alarmas**.

| Condición | Regla predeterminada | Indicación |
|---|---|---|
| Puerta abierta — advertencia | Abierta durante **90 s** continuos | Ámbar, buzzer apagado |
| Puerta abierta — crítica | Abierta durante **180 s** continuos | Ámbar y buzzer, salvo ACK vigente |
| Alta temperatura de la cava | `PV >= SP + 2,5 °C` de forma continua durante **300 s** | Rojo y buzzer, salvo ACK válido |
| Humedad baja | `HR <= 80 %` en cavas con humedad | Alarma de proceso |
| Humedad alta | `HR >= 90 %` en cavas con humedad | Alarma de proceso |
| Contacto físico KIDE | Contacto abierto / estado no OK | Alarma de proceso |
| Reconocimiento local (ACK) | Pulsador físico en la cava | Silencia el buzzer y fija la luz hasta que la causa se normalice |
| Pérdida de comunicación KIDE | Cava no responde por Modbus | Estado de error de comunicación; buzzer apagado |

Los límites de humedad se evalúan directamente, sin un retardo de confirmación en la lógica actual. Las cavas sin humedad no evalúan las alarmas de HR.

## Prioridad y comportamiento

1. **Comunicación con KIDE perdida:** estado `TOWER_COMM_ERROR`; rojo intermitente, buzzer apagado. Tras ACK pasa a rojo fijo hasta que se recupere la comunicación.
2. **Alarma de proceso:** alta temperatura, humedad fuera de límites o contacto KIDE en alarma producen estado rojo.
3. **Puerta abierta crítica:** si no hay una alarma de proceso de mayor prioridad, produce estado ámbar crítico.
4. **Puerta abierta preventiva:** al superar el tiempo de gracia, pero antes del umbral crítico, produce estado ámbar silencioso.
5. **Normal:** cava comunicada, sin alarmas activas y sin puerta abierta fuera de tiempo produce estado verde.

El ACK físico no corrige la causa: la reconoce para el canal de esa cava, silencia el buzzer y detiene la intermitencia mientras la alarma siga activa. No hay temporizador de re-alarma post-ACK. El reconocimiento se limpia al normalizarse la causa que lo originó; la señal visual de alarma permanece hasta entonces.

## Señalización y E/S por cava

Cada FridgeIO asociado controla dos cavas. Cada canal usa cuatro salidas: verde, ámbar, rojo y buzzer. Las entradas reportan puerta, ACK y contacto de alarma KIDE. Los estados de cava incluyen además comunicación y calidad de enlace Modbus.

El Maestro evalúa los datos del KIDE y envía al FridgeIO asociado banderas separadas de alarma de proceso y NOCOMM. El FridgeIO es quien ejecuta localmente la FSM de puertas, ACK, temporización y escritura física de relés; el Maestro no refresca las salidas físicas con una máscara periódica. Así, ante una pérdida del enlace Maestro–FridgeIO, el auxiliar conserva el último estado recibido y sigue atendiendo puertas y ACK de manera local.

El ACK de cada canal reconoce únicamente su cava. Mientras la causa permanezca activa, silencia el buzzer y deja fija la luz correspondiente; el reconocimiento se libera cuando el Maestro informa que la causa se normalizó. En NOCOMM se mantiene la luz roja de comunicación y el ACK detiene su intermitencia. El estado de alarma se expone en la API de cavas y se publica por MQTT; el detalle de estado en tiempo real y la asociación de cada cava a su canal se consultan desde la aplicación. El mapa de registros de entradas y salidas está en el [documento de diseño ampliado](./DISENO_SENALIZACION_LUMINOSA_Y_PUERTAS.md).

## Consideraciones para las pruebas

- El Maestro actualiza estados de proceso y comunicación; el FridgeIO ejecuta la FSM local y acciona sus salidas con la información recibida y sus entradas físicas.
- El temporizador de puerta inicia en el flanco detectado de cerrado a abierto; al cerrar se reinicia. El ACK se registra en el flanco de pulsación, no en cada lectura del botón mantenido.
- Cada pulsador ACK reconoce solo la cava de su canal. Se aplica a alarma de proceso, NOCOMM y alarma crítica de puerta; se elimina al normalizarse la causa.
- Las alarmas críticas y NOCOMM hacen parpadear su luz con un ciclo de 500 ms hasta ACK; tras ACK, la luz queda fija mientras la causa siga activa.

La lógica debe validarse físicamente con las cavas y entradas conectadas. Estos puntos describen el código de esta versión y no constituyen una especificación normativa ni una declaración de conformidad integral con ISA-18.2.
