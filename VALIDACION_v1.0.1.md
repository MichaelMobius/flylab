# Validación v1.0.1

## Resultado

- `node --check src/main.js`: OK
- `node --check src/models.js`: OK
- `node --check src/gait.js`: OK
- `node --test tests/*.test.mjs`: **39/39 OK**

## Pruebas nuevas de marcha

1. La fase del CPG permanece continua al cambiar bruscamente la velocidad MaleCNS.
2. Los dos trípodes mantienen aproximadamente media vuelta de desfase.
3. Alimentarse reduce suavemente la amplitud sin resetear la fase.
4. El giro cambia las zancadas izquierda/derecha sin romper la sincronía.

## Alcance científico

La v1.0.1 sigue siendo híbrida: el readout de DNs MaleCNS genera comandos locomotores de alto nivel; la coordinación fina de patas se ejecuta mediante un CPG trípode. Esto coincide con la estrategia de control descendente usada por la implementación de referencia, pero no equivale a simular cada músculo directamente desde el VNC.
