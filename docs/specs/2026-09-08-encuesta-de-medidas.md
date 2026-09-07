# La encuesta de medidas (2026-09-08)

## Qué pide ahora, y por qué justo esto

«Mis medidas» pedía la báscula y cinco perímetros de estética: cintura, cadera, abdomen,
muslo y brazo. Con eso el coach ve si alguien adelgaza, y ya.

Ahora pide **ocho**, y seis de ellas son **longitudes de hueso**. El motivo no es el
seguimiento: es que **el sujeto 3D del salón no tiene cuerpo**. Con la estatura sola el
muñeco se escala entero, así que dos personas de 1,75 con fémures distintos se dibujan
iguales — y el fémur es justo lo que cambia el brazo de momento de una sentadilla, que es
lo que la app enseña. Está escrito en `domain/patrones/estatura.ts`: lo que un escalado por
estatura NO puede hacer es individualizar las proporciones.

Las ocho, en el orden en que se piden. **Ni el orden, ni la etiqueta, ni el protocolo, ni
el rango están escritos en el formulario**: salen de la tabla `MEDIDAS` de
`src/domain/medidas.ts`, que es la única fuente (la trajo la capa de datos, PR #226). Esta
tabla es una copia para leer, no una segunda definición:

| # | Clave en `MedidaCorporal.cuerpo` | Etiqueta en pantalla | Rango que admite el dominio |
|---|---|---|---|
| 1 | `tibiaCm` | Tibia y peroné (cm) | 22–56 |
| 2 | `femurCm` | Fémur (cm) | 27–69 |
| 3 | `torsoCm` | Torso (cm) | 32–79 |
| 4 | `antebrazoCm` | Antebrazo (cm) | 14–34 |
| 5 | `brazoCm` | Brazo (cm) | 19–46 |
| 6 | `anchoClavicularCm` | Ancho clavicular (cm) | 24–57 |
| 7 | `cinturaCm` | Cintura (cm) | 40–200 |
| 8 | `caderasCm` | Caderas (cm) | 50–200 |

Cómo se toma cada una también sale de ahí (`comoSeMide`) y se pinta bajo su etiqueta.

Y **ninguna otra**. Un formulario que pide once cosas se rellena a medias, y una medida a
medias no se puede comparar con la de dentro de tres meses.

Cada campo lleva su protocolo al lado, no en un pie de página. Una longitud sin protocolo
no es una medida: el fémur medido desde la cadera y desde el trocánter son dos números
distintos, y el que se compara dentro de tres meses tiene que salir del mismo sitio.

## Dónde se guarda, y quién dice que está bien

Las ocho van en **`MedidaCorporal.cuerpo`** (`MedidasDelCuerpo`, del PR #226), no en
`perimetros`. La diferencia es la razón de ser de las dos mitades: `perimetros` tiene las
claves abiertas, y por eso en la app conviven «Cadera» y «Glúteos» —o «Brazo» y «Brazos»—
para el mismo dato; un mapa así no se puede consultar, porque nadie sabe si a la persona
le falta el dato o lo tiene con otro nombre. `cuerpo` tiene el catálogo cerrado.

- **La ficha ya no escribe en `perimetros`.** Guarda `{}` y deja intacto lo que hubiera.
  El resumen de la tarjeta sigue enseñando esos perímetros viejos, al lado de las ocho
  nuevas, para que a quien lleva meses midiéndose no se le borre la pantalla.
- **Antes de guardar se llama a `revisarMedidas(cuerpo)`.** Con un reparo no se guarda
  nada, el borde del campo se pone en rojo y el mensaje del dominio se pinta TAL CUAL
  debajo. Reescribirlo aquí sería una tercera versión de la regla. El reparo se va al
  tocar el campo: dejarlo puesto mientras se corrige convierte un aviso en un regaño.
- **El botón no se apaga por un valor fuera de rango**, y es a propósito: un botón apagado
  no dice por qué. Solo se apaga con las ocho en blanco, que no es un error sino un
  formulario sin empezar.
- Las que se dejen vacías **no se guardan**: un cero inventado es peor que un hueco.

## El peso ya no está aquí

La báscula sale del formulario. Se pregunta en el **check-in del día**
(`CheckinForm`, campo «Peso ayunas»), que es donde tiene sentido: el peso se mueve cada
día y un fémur no. Tenerlo también aquí lo convertía en la cuarta superficie de peso de la
app.

Lo que **sí** se queda es la prop `verPeso`, que sigue decidiendo si el resumen de la
tarjeta enseña el kilaje de una medición anterior. Es la migración 0018: a quien tiene un
antecedente de conducta alimentaria se le apagan las cifras de composición corporal, y
enseñarlas en el resumen sería dejarlas entrar por la puerta de atrás.

**Consecuencia que hay que decir en voz alta**: desde hoy, una persona no puede anotar su
peso desde «Mis medidas». Si alguien lo echa de menos, el sitio de esa decisión es el
check-in, no esta tarjeta.

## Cómo se comprobó

```
$ npx vitest run src/features/bienestar/MedidasCard.test.tsx
 ✓ la encuesta de medidas > pide exactamente ocho, con estas etiquetas y ninguna otra
 ✓ la encuesta de medidas > ya no pide el peso: eso es del check-in del día
 ✓ la encuesta de medidas > cada medida dice CÓMO se toma: una longitud sin protocolo no es una medida
 ✓ la encuesta de medidas > guarda en `cuerpo`, con las claves del dominio, y deja `perimetros` en paz
 ✓ la encuesta de medidas > una toma completa llega entera: las ocho claves en `cuerpo`
 ✓ la encuesta de medidas > una medida fuera de rango no se guarda, y lo dice con las palabras del dominio
 ✓ la encuesta de medidas > no deja guardar una medición vacía
 ✓ la encuesta de medidas > con una sola medida escrita ya deja guardar
 ✓ la encuesta de medidas > a quien tiene la composición apagada no le enseña el kilaje de antes
 ✓ la encuesta de medidas > y sí se lo enseña a quien sí ve su composición
 ✓ la columna de la pieza E (6 tests)
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

La primera cuenta los campos por su papel (`getAllByRole('textbox')`) y compara la lista
de etiquetas **contra `MEDIDAS` del dominio**, en su orden. Comparar contra ocho nombres
escritos en el test dejaría el test verde el día que la ficha y el dominio dejaran de
decir lo mismo, que es justo el fallo que hay que cazar: no da error, se ve como un campo
que no deja guardar sin decir por qué.

La del rango mete el fémur en milímetros —la trampa más frecuente de un campo de
centímetros— y comprueba tres cosas: que no se guarda, que el aviso lleva las palabras del
dominio (su etiqueta y su rango) y que está debajo de SU campo. Después lo corrige y
comprueba que entonces sí entra. No cuenta filas para saber si se guardó: `agregarMedida`
reemplaza la medición del mismo día, así que contar no distingue «no se guardó» de «se
guardó encima» — se compara el contenido.

## Qué queda

- **Las dos mitades ya encajan.** El catálogo, los rangos y el validador son de la capa de
  datos (`src/domain/medidas.ts`, PR #226) y este formulario los consume: no hay una sola
  etiqueta ni un solo rango escritos dos veces. Al llamar la ficha a `revisarMedidas`, su
  entrada en `HUERFANOS_DE_ENTRENAR` deja de hacer falta y se ha quitado.
- **Los registros viejos no se migran.** Lo que hay en `perimetros` («Cadera», «Glúteos»,
  «Abdomen medio») se queda donde está y se sigue enseñando; nadie lo traduce a las claves
  nuevas. Unir las dos series es una decisión de datos, no de la ficha.
- **Nadie usa todavía las seis longitudes para dibujar el sujeto.** El visor ya sabe
  recibir `ProporcionesDelCuerpo` (fémur, tibia y torso como razones), y hoy esas
  proporciones salen de una pista de pose medida (`cuerpoDelAsesorado`), no de la ficha.
  Enchufar estas medidas ahí es el paso siguiente y no es de esta tarea.
- **Un solo lado.** Se pide una tibia, un fémur, un antebrazo y un brazo, no izquierdo y
  derecho. Una asimetría real existe y no se va a ver aquí; pedir dieciséis campos para
  cazarla habría hundido el formulario.
