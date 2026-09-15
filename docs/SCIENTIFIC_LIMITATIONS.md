# Scientific limitations and interpretation boundary

FlyLab is designed as an auditable embodied-connectomics experiment. This document states the assumptions that currently prevent stronger biological claims.

## 1. The specific MaleCNS topology has not yet been validated causally

FlyLab currently runs a real MaleCNS-derived structural graph, but there is no matched null ensemble in the repository. The project therefore does not yet know whether the real graph produces neural or behavioral statistics that differ from structurally controlled alternatives.

Priority negative controls:

- directed degree-preserving rewiring;
- edge-weight permutation within controlled classes;
- descending-neuron identity permutation preserving population size and laterality;
- transmitter-sign perturbation preserving the global sign distribution.

The first publication-grade result should compare the real graph against these controls under exactly matched open-loop sensory and endogenous-drive sequences.

## 2. Current endogenous drive can bypass much of the graph

`IntrinsicDrive` directly biases identified DN populations such as DNg100/DNg97, DNa01/DNa02, DNp02/DNp04 and MDN. `DNMotorReadout` then reads activity from those same or overlapping populations.

This creates a plausible shortcut:

```text
modeled endogenous state -> DN bias -> DN spikes -> motor command
```

The full recurrent graph may modulate this path, but its contribution has not yet been isolated. At minimum, future validation should report lagged correlations between intrinsic drive and DN readout for the real graph and null graphs. A stronger architecture should inject state/sensory drive upstream and read DNs, or inject DNs and read downstream VNC/motor populations.

## 3. Full-graph runtime is far below real time

The stored full-connectome Node benchmark reports approximately `0.036x` neural real time in one validation run. In interactive pacing, the body continues at its own fixed simulation step using the latest confirmed DN command while neural time can lag. When the sensory queue is full, older samples may be replaced.

Consequences:

- interactive mode is useful for exploration but timing is hardware-dependent under coalescing;
- synchronized mode is the preferred interpretation mode when every sensory batch must be preserved;
- exported sessions should be treated as non-reproducible in timing if coalescing occurred;
- a principled reduced subgraph is a major engineering/scientific priority.

## 4. Synaptic physiology is simplified

The current LIF runtime uses shared baseline parameters, including a uniform synaptic scale and delay. Neurotransmitter identity determines a fast sign table, but the model does not yet distinguish slow metabotropic neuromodulation from fast ionotropic transmission.

In particular, dopamine, serotonin and octopamine should not be interpreted as biologically faithful fast excitatory synapses. Mushroom-body activity is therefore structurally grounded but dynamically model-dependent.

A sensitivity analysis over synaptic scale, delay and time constants is required before interpreting network-level findings as robust.

## 5. Embodiment is hybrid rather than muscle-complete

FlyLab contains explicit engineering layers for:

- gait generation;
- traction/contact approximations;
- wall adhesion and corner transitions;
- aerodynamic/flight control;
- landing policy;
- feeding mechanics;
- adaptive motor learning.

These layers are intentionally visible rather than hidden. MaleCNS Control currently supplies high-level descending intent, not a complete muscle-by-muscle reconstruction.

## 6. Current regression coverage is not full integration coverage

A subset of regression tests extracts functions from `src/main.js` into a VM with MaleCNS/adaptive behavior stubbed. Those tests catch many behavioral regressions but do not establish that the production `simulate()` path is exercised end-to-end with real or synthetic MaleCNS snapshots.

The simulation core should be split into directly importable pure modules and tested with a fake bridge that injects known motor snapshots.

## Interpretation rule

The strongest statement currently supported is:

> Embodied sensory input can drive a MaleCNS-derived structural network; identified descending-neuron populations can be read as locomotor intent; and modeled body/adaptive layers can execute that intent in a virtual environment.

The following statement is **not** yet supported:

> The specific MaleCNS connectome is necessary for, or by itself generates, the observed virtual-fly behavior.

The purpose of the next research phase is to test exactly that difference.
