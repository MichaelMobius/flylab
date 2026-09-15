# FlyLab v1.1.1 — Wall Transitions

- Fixed a MaleCNS Control failure mode where wall climbing could become an absorbing state.
- Added wall context to the neural worker: wall age, normalized height and signed climbing rate.
- Added an explicit endogenous wall-exit pathway that excites identified takeoff DNs (DNp02/DNp04) rather than switching body mode directly.
- Wall exit can be recruited by upper-wall arrival, prolonged stall, long wall residence, or a probabilistic takeoff event at walking-bout boundaries.
- Neural telemetry now reports wall-exit reasons (`wall-top`, `wall-stall`, `wall-timeout`, `wall-bout`).
- Wall takeoff now gives the body additional clearance from the glass and a minimum inward launch speed to reduce immediate re-collision.
- MaleCNS CSV export now includes `intrinsic_reason`.
