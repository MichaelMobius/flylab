# Changelog v0.8 — visión compuesta aproximada

- Añadido un modo **⬢ Compuesta** dentro de la vista de la mosca.
- La vista compuesta renderiza dos campos visuales separados, inspirados en los dos ojos compuestos.
- Cada ojo se muestra como una retícula de celdas hexagonales de baja resolución (ommatidios virtuales).
- Se mantienen dos modos de primera persona:
  - **👁 Ocular**: cámara continua entre los ojos.
  - **⬢ Compuesta**: aproximación panorámica insectoide.
- La vista compuesta y el modo neural siguen siendo mutuamente excluyentes.
- Se añadió un canvas superpuesto de visión compuesta, con render fuera de pantalla y muestreo por ojo.
- El badge superior ahora permite alternar entre los dos modos de visión.
- Se actualizaron las pruebas estáticas para cubrir controles y pipeline de visión compuesta.
