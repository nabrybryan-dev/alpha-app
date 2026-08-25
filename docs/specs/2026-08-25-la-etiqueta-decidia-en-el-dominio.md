# La etiqueta seguía decidiendo, pero en el dominio

**2026-08-25** · continuación del #100

## Qué se encontró

El #100 quitó de `SesionPage` la regla de que `tipo` decidiera qué se pinta:
dos sesiones marcadas `metabolica` **con ejercicios dentro** escondían 13
ejercicios prescritos, y una marcada `fuerza` con **cero** ejercicios se llevaba
la cabecera «EJERCICIO 1 DE 0».

Al revisar los planes de entrenamiento buscando ramas muertas apareció que
**esa misma regla seguía viva en otros cuatro sitios**, y tres de ellos fuera de
la pantalla — donde salen los números con los que se decide la carga:

| Dónde | Qué decide por la etiqueta |
|---|---|
| `domain/cumplimiento.ts` · `sesionCompleta` | si la sesión se puede dar por cerrada |
| `domain/rutaEntrenamiento.ts` · `detalleDeSesion` | la línea que resume la sesión en la Ruta |
| `features/coach/PautadoVsRealizado.tsx` | si el coach ve la lista de bloques |
| `features/coach/propuestaMicrociclo.ts` | si los ejercicios entran en la propuesta |

## Lo que se arregla aquí, y por qué solo eso

Se arregla **la mitad sin ejercicios**: una sesión con cero ejercicios y bloques
dentro. Es el caso de la ZONA 2 + MOVILIDAD que venía marcada `fuerza`.

1. **`sesionCompleta` no la cerraba nunca.** `sesionRegistrada([])` es `false`
   siempre, así que la persona podía tildar los dos bloques y la sesión seguía
   pendiente — y contaba como no registrada en `pctRegistrado`, que es el
   porcentaje con el que se juzga la adherencia antes de subir la carga. Una
   sesión imposible de completar no la eligió nadie: es un descuido, no una
   política.
2. **`detalleDeSesion` la describía como `0 ejercicios · 0 series · 12m`.** Es la
   misma frase que el #100 borró de la sesión, sobreviviendo en la Ruta.
3. **`PautadoVsRealizado` no le enseñaba al coach ni un bloque**, porque la lista
   solo se pintaba con la etiqueta puesta. Ahora se pinta si hay bloques.

## Lo que quedó pendiente, y se decidió el mismo día

Quedaba abierto si una sesión marcada `metabolica` **con ejercicios dentro** debía
contar: cerrarse por sus ejercicios y no solo por sus bloques, y entrar en la
propuesta del microciclo siguiente.

**Decisión de Bryan, 2026-08-25: sí cuentan, porque generan fatiga.** Un
ejercicio con series y kilos produce fatiga esté en la sesión que esté, así que
tiene que contar para cerrarla, para el volumen y para la progresión.

Aplicado justo después, en su propio cambio:

- **`sesionCompleta` ya no mira `tipo` en absoluto.** Si hay ejercicios, mandan
  los ejercicios; si no hay, la cierran sus bloques. Las dos sesiones con 7 y 6
  ejercicios dentro dejan de darse por completas con los 13 sin registrar.
- **`propuestaMicrociclo` ya no filtra por `tipo`.** Sus ejercicios entran en las
  filas, en la cuenta de volumen, en el barrido de desalineados y en la
  ondulación. Una metabólica de verdad —solo bloques, `ejercicios: []`— sigue sin
  aportar nada, porque no tiene ejercicios que aportar: el filtro sobraba.
- **`detalleDeSesion` describe los ejercicios cuando los hay**, aunque la
  etiqueta diga `metabolica`.

**Lo que expresamente NO se hizo:** exigir las dos cosas a la vez. Una sesión de
fuerza con un bloque de movilidad delante seguiría sin cerrarse hasta tildarlo, y
eso bajaría la adherencia de media cartera por un calentamiento sin marcar. La
regla es «manda lo que prescribe carga», no «manda todo». Hay un test que lo fija.

`tipo` sobrevive solo donde de verdad describe: el fondo de la tarjeta, el panel
de ritmo y el rótulo de los bloques.

## Cómo se comprobó

Los cuatro tests nuevos se corrieron **contra el código viejo primero** y los
cuatro fallan, uno de ellos delatando la frase exacta que veía el asesorado:

```
AssertionError: expected '0 ejercicios · 0 series · 12m' to be '2 bloques'
AssertionError: expected false to be true
AssertionError: expected +0 to be 100
```
