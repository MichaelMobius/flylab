# FlyLab v1.1.9 — volar, aterrizar en vidrio y caminar

## Correcciones

- La adhesión desde el piso da espacio a las patas traseras para que la comprobación de soporte no descarte la transición inmediatamente.
- Una colisión aérea lateral ya no rebota siempre. Durante un aterrizaje puede elegir la pared contactada, plegar las alas y aproximarse antes de adherirse. La adhesión exige proximidad al plano real; al completarse recupera el estado de marcha y verifica las patas.
- La aproximación a una pared conserva la altura en lugar de seguir descendiendo obligatoriamente hacia el piso. El objetivo de pared se limpia al completar el contacto o cambiar de modo.
- El vuelo puede elegir aterrizar tras más de dos segundos si la energía es inferior a 0,75, o después de ocho segundos de vuelo; requiere contacto lateral y altura válida. Un vuelo recién iniciado o un estado de energía alto no se pega necesariamente a cada pared.
- Esta elección de aterrizaje sigue siendo una política corporal explícita, también con MaleCNS Control. Los eventos wall-approach y wall-landing incluyen source: body-policy; no se presentan como una decisión emergente de una neurona de aterrizaje.
- Se elimina el despegue de respaldo por haber pasado 14 segundos en una pared. Se mantiene la recuperación tras cuatro segundos sin progreso y las decisiones autónomas de despegue existentes.

## Validación

93 pruebas automatizadas aprobadas. Las nuevas rutas ejercitan las funciones reales de simulación con una orden motora constante de prueba: subir desde el piso, aproximarse en vuelo o aterrizaje, adherirse a cada una de las cuatro paredes, seguir caminando y despegar de nuevo. Se comprueba que conserva al menos tres patas apoyadas y que un vuelo breve o con energía alta no fuerza el aterrizaje.

En navegador se verificó el simulador con Proxy y controles temporales de escenario: aterrizaje sobre el vidrio este, continuación de marcha con altura de 1,92 a 2,66 y subida desde el piso. Las muestras mostraron seis patas apoyadas y separación máxima cero respecto al vidrio. Los controles de prueba no se incluyen en el paquete.

Comando: node --test --test-isolation=none tests/*.mjs

## Límites

La transición de adhesión es cinemática: no incorpora un modelo de fuerzas ni una maniobra biomecánica continua. La prueba de rutas con órdenes neuronales simuladas no equivale a un ensayo prolongado con el conectoma completo. Se conservan las optimizaciones neuronales y las comprobaciones de apoyo real de las versiones anteriores.
