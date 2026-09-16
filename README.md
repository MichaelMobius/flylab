# FlyLab

**An experimental browser-based laboratory for embodied connectomics in _Drosophila melanogaster_.**

**Current release: v1.3.1 — biomechanics and eye-safe grooming.**

FlyLab asks a deliberately narrow scientific question:

> **What changes when a structural nervous-system connectome is coupled to a body, sensory inputs, internal state and adaptive motor control?**

The project uses the 2026 **MaleCNS v1.0** connectome as a structural substrate for a virtual fly that can sense odor and contact, walk on the floor and glass walls, cross corners, fly, land, feed, groom, and adapt aspects of its terrestrial locomotion. The goal is not to claim that a connectome is a complete brain. The goal is to build an auditable experimental system in which the contribution of the connectome can be separated from the dynamics, controllers and body models added around it.

## Live demo

**Try FlyLab in the browser:**

https://michaelmobius.github.io/flylab/

Direct MaleCNS Control mode:

https://michaelmobius.github.io/flylab/?brain=control

The full MaleCNS mode is computationally demanding. For reproducible neural timing, use synchronized pacing and interpret browser performance together with the reported neural-speed telemetry.

## Scientific status

FlyLab is a **research prototype**, not a validated whole-animal brain simulation.

The current system demonstrates that embodied sensory inputs can drive activity in a MaleCNS-derived graph and that identified descending-neuron populations can be used as locomotor readouts. It does **not yet demonstrate that the specific topology of MaleCNS is necessary for the observed behavior**. Negative controls such as degree-preserving rewiring, weight shuffling, DN-identity shuffling and neurotransmitter-sign controls are the next major experimental milestone.

That distinction is central to the project.

## Brain modes

FlyLab exposes three conditions so modeled behavior is not confused with connectome-derived activity:

- **Proxy** — a compact functional controller drives behavior. No claim is made that the displayed activity is MaleCNS activity.
- **MaleCNS Observe** — the embodied sensory state is sent through the MaleCNS-derived LIF network and the Neural Inspector displays aggregated spikes, while locomotion remains under the proxy controller.
- **MaleCNS Control** — identified descending-neuron populations are read from the network and used as high-level locomotor intent. Body mechanics, gait generation, landing, grooming, feeding policy and several other processes remain modeled layers.

## What is modeled

The browser runtime currently includes:

- 165,122 traced neurons and about 10.5 million aggregated directed connections from the compact MaleCNS representation used by FlyLab;
- leaky integrate-and-fire dynamics with transmitter-dependent sign;
- olfactory input mapped to identified ORN populations;
- approximate contact, haltere and Johnston's-organ input;
- identified descending-neuron readouts for forward/backward motion, steering and takeoff;
- an explicit endogenous-drive model for spontaneous behavioral bouts;
- a tripod gait prior plus online residual motor adaptation;
- six articulated legs with inverse kinematics, fixed modeled segment lengths, support anchoring and reach-aware terrestrial motion;
- floor and wall locomotion, wall-to-wall corner transitions, flight, landing and feeding;
- explicit foreleg grooming with four-leg body support and geometric clearance from the modeled compound eyes;
- hunger-modulated search behavior on walls;
- session and neural-activity export for analysis.

## What is **not** claimed

A structural connectome does not specify membrane dynamics, synaptic time constants, neuromodulation, sensory transduction, plasticity or biomechanics. FlyLab therefore does not support the claim that the complete behavior of the virtual animal is generated solely by MaleCNS.

Important current limitations include:

1. **No connectome negative control yet.** The real graph has not yet been benchmarked against rewired or shuffled null models.
2. **Potential shortcut in the motor loop.** The endogenous controller currently biases several DN populations that are also read by the motor decoder. This can allow a direct `intrinsic drive -> DN firing -> motor command` pathway whose dependence on the larger graph remains to be quantified.
3. **Full-graph performance.** A stored Node benchmark measured approximately `0.036x` neural real time for the full graph. The default interactive browser pacing can therefore hold the most recent confirmed DN command while neural time lags body time and may coalesce sensory samples under load.
4. **Simplified synaptic physiology.** The current LIF model uses uniform baseline synaptic scaling and delay parameters. Dopamine, serotonin and octopamine are not yet represented with a separate slow metabotropic model.
5. **Hybrid embodiment.** Gait, contact mechanics, flight control, landing, grooming and feeding include explicit engineering models rather than a complete muscle-by-muscle reconstruction. The grooming sequence in v1.3.1 is therefore a body policy, not a behavior claimed to emerge from MaleCNS.

