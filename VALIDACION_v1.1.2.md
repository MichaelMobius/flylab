# Validación — FlyLab v1.1.2 Hunger-Motivated Search

## Automated validation

- `node --check src/main.js`: pass
- `node --check src/malecns/motor.js`: pass
- `node --check src/malecns/worker.js`: pass
- `node --check src/malecns/bridge.js`: pass
- `npm test`: **57/57 tests passed**

## New behavioural tests

1. High hunger + weak, non-improving fruit odour accumulates motivated wall-search drive and produces a `wall-hunger-search` DN takeoff pulse.
2. Strong improving fruit odour suppresses that hunger-driven wall exit.
3. Satiety strongly reduces wall-search pressure under otherwise identical conditions.
4. Runtime sends filtered fruit-odour level and temporal trend into the MaleCNS worker.
5. Existing locomotion, wall transition, adaptive gait, vision, feeding and deterministic regression tests remain passing.

## Controlled motivational assay

With intrinsic bout transitions disabled to isolate the new mechanism, wall height fixed at 0.45, positive climb progress (`0.12`) and weak flat fruit odour (`0.015`):

- hunger `0.92`: `wall-hunger-search` pulse at **3.66 s**;
- hunger `0.55`: no hunger-specific pulse within 12 s (the ordinary wall-timeout mechanism remains the fallback);
- hunger `0.12`: no hunger-specific pulse within 12 s;
- hunger `0.92` with strong rising odour (`0.65`, trend `+0.12/s`): no hunger-specific pulse within 12 s.

These are deterministic unit-level checks of the motivational policy, not a claim that the full remote MaleCNS graph was run end-to-end in this container. The decisive embodied validation remains a browser run with the real packed MaleCNS assets loaded.

## Scientific boundary

The mechanism uses hunger/energy, time since feeding, wall context, measured fruit-odour concentration and its temporal trend. It does **not** receive fruit coordinates and does **not** inspect the experimenter's reward value. Hunger therefore changes search motivation, not privileged knowledge of where the food is.
