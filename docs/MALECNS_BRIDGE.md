# MaleCNS Bridge — v1.0 architecture

FlyLab v1.0 adds the first closed motor layer on top of the v0.9 observation bridge.

## Data path

```text
terrarium state
  -> bilateral odor / contact / self-motion signals
  -> identified MaleCNS sensory neurons
  -> packed MaleCNS CSR graph
  -> LIF dynamics in Web Worker
  -> spikes
      -> AL / MB / CX / SEZ / DN / VNC inspector
      -> descending-neuron motor readout
      -> FlyLab body command
```

The compact data are loaded from the pinned `Lulzx/fly-brain` commit
`4a8a8ebe2b8713106b605f5e32bc8458d65e0f16` unless `malecnsBase` is supplied.

## Modes

### Proxy
No MaleCNS runtime is required. The original FlyLab controller drives behavior.

### MaleCNS Observe
The connectome runs and receives the same embodied sensory state, but the body is still controlled by FlyLab's proxy policy. This remains the essential control condition for experiments.

### MaleCNS Control
The network is paced against wall time and identified DNs are read out for locomotion.

Current motor roles:

```text
forward  DNg100 DNg97 DNp09 DNa05 DNa07 DNp26 DNg25 DNa01 DNa02
backward MDN
turn     DNa02 DNa01 DNp09 (left - right)
takeoff  DNp02 DNp04
```

The mapping and numerical constants live in `src/malecns/motor.js`.

## Endogenous activity

A connectome is a wiring graph, not a complete state model. The reference embodied MaleCNS project explicitly adds an endogenous-behavior layer because a connectome-only LIF model may never initiate walking or may fail to alternate behavioral states.

FlyLab v1.0 therefore includes a small `IntrinsicDrive` that creates documented walk/stop bouts, steering saccades and occasional voluntary takeoff by applying conductance-like biases to identified DNs. The drive is not hidden: its state is shown in telemetry and exported.

Critically, FlyLab does not write velocity directly from `IntrinsicDrive`. The drive is delivered to identified neurons; the body reads the downstream spike-rate readout from the MaleCNS simulation.

## Pacing

Observe mode can advance as fast as the Worker allows.

Control mode uses:

```text
target neural time = neural anchor + elapsed wall time
```

and only integrates toward that target. This prevents a 100 ms neural event from being compressed into a few milliseconds of body time when the Worker runs faster than real time.

## Motor readout

For each selected DN, v1.0 estimates a low-pass firing rate from the difference in cumulative spike counts. Weighted population means then produce:

```text
forward Hz
backward Hz
left/right steering Hz
takeoff Hz
```

Forward/backward and steering follow the public reference readout conventions. Takeoff is triggered only by a rising event above the high-rate criterion, not continuously while the population remains elevated.

## What is not closed-loop yet

MaleCNS Control does not yet directly drive:

- individual leg muscles;
- individual wing muscles;
- adhesion actuators;
- aerodynamic lift;
- landing selection;
- ingestion mechanics.

The public reference project itself reports that raw full-connectome leg-muscle mode cannot yet keep the simulated fly standing. FlyLab therefore starts with the descending-neuron layer rather than claiming a solved VNC/body controller.

## Experimental comparison

The recommended assay is to run the same scenario and seed under:

```text
Proxy
MaleCNS Observe
MaleCNS Control
```

and compare trajectory, fruit contact, neural activity, DN command traces and time-to-target.

The CSV includes both regional neural activity and DN motor variables so the causal boundary can be audited after the run.

## v1.1 adaptive motor boundary

In v1.1, `MaleCNS Control` can be run with an adaptive execution layer. The DN readout is unchanged: identified MaleCNS descending populations still define forward/backward intent, steering and takeoff. The new learner acts **downstream** of that readout.

With motor adaptation enabled, the ground-loop boundary is:

```text
MaleCNS spikes -> DN readout -> desired speed/yaw -> adaptive tripod CPG -> stance traction -> body motion
```

Thus the learned parameters should not be interpreted as synaptic plasticity inside MaleCNS. They are a model of motor adaptation/body calibration below the descending command layer.

## v1.1.1 — wall-to-flight bridge

Wall climbing is treated as a distinct behavioural context. FlyLab sends wall age, normalized height and signed climbing rate to the MaleCNS worker. A modelled endogenous wall-exit signal can excite DNp02/DNp04 when the fly reaches the upper wall, remains stalled, stays on the wall unusually long, or samples a wall-specific spontaneous takeoff at a bout boundary. The body changes to takeoff only after the MaleCNS DN readout triggers. This avoids a direct hard-coded wall->flight switch while preventing the wall from becoming an absorbing state.


## v1.1.2 motivational wall state
The worker now receives two additional body-derived sensory variables: `fruitOdor` (a filtered mean concentration measured at the antennae) and `fruitOdorTrend` (its temporal derivative). `IntrinsicDrive` combines these with hunger and time since feeding to build a bounded `wallSearchDriveMs`. This signal never moves the body directly; when it reaches threshold it produces endogenous excitation of the identified takeoff DN population, and physical wall-to-flight transition still requires the standard MaleCNS DN takeoff trigger. No fruit coordinates or experimenter reward labels are supplied to this mechanism.
