# Validación de FlyLab 0.7

## Automática

Node.js 24.19.0: 28 tests aprobados. Ejecutar desde esta carpeta:

```sh
node --test --test-isolation=none tests/*.mjs
```

Las regresiones ejecutan las funciones de simulación reales extraídas de `main.js` en un contexto sin renderer y usan los módulos reales de cerebro, actividad, física y Three.js. Incluyen continuidad de sensores entre suelo y vuelo, ciclo de vuelo manual, estado idéntico con el mismo seed a 20 y 60 FPS, reinicio, edición durante alimentación, distractores en aprendizaje y contactos múltiples.

Se verifica además que la mosca tenga seis cadenas de nueve segmentos, dos alas con nervaduras asociadas, dos halterios y tres ocelos.

## Navegador

Se abrió el laboratorio y el atlas con Three.js servido localmente. Se comprobó el renderizado del adulto, las facetas oculares, la banana cerrada y el racimo; se revisaron los controles del inspector y la selección de frutas. Un despegue solicitado desde la interfaz permaneció en VUELO hasta el segundo 11.9; después se solicitó aterrizaje y se observó locomoción de superficie. La colocación accesible añadió y seleccionó una fresa en un espacio libre.

El navegador de prueba reduce la frecuencia cuando la vista está en segundo plano: la política de interrupciones pausa el ensayo y exige continuar. Con la vista activa, el reloj avanzó normalmente. El comportamiento es intencional para no descartar tiempo de forma silenciosa.

## Límites

La independencia de FPS está comprobada para el escenario de regresión y dentro del mismo runtime. No se promete identidad binaria entre motores JavaScript diferentes. Los gráficos y las texturas no afectan al RNG experimental.

Las pruebas de lógica no sustituyen una validación biomecánica. Las proporciones, el movimiento y los canales de actividad siguen siendo modelos simplificados.

