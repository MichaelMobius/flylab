# FlyLab v1.1.4 — corrección de la lentitud en MaleCNS

## Qué cambió

v1.1.3 detenía el cuerpo después de cada lote de 10 ticks hasta recibir la respuesta neuronal. Si el conectoma tardaba en procesarlo, caminar, metabolismo y tiempo corporal también se ralentizaban.

El nuevo selector «Ritmo neuronal» inicia en **Fluido**. El cuerpo mantiene su paso fijo y utiliza la última orden DN confirmada mientras el worker calcula. Solo hay un lote en vuelo y hasta 10 muestras pendientes. Cuando se llena la cola, se sustituye la muestra más antigua para enviar información reciente al terminar el lote actual.

**Sincronizado** conserva la espera de v1.1.3 y cada muestra sensorial. Cambiar de ritmo reinicia la red y descarta las respuestas del ritmo anterior. El modelo LIF y su paso de integración no se han reducido ni sustituido por un controlador proxy. Durante su calibración inicial se mantiene el proxy, identificado en la interfaz como en v1.1.3.

Se conserva el watchdog de 10 segundos, la invalidación de órdenes tras errores y los límites de datos. Las órdenes de despegue se consumen una vez por respuesta para evitar repetir un pulso mientras se mantiene una orden neuronal.

La interfaz muestra el ritmo, el rendimiento neuronal y la antigüedad corporal de la muestra al recibir cada respuesta. CSV registra el ritmo y el número acumulado de muestras sustituidas en cada lote; JSON añade el ritmo inicial, sus cambios, la antigüedad de la muestra y los contadores de sustitución.

## Verificación

Comando: `node --test --test-isolation=none tests/*.mjs`

**74 pruebas aprobadas**, incluyendo las 68 anteriores y seis regresiones de ritmo:

- Un worker que no responde durante un segundo permite 120 ticks corporales en Fluido, frente a 10 en Sincronizado.
- La sobrecarga mantiene una cola de tamaño limitado con las muestras más recientes y un conteo exacto de sustituciones.
- Cambiar de ritmo invalida las respuestas y muestras anteriores.
- El watchdog también invalida las órdenes mantenidas en Fluido.
- Un pulso de despegue se aplica una sola vez por respuesta.
- Pausar drena únicamente los lotes ya pendientes, sin cálculo continuo autónomo.

También se comprobó la sintaxis de los módulos modificados. La prueba temporal utiliza un worker simulado: no es una medición del rendimiento del conectoma completo en el equipo del usuario. No se hizo una validación visual de extremo a extremo de esta versión.

## Compromiso del modo fluido

No acelera el cálculo del conectoma: evita que su espera congele el cuerpo. El tiempo neuronal puede retrasarse respecto al corporal y las órdenes pueden llegar tarde. Se omiten muestras bajo carga, por lo que Fluido no equivale al protocolo de un ensayo sincronizado ni garantiza la captura de contactos sensoriales breves. Para experimentos que requieran conservar cada muestra debe elegirse Sincronizado.

No se modificaron los modelos visuales de mosca y frutas ni los parámetros de velocidad locomotora. Esta corrección aborda la espera impuesta por el puente neuronal.

## Uso

Servir esta carpeta por HTTP o publicar su contenido en GitHub Pages. Seleccionar **MaleCNS Control** y **Fluido**. Se puede abrir directamente con `?brain=control`; para el protocolo anterior usar `?brain=control&pacing=synchronized`.
