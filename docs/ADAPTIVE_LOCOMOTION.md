# Adaptive Locomotion architecture

## Goal

FlyLab v1.1 separates two questions:

1. **What action does MaleCNS request?** — descending-neuron activity.
2. **How should this body execute that request?** — adaptive motor policy.

The second layer is allowed to learn online from embodied motor consequences without access to fruit position.

## Closed loop

```text
world -> sensory transduction -> MaleCNS -> DN readout
                                      |
                                      v
                               desired v, yaw
                                      |
                                      v
                             innate tripod CPG
                                      +
                            learned residual policy
                                      |
                                      v
                        stance-foot relative motion
                                      |
                                      v
                         simplified ground traction
                                      |
                                      v
                         actual translation / yaw
                                      |
                         motor-only reward signal
                                      +-----------> learner
```

## Innate prior

The CPG begins from an alternating tripod pattern. Learning does not invent six-leg coordination from white noise. It modifies a bounded residual vector around this prior.

Let the learned normalized vector be `theta`. It is decoded into:

```text
cadenceScale
amplitudeScale
dutyOffset
tripodPhaseDelta
turnGain
liftScale
```

All values are bounded. Changes are smoothed before affecting the gait to prevent instantaneous joint/phase jumps.

## Body coupling

During stance, a foot moving posteriorly relative to the thorax contributes forward push. If `x_i` is a stance foot's fore/aft body-relative coordinate,

```text
push_i ~= - d x_i / dt
```

up to a traction factor. Mean left/right push gives translation; their difference gives yaw.

This is not full contact dynamics. It is deliberately an intermediate model that makes gait quality matter before a future VNC + rigid-body implementation.

## Learning rule

The optimizer is SPSA. For a learned parameter vector `theta` and random sign vector `Delta`, it evaluates

```text
theta+ = theta + eps Delta
theta- = theta - eps Delta
```

for short embodied windows, obtains rewards `R+` and `R-`, estimates a gradient from their difference, and updates `theta`.

This avoids backpropagating through MaleCNS or the browser physics.

## Reward

The learner receives only motor quantities:

- DN-requested forward/backward speed;
- effective surface displacement;
- requested and actual yaw;
- stance support count;
- foot-slip proxy;
- small cadence/amplitude energy proxy.

It does **not** receive:

- fruit coordinates;
- distance to fruit;
- odor source coordinates;
- nutritive reward;
- mushroom-body reward.

Therefore improvements in fruit finding cannot be obtained by a hidden navigation shortcut inside this layer.

## Trials and memory

`Nuevo ensayo` resets the body and experimental trial while retaining the learned motor policy in the current page session. `Reiniciar` inside the Aprendizaje motor card explicitly returns the motor policy to the innate prior.

The exported session JSON records the learned vector and generation counter.

## Current limitations

- simplified traction, not rigid-body foot contact;
- no learned joint-by-joint torque policy;
- one shared policy currently spans floor and glass surfaces;
- flight motor learning is not included in v1.1;
- VNC motor neurons do not yet directly drive individual leg muscles.

The intended next progression is context-specific floor/wall policies, then VNC-informed residuals, and only later direct VNC-to-muscle control.
