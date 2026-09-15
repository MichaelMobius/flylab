# Changelog v1.0.2 — Motor Calibrated

Corrección motivada por inspección de un vídeo real de ejecución de MaleCNS Control.

- Eliminada la segunda amplificación del comando de giro MaleCNS (`turn / 0.6`).
- Nuevo baseline adaptativo para tasas tónicas de DNs de avance, retroceso y steering.
- El avance se calcula a partir de actividad DN excedente sobre el baseline del runtime LIF de FlyLab.
- Steering con deadband y límites distintos durante marcha y pivote.
- A velocidades casi nulas, giros pequeños ya no hacen rotar continuamente el cuerpo; solo señales fuertes permiten pivote deliberado.
- Contacto con fruta positiva deja de convertirse en `blocked` para el módulo de evitación.
- Señal gustativa MaleCNS se activa con contacto comestible, además de durante feeding.
- Telemetría ampliada: `fwdBaselineHz`, `fwdExcessHz`, tasas izquierda/derecha de steering y baselines.
- Nueva prueba contra desequilibrio tónico L/R que anteriormente podía producir pivote permanente.
- 41/41 tests.
