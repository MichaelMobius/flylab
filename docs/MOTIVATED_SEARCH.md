# Motivated search in FlyLab v1.1.2

The wall transition policy now combines internal state and sensory evidence. Hunger does not directly switch the body to flight. Instead, while the fly is attached to glass, a bounded **wall-search drive** accumulates when three conditions align: hunger is elevated, time since feeding grows, and fruit odour is weak or is not improving. A strong positive temporal odour trend discharges this drive.

The resulting signal is applied as endogenous excitation to the identified MaleCNS takeoff population (`DNp02`, `DNp04`). Physical takeoff still occurs only if the LIF network produces the normal DN takeoff trigger.

The controller receives no fruit coordinates and does not inspect the experimenter's reward value. It uses only hunger/energy, elapsed feeding state, wall context, fruit-odour concentration available at the antennae, and the temporal derivative of that sensory signal.

This produces a testable prediction in the simulation: under the same seed and geometry, a hungry fly should abandon an uninformative wall sooner than a satiated fly, while a hungry fly climbing into an improving fruit plume should remain on the wall longer.
