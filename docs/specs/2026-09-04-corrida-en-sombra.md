# La corrida en sombra del bucle del día

**2026-09-04** · Ejecuta el §7.1 del supuesto del 2026-08-25
(`Cerebro Alpha/docs/superpowers/specs/2026-08-25-ondulacion-flexible-intra-semana.md`).

## El cambio de plan que ahorra un mes

Lo pactado dice: la app calcula el escenario que habría pisado cada día, lo guarda sin
enseñarlo, y al cerrar se compara. Leído tal cual, obliga a esperar a que pase una semana
con gente entrenando, y después otra, y otra.

**No hace falta esperar, porque todo lo que el cruce necesita ya está guardado.**
`rendimientoDelDia` lee la prescripción y las series; el contexto sale del check-in de ese
día o del PRS del test posterior, que va dentro de la propia sesión. Así que la sombra se
**reproduce sobre la historia** y da el número hoy, sobre una muestra mucho mayor que una
semana:

| | |
|---|---|
| sesiones en la cartera | 607 |
| con series anotadas | 268 |
| **con las dos mitades del cruce** (series + contexto) | **254** |
| de esas, por PRS del test | 231 |
| de esas, por check-in fechado | 184 |

Y se reproduce **con el mismo módulo que decidiría en vivo** (`bucleDelDia.ts`). Una
segunda implementación de la regla —en Python, en SQL— es el fallo que esta casa lleva
pagando desde la migración 0037: dos copias divergen y la sombra dejaría de medir lo que
se va a enchufar.

## Los dos hemisferios, y solo uno se contesta hoy

**1 · ¿Se dispara el cruce, y sobre quién?** Contestable ya. Si casi nunca salta, el
mecanismo no tiene tracción y la conversación se acaba ahí.

**2 · ¿El ajuste habría reducido la discrepancia o la habría perseguido?** **No
contestable hoy.** `aplicarEscenario` exige `ejercicio.escenarios` —las dos escaleras que
el coach preautoriza— y en producción hay **0 de 3.106 ejercicios** con ellas. Es el punto
1 del §8, pendiente de la aprobación explícita de Bryan.

Por eso el informe imprime **`sin camino escrito` como una fila propia**. Esconderlo
dentro de «ninguno» haría que un mecanismo *bloqueado* pareciera un mecanismo que *decide
no actuar*, y son cosas opuestas. Mientras ese número no baje de cero, el segundo
hemisferio no se puede medir, y el informe lo dice con esas palabras.

## Lo construido

- **`src/domain/corridaEnSombra.ts`** — reproduce el bucle sobre los microciclos de una
  persona: ata cada sesión a su día (el campo `fecha` del PR #199, o la primera marca de
  preparación para la historia, que no lo tiene), busca el check-in de ese día, cruza
  ejercicio a ejercicio y aplica la regla del martes solo hacia delante.
- **`supabase/exportar-corrida-en-sombra.sql`** — saca la historia reducida al hueso: ni
  nombres, ni notas, ni prosa, ni medidas. Sale del SQL Editor a un archivo **fuera del
  repo**.
- **`scripts/corrida-en-sombra.mjs`** — lee ese archivo y imprime el informe. **Aborta si
  el archivo cae dentro de un árbol git**: lleva el entrenamiento real de personas.

## Un guardián que se cayó solo, y su reemplazo

Hasta hoy, que el bucle no llegara a ninguna pantalla lo garantizaba **de rebote** el
detector de código huérfano: `bucleDelDia` no lo importaba nadie, luego era imposible.
Al escribir `corridaEnSombra.ts` aparece el primer consumidor y **esa garantía se cae
sola** — el detector solo mira si hay consumidor, no cuál.

Es el patrón de siempre (el check que sobrevive al campo que lo volvía falso) con una
vuelta: lo que se cae no es el check, sino lo que protegía sin querer. Así que la
condición se escribe a mano y se mide, en `bucleDelDia.enSombra.test.ts`:

> **ni `src/features/` ni `src/data/` pueden importar el bucle.**

`src/domain/` sí puede —ahí no hay React ni I/O— y los scripts también, que se corren a
mano. Visto romperse: metiendo el import en `RutaPage.tsx`, el test se pone rojo y **dice
el archivo culpable por su nombre**.

Cuando Bryan apruebe enchufarlo, ese test se borra **en el mismo commit** que lo enchufa y
con el número de la corrida delante.

## Un hallazgo de paso

El campo `rir` de una serie **guarda a veces texto**: hay al menos una serie real con
«Isometría» dentro. Un `::numeric` a pelo revienta la consulta entera, así que el export
filtra por patrón y deja en null lo que no es número — que es lo que significa: esa serie
no declaró RIR. Merece mirarse aparte: si la app permite escribirlo, cualquier media de
RIR de la cartera está calculada sobre un campo que no siempre es un número.

## Visto romperse

`node scripts/mutar-corrida-en-sombra.mjs` → **7 mutaciones, 7 rojos**. Dos sobrevivieron
al primer intento y las dos por el mismo motivo —un fixture demasiado cómodo—:

- «coger la última marca en vez de la primera» no cambiaba nada porque las dos marcas del
  caso caían **el mismo día**. Ahora caen en días distintos.
- «cruzar los microciclos en el orden en que llegan» no cambiaba nada porque la lista ya
  venía ordenada. Ahora entra desordenada a propósito.

## Lo que falta, y es un paso de Bryan

Correr `supabase/exportar-corrida-en-sombra.sql` en el SQL Editor, guardar la celda en un
archivo fuera del repo y pasárselo al script. Es lectura pura; no escribe nada.
