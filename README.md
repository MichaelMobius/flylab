# FlyLab v1.2.1 — Giro progresivo y cámara ocular

Cruce de esquinas con giro corporal gradual y cambio de apoyo por pares de patas. Corrige la interferencia del control orbital en la vista ocular, que sigue el avance o retroceso desde la cabeza. Consulta [validación y límites](VALIDACION_v1.2.1.md).

## Historial: FlyLab v1.2.0 — Paso entre paredes

La mosca puede cruzar una esquina caminando hacia la pared vecina, conservando la velocidad, la inclinación de marcha y el apoyo sobre el vidrio. Funciona también al retroceder. Consulta [validación y límites](VALIDACION_v1.2.0.md).

## Historial: FlyLab v1.1.9 — Aterrizaje y marcha sobre vidrio

Permite aproximarse en vuelo, aterrizar sobre una pared real y continuar caminando. También corrige la adhesión desde el piso y elimina la salida obligatoria por 14 segundos de permanencia. Consulta [validación y límites](VALIDACION_v1.1.9.md).

## Historial: FlyLab v1.1.8 — Patas apoyadas en superficies reales

Corrige las colisiones fantasma de los ojos instanciados y exige apoyo real de las patas para caminar. Consulta [correcciones y validación visual](VALIDACION_v1.1.8.md). Conserva la optimización neuronal de v1.1.7.

## Historial: FlyLab v1.1.7 — Optimización neuronal

Reduce accesos repetidos a memoria en LIF y esperas entre bloques del worker, conservando el modelo. Consulta [mediciones, pruebas y límites](VALIDACION_v1.1.7.md).

## Historial: FlyLab v1.1.6 — Contacto físico y prueba del conectoma

La contención contra el vidrio ahora modifica la posición física, compartida con el modelo y los sensores. Incluye giro corporal gradual y una prueba del worker con el conectoma completo. Consulta [validación y límites](VALIDACION_v1.1.6.md).

## Historial: FlyLab v1.1.5 — Paredes y salida de atascos

Corrige el regreso al piso, contiene la geometría visible dentro del vidrio y añade recuperación corporal registrada ante atascos. Consulta [validación y límites](VALIDACION_v1.1.5.md).

## Base FlyLab 1.1.4 — MaleCNS fluido

**Corrección de la lentitud de v1.1.3:** el selector «Ritmo neuronal» usa **Fluido** por defecto. El cuerpo continúa a 120 pasos simulados por segundo mientras el worker calcula, utilizando la última orden DN confirmada. La cola mantiene como máximo las 10 muestras sensoriales más recientes: bajo carga se sustituyen las más antiguas. Esto evita que el cuerpo se detenga por cada lote, pero no acelera el conectoma ni garantiza respuestas neuronales en tiempo real.

**Sincronizado** conserva el protocolo de v1.1.3: guarda todas las muestras y espera cada respuesta. Puedes activarlo en el selector o con `?brain=control&pacing=synchronized`.

En Fluido, el tiempo neuronal puede avanzar más lentamente que el corporal. La interfaz muestra el rendimiento neuronal y la antigüedad de la muestra; JSON y CSV registran el ritmo y las muestras sustituidas. El watchdog de 10 segundos y el rechazo de respuestas anteriores siguen activos. Cambiar el ritmo reinicia la red para evitar mezclar órdenes. Las órdenes de despegue se consumen una vez por respuesta.

Validación de v1.1.4: consultar [VALIDACION_v1.1.4.md](VALIDACION_v1.1.4.md). Los apartados siguientes describen la base de v1.1.3; su protocolo de espera se aplica ahora solo a Sincronizado.

## Base v1.1.3 — Integración neuronal corregida

Esta versión corrige los fallos reproducidos en la auditoría de v1.1.2. Consulta [cambios y validación](VALIDACION_v1.1.3.md). Conserva los modelos visuales existentes.


FlyLab 1.1.3 keeps the adaptive motor layer and wall-to-flight pathway, and adds hunger-modulated motivated search to the embodied MaleCNS loop. MaleCNS supplies descending intent, but in adaptive mode the body is no longer translated directly from the requested speed: stance-foot kinematics generate a simplified traction signal and an online learner changes residual gait parameters to improve command tracking, support and slip.

## Run

Serve the folder; do not open `index.html` by double-clicking:

```sh
python -m http.server 8080
```

Then open `http://localhost:8080/`.

GitHub Pages needs no build step. Three.js is bundled under `vendor/three`.

## Brain modes

The **Cerebro** selector has three modes:

