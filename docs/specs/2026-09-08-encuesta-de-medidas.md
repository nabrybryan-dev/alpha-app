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

Las ocho, en el orden en que se piden:

| # | Etiqueta en pantalla | Clave guardada | Cómo se mide |
|---|---|---|---|
| 1 | Longitud de tibia y peroné (cm) | `Tibia y peroné` | de extremo a extremo, del tobillo a la rodilla |
| 2 | Longitud del fémur (cm) | `Fémur` | del trocánter a la rodilla |
| 3 | Longitud del torso (cm) | `Torso` | del hueco del cuello al ombligo, de pie y recto |
| 4 | Longitud del antebrazo (cm) | `Antebrazo` | del codo a la muñeca |
| 5 | Longitud del brazo (cm) | `Brazo` | del hombro al codo |
| 6 | Ancho clavicular (cm) | `Ancho clavicular` | de punta a punta de los hombros, por delante |
| 7 | Cintura (cm) | `Cintura` | en la parte más estrecha, sin apretar |
| 8 | Caderas (cm) | `Caderas` | en la parte más ancha |

Y **ninguna otra**. Un formulario que pide once cosas se rellena a medias, y una medida a
medias no se puede comparar con la de dentro de tres meses.

Cada campo lleva su protocolo al lado, no en un pie de página. Una longitud sin protocolo
no es una medida: el fémur medido desde la cadera y desde el trocánter son dos números
distintos, y el que se compara dentro de tres meses tiene que salir del mismo sitio.

## Las claves, para la capa de datos

Se guardan dentro de `medidas[].perimetros`, que ya viaja a `perfiles` como JSONB
(`MedidaCorporal.perimetros: Record<string, number>`). **No hace falta tocar
`src/domain`**: el tipo ya admite cualquier clave.

Las claves son las ocho de la columna del medio: `Tibia y peroné`, `Fémur`, `Torso`,
`Antebrazo`, `Brazo`, `Ancho clavicular`, `Cintura`, `Caderas`. Tres cosas que la capa de
datos necesita saber:

1. **Son nombres de persona, con tildes y espacios, y es a propósito.** Es la convención
   que ya tienen los registros viejos (`Glúteos`, `Abdomen medio`) y hay dos pantallas más
   que imprimen la clave TAL CUAL: `coach/AsesoradoDetallePage.tsx` y
   `logros/ProgresoEvolucion.tsx`. Con claves de máquina esas pantallas dirían
   `tibiaPerone`.
2. **No se renombran.** Un renombrado parte el historial en dos sin que nada falle: las
   medidas viejas se quedan con su clave y la comparación con la anterior deja de
   encontrarse.
3. **`Cintura` es la misma clave de siempre**, así que la serie no se corta. `Caderas` NO
   lo es: los registros viejos usan `Cadera` (singular) y los que se guarden desde hoy
   usan `Caderas`. Se ha elegido el plural porque es como lo pide el encargo; quien quiera
   unir las dos series tendrá que hacerlo a mano, y por eso queda escrito aquí.

Las que se dejen vacías **no se guardan**: un cero inventado es peor que un hueco.

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
 ✓ la encuesta de medidas > guarda con las claves estables, tal y como viajan a `perfiles`
 ✓ la encuesta de medidas > no deja guardar una medición vacía
 ✓ la encuesta de medidas > con una sola medida escrita ya deja guardar
 ✓ la encuesta de medidas > a quien tiene la composición apagada no le enseña el kilaje de antes
 ✓ la encuesta de medidas > y sí se lo enseña a quien sí ve su composición
 ✓ la columna de la pieza E (6 tests)
 Test Files  1 passed (1)
      Tests  14 passed (14)
```

La primera cuenta los campos por su papel (`getAllByRole('textbox')`) y compara la lista
de etiquetas con las ocho, en orden: si alguien añade una novena, sale en rojo por las dos
mitades —la cuenta y la lista—.

## Qué queda

- **Esta es la mitad de interfaz.** Que las ocho lleguen a `perfiles` y se validen allí es
  de la capa de datos; aquí quedan escritas las claves para que pueda hacerlo.
- **Nadie usa todavía las seis longitudes para dibujar el sujeto.** El visor ya sabe
  recibir `ProporcionesDelCuerpo` (fémur, tibia y torso como razones), y hoy esas
  proporciones salen de una pista de pose medida (`cuerpoDelAsesorado`), no de la ficha.
  Enchufar estas medidas ahí es el paso siguiente y no es de esta tarea.
- **Un solo lado.** Se pide una tibia, un fémur, un antebrazo y un brazo, no izquierdo y
  derecho. Una asimetría real existe y no se va a ver aquí; pedir dieciséis campos para
  cazarla habría hundido el formulario.
