# Auditoría breve — FlyLab v0.7 → v0.7.1

## Hallazgos

1. La cámara Neural existente era seguimiento externo; no existía una perspectiva ligada a la cabeza.
2. El modelo anatómico v0.7 ya define un frente corporal coherente (+Z local), por lo que es adecuado para un POV de cabeza.
3. El drawer seguía persistiendo bajo claves `flylab:v06:*`, un residuo de versiones anteriores.
4. El script `npm test` usaba `--test-isolation=none`, no reconocido por la versión de Node disponible durante la auditoría.
5. El tooltip del botón de nuevo ensayo no era consistente con su `aria-label`.

## Cambios aplicados

- Botón **👁 Mosca** junto a Cámara/Neural/Pantalla.
- Cámara anclada a la cabeza del modelo procedural.
- FOV 104° y plano cercano reducido para primera persona.
- Orientación completa heredada del cuerpo, incluida locomoción vertical sobre vidrio.
- Vista Neural y Vista Mosca mutuamente exclusivas.
- `Esc` sale del POV; Cámara restablece la vista libre.
- Indicador en pantalla: “POV corporal · no reconstrucción óptica compuesta”.
- Claves de persistencia actualizadas a `flylab:v07:*`.
- Script de tests compatible: `node --test tests/*.mjs`.

## Validación

- 29/29 tests automáticos: OK.
- `node --check` en todos los módulos `src/*.js`: OK.
- La comprobación visual headless no pudo completarse en este entorno porque Chromium no pudo inicializar WebGL/EGL; por eso no se afirma una validación visual automatizada del render final.
