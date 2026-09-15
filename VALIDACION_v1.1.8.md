# FlyLab v1.1.8 — apoyo real y eliminación de colisiones fantasma

## Causa

La contención incorporada en v1.1.5/v1.1.6 calculaba la caja de las facetas de los ojos compuestos a partir de la geometría base de un InstancedMesh, ignorando las transformaciones de cada instancia. Una primitiva de tamaño unidad se interpretaba como un volumen invisible grande alrededor de la mosca. Eso la separaba de las superficies. Además, limitar todo el modelo no garantizaba contacto de las patas y podía usar las alas como apoyo de aterrizaje.

## Correcciones

- Las cajas de las mallas instanciadas incluyen sus transformaciones reales.
- El apoyo se calcula con las puntas de las garras de las patas en fase de apoyo. Se usan el piso en y=0 y las caras interiores del vidrio en x/z=±5,9825, correspondientes al terrario visible.
- La posición normal al apoyo se ajusta a esas garras; las correcciones tangenciales no pueden separar a la mosca del plano de apoyo.
- Si no hay una superficie real alcanzable con al menos tres apoyos, deja el estado de marcha y pasa a vuelo/caída. No se proyecta desde el centro del terrario hacia una pared imaginaria.
- Para aterrizar se comprueba el contacto de las patas, no el extremo de un ala. Las patas se extienden durante el aterrizaje.
- Durante la alimentación las patas permanecen desplegadas sobre el suelo.
- Se retira la interpolación de orientación y el balanceo decorativo mientras camina, porque no estaban acompañados de una resolución de apoyos. El cambio de superficie alinea el cuerpo con el apoyo; las rotaciones aéreas se conservan.
- Las exportaciones incluyen fly.support con superficie, número de patas y separación máxima medida.

## Validación

90 pruebas automatizadas aprobadas. Las nuevas regresiones detectan la falsa caja de los ojos instanciados, comprueban las garras durante 600 poses distribuidas entre piso y cuatro paredes, incluyen marcha y alimentación, rechazan estados de marcha sin apoyo y verifican el aterrizaje por patas.

Se revisó el simulador real en el navegador integrado mediante controles temporales de prueba añadidos exclusivamente por el servidor local: piso, cuatro paredes, marcha en piso/pared y vuelo. En reposo se observaron seis apoyos; en la muestra de marcha sobre pared, tres. La separación máxima informada fue cero en las paredes y aproximadamente 1,2e-17 en el piso (redondeo numérico). En vuelo se observaron patas recogidas y cero apoyos. No aparecieron errores JavaScript.

Los controles temporales de prueba no forman parte del paquete. Esta revisión utiliza el controlador Proxy para ejercitar el cuerpo y poses fijadas; no es un ensayo prolongado del conectoma completo en navegador. El worker y el kernel neuronal son idénticos a v1.1.7, cuya optimización se conserva.

Comando de pruebas: node --test --test-isolation=none tests/*.mjs

## Alcance

Se garantiza mediante restricciones cinemáticas el contacto de las patas en estas superficies planas; no se simulan fuerzas individuales, adhesión microscópica ni una transición biomecánica continua entre piso y pared. Los colisionadores de frutas mantienen su implementación anterior.
