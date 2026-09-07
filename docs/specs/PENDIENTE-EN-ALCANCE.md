# Pendiente, y dentro del alcance

**Este archivo es para Bryan.** Aquí no se ha decidido nada: son los pendientes que las
seis specs del 8 de septiembre traían escritos, que **sí los pide `SEMANA-2.md`** —el
documento de alcance de la raíz del repo; no existe ningún `SEMANA.md`— y que **no están
hechos** a día de hoy en esta rama.

Lo que estaba hecho se ha borrado de las specs sin más. Lo que no lo pide ningún punto se
ha ido a `FUERA-DE-ALCANCE.md`, con el motivo escrito uno por uno. Lo de aquí no se ha
mandado a ningún sitio a propósito: se deja a la vista porque sacarlo del alcance es una
decisión del coach, no de quien limpia las specs.

Los puntos que se citan son los del `§5. Qué significa "terminado"` del PENDIENTE 1 de
`SEMANA-2.md`, que son cinco y tienen que verse **a la vez, sin scroll y sin tocar nada**:
(1) el salón con sus paredes, (2) las letras y los datos en 3D sobre esas paredes, (3) **el
sujeto en medio**, (4) la cámara a un lado, (5) los implementos. Y el `§6`, que es el
TESTIGO: un script en Chrome con la pestaña visible que cuente píxeles y devuelva un
número.

| ítem | spec | punto de `SEMANA-2.md` que lo exige | dueño |
|---|---|---|---|
| **La anchura de hombros y la planta del pie no se miden.** Siguen escaladas con la estatura, o sea con la proporción del atlas. | `2026-09-08-definicion-corporal.md` | PENDIENTE 1, §5 punto 3 — «El sujeto en medio». El sujeto que se ve sigue teniendo los hombros del atlas, no los de la persona. Y la mitad de este ítem ya cambió de estado: el **ancho clavicular sí se pide** desde esta rama (`anchoClavicularCm`, `src/domain/medidas.ts:58`), pero nadie lo consume. La planta del pie no se pide ni se usa. | datos |
| **Las proporciones solo salen de una pista de pose.** Cuando la ficha tenga las ocho medidas con cinta habrá una segunda fuente para fémur, tibia, torso y antebrazo, y hay que decidir cuál manda. | `2026-09-08-definicion-corporal.md` | PENDIENTE 1, §5 punto 3. Es la misma decisión que la fila de `medidas-en-el-dominio` de más abajo, escrita desde el otro lado. La respuesta probable es la cinta —está en centímetros, la pista solo da razones—, pero **eso lo decide Bryan**, y hoy `cuerpoDelAsesorado()` (`src/domain/cuerpoDelAsesorado.ts:65-73`) solo lee la pista. | datos |
| **Que las ocho lleguen a `perfiles` y se validen allí.** La spec de la encuesta dejó escritas las claves para que la capa de datos pudiera hacerlo. | `2026-09-08-encuesta-de-medidas.md` | PENDIENTE 1, §5 punto 3. Está hecho a medias y **las dos mitades no se tocan**: el dominio construyó un catálogo cerrado de ocho claves de máquina en `MedidaCorporal.cuerpo` con su validador (`revisarMedidas`, `src/domain/medidas.ts`), y el formulario sigue escribiendo en `MedidaCorporal.perimetros` con las claves de persona («Tibia y peroné», «Fémur»…, `src/features/bienestar/MedidasCard.tsx:169`). Hoy `revisarMedidas` no lo llama nadie en `src/` fuera de su propio test, y nada escribe `cuerpo`. | datos |
| **Nadie usa todavía las seis longitudes para dibujar el sujeto.** El visor ya sabe recibir `ProporcionesDelCuerpo`, pero esas proporciones salen de una pista de pose, no de la ficha. | `2026-09-08-encuesta-de-medidas.md` | PENDIENTE 1, §5 punto 3 — y es el motivo por el que la encuesta se cambió: «el sujeto 3D del salón no tiene cuerpo». Con la estatura sola, dos personas de 1,75 con fémures distintos se dibujan iguales. Verificado sin hacer: `src/domain/cuerpoDelAsesorado.ts:65-73` compone el cuerpo con `estaturaVigente(perfil?.medidas)` y `proporcionesDeSusSeries(microciclos)`, y ninguna de las dos mira las ocho medidas. | datos |
| **Llevar las ocho medidas a `definicionDe`**, que es hoy el único sitio del que sale un cuerpo, después de decidir si manda la cinta o la pista. | `2026-09-08-medidas-en-el-dominio.md` | PENDIENTE 1, §5 punto 3. Verificado sin hacer: `definicionDe(sexo, estaturaCm, proporciones)` (`src/domain/patrones/definicionCorporal.ts:140-145`) no recibe `MedidasDelCuerpo` por ninguna parte. | datos |
| **El eje W del testigo no mide nada desde que la escalera es un gesto.** `PULSAR_W_EN_PAGINA` busca `[role="group"][aria-label="Capa del cuerpo"]`, que ya no existe en el salón: el acta sale con `ejeW.botones: -1` y `cambioEnSujeto: 0`. | `2026-09-08-partir-el-visor.md` | PENDIENTE 1, §6 — el TESTIGO. El acta certifica hoy un grupo de botones que se retiró, y un testigo que da un número sobre algo que no existe es exactamente lo que el §6 quiere evitar. Verificado sin arreglar: el selector sigue en `testigo/salon-visible.mjs:476` y en `src/` solo aparece en tres tests que comprueban que **ya no está**. | pruebas |

## Una consecuencia de haber borrado las secciones

`src/domain/medidas.ts:233` remite a «`docs/specs/2026-09-08-definicion-corporal.md` §5»,
que era la sección que este cambio se lleva. Ese apunte vive ahora en las dos primeras
filas de esta tabla. Cambiar el comentario es de quien manda en `src/`, y por eso queda
dicho aquí y no hecho.