- **Proxy** — the compact FlyLab sensory/learning controller drives behavior; the activity map is functional/proxy.
- **MaleCNS Observe** — MaleCNS receives the embodied sensory state and the Neural Inspector is driven by connectome spikes, but the FlyLab proxy still controls locomotion.
- **MaleCNS Control** — identified descending-neuron populations drive forward/backward locomotion, steering and takeoff after calibration. During calibration, locomotion uses the proxy controller and the UI labels it explicitly.

Query parameters:

```text
?brain=observe
?brain=control
```

`?brain=malecns` is retained as a backwards-compatible alias for Observe.

## MaleCNS data loading

By default the bridge fetches these compact public files from the pinned `Lulzx/fly-brain` commit `4a8a8ebe2b8713106b605f5e32bc8458d65e0f16` under `public/data/`:

- `neurons.flyn`
- `graph.flyg`
- `meta.json`
- `bodymap.json`

The packed graph is decoded back to CSR arrays in a worker. No API key or backend is required.

For a self-hosted copy, put those four files in `data/` and use:

```text
?brain=control&malecnsBase=./data/
```

## Descending-neuron motor readout

`src/malecns/motor.js` keeps the mapping explicit and auditable. The readout uses identified MaleCNS types:

- forward: `DNg100`, `DNg97`, `DNp09`, with smaller contributions from `DNa05`, `DNa07`, `DNp26`, `DNg25`, `DNa01`, `DNa02`;
- backward: `MDN`;
- steering: `DNa02`, `DNa01`, `DNp09`, separated by left/right side;
- takeoff: `DNp02`, `DNp04`.

The forward readout is calibrated relative to a slow resting baseline of the FlyLab LIF runtime, then uses an excess-rate threshold and smooth saturation. Steering subtracts right from left DN activity, removes slow tonic imbalance, and maps transient asymmetry to yaw. A MaleCNS-triggered takeoff requires approximately 70 Hz and three times the slow baseline, after the neural runtime has warmed up.

The motor telemetry panel exposes the actual DN rates and the derived command separately.

## Why there is still an endogenous-drive model

A structural connectome does not encode all spontaneous state, neuromodulation and intrinsic dynamics of a living fly. If the graph is left completely undriven, a simulated animal may never initiate a walking bout. `IntrinsicDrive` therefore supplies a documented, slowly varying conductance-like bias to identified DNs for walking bouts, pauses, saccades and occasional voluntary takeoff.

This is **not hidden**: the current intrinsic state (`walk`, `stop`, `feed`, `fly`) is shown in the MaleCNS motor telemetry and exported to CSV. The final motor command is still read from spikes produced by the MaleCNS network after sensory and recurrent interactions.

## What MaleCNS controls in v1.1

In **MaleCNS Control**:

- floor walking forward/backward is driven by the DN readout;
- glass-wall locomotion uses the same DN forward/turn readout in the surface tangent frame;
- steering/yaw is driven by left-right descending-neuron asymmetry;
- takeoff can be triggered by `DNp02`/`DNp04` activity;
- during flight, DN steering controls yaw and forward DN activity modulates flight speed.

The following remain explicit body/controller policies in v1.1:

- aerodynamic lift and altitude regulation;
- landing selection and descent;
- contact mechanics and adhesion;
- the decision to consume food once the body is correctly positioned;
- detailed leg-muscle and wing-muscle activation.

This boundary is intentional. It lets us test the descending command layer before attempting a raw VNC/muscle closed loop.


## Adaptive locomotion (v1.1)

The **Aprendizaje motor** switch appears in the Locomoción panel and is used only when **MaleCNS Control** is active. With the switch off, v1.1 preserves the calibrated v1.0.2 mapping. With it on, descending commands become targets rather than direct body velocities.

The innate tripod CPG remains as a motor prior. The online learner adapts residuals for:

- cadence scale;
- step amplitude;
- stance duty-cycle offset;
- inter-tripod phase residual;
- turning gain;
- swing/lift scale.

The body translation is estimated from the posterior velocity of stance feet. Left/right differences generate yaw. This is a **simplified traction model**, not a full rigid-body/contact simulation, but it makes locomotor outcome depend on the gait rather than merely animating legs over a pre-scripted body trajectory.

The optimizer is SPSA (simultaneous perturbation stochastic approximation): it evaluates small positive/negative perturbations of all gait residuals over short motor windows and updates the learned policy from their reward difference. It is lightweight enough to run alongside the connectome in the browser.

The motor reward has no fruit-position term and does not use FlyLab's nutritive reward. It combines DN-command tracking, support, a stance-foot slip proxy and a small energetic penalty. Thus the adaptive layer learns **how to move when MaleCNS asks it to move**, not where food is.