See [`docs/SCIENTIFIC_LIMITATIONS.md`](docs/SCIENTIFIC_LIMITATIONS.md) for the detailed interpretation boundary.

## Current research program

The next scientific phase is **connectome validation**, not additional behavioral features. The planned experiments are:

1. compare the real MaleCNS graph with degree-preserving rewired graphs;
2. shuffle edge weights while preserving appropriate weight/sign classes;
3. shuffle DN identities while preserving population sizes and laterality;
4. perturb neurotransmitter signs under controlled null models;
5. quantify correlations and latencies between endogenous drive, sensory input and DN readouts;
6. build a principled input-to-output subgraph that can run closer to real time and compare it against the full graph;
7. separate upstream state/sensory drive -> DN computation from DN -> VNC/motor computation.

A scientifically useful result can be either outcome: if null graphs behave like the real graph, FlyLab has identified that its present behavioral loop is dominated by modeled controllers; if the real graph produces reproducibly different neural and behavioral statistics, that is evidence that the specific connectome structure is doing computational work.

## Run locally

FlyLab is a static web application. No build step is required.

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

Useful query parameters:

```text
?brain=observe
?brain=control
?brain=control&pacing=synchronized
?seed=1337
```

`pacing=synchronized` preserves every sensory batch but may run much slower than wall-clock time. The default interactive mode prioritizes responsiveness and should not be treated as machine-independent timing when sensory ticks are coalesced.

## MaleCNS data

FlyLab mirrors the compact browser-oriented files required by the bridge under `data/malecns/`:

```text
graph.flyg
neurons.flyn
meta.json
bodymap.json
MANIFEST.json
```

They are mirrored from `Lulzx/fly-brain` at the pinned commit:

```text
4a8a8ebe2b8713106b605f5e32bc8458d65e0f16
```

The manifest records provenance, size and SHA-256 checksums. The MaleCNS dataset remains subject to its original attribution/licensing requirements; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Tests

```bash
npm test
```

FlyLab v1.3.1 passes **182 automated tests**. The suite covers sensory/proxy behavior, gait, adaptive motor learning, MaleCNS codecs and motor readout, pacing, contact mechanics, articulated-leg kinematics, stance-foot support, grooming and eye clearance, wall transitions, landing, corner transitions and camera behavior.

A known limitation of the current suite is that part of `tests/regressions.test.mjs` extracts functions from `src/main.js` into a VM with MaleCNS/adaptive paths stubbed. This is useful regression coverage but is **not** full integration coverage of the live MaleCNS control loop. Refactoring the simulation core into directly importable pure modules is on the validation roadmap.

See [`docs/VALIDATION_v1.3.1.md`](docs/VALIDATION_v1.3.1.md) for the current biomechanics/grooming validation boundary.

## Repository layout

```text
flylab/
├── index.html                 # application entry point
├── anatomia.html              # anatomical reference page used by the UI
├── styles.css
├── src/                       # simulation, body, brain and MaleCNS runtime
├── tests/                     # automated tests
├── validation/                # longer headless validation harnesses
├── tools/                     # benchmark utilities
├── data/malecns/              # pinned compact MaleCNS mirror
├── benchmarks/                # raw validation/performance evidence
├── docs/                      # architecture and scientific notes
├── vendor/three/              # vendored Three.js subset
├── CHANGELOG.md
├── CITATION.cff
├── THIRD_PARTY_NOTICES.md
└── LICENSE
```

## Provenance

FlyLab uses the compact MaleCNS representation and codec conventions published by [`Lulzx/fly-brain`](https://github.com/Lulzx/fly-brain), pinned to a specific source commit for reproducibility. Parts of the DN motor-role mapping and endogenous-drive rationale are adapted from that MIT-licensed project. Three.js is bundled under its MIT license.

MaleCNS v1.0 is a structural reconstruction of the adult male _Drosophila_ central nervous system. Dataset attribution and licensing are preserved in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Citation

If you use FlyLab in research or teaching, please cite the software using [`CITATION.cff`](CITATION.cff). A versioned archival DOI should be created before citing a scientific release in a paper.

## License

FlyLab source code is released under the MIT License. Third-party code and data retain their original licenses and attribution requirements.
