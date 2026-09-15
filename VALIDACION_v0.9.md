# Validación v0.9

## Automated checks

- JavaScript syntax check passes for the main app and every MaleCNS bridge module.
- `node --test tests/*.test.mjs`: **30/30 tests pass**.
- Existing deterministic FlyLab behavior tests remain unchanged when MaleCNS is not selected.
- Static integration tests verify the MaleCNS selector, Worker bridge, packed graph filenames and biological population mappings.

## Environment limitation

The execution container used to build this artifact cannot resolve arbitrary external hosts from Node/container processes. Therefore the full ~19 MB remote MaleCNS payload could not be downloaded and executed end-to-end inside this build environment.

The browser runtime is implemented to fetch the pinned public files directly when `MaleCNS Observe` is selected. If remote loading is blocked in a deployment, the same files can be hosted locally under `data/` and selected with `?malecnsBase=./data/`.

## Scientific status

The graph/neuron identities are MaleCNS-derived data. The LIF dynamics and some embodied sensory transduction remain modeled assumptions. v0.9 is an **observe** mode; it does not yet claim that MaleCNS generated the locomotor behavior.
