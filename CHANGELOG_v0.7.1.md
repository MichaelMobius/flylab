# FlyLab v0.7.1 — Vista de la mosca

- Añade botón **👁 Mosca** para una cámara de primera persona ligada a la cabeza.
- La cámara hereda orientación, inclinación y rotación corporal al caminar, trepar vidrio y volar.
- Usa FOV 104° y near clipping reducido para una vista cercana estable.
- Añade etiqueta visual que aclara que es un POV corporal y **no** una reconstrucción óptica compuesta.
- `Neural` y `Mosca` son modos mutuamente exclusivos.
- `Esc` sale de la vista de la mosca y el botón Cámara restablece la vista libre.
- Corrige claves de persistencia del drawer de `v06` a `v07`.
- Corrige el script de tests para versiones de Node sin `--test-isolation`.
- 29 pruebas automáticas pasan.
