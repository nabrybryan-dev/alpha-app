# El ritmo se ve en el cuerpo, no en un rótulo

**2026-09-10** · salón de `/entrenar` · rama `salon/kit-verificado`

Bryan: *«agrégale al diseño las diferentes velocidades o zonas aeróbicas, para que se vea
cuándo corre lento o intenso o camina»*.

## Qué pasaba

Un trote de zona 2 y un intervalo a RPE 8 se animaban **exactamente igual**: la misma
cadencia, la misma zancada, la misma amplitud. Lo único que los distinguía era una cifra en
el muro. El salón enseñaba QUÉ se hace y no A QUÉ RITMO, que en cardio es medio ejercicio.

## De dónde sale el esfuerzo

Del texto que escribió el coach, y **solo** de ahí:

- **RPE** (`RPE 8`, `rpe 7-8` → se queda con el techo), en la escala útil de 4 a 10;
- **zona aeróbica** (`zona 2`, `Z4`), las cinco clásicas;
- y si no hay número, **la palabra**: suave, conversacional, sostenido, fuerte, intervalos,
  a tope. De dos palabras gana **la más fuerte**, no la primera: «1 min fuerte / 1 min suave»
  son las dos mitades de un intervalo, y si ganara «suave» un HIIT se vería como un paseo.

**Si no dice nada, no se inventa.** Sin ritmo escrito la ficha se anima tal como está, y no
hay un esfuerzo por defecto escondido: un trote que nadie calificó no puede parecer suave ni
fuerte, porque nadie lo dijo.

## Qué se mueve, y por qué justo eso

De medidas publicadas de carrera a distintas velocidades, no de ajustar a ojo:

| Qué | Cuánto | Por qué se ve |
|---|---|---|
| Cadencia | ±14 % del período | Es lo primero que se nota de lejos |
| Rodilla de la pierna que **recoge** | hasta +15° de flexión (62,6° → 77,1° medidos) | El cambio más grande y más visible: el talón sube hacia el glúteo |
| Cadera de la pierna de **atrás** | +4,5° de extensión entre el 85 % y el 130 % de la velocidad libre | La zancada se abre por detrás |
| Cadera de la pierna que **llega** | ~1° por escalón de velocidad | Casi nada, y por eso el número es pequeño |

**La pierna que apoya no se toca.** Está casi estirada: estirarla más la rompería hacia
atrás, y encogerla haría cojear.

Fuentes:
- [A little bit faster: Lower extremity joint kinematics and kinetics as recreational runners achieve faster speeds](https://www.sciencedirect.com/science/article/pii/S0021929018300964)
- [Investigation of normal knees kinematics in walking and running at different speeds](https://www.tandfonline.com/doi/full/10.1080/14763141.2020.1864015)
- [Runners Adapt Different Lower-Limb Movement Patterns With Respect to Different Speeds and Downhill Slopes](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8275652/)

## En una máquina se mueve la cadencia y NADA más

Y esto es lo que separa esto de un efecto. En una bicicleta, una elíptica o una escaladora
**el recorrido lo fija el aparato**: pedalear fuerte es pedalear más rápido y apretar más, no
describir un círculo más grande — el pedal no se sale de su eje. Estirar las amplitudes ahí
sería dibujar una máquina que no existe. Correr y caminar son lo contrario: la pierna va
libre, y la amplitud es justo lo que cambia.

## Dónde vive

`domain/patrones/esfuerzoDelBloque.ts`, función pura: entra la ficha y el texto, sale la
ficha animada a ese ritmo. **Devuelve el MISMO objeto cuando no hay nada que cambiar**, y eso
no es cosmético: el visor monta su escena WebGL con la ficha por dependencia, así que una
copia nueva en cada render recrearía el contexto entero. El salón la llama dentro de un
`useMemo` por la misma razón.

## Guardián

`esfuerzoDelBloque.test.ts`, once casos, visto rojo con cuatro señuelos: que ganara la primera
palabra en vez de la más fuerte, que la máquina también estirara la amplitud, que la pierna de
apoyo se moviera, y que devolviera copia siempre.

Y la prueba que no se puede automatizar: las dos fotos del mismo corredor a **zona 2** y a
**RPE 9**, en `informes/ritmo-zona2.png` y `informes/ritmo-rpe9.png`. En la primera las
piernas van juntas y el paso es corto; en la segunda la pierna de atrás se abre y el talón
sube al glúteo.
