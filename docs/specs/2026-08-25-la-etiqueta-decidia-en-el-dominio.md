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

## Lo que NO se toca, y es una decisión pendiente

Una sesión marcada `metabolica` **con ejercicios dentro** sigue juzgándose solo
por sus bloques, y sus ejercicios siguen fuera de la propuesta del microciclo
siguiente (`propuestaMicrociclo` los filtra por `tipo`).

**Eso no es un descuido: está pinneado por sus propios tests**, dos de ellos
escritos a propósito («no ondula las metabólicas, pero tampoco las pierde»).
Cambiarlo movería la adherencia de personas a mitad de bloque y metería sus
ejercicios en la propuesta de carga. Es una decisión de programación, no de
código, y no se toma desde aquí.

Lo que sí conviene saber al decidirla: hoy, una `metabolica` con 7 ejercicios
dentro **se da por completa marcando solo los bloques**, con los 7 ejercicios sin
registrar — y ese 100 % es el que alimenta el «margen sin usar → sube».

## Cómo se comprobó

Los cuatro tests nuevos se corrieron **contra el código viejo primero** y los
cuatro fallan, uno de ellos delatando la frase exacta que veía el asesorado:

```
AssertionError: expected '0 ejercicios · 0 series · 12m' to be '2 bloques'
AssertionError: expected false to be true
AssertionError: expected +0 to be 100
```
