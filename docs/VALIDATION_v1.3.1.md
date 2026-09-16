# FlyLab 1.3.1 — Biomecánica y acicalamiento

## Cambios

- Las seis patas usan cinemática inversa con nueve longitudes constantes y límites de cadera, rodilla y tobillo. Los objetivos inalcanzables no estiran segmentos.
- Los pies de apoyo conservan su posición mundial sobre piso o vidrio. El cuerpo frena si excede el alcance; la fase de marcha continúa para permitir el siguiente paso.
- Cruces entre superficies con transferencia alternada de trípodes y apoyo real. Si no existen tres apoyos alcanzables, la mosca abandona la adhesión.
- Aproximación a paredes con orientación gradual, patas extendidas y plegado de alas posterior al contacto.
- Acicalamiento anterior de cuatro segundos: elevar patas delanteras, frotarlas/cruzarlas, barrer la cabeza y volver a apoyarlas. Las otras cuatro patas sostienen el cuerpo. Funciona en piso y paredes; el despegue lo interrumpe.
- Corrección v1.3.1: el IK de las patas delanteras usa un polo ventral durante el acicalamiento para que los segmentos rodeen el volumen de ambos ojos compuestos en lugar de atravesarlos. La suite incluye una prueba geométrica explícita de no penetración ocular.
- Botón «Acicalar» (✧). También se activa mediante una variable aproximada de suciedad que aumenta al caminar y alimentarse. No representa bacterias ni pérdida de olfato.

El acicalamiento y el aterrizaje son políticas corporales explícitas. No se presentan como comportamientos emergentes del conectoma MaleCNS.

## Verificación

182 pruebas automatizadas aprobadas en la suite actual:

```sh
npm test
```

Incluyen objetivos de articulación, longitudes y ángulos, anclaje durante traslación/giro, piso y cuatro paredes, cruces, aterrizaje, cuatro apoyos durante acicalamiento y su interrupción por vuelo. La corrección v1.3.1 añade una comprobación geométrica de que los segmentos de las patas delanteras no penetran los elipsoides usados para representar ambos ojos compuestos.

### Ensayos con la red completa

El arnés `validation/malecns-soak.mjs` ejecuta el worker LIF completo con 165122 neuronas y 10511038 conexiones bajo un adaptador determinista de ritmo fluido 10:1 entre tiempo corporal y neuronal. Este protocolo no equivale a tiempo neuronal sincronizado y no debe interpretarse como simulación en tiempo real.

Los ensayos v1.3.0 de referencia observaron retorno al piso desde pared baja, aterrizajes en pared y salidas al aire. No se observaron eventos de despegue neuronal autónomo; por tanto, esos ensayos no demuestran despegue originado por MaleCNS.

Reproducción con el mirror local incluido en el repositorio:

```sh
node validation/malecns-soak.mjs data/malecns
node validation/malecns-soak.mjs data/malecns --groom
```

## Límites científicos

Los rangos articulares son parámetros del modelo, no mediciones anatómicas calibradas. Los tarsómeros conservan longitud pero forman una cadena distal simplificada; no se resuelven fuerzas musculares ni adhesión. El acicalamiento anterior es una política corporal explícita y no una conducta demostrada como emergente de MaleCNS.

La alternancia entre limpieza corporal y frotamiento de patas está documentada en Seeds et al. (2014), y los circuitos de limpieza antenal se estudian en Hampel et al. (2015). Estas referencias motivan el comportamiento general, pero los parámetros geométricos de FlyLab siguen siendo aproximaciones de ingeniería.
