# Changelog

This file summarizes the public development line. Earlier per-version changelog files were consolidated during the repository cleanup; Git history should be used for future changes.

## 1.3.1

- Added articulated six-leg inverse kinematics with fixed segment lengths and modeled joint limits.
- Added world-space stance-foot anchoring on the floor and glass walls, with reach-aware body motion.
- Improved support transfer during floor/wall and wall/wall transitions.
- Added an explicit four-second foreleg grooming behavior while the remaining legs support the body.
- Added a modeled dirt/grooming trigger and a manual grooming control; grooming remains an explicit body policy, not a behavior claimed to emerge from MaleCNS.
- Corrected foreleg inverse-kinematics geometry during grooming so leg segments route around the compound-eye volumes instead of penetrating them.
- Added geometric regression coverage for eye clearance during grooming and expanded the automated suite to 182 passing tests.
- Added headless validation utilities for longer MaleCNS/embodiment runs.

## 1.2.1

- Progressive body rotation when crossing between adjacent glass walls.
- Pairwise support transfer during corner transitions.
- Fixed ocular camera interference from OrbitControls.
- Retained the 1.2.0 wall-to-wall locomotion behavior.

## 1.2.0

- Added walking transitions between adjacent glass walls.
- Preserved locomotor direction and surface-relative support when moving through corners.

## 1.1.9

- Added landing on vertical glass and continued wall walking.
- Corrected adhesion/contact transitions from the floor.
- Removed the previous mandatory wall-exit timeout behavior.

## 1.1.8

- Required real leg support on surfaces for terrestrial locomotion.
- Corrected phantom collision/support artifacts.

## 1.1.7

- Optimized the browser LIF kernel and worker scheduling.
- Added/updated headless performance validation.

## 1.1.6

- Coupled glass containment to physical body position and sensors.
- Added full-connectome worker validation evidence.

## 1.1.5

- Improved wall/floor transitions and recovery from body stalls.

## 1.1.4

- Introduced interactive ("fluid") neural pacing as the default browser mode.
- Preserved synchronized pacing for ordered sensory/neural execution.
- Added neural speed, sample age and coalescing telemetry.

## 1.1.3

- Corrected integration issues in the embodied MaleCNS loop.

## 1.1.2

- Added hunger-modulated wall search using internal state and odor trend.

## 1.1.1

- Added explicit wall-to-flight transition context and DN-mediated takeoff attempts.

## 1.1

- Added adaptive locomotion.
- Converted descending-neuron output into motor targets for an adaptive CPG/traction layer.
- Added online SPSA residual gait adaptation.

## 1.0.x

- Introduced MaleCNS Control using identified descending-neuron populations.
- Added DN baseline calibration and stabilized tripod gait.
- Improved motor readout calibration and food-contact handling.

## 0.9

- Added browser loading and observation of the compact MaleCNS graph/neuron representation.

## 0.8 and earlier

- Developed the embodied terrarium, proxy controller, feeding/metabolism, wall/floor/flight locomotion, neural inspector, anatomical model and approximate compound-eye visualization.
