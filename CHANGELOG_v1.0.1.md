# Changelog v1.0.1 — Gait Stabilized

- Reemplaza `phase = t × frecuencia` por un CPG trípode con fase persistente.
- MaleCNS controla velocidad y giro; el CPG preserva coordinación de seis patas.
- Cadencia suavizada 3.2–10 Hz; duty de apoyo 0.6763456489.
- Trípodes: `(L1,R2,L3)` y `(R1,L2,R3)`, desfase π.
- Zancada izquierda/derecha asimétrica durante giro sin romper fase.
- Pivote coordinado cuando la orden dominante es giro con poca traslación.
- Alimentación reduce amplitud de marcha de forma continua, sin reset brusco.
- El balanceo vertical del cuerpo se sincroniza con el CPG.
- Telemetría de locomoción muestra `Trípode · X Hz` y modo pivote.
- Añadido `src/gait.js` y pruebas específicas de continuidad y coordinación.
