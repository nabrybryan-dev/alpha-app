# Pendiente, y dentro del alcance

**Este archivo es para Bryan.** Aquí no se ha decidido nada: son los pendientes que las
seis specs del 8 de septiembre traían escritos, que **sí los pide `SEMANA.md`** y que **no
están hechos** en esta rama. Lo que estaba hecho se borró de las specs sin más; lo que no
lo pide ningún punto se fue a `FUERA-DE-ALCANCE.md` con el motivo escrito uno por uno. Lo
de aquí se deja a la vista porque sacarlo del alcance es decisión del coach, no de quien
limpia las specs.

## Cuál es el documento de alcance

El que manda es **`SEMANA.md`, del 1 de septiembre** («Pendiente 1 — Demo del salón
cuadridimensional personalizado»), que está **sin trackear, solo en disco**, en
`C:\Users\ASUS\dev\alpha-app\SEMANA.md`. Por eso no aparece en `git ls-files` ni se
encuentra desde un worktree. No se ha copiado al repo a propósito.

El `SEMANA-2.md` que sí está en la raíz es del **29 de agosto**, y es anterior y menos
exigente. Cuando los dos hablan, manda el del 1-sep; `SEMANA-2.md` solo se cita donde
`SEMANA.md` calla, y se dice cuándo pasa.

Los diez puntos del `§5. Qué significa terminado`, en corto: (1) salón 4D con interfaz
libre y sujeto en el centro · (2) recorrer el tiempo **y** las capas internas · (3) el
sujeto convierte en acciones gráficas técnica, repeticiones, series, velocidad de la
última repetición y descanso · (4) la encuesta pide **exactamente** las ocho medidas · (5)
al cambiar las medidas cambian las proporciones **de forma visible** · (6) dos
antropometrías conservan el patrón pero difieren de forma comprobable en técnica,
segmentos móviles y fijos, brazos de momento, vectores, reparto de carga y centro de masas
· (7) dominada en cadena cerrada · (8) peso muerto convencional desde el suelo · (9)
acabado gráfico realista · (10) ningún texto aprobado cambia de sentido sin revisión de
Bryan.

## Lo que las seis specs dejaron pendiente y sí se pide

