# FlyLab 0.7 — Anatomía y correcciones

## Corregido

- Eje lateral de las antenas en vuelo: mantiene el signo del giro respecto al suelo.
- Órdenes de despegue/aterrizaje: explícitas, consumidas una sola vez.
- Reinicio completo del ensayo: relojes, trayectoria, energía, ingesta, memoria y habilidad motora; repone las frutas que aún existen.
- Telemetría: `air` ya no cuenta como pared; el borrado reinicia también el acumulador de muestreo.
- Aprendizaje: usa la mezcla ambiental de las antenas, incluyendo distractores.
- Alimentación: revalida recompensa positiva al editar y en cada paso.
- Colisiones múltiples: pasadas iterativas y retorno a la última posición válida si no existe una resolución; el editor impide solapamientos y reserva espacio para fruta completa.
- Picking: solo usa los objetos de selección, no las envolventes de olor.
- Reloj fijo de 120 Hz y RNG con semilla independiente de texturas y renderizado.

## Visual

- Mosca remodelada: cabeza, tórax, escutelo y abdomen ahusado con bandas sobre la superficie; ojos compuestos con facetas, tres ocelos, antenas cortas y aristas ramificadas, palpos y probóscide con extremo bilobulado.
- Seis patas con coxa, trocánter, fémur, tibia, cinco tarsómeros y garras.
- Un par de alas translúcidas con nervaduras que siguen su movimiento, dos halterios y setas torácicas.
- Frutas: manzana lobulada con depresión apical, naranja con microrelieve, banana curvada y cerrada, racimo tridimensional y fresa con aquenios y cáliz.
- Atlas visual independiente con vistas dorsal, frontal y lateral y alas extensibles.

## Robustez y experimentación

- Three.js 0.186.0 incluido localmente. No hay solicitudes de red de la aplicación después de servir los archivos.
- Registro JSON de semilla, escenario inicial, intervenciones, sensores, posición y canales de actividad; el CSV sigue siendo una ventana reciente.
- Selección de frutas por lista, colocación por teclado y selector de calidad.
- Pausa explícita al ocultar la pestaña o ante una interrupción de más de un segundo.
- 28 tests, incluyendo regresiones ejecutables sobre la lógica de simulación y estructura del modelo.

El modelo visual es una interpretación procedural de un adulto Drosophila. No es una reconstrucción microscópica calibrada ni representa una implementación del conectoma completo. El batido se ralentiza visualmente para hacerlo legible.
