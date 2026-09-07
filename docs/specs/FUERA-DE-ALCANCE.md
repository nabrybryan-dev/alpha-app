# Fuera de alcance

Aquí viven los pendientes que las seis specs del 8-sep traían escritos y que **no los pide
ningún punto de `SEMANA.md`**.

## Cuál es el documento de alcance, porque hay dos y no dicen lo mismo

El que manda es **`SEMANA.md`, del 1 de septiembre** («Pendiente 1 — Demo del salón
cuadridimensional personalizado»). Está **sin trackear**, solo en disco, en
`C:\Users\ASUS\dev\alpha-app\SEMANA.md`: por eso no se encuentra desde este worktree ni
sale en `git ls-files`, y por eso conviene decirlo aquí antes que nada. No se copia al
repo a propósito — la raíz no es de esta tanda.

En la raíz sí está `SEMANA-2.md`, del **29 de agosto**. Es **anterior y menos exigente**:
pide que en el iPhone se vean cinco cosas a la vez. `SEMANA.md` pide diez, y entre ellas
hay tres que `SEMANA-2.md` ni nombra —la encuesta de las ocho medidas, la dominada en
cadena cerrada y el peso muerto desde el suelo—. **Cuando los dos hablan, manda el del
1-sep.** `SEMANA-2.md` solo se cita aquí donde `SEMANA.md` calla, y se dice cuándo pasa.

Los diez puntos del `§5. Qué significa terminado` de `SEMANA.md`, en corto, porque son la
vara con la que se mide cada fila:

1. salón cuadridimensional, interfaz libre, sujeto anatómico en el centro
2. moverse por el tiempo **y** por las capas internas del cuerpo
3. el sujeto convierte en acciones gráficas la técnica, las repeticiones, las series, la
   velocidad de la última repetición y el descanso
4. la encuesta pide **exactamente** las ocho medidas y ninguna otra
5. al cambiar las medidas, las proporciones del sujeto cambian de forma visible
6. dos antropometrías distintas conservan el patrón pero difieren de forma comprobable en
   técnica, segmentos móviles y fijos, brazos de momento, vectores, reparto de carga y
   centro de masas
7. la dominada se representa en cadena cerrada
8. el peso muerto convencional arranca del suelo y se distingue del rumano
9. acabado gráfico actual y realista de la estructura anatómica y muscular
10. ningún texto aprobado cambia de significado sin que Bryan lo revise antes

## La regla

**Ninguna spec lleva sección de «Qué queda».** Lo que una spec dejaba dicho o dejaba a
medias, o estaba hecho —y entonces desaparece—, o está aquí, o está en
`PENDIENTE-EN-ALCANCE.md`, que es el archivo que Bryan tiene que mirar.

Estar en esta lista **no significa que esté mal ni que no se vaya a hacer**. Significa una
sola cosa: que ninguno de los diez puntos lo pide, así que no puede frenar el demo. Casi
todas son decisiones ya tomadas con su motivo escrito, y se guardan para que nadie las
vuelva a tomar de pasada y en sentido contrario.

Cada fila se comprobó contra el **árbol integrado** (`integra/salon`), no contra la rama de
capa donde se escribe esto, que va por detrás.

| ítem | spec de origen | por qué no lo exige `SEMANA.md` | dueño sugerido |
|---|---|---|---|
| **El reintento del atlas no tiene espera ni cuenta atrás.** Se reintenta cuando el visor vuelve a pedir y cuando el navegador avisa de que hay red; no hay backoff. | `2026-09-08-carga-del-atlas-por-pieza.md` | Los puntos 1 y 9 piden que el sujeto **esté** y que su estructura se vea bien acabada, y para eso lo que hacía falta era el reintento por pieza, que ya está. Ningún punto pide una política de espera. La spec además razona la ausencia: un bucle por temporizador contra un CDN caído es un martillo, y aquí lo que falta se ve —el cuerpo sin músculos—, así que la persona ya tiene motivo para tocar algo. | interfaz |
| **Nadie avisa de que falta una pieza.** Si el esqueleto llega y los músculos no, el cuerpo se abre sin músculos y no lo dice. | `2026-09-08-carga-del-atlas-por-pieza.md` | Lo que piden los puntos 1 y 9 es que los músculos **estén**, no que la app narre lo que le falta; y eso lo entrega el cargador por pieza. Un aviso es otra cosa, y no lo pide ninguno de los diez. La propia spec lo manda a la capa de interfaz como decisión aparte. | interfaz |
| **Un solo lado.** Se pide una tibia, un fémur, un antebrazo y un brazo, no izquierdo y derecho, así que una asimetría real no se va a ver. | `2026-09-08-encuesta-de-medidas.md` | Aquí `SEMANA.md` no es que calle: **dice lo contrario**. El punto 4 exige que la encuesta pida «exactamente las ocho medidas acordadas y no solicite otras», y el §1 lo repite («No se incluirán otras medidas en esta primera versión»). Pedir dieciséis campos para cazar la asimetría **rompería** el punto 4. | datos |
| **Los registros viejos no se migran.** Lo que ya está en `perimetros` —«Cadera», «Glúteos», «Abdomen medio»— se queda donde está y se sigue enseñando; nadie lo traduce a las claves nuevas. | `2026-09-08-encuesta-de-medidas.md` | Ninguno de los diez puntos habla del historial: el punto 4 pide que la **encuesta** pida ocho y solo ocho, y el punto 5 pide que **esas ocho** muevan al sujeto. Las dos cosas se cumplen con lo que se guarde de hoy en adelante, sin tocar lo viejo. **Pero conviene mirarlo con los ojos abiertos**, porque desde `a78f9ca` la ficha guarda en `cuerpo` y deja `perimetros: {}` (`MedidasCard.tsx:188-189`): a partir de ahí la serie de una persona vive **en dos sitios** —lo de antes bajo «Cadera», lo nuevo bajo `caderasCm`— y la comparación con la medición anterior no las cruza sola. Unir las dos series es una decisión de datos, y es de Bryan, no de la ficha. | datos |
| **El estado de React del tiempo no se movió**: `fase` y `reproduciendo` siguen dentro de `VisorPatron` (`VisorPatron.tsx:400-401`). | `2026-09-08-partir-el-visor.md` | El punto 2 pide poder **moverse por el tiempo**, y eso ya funciona desde `controlDelTiempo.ts`. Dónde vive el estado de React de un componente no cambia nada de lo que Bryan abre en el enlace. El contrato de aquella tarea era además que esos dos archivos **solo pierden líneas**. | interfaz |
| **El estado del tiempo es de módulo** (`controlDelTiempo.ts:64`), así que dos visores a la vez compartirían mando. | `2026-09-08-tiempo-de-la-repeticion.md` | Hoy solo hay un visor montado a la vez, y el punto 1 describe **un** salón con **un** sujeto en el centro. El día que haya dos, esto pide un identificador; ese día no es este demo. | interfaz |
| **Nadie avisa de que la demostración está pausada** más que la propia demostración. | `2026-09-08-tiempo-de-la-repeticion.md` | Ninguno de los diez puntos pide el aviso: el punto 2 pide poder recorrer el tiempo, y se recorre. **Aviso de que el motivo escrito envejeció**: la spec lo justificaba con la regla de `SEMANA-2.md` de que todo va en las paredes, y `SEMANA.md` §1 ya no manda eso —habla de «una interfaz libre»—. La decisión sigue en pie; el argumento que la sostenía, no. Si algún día se echa de menos, esto se revisa. | interfaz |