| ítem | spec | punto de `SEMANA.md` que lo exige | dueño |
|---|---|---|---|
| **Nadie usa todavía las seis longitudes para dibujar el sujeto.** El visor ya sabe recibir `ProporcionesDelCuerpo`, pero esas proporciones salen de una pista de pose, no de la ficha. | `2026-09-08-encuesta-de-medidas.md` | **Punto 5**, literal: «al cambiar las medidas, las proporciones del sujeto cambian de forma visible». Hoy no cambian, porque nadie las lee. Verificado: `src/domain/cuerpoDelAsesorado.ts:65-73` compone el cuerpo con `estaturaVigente(perfil?.medidas)` y `proporcionesDeSusSeries(microciclos)`, y ninguna de las dos mira las ocho. **Es el punto 5 entero, y es la fila que arrastra a las tres siguientes.** | datos |
| **Que las ocho lleguen a `perfiles` y se validen allí.** La spec de la encuesta dejó escritas las claves para que la capa de datos pudiera hacerlo. | `2026-09-08-encuesta-de-medidas.md` | **Puntos 4 y 5.** Está hecho a medias y **las dos mitades no se tocan**: el dominio construyó un catálogo cerrado de ocho claves de máquina en `MedidaCorporal.cuerpo` con su validador (`revisarMedidas`, `src/domain/medidas.ts`), y el formulario sigue escribiendo en `MedidaCorporal.perimetros` con las claves de persona («Tibia y peroné», «Fémur»…, `src/features/bienestar/MedidasCard.tsx:169`). Hoy `revisarMedidas` no lo llama nadie en `src/` fuera de su propio test, y nada escribe `cuerpo`. El punto 4 se cumple **de cara a la persona** —la encuesta pide ocho y solo ocho— pero por debajo hay dos catálogos. | datos |
| **Llevar las ocho medidas a `definicionDe`**, que es hoy el único sitio del que sale un cuerpo. | `2026-09-08-medidas-en-el-dominio.md` | **Puntos 5 y 6.** `definicionDe(sexo, estaturaCm, proporciones)` (`src/domain/patrones/definicionCorporal.ts:140-145`) no recibe `MedidasDelCuerpo` por ninguna parte. Sin este paso, el punto 6 solo se puede demostrar inyectando proporciones a mano, que es justo lo que hace hoy el informe. | datos |
| **Las proporciones solo salen de una pista de pose**, y cuando la ficha tenga las ocho con cinta habrá dos fuentes para fémur, tibia, torso y antebrazo: hay que decidir cuál manda. | `2026-09-08-definicion-corporal.md` | **Puntos 5 y 6.** Es la misma decisión que la fila de arriba, escrita desde el otro lado. La respuesta probable es la cinta —está en centímetros, la pista solo da razones—, pero **eso lo decide Bryan**. | datos |
| **La anchura de hombros no se usa**: sigue escalada con la estatura, o sea con la proporción del atlas. | `2026-09-08-definicion-corporal.md` | **Puntos 5 y 6.** El ancho clavicular es una de las ocho y **ya se pide** (`anchoClavicularCm`, `src/domain/medidas.ts:58`), pero nadie lo consume, así que el sujeto luce los hombros del atlas. Y afecta al punto 6 por partida doble: el ancho clavicular cambia el brazo de momento de todo empuje y toda tracción horizontal. **La otra mitad del ítem original —la planta del pie— se cae sola**: el punto 4 prohíbe pedir una novena medida, así que la planta ni se mide ni se va a medir en esta versión. | datos |
| **La velocidad no tiene mando todavía.** `ponerLaVelocidad` está construida y probada por el tipo, pero ningún gesto la llama: el disco solo pausa y recorre. | `2026-09-08-tiempo-de-la-repeticion.md` | **Punto 3**, que nombra «la velocidad de la última repetición» entre las cinco cosas que el sujeto tiene que convertir en acción gráfica. Hoy la app **mide** esa velocidad, pero el sujeto no la representa: la palanca existe y está desconectada, declarada huérfana con su motivo en `src/test/codigo-huerfano.test.ts:322`. Cuando se decida el gesto —lo natural sería el eje vertical del mismo disco— ya hay dónde enchufarlo. **Cambió de veredicto**: con `SEMANA-2.md` esto no lo pedía nadie; con `SEMANA.md` sí. | interfaz |
| **`encuadrar()` recorre `ESQUELETO`** —el juego neutro— para juntar los puntos del cuerpo, y `patron.foco` busca ahí el padre del hueso: es un tercer sitio del que sale una lista de huesos. | `2026-09-08-definicion-corporal.md` | **Punto 6.** Se dice entero para que no se lea como una alarma: **hoy no rompe nada**, porque las posiciones sí salen del esqueleto individualizado (`escena.ts:271-273` resuelve la fase con `huesos` y solo toma de `ESQUELETO` la lista de nombres), y los tres juegos comparten nombres y padres. Lo que lo pone en esta lista y no en la otra es que el punto 6 vive justo de esa cadena: el día que un juego individualizado deje de calcar los nombres del neutro, el encuadre dejaría de seguir al cuerpo **sin que falle nada**. | datos |
| **El eje W del testigo no mide nada desde que la escalera es un gesto.** `PULSAR_W_EN_PAGINA` busca `[role="group"][aria-label="Capa del cuerpo"]`, que ya no existe: el acta sale con `ejeW.botones: -1` y `cambioEnSujeto: 0`. | `2026-09-08-partir-el-visor.md` | **Punto 2**, por el lado de la medida. La navegación por capas **funciona** —mantener el dedo sobre el cuerpo hunde de la piel al hueso, `SalonEntrenar.tsx:889-891`—, pero lo único que la certificaba apunta a un grupo de botones retirado (`testigo/salon-visible.mjs:476`; en `src/` el selector solo aparece en tres tests que comprueban que **ya no está**). `SEMANA.md` no pide testigos —su prueba es que Bryan abra el enlace—, así que aquí se conserva la cita a `SEMANA-2.md` §6, que sí los exige. | pruebas |

## Puntos de `SEMANA.md` sin ninguna spec detrás

Esto es lo que las seis specs de esta tanda **no** cubren. Va punto por punto, con quién lo
cubre cuando alguien lo cubre, porque el hueco solo se ve mirando los diez seguidos.

