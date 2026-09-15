# FlyLab v1.1.3: cambios y validación

## Correcciones

- Intercambio cuerpo–red en lotes ordenados de hasta 10 ticks. Se conserva cada muestra sensorial y se espera confirmación antes del siguiente lote. El tiempo neuronal sigue el tiempo simulado del cuerpo, no un bucle independiente de reloj real.
- Fallos del worker y tiempos de espera invalidan las órdenes y pausan el ensayo. Reintentar crea un worker nuevo. Las generaciones de mensajes impiden aplicar respuestas anteriores a un reinicio o cambio de modo.
- Reinicios y cambios de modo limpian los contadores de actividad. CSV identifica generación, tick, tiempo corporal, tiempo neuronal y unidades Hz; poblaciones ausentes quedan vacías.
- JSON conserva los canales históricos proxy por compatibilidad y añade actividad proxy, actividad LIF y fuente del controlador aplicada de forma separada.
- Validación de cabeceras, dimensiones, índices, grados y pesos; rechazo de flujos aritméticos truncados. Descargas con límite de 64 MiB por archivo y presupuestos de 262.144 neuronas y 20 millones de aristas.
- Reiniciar los componentes de motivación intrínseca y aprendizaje motor restaura sus generadores aleatorios. El aprendizaje descarta evaluaciones parciales al cambiar de contexto motor.
- La interfaz identifica el control proxy durante la calibración neuronal. Se mantienen la mosca y las frutas de v1.1.2.

## Pruebas ejecutadas

68 pruebas automatizadas aprobadas: 57 existentes y 11 nuevas regresiones. Comando utilizado en esta carpeta:

```sh
node --test --test-isolation=none tests/*.mjs
```

Las regresiones cubren errores y reintentos, 120 muestras ordenadas sin descarte, respuestas antiguas, tiempo de espera, suspensión del cuerpo, archivos truncados, dimensiones inválidas, reinicios aleatorios, cambios de contexto motor, limpieza de contadores y avance temporal del worker con una red pequeña simulada.

## Alcance y límites

No se ha ejecutado en esta validación el conectoma externo completo ni una prueba visual de extremo a extremo en navegador. Las pruebas pequeñas no demuestran compatibilidad con todos los archivos del proveedor ni rendimiento con la red completa. Los límites de recursos pueden necesitar ajuste si cambian los datos.

El nuevo ensayo conserva los parámetros motores aprendidos y los incluye en su estado inicial exportado. La exportación no es una instantánea completa de todos los generadores y evaluaciones pendientes: no garantiza reproducción bit a bit. Las semillas repetibles de componentes aislados no equivalen a esa garantía.

El controlador aplica la última respuesta confirmada durante el siguiente lote; por tanto, existe un retardo de hasta un lote. En equipos lentos el tiempo simulado avanza más despacio. El proxy controla durante la calibración y en modo Observe; la exportación identifica la fuente aplicada.

## Siguientes mejoras recomendadas

1. Validar el paquete con el conectoma completo, incluyendo carga, pausa, reintento y cambio de modo; medir memoria, latencia y estabilidad.
2. Incorporar una instantánea completa del estado y reproducción automática de ensayos por semilla.
3. Comparar hambre, saciedad y ausencia de alimento mediante ensayos repetidos y métricas predefinidas antes de atribuir realismo biológico al comportamiento.
4. Evaluar el aprendizaje motor con contextos estables: el descarte de ventanas evita mezclar órdenes, pero puede reducir el aprendizaje si cambian continuamente.
