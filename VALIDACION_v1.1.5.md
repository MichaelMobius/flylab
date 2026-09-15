# FlyLab v1.1.5 — paredes y recuperación corporal

Correcciones:
- El umbral de regreso al piso ahora es alcanzable desde la pared y considera el desplazamiento real, también al caminar hacia atrás.
- El regreso orienta la mosca hacia el interior y la separa del vidrio para evitar volver a adherirse inmediatamente.
- La geometría visible animada (cuerpo, patas y alas) se mantiene dentro de los cuatro planos interiores del vidrio, incluidas las esquinas. Se excluye la esfera invisible de selección.
- Una asistencia corporal sale de la pared tras 4 segundos simulados sin progreso o 14 segundos de permanencia. Cerca del piso regresa al suelo; a mayor altura despega hacia el interior. Se registra como body-wall-recovery, source: body-assist, separada de las órdenes neuronales.

Validación: 78 pruebas aprobadas con node --test --test-isolation=none tests/*.mjs. Las cuatro pruebas nuevas ejercitan las funciones de simulación con órdenes neuronales simuladas y la geometría Three.js en 32 poses junto a esquinas. No se ha validado esta versión con el conectoma completo en navegador.

Límites: la contención del modelo visible es una corrección de presentación mediante su caja envolvente animada; no constituye una colisión musculoesquelética de cada pata. Puede desplazar ligeramente el modelo respecto del centro físico junto al vidrio. La asistencia corporal es una regla explícita de la simulación, no una decisión emergente de MaleCNS. Los umbrales usan tiempo corporal, también con ritmo Fluido.

Se conserva Fluido como ritmo neuronal predeterminado. Publicar el contenido de esta carpeta en GitHub Pages o servirlo mediante HTTP.