| punto | ¿lo cubre alguna de las seis? | estado real |
|---|---|---|
| **1.** Salón 4D, interfaz libre, sujeto en el centro | No, y no hace falta | Ya existía antes de esta tanda. Las seis lo sostienen sin entregarlo: `partir-el-visor.md` adelgaza el visor que lo dibuja y `carga-del-atlas-por-pieza.md` evita que el cuerpo se abra sin músculos. |
| **2.** Recorrer el tiempo **y** las capas internas | A medias | El **tiempo** lo entrega `tiempo-de-la-repeticion.md`: el disco pausa el gesto y lo recorre, con testigo de dedo real. Las **capas** ya se recorren en el salón (`SalonEntrenar.tsx:889-891`) pero **ninguna de las seis specs las toca**, nadie las mide (fila del eje W) y con teclado no hay forma de cambiar de capa (`SalonEntrenar.tsx:894-896`). |
| **3.** Técnica, repeticiones, series, velocidad de la última repetición y descanso, como acción gráfica | A medias, y es el hueco más grande | El **descanso** ya se cuenta en el muro y `tiempo-de-la-repeticion.md` lo comprueba. La **velocidad** tiene la palanca construida y desconectada (fila de arriba). **Técnica, repeticiones y series convertidas en acciones del sujeto: ninguna de las seis, y ningún código que se haya encontrado.** |
| **4.** La encuesta pide exactamente las ocho | **Sí, y comprobado** | `encuesta-de-medidas.md` (interfaz) y `medidas-en-el-dominio.md` (dominio). El test cuenta los campos por su papel y compara la lista con las ocho **en orden**, así que una novena sale en rojo por las dos mitades. Es el único de los diez puntos que esta tanda cierra. |
| **5.** Al cambiar las medidas cambian las proporciones | **No** | Se piden y se guardan; nadie las lee (`cuerpoDelAsesorado.ts:65-73`). Cuatro filas de la tabla de arriba son este punto. |
| **6.** Dos antropometrías, mismo patrón, diferencias comprobables | A medias, y por el lado equivocado | `definicion-corporal.md` sí lo demuestra: `informes/definicion-corporal.json` compara dos cuerpos de 175 cm con el fémur ±15 % y mide `angulosIdenticosEnCadaFase`, `trazaMaximaSeparacionMm` y `brazosDeMomentoPorFase` — o sea, mismo ejercicio con palancas distintas. Pero **las proporciones se le inyectan a mano**, no salen de las ocho medidas. Y de lo que el punto 6 enumera, el informe cubre técnica, segmentos y brazos de momento; **no cubre vectores de fuerza, reparto de carga ni centro de masas por antropometría**, y ninguna de las seis specs los toca. |
| **7.** Dominada en cadena cerrada | No, y **ya está hecho** | Existe desde el 6-sep, fuera de esta tanda: `catalogo.ts:529-531` — `id: 'dominada'`, `cadena: 'cerrada'`, `apoyo: 'manos'`, y la raíz del cuerpo sube de 0,95 a 1,4 m mientras las manos no se mueven. Su spec es `2026-09-06-la-maquina-de-dominada-asistida.md`. Conviene que quede marcado como cerrado. |
| **8.** Peso muerto convencional desde el suelo | **No. Nada.** | Los 40 patrones del catálogo no incluyen ninguno: `bisagra_cadera` (`catalogo.ts:244-248`) sigue siendo el rumano y así lo dicen sus propios ejemplos («Peso muerto rumano con barra…»). Sin spec, sin patrón, sin código. **Es el hueco más limpio de los diez.** |
| **9.** Acabado gráfico actual y realista | No | Ninguna de las seis. `carga-del-atlas-por-pieza.md` solo garantiza que las tres piezas del atlas lleguen, que es condición previa y no acabado. El trabajo de superficies vive en otra spec y otra tanda (`2026-09-05-el-motor-pinta-superficies.md`). |
| **10.** Ningún texto aprobado cambia de sentido sin revisión de Bryan | Ninguna de las seis toca prescripciones | Pero hay **una decisión de texto que Bryan debería ver y no es una prescripción**: `encuesta-de-medidas.md` saca la báscula de «Mis medidas» —desde ahora el peso se anota en el check-in del día— y estrena la clave `Caderas` en plural mientras el historial viejo guarda `Cadera`, así que **la serie de caderas no se une sola**. Las dos están escritas en la spec; ninguna está aprobada. |

## Una consecuencia de haber borrado las secciones

`src/domain/medidas.ts:233` remite a «`docs/specs/2026-09-08-definicion-corporal.md` §5»,
que era la sección que este cambio se lleva. Ese apunte vive ahora en las filas de esta
tabla. Cambiar el comentario es de quien manda en `src/`, y por eso queda dicho aquí y no
hecho.
