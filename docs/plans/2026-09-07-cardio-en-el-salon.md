# Plan: el cardio entra al salón

Spec: `docs/specs/2026-09-07-cardio-en-el-salon.md`. Rama `salon/cardio`, apilada sobre
`salon/face-pull` (#223), que a su vez va sobre #221. Cada paso con su prueba vista en rojo.

1. **Motor: ritmo cíclico.** `Patron.ciclo?: { periodoSeg }`. `faseDeTiempo` con una ficha
   cíclica da dos medios ciclos iguales, suaves, sin atasco ni asentamiento. Prueba:
   simetría `fase(t) = fase(T − t)`, sin pausas, periodo exacto. — `escena.ts`,
   `escena.test.ts`.
2. **Cinco fichas cíclicas** con canales por lado, y la comprobación de espejo entre fase 0
   y fase 1 en `pruebas/`. — `catalogo.ts`, prueba nueva `pruebas/el-ciclo-es-simetrico.test.ts`.
3. **`patronDeBloque`** por palabra clave sobre título + indicaciones, con los 44 títulos
   reales de hoy resumidos como casos (sin personas). Y `SIN_PATRON` pierde las modalidades
   de cardio; el cribado, el trineo y el circuito sin modalidad se quedan. Pruebas de
   catálogo y de cobertura actualizadas con el motivo del cambio de decisión.
4. **Máquinas de cardio** en la escena, construidas contra el cuerpo: cinta, escaladora,
   bicicleta, elíptica. Piezas propias, sin agarres de carga. Prueba: los pies (o la
   pelvis) tocan la máquina en todas las fases; nada bajo el suelo.
5. **Gancho del salón**: `SalonEntrenar` pinta el sujeto del bloque cuando `patronDeBloque`
   da ficha; si no, `SalonSinSujeto` como hoy. Se acuerda con asus-f4 antes de entrar.
6. Verify completo, PR contra la rama de abajo, palabra de Bryan.
