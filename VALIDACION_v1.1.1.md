# Validación FlyLab v1.1.1

This release targets the wall-to-flight transition in MaleCNS Control.

Validation criteria:

- `IntrinsicDrive` must generate takeoff-DN drive after prolonged wall stall.
- Reaching the upper wall must generate a `wall-top` takeoff pulse.
- Wall exit must remain mediated by the MaleCNS takeoff readout; no direct wall-to-flight body switch is introduced.
- Wall context (age, height, climbing rate) must reach the MaleCNS worker.
- Existing locomotion, adaptive motor, connectome and world tests must remain green.

The automated suite verifies these code-level properties. Full biological/behavioral validation still requires running the remote MaleCNS graph in a browser and observing repeated wall-climb/exit trials.

Automated result for this package: **53/53 tests passed**; `node --check` passed for `src/main.js`, `src/malecns/motor.js`, `src/malecns/worker.js`, and `src/malecns/bridge.js`.
