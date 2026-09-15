# FlyLab v1.1.6 — contacto corporal con vidrio

## Cambios

La contención se resuelve en cada paso físico mediante las cajas de las partes animadas del modelo, excluyendo el objeto invisible de selección. La corrección modifica x/y/z de la mosca y se exporta en bodyContact. El renderizado usa la misma posición y pose: ya no aplica un desplazamiento separado para esconder penetraciones del vidrio. Se elimina también el desplazamiento visual hacia la fruta durante la alimentación, que separaba el modelo de su posición física.

Las antenas siguen la orientación corporal. El cuerpo gira progresivamente al cambiar de superficie, con límite angular por paso fijo; esto no añade todavía una transición biomecánica con apoyos individuales. La llegada al vidrio puede iniciar la adhesión antes de que el centro lo alcance. Los contactos aéreos orientan el movimiento hacia el interior; el contacto de descenso con el piso completa el aterrizaje.

Se mantiene la asistencia corporal de v1.1.5. Las correcciones normales al vidrio no se contabilizan como progreso de marcha que impida detectar un atasco.

## Red completa

Se descargaron los cuatro archivos del commit ya fijado por FlyLab: 4a8a8ebe2b8713106b605f5e32bc8458d65e0f16 de Lulzx/fly-brain. El worker de producción cargó 165.122 neuronas y 10.511.038 conexiones. Se enviaron 24 lotes de 10 muestras con contexto de pared: 2.000 ms neuronales. El readout alcanzó controlReady=true, sin errores de decodificación ni del worker.

La ejecución en Node necesitó aproximadamente 61,6 segundos para esos 2 segundos neuronales, más 2,6 segundos de carga local. Los resultados detallados están en VALIDACION_CONECTOMA_v1.1.6.json. Este ensayo usa los datos completos y el worker de producción, pero entradas sintéticas: no es una prueba del navegador ni una validación del comportamiento autónomo completo. No prueba la salida neuronal de paredes a largo plazo ni garantiza tiempo real. Los archivos del conectoma se mantienen externos al ZIP.

## Pruebas corporales

La suite incluye aterrizaje sin rebote, determinismo con distintas frecuencias de renderizado, coincidencia física/render/sensores junto al vidrio, contacto antes del límite del centro, rotación gradual y salida por atasco con la contención física activa.

Comando: node --test --test-isolation=none tests/*.mjs

## Límites

Es una resolución cinemática de penetraciones con cajas envolventes de partes, no una simulación de fuerzas de contacto, elasticidad de alas o articulaciones con apoyo real. Puede separar el cuerpo conservadoramente del vidrio. Las frutas conservan sus colisionadores anteriores. No se ha realizado una inspección visual de extremo a extremo en navegador. El coste del conectoma sigue pendiente de optimización.

Resultado final de la suite: 83 pruebas aprobadas, 0 fallos.
