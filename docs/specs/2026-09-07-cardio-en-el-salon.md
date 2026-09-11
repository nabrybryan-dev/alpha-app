# El cardio entra al salón con sujeto y con máquina

**Encargo de Bryan, 2026-09-07 (tarde):** «integrar ejercicios de la parte de actividad
cardiovascular en las diferentes sesiones que tenemos e implementar; estos patrones de
movimiento son esos ejercicios».

## Lo que esto revierte, y hay que decirlo

`salon/sinPatron/SalonSinSujeto.tsx` lleva escrita una decisión anterior del propio Bryan:

> los ejercicios sin patrón de movimiento **abren el salón igual** […] pero **sin sujeto
> ejecutando en el centro**.

Y `SIN_PATRON` en `catalogo.ts` la aplica: bicicleta, cinta, elíptica, escaladora, zona 2,
caminata, trote, carrera continua… se quedan sin ficha a propósito. La orden de hoy es la
contraria para el cardio. Se hace, y se deja escrito que es un cambio de decisión y no una
deriva: el cribado de banderas rojas, el trineo y los circuitos sin modalidad **siguen sin
sujeto**.

## Qué hay en la base (medido, solo cifras)

El cardio **no es un ejercicio**: en los 22 microciclos activos no hay ni un `ejercicio`
de cardio. Vive en `sesion.bloquesCardio`, que son `ItemMarcable` (`titulo`,
`indicaciones`, `duracionMin`): 44 bloques en 26 sesiones. Y muchos no son cardio —notas
del coach, pasos diarios, estiramientos, propiocepción—. Las modalidades reales que aparecen
en el texto: **caminadora/cinta** (la más frecuente, con y sin pendiente), **escaladora**,
**bicicleta**, **elíptica** (como opción), **carrera** (al aire libre), **intervalos y
circuitos**.

## Diseño

1. **Cinco fichas cíclicas** en el catálogo: `caminata_en_cinta`, `carrera_en_cinta`,
   `escaladora`, `bicicleta_estatica`, `eliptica`. Locomoción, no repetición: la fase 0 es
   la pierna derecha delante y la izquierda atrás, la fase 1 es el espejo, con los canales
   por lado que el rig ya tiene (`caderaFlexD/I`, `rodillaFlexD/I`, `hombroFlexD/I`).
2. **Un ritmo cíclico en el motor.** `faseDeTiempo` hoy es una repetición: 1,2 s con punto
   de atasco, pausa, 1,9 s frenando, pausa. Una zancada no tiene pausas ni asimetría. La
   ficha declara `ciclo: { periodoSeg }` y el motor usa dos medios ciclos iguales y suaves,
   sin atasco ni asentamiento. El retardo distal se queda: en la marcha también lo distal
   va detrás.
3. **La máquina se coloca contra el cuerpo**, como el banco y la prensa: la cinta bajo los
   pies, la escaladora bajo los pies con los peldaños, la bici bajo la pelvis con los
   pedales en los pies, la elíptica con las plataformas en los pies y los brazos en las
   manos. No pasan por `IMPLEMENTOS`: esa tabla clasifica implementos **de carga** y una
   cinta no aporta carga (`implementosDeSesion.ts` ya lo dejó escrito). Van como piezas de
   escena propias, `forma: 'cinta' | 'escaladora' | 'bicicleta' | 'eliptica'`, sin agarres
   de carga, y por eso el guardián de oposición no las juzga.
4. **`patronDeBloque(bloque)`** en el dominio: la modalidad sale del `titulo` y las
   `indicaciones` por palabra clave. Un bloque que no nombre modalidad —«PASOS: 10.000 AL
   DÍA», «STRETCHING»— no da sujeto, y eso es correcto. «Carrera» sin cinta ni caminadora es
   correr en el sitio, sin máquina.
5. **El gancho del salón**: donde hoy `SalonEntrenar` cae a `SalonSinSujeto`, si el bloque
   de cardio da patrón se pinta el sujeto con su máquina. Es una condición en un archivo
   del carril de asus-f4; se acuerda antes de entrar.

## Lo que se mide antes de dar nada por bueno

- Nada bajo el suelo ni flotando: los pies sobre la cinta o los pedales, la pelvis en el
  sillín (`pruebas/nada-bajo-el-suelo`).
- Sin cuerpo atravesándose ni manos dentro del tronco (`el-gesto-no-se-contradice`).
- El ciclo es simétrico: la pierna derecha en la fase 0 es la izquierda en la fase 1, en
  cada canal, dentro de 1°.
- Sin pausas: la fase avanza en todo instante del periodo.
- La máquina toca lo que sostiene: los pies a la altura de la cinta o de los pedales en
  todas las fases, con la misma tolerancia que el banco.
