# Fuera de alcance

Aquí viven los pendientes que las specs traían escritos y que **no los exige `SEMANA-2.md`**
—el documento de alcance que está en la raíz del repo; no hay ningún `SEMANA.md`, y cuando
en esta casa se dice «SEMANA» se habla de ése—.

La regla es la que aprobó Bryan: **ninguna spec lleva sección de «Qué queda»**. Lo que una
spec dejaba a medias o dejaba dicho a propósito, o está hecho —y entonces desaparece— o
está aquí, o está en `PENDIENTE-EN-ALCANCE.md`, que es el que Bryan tiene que mirar.

Estar en esta lista **no significa que esté mal ni que no se vaya a hacer**. Significa una
sola cosa: que ninguno de los puntos de `SEMANA-2.md` lo pide, así que no puede frenar la
entrega de la semana. Casi todas son decisiones ya tomadas con su motivo escrito; se
guardan para que nadie las vuelva a tomar de pasada y en sentido contrario.

Los puntos que se citan son los del `§5. Qué significa "terminado"` de cada pendiente de
`SEMANA-2.md`: el del PENDIENTE 1 son cinco cosas que tienen que verse a la vez en el
iPhone (salón, letras en 3D, sujeto, cámara, implementos), y el del PENDIENTE 2 es «cero
casillas quietas». El `§6` de cada uno es el TESTIGO.

| ítem | spec de origen | por qué no lo exige `SEMANA-2.md` | dueño sugerido |
|---|---|---|---|
| **El reintento del atlas no tiene espera ni cuenta atrás.** Se reintenta cuando el visor vuelve a pedir y cuando el navegador avisa de que hay red; no hay backoff. | `2026-09-08-carga-del-atlas-por-pieza.md` | Ninguno de los cinco puntos del §5 habla de política de reintento: piden que las cinco cosas **se vean**, y con el cargador por pieza se ven. La spec además razona la ausencia: un bucle por temporizador contra un CDN caído es un martillo, y aquí lo que falta se ve —el cuerpo sin músculos—, así que la persona ya tiene motivo para tocar algo. | interfaz |
| **Nadie avisa de que falta una pieza.** Si el esqueleto llega y los músculos no, el cuerpo se abre sin músculos y no lo dice. | `2026-09-08-carga-del-atlas-por-pieza.md` | El §5 pide que se vea el sujeto, no que la app narre lo que le falta; y el §5 del PENDIENTE 2 cuenta movimiento, no avisos. La propia spec lo manda a la capa de interfaz como decisión aparte. | interfaz |
| **`encuadrar()` recorre `ESQUELETO`** —el juego neutro— para juntar los puntos del cuerpo, y `patron.foco` busca ahí el padre del hueso: es un tercer sitio del que sale una lista de huesos. | `2026-09-08-definicion-corporal.md` | Es higiene interna, no comportamiento: hoy los tres juegos tienen los mismos nombres y los mismos padres, así que no mueve un píxel de las cinco cosas del §5 ni una casilla del PENDIENTE 2. Conviene hacerlo; no lo pide la semana. | datos |
| **Un solo lado.** Se pide una tibia, un fémur, un antebrazo y un brazo, no izquierdo y derecho, así que una asimetría real no se va a ver. | `2026-09-08-encuesta-de-medidas.md` | `SEMANA-2.md` no nombra la asimetría en ningún punto, y la decisión ya está tomada con su motivo: dieciséis campos habrían hundido el formulario, y un formulario que se rellena a medias da una medida que no se puede comparar dentro de tres meses. | datos |
| **El estado de React del tiempo no se movió**: `fase` y `reproduciendo` siguen dentro de `VisorPatron`. | `2026-09-08-partir-el-visor.md` | Es reparto interno entre dos archivos, y el contrato de aquella tarea era que esos dos archivos **solo pierden líneas**. El mando del salón ya funciona desde `controlDelTiempo.ts`, que es lo que el §5 podría llegar a mirar. | interfaz |
| **La velocidad no tiene mando todavía.** `ponerLaVelocidad` está construida y probada, pero ningún gesto la llama: el disco solo pausa y recorre. | `2026-09-08-tiempo-de-la-repeticion.md` | Ni el §5 ni el §6 de ninguno de los dos pendientes piden control de velocidad. Y no es código olvidado: está declarada como huérfana **con su motivo** en `src/test/codigo-huerfano.test.ts:322`, que es el sitio donde este repo guarda lo que existe antes de tener quien lo llame. | interfaz |
| **El estado del tiempo es de módulo**, así que dos visores a la vez compartirían mando. | `2026-09-08-tiempo-de-la-repeticion.md` | Hoy solo hay un visor montado a la vez, y `SEMANA-2.md` describe una sola pantalla de Entrenar con un salón dentro. El día que haya dos, esto pide un identificador; ese día no es esta semana. | interfaz |
| **Nadie avisa de que la demostración está pausada** más que la propia demostración. | `2026-09-08-tiempo-de-la-repeticion.md` | Es una decisión tomada a propósito y en la dirección del alcance, no en contra: el §1 del PENDIENTE 1 dice que el salón ocupa la pantalla entera y que los datos van **en las paredes**, así que un cartel encima del sujeto rompería la regla. Si algún día se echa de menos, el sitio es la pared, no el mando. | interfaz |
