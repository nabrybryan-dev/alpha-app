# El cardio que está programado de verdad, y qué le faltaba

**2026-09-10** · salón de `/entrenar` · rama `salon/kit-verificado`

Encargo de Bryan: *«visualiza qué ejercicios de cardio tienen programados los asesorados,
busca referencias y complétalos»*. Así que lo primero no fue escribir código: fue mirar.

## Lo que hay, medido sobre los microciclos activos

**47 bloques de `bloquesCardio` en 11 personas**, 27 textos distintos. Catorce de esos bloques
viven en sesiones **sin ejercicios**, que son las que abren el salón de cardio.

Pasados por el enrutador real —`patronDeBloque()`, no una copia—, **14 de 27 tenían ficha**.
Los trece que no, en tres montones bien distintos:

| Montón | Cuántos | ¿Es un hueco? |
|---|---|---|
| Notas del coach dentro de `bloquesCardio` («LEE ESTO PRIMERO», «TU RODILLA MANDA») | 6 | No. No son trabajo. |
| Formatos sin un gesto único (circuito 20/10, HIIT) y NEAT (pasos al día) | 4 | No. Decisión escrita del 7-sep. |
| **Movimiento con gesto y sin camino hasta su ficha** | **3** | **Sí.** |

Y además, un error que no era un hueco: **cuatro bloques de salir a correr —«5 km por la
tarde»— se dibujaban encima de una cinta**.

## Lo que se completó

### 1 · La movilidad y la propiocepción ya tenían ficha; les faltaba el camino

`apoyo_una_pierna`, `rotacion_cadera`, `dorsiflexion` y `movilidad_toracica` llevaban meses
escritas en el catálogo. El enrutador de bloques solo sabía leer **seis modalidades de
cardio**, así que un bloque titulado «PROPIOCEPCIÓN — 3×30 seg por pierna» no llegaba a la
ficha que lo dibuja. No hubo que dibujar nada nuevo: hubo que llegar.

**En una secuencia manda el orden del TEXTO, y en las modalidades el de la lista.** No es una
incoherencia: «bicicleta o caminadora» son alternativas —se hace una— y ahí decide la lista,
de lo más específico a lo más general; «cadera, tobillo y torácica» es una secuencia —se hacen
las tres— y la primera es por donde se empieza.

**Los gestos se leen solo del título.** Una NOTA habla de movimientos sin ser uno: «POR QUÉ HOY
NO HAY CIRCUITO», cuyas indicaciones dicen «hoy caminas y trabajas equilibrio», salía con
muñeco de apoyo monopodal. Los cinco bloques de movilidad y propiocepción de la cartera nombran
su gesto en el título, así que leer las indicaciones no gana ninguno y cuela notas.

### 2 · La carrera de la calle no lleva cinta debajo

Ficha nueva `carrera_al_aire`, la 71 con patrón. **Los dos números que la separan de la cinta
salen de medidas publicadas**, no de ajustar a ojo hasta que «se vea bien»:

- **flexión de cadera al contacto: +12°** (en cinta se reduce unos doce grados respecto al
  suelo). La pierna que llega pasa de 42° a 54°.
- **ángulo del pie contra el suelo al contacto: ~10° más** —aterrizaje más de talón—, así que
  la dorsiflexión de la pierna que aterriza pasa de −4° a −14°.

Todo lo demás —cadencia, rodilla, brazos, tronco— es comparable entre las dos según la revisión
sistemática, así que se deja idéntico: cambiar más sería inventar.

Fuentes:
- [Is Motorized Treadmill Running Biomechanically Comparable to Overground Running? A Systematic Review and Meta-Analysis](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7069922/)
- [Three-dimensional kinematic comparison of treadmill and overground running](https://www.tandfonline.com/doi/full/10.1080/14763141.2012.759614)
- [Joint kinematics and ground reaction forces in overground versus treadmill graded running](https://pubmed.ncbi.nlm.nih.gov/29729612/)

**Y la regla que deja:** sin ninguna pista, la cinta sigue siendo lo que toca —el salón ES un
gimnasio—. Lo que no puede pasar es dibujar una máquina que el propio texto desmiente.

### 3 · Una cíclica puede no tener máquina

`cardio.escena.test.ts` afirmaba «toda ficha cíclica recibe una máquina». Ahora son dos mitades:
la que tiene máquina la tiene bien puesta, y la que no, **no dibuja ningún aparato**. Sin esa
segunda mitad, quitarle la cinta a una ficha de gimnasio pasaría de largo.

## El resultado, con el mismo instrumento

**De 14 a 17 textos con ficha** sobre los 26 reales, y en los días que de verdad abren el salón
de cardio, **de 5 a 8 de 14**. Los seis que siguen sin muñeco son los que no deben tenerlo: dos
formatos, dos notas y dos estiramientos globales —«10 min globales» no es un gesto, es un rato,
y un muñeco ahí tendría que elegir uno de veinte estiramientos y enseñar el que nadie pidió—.

## Dos prescripciones que no dicen en qué se hacen

No es cosa de la app y por eso no se arregla en la app: **«CARDIO PEGADO AL FINAL — 15 min
estado estable»** e **«INTERVALOS LARGOS: 5 × 3 min FUERTE / 2 min SUAVE»** no nombran ninguna
modalidad. El salón no se la inventa. Si el coach escribe «en bici» o «en cinta», las dos
ganan sujeto sin tocar una línea de código.

## Dos guardianes que nacieron mal y lo dijeron

- La regla «manda el orden del texto» se **documentó bien y se programó mal** (un `find` sobre
  la lista). «MOVILIDAD: tobillo y cadera» devolvía cadera. Lo cazó su propia prueba, escrita
  con las dos regiones al revés a propósito.
- Un `\b` de una expresión regular se convirtió en un **carácter de retroceso** al escribir el
  archivo, y dejó dos reglas mudas: «8.000 PASOS» pasó a dibujar una caminata y las cuatro
  carreras de la calle siguieron en la cinta. Se vio en la medida contra la cartera, no
  leyendo el código: el número no cuadraba con lo que acababa de escribirse.
