# Changelog v1.0 — MaleCNS Control

- Added third brain mode: **MaleCNS Control**.
- Added explicit identified-DN motor map and readout in `src/malecns/motor.js`.
- Forward locomotion reads DNg100/DNg97/DNp09 and weighted supporting DNs.
- Backward locomotion reads MDN.
- Steering reads left/right DNa02, DNa01 and DNp09 asymmetry.
- Takeoff reads DNp02/DNp04 and uses a high-rate / baseline-ratio trigger.
- Added conductance-like external bias support to the local LIF runtime.
- Added a documented endogenous-behavior drive for walk/stop bouts, saccades, braking and voluntary takeoff.
- Control mode paces neural time against wall time instead of free-running.
- Added motor telemetry: intrinsic state, forward DN rate, turn DN rate, takeoff DN rate and feeding motor-neuron rate.
- MaleCNS CSV now exports motor commands and intrinsic state.
- Session JSON samples include selected brain mode and MaleCNS motor snapshot.
- Landing, ingestion and detailed muscle control remain explicitly hybrid/body policies.
- Added unit tests for DN population mapping, motor readout, MDN reverse drive, endogenous feeding brake and LIF conductance bias.
