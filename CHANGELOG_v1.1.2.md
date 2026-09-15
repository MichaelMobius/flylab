# FlyLab v1.1.2 — Hunger-Motivated Search

- Hunger is now an explicit motivational input for leaving walls in MaleCNS Control.
- Wall exit is not a direct `if (hungry) fly`: hunger accumulates a search drive that excites identified takeoff DNs (DNp02/DNp04).
- Fruit-odour strength and its temporal trend modulate that drive. A rising plume suppresses wall-exit pressure; weak/non-improving odour lets hunger-driven search accumulate.
- Time since feeding contributes gradually to search motivation.
- Added Neural Inspector telemetry for wall motivation and fruit-odour trend.
- CSV exports wall-search motivation, accumulated drive, odour level/trend and time since feeding.
- No fruit coordinates or reward labels are provided to the motivational controller.
