# Validación FlyLab v1.0.2

## Motivo de la revisión

La revisión parte de un vídeo de ~22.1 s de MaleCNS Control. La inspección cuadro a cuadro mostró poco desplazamiento neto del centro del cuerpo comparado con cambios continuos de orientación y numerosos pivotes. La coordinación visual de las patas había mejorado en v1.0.1, por lo que el cuello de botella restante estaba en el readout motor y no principalmente en el CPG.

## Hallazgos

1. `m.turn` ya estaba acotado en el readout DN, pero `locomotorSignals()` lo dividía nuevamente por `0.6`, amplificando steering.
2. El avance dependía de un umbral absoluto de firing transferido desde la implementación de referencia, aunque la dinámica LIF de FlyLab no es numéricamente idéntica.
3. Con avance cercano a cero y steering no nulo, el CPG entraba repetidamente en pivote y el cuerpo podía cambiar heading casi sin traslación.
4. `blocked` mezclaba colisión con obstáculos y contacto con fruta positiva; el bridge gustativo solo recibía azúcar cuando `feeding` ya estaba activo.

## Correcciones

- baseline adaptativo de DNs durante reposo/feed/warming;
- readout de avance sobre `fwdExcessHz` y retroceso sobre `backExcessHz`;
- deadband y límites de steering;
- eliminación de re-amplificación `/0.6`;
- reducción de heading change cuando hay poco avance y el giro no es una orden fuerte de pivote;
- separación `foodContact` / `blocked`;
- sugar drive ante contacto comestible;
- telemetría explícita de baseline y exceso.

## Pruebas

- Todos los módulos JavaScript pasan `node --check`.
- `node --test tests/*.test.mjs`: **41/41 tests OK**.
- Nueva prueba: desequilibrio tónico L/R calibrado no debe convertirse en pivote persistente y un incremento real de actividad de avance debe producir traslación.
- Nueva prueba estática: steering no se re-amplifica y food contact queda separado del bloqueo por obstáculo.

## Limitación pendiente

El test decisivo sigue siendo end-to-end en navegador con el grafo MaleCNS real descargado. Esta revisión corrige fallos deterministas encontrados en el adaptador, pero no sustituye una corrida grabada de v1.0.2. La próxima evidencia útil será comparar vídeo + CSV de `MaleCNS Control` antes/después con la misma semilla y escenario.
