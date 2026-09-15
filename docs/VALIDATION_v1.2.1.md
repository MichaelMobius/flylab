# Validación v1.2.1

## Esquinas

La orientación corporal se interpola durante 0,72 segundos. La marcha ordinaria se pausa durante esa maniobra; se conserva el comando de velocidad para reanudarla. Los pares de patas cambian de apoyo en orden delantero, medio y trasero; al retroceder se invierte el orden. Cuatro patas quedan ancladas mientras otro par cambia de vidrio. Las uñas giran con su superficie de apoyo y la geometría se ajusta dentro de ambas paredes.

Es una aproximación cinemática: adapta los segmentos de las patas a objetivos de contacto y asienta sus extremos al iniciar el cruce. No calcula fuerzas de adhesión ni conserva rigurosamente las longitudes articulares. La decisión de cruzar sigue dependiendo del contacto y del sentido de marcha; no se añadió una nueva política neuronal de elección de ruta.

## Vista ocular

Se encontró una actualización de OrbitControls posterior a la orientación de primera persona. Aunque los controles estaban desactivados para entrada del usuario, su método update seguía modificando la cámara con el objetivo orbital anterior. Ahora solo se actualizan en vista externa.

La cámara ocular permanece en la cabeza, con la orientación local del cuerpo en piso, paredes y vuelo. En retroceso deliberado mira hacia atrás para seguir el desplazamiento solicitado; en reposo mira hacia delante. Esa vista de navegación no pretende reproducir literalmente la óptica de los ojos. La vista compuesta conserva sus dos campos orientados anatómicamente.

## Pruebas

- 97 pruebas automatizadas aprobadas mediante `node --test --experimental-test-isolation=none tests/*.test.mjs`.
- 16 recorridos de esquina: las ocho conexiones dirigidas, en avance y retroceso. Incluye fases de marcha con patas levantadas; se verifica continuidad de posición y orientación, cuatro apoyos durante el giro, ausencia de penetración apreciable del vidrio y marcha posterior.
- Cámara ejecutada a través de la función de render real con un objetivo orbital anterior deliberadamente incorrecto: piso, cuatro paredes y aire, en avance, retroceso y reposo. Posición de cabeza y dirección correctas en los 18 casos.
- Navegador: cruce controlado Proxy con cuatro apoyos durante la transición, marcha sobre la pared sur después del cruce, vista ocular continua comprobada y sin errores de consola observados.

No se repitió la ejecución del conectoma completo; el núcleo neuronal no cambió. Los controles QA usados en navegador pertenecen al servidor de desarrollo y no están incluidos en el paquete.