A new trial resets the body and assay but intentionally preserves motor learning within the current page session. **Reiniciar** in the Aprendizaje motor card explicitly clears only the learned locomotor policy. The session JSON exports the learned parameter vector and generation count.

## Sensory input and neural observation

MaleCNS receives:

- ORN input by glomerulus and antenna side from the compact `bodymap`;
- baseline ORN firing plus concentration-dependent odor drive;
- identified sugar/taste input during feeding contact;
- approximate contact afferent activity for floor/wall locomotion;
- haltere and Johnston's-organ drive during flight/self-motion.

The Neural Inspector aggregates spikes into AL, MB, CX, SEZ, DN and VNC groups. These are real neuron identities from the loaded graph; the LIF dynamics and physical-to-neural transduction remain model assumptions.

## Neural runtime pacing

With synchronized pacing, both MaleCNS modes process ordered sensory batches of at most 10 body ticks (120 Hz). The body waits for acknowledgement before advancing another batch. Neural integration follows accumulated body time, with rounding bounded by one neural integration step. Simulation speed therefore decreases on slower hardware; real-time operation is not guaranteed. A pending batch without acknowledgement for 10 seconds pauses the trial and invalidates the worker.

The panel reports neural speed. If the browser cannot maintain approximately 1× in Control mode, behavior should be interpreted cautiously.

## CSV export

When MaleCNS is active, activity export includes regional rates plus motor readout:

```text
wall_ms,neural_ms,neural_speed,mode,
AL_hz,MB_hz,CX_hz,SEZ_hz,DN_hz,VNC_hz,
motor_v,motor_turn,fwd_hz,back_hz,takeoff_hz,feed_hz,intrinsic_state
```

## Scientific boundary

FlyLab 1.1 supports the following statement:

> “Embodied sensory input drives MaleCNS activity; identified descending-neuron populations generate locomotor intent; and an adaptive, body-coupled gait layer can learn how to execute that intent.”

It still does **not** support:

> “The complete behavior of the virtual fly is generated solely by MaleCNS.”

Landing, detailed contact mechanics, endogenous drive, metabolic physiology and several actuator mappings remain modeled layers. The v1.1 traction model is deliberately simpler than a full musculoskeletal fly.

## Other features retained

- floor walking, glass-wall climbing and free 3D flight;
- feeding with proboscis and fruit depletion/disappearance;
- articulated fly model and animated wings/legs;
- draggable volumetric fruit;
- immersive drawer UI and fullscreen mode;
- Neural Inspector follow camera;
- ocular POV and approximate compound-eye visualization;
- deterministic FlyLab simulation seed and session export.

## Testing

```sh
npm test
```

The suite covers behavior regressions, UI, compound vision, connectome bridge wiring, DN motor mapping/readout, adaptive gait propulsion, SPSA motor learning, endogenous drive, LIF bias, fruit physics and reproducibility.

## Provenance

The MaleCNS dataset is the 2026 male *Drosophila* CNS connectome (`male-cns:v1.0`). FlyLab uses the compact browser-oriented representation and codec conventions published by `Lulzx/fly-brain`. Motor-role mappings and readout constants are adapted from that project's MIT-licensed motor implementation. See `THIRD_PARTY_NOTICES.md` and `MALECNS_BRIDGE.md`.


## Wall-to-flight transitions (v1.1.1)

MaleCNS Control no longer treats glass climbing as a potentially absorbing state. While the fly is attached to a wall, FlyLab sends wall context to the MaleCNS worker: time on wall, normalized height and signed climbing rate. The endogenous layer can then excite the identified takeoff DN population (DNp02/DNp04) in three documented situations: reaching the upper wall, prolonged lack of climbing progress, or unusually long residence on the wall. A separate probabilistic wall-takeoff hazard is also applied at walking-bout boundaries.

This is deliberately **not** a direct `if wall => fly` command. The wall-exit signal is modelled endogenous drive; the connectome must still propagate it and the DN takeoff readout must trigger before the body changes from climbing to takeoff. The Neural Inspector exposes reasons such as `wall-top`, `wall-stall` and `wall-timeout`.

When wall takeoff is triggered, the body is displaced slightly inward from the glass and given a minimum forward launch speed before entering the normal flight controller. This prevents immediate re-collision with the wall.


## v1.1.2 — Hunger-motivated wall search
Hunger now modulates behavioural selection on walls. Weak or non-improving fruit odour plus time without feeding accumulates a search drive; improving odour suppresses it. The drive excites MaleCNS takeoff DNs rather than switching flight directly. No fruit coordinates or reward labels are exposed to this controller.
