# FlyLab v1.1.7 — rendimiento neuronal

## Cambios

El bucle LIF reutiliza en variables locales el estado de cada neurona, reduciendo accesos repetidos a los vectores. Conserva el orden de disparos y llamadas aleatorias y los redondeos Float32 intermedios.

El worker cede el control con MessageChannel en lugar de encadenar temporizadores de cero milisegundos. Mantiene puntos de cesión después de aproximadamente 8 ms de trabajo y comprueba generación/cancelación al reanudarse. Existe una alternativa con temporizadores si MessageChannel no está disponible. No se modifican el número de neuronas, conexiones, paso temporal ni parámetros del modelo.

## Medición

Conectoma completo: 165.122 neuronas y 10.511.038 conexiones. Misma semilla 1337, mismas entradas sintéticas de pared, 24 lotes y 2.000 ms neuronales. Ejecuciones locales en Node, sin perfilador en la comparación final:

- v1.1.6: 62.11 segundos de procesamiento.
- v1.1.7: 32.28 segundos de procesamiento.
- Reducción observada del tiempo: 48.0 %.

Los tiempos excluyen la carga inicial. Es una comparación orientativa de una ejecución final por versión, no una estimación estadística ni un benchmark del navegador. Hubo variación entre ejecuciones exploratorias. Las 24 salidas de control, tiempos neuronales y recuentos de neuronas activas coinciden exactamente.

La prueba alternada del kernel en un mismo proceso, con la red completa y entrada constante, midió 4196 ms frente a 3927 ms (reducción 6.4 %); los vectores finales de conteo de disparos coincidieron. No equivale al ensayo completo: utiliza otro estímulo y excluye el puente.

## Validación y reproducción

86 pruebas aprobadas. La nueva prueba de equivalencia compara estados, buffers de retraso y disparos en 7.200 pasos, tres semillas, reinicios y cambios de estímulo. Otras pruebas comprueban el orden de reanudación y que una generación cancelada no continúe integrando ni publique.

Suite: node --test --test-isolation=none tests/*.mjs

El paquete incluye tools/benchmark-connectome.mjs. Desde la carpeta del proyecto, ejecutar node tools/benchmark-connectome.mjs RUTA_DATOS resultado.json. RUTA_DATOS debe contener meta.json, bodymap.json, neurons.flyn y graph.flyg del commit fijado por la aplicación. Este script carga archivos locales; no descarga datos. Comparar versiones con idénticos archivos e inputs.

RENDIMIENTO_v1.1.7.json contiene las mediciones y lecturas completas.

## Límites

Todavía no funciona en tiempo real: 2 segundos neuronales requieren unos 32.3 segundos de procesamiento en este ensayo. El navegador y otros equipos pueden rendir de forma distinta. La validación del worker no sustituye una prueba visual del simulador completo en navegador. Se conserva Fluido como opción predeterminada y Sincronizado para no omitir muestras sensoriales.
