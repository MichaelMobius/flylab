# Validación v1.2.0

## Cambio

Al caminar hacia una esquina, el contacto corporal transfiere el apoyo a la pared adyacente. Transporta la orientación entre las normales de ambas paredes y conserva velocidad, componente vertical de marcha, fase de las patas y tiempo de permanencia. Registra `wall-transfer` con origen `body-contact`; es una regla corporal compartida por Proxy y MaleCNS, no una conducta neuronal emergente.

El ajuste tangencial mantiene las patas dentro de los límites finitos del vidrio antes de validar el apoyo. La detección considera el sentido del desplazamiento y evita transferencias laterales cuando solo está subiendo y rebotes inmediatos hacia la pared anterior.

## Comprobaciones

- 95 pruebas aprobadas, sin fallos: `node --test --experimental-test-isolation=none tests/*.test.mjs`. Se usó ejecución sin aislamiento porque el entorno impide crear subprocesos para el corredor de pruebas.
- Ocho conexiones dirigidas entre paredes, en avance y retroceso (16 recorridos). Se exige marcha terrestre durante todo el recorrido, al menos tres patas de apoyo, separación menor de 1e-7, conservación de velocidad y fase, y orientación transportada correctamente.
- Marcha posterior a cada cruce sin volver a transferirse hacia atrás; apoyo dentro de las paredes reales.
- Ascenso vertical junto a una esquina sin cambio lateral espurio.
- Verificación en navegador con escenario controlado Proxy: pared este a pared sur en el primer segundo; continuación sobre la pared sur durante el segundo siguiente. Lectura de seis patas apoyadas y separación cero en ambos puntos; inspección visual final realizada.

## Alcance

El giro es una transferencia cinemática de contacto entre pasos de simulación. Todavía no modela una secuencia biomecánica continua de patas repartidas entre dos paredes durante todo el giro. No se repitió una ejecución del conectoma completo: el código neuronal no cambió.
