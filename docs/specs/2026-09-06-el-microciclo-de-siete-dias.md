# El microciclo de siete días

**2026-09-06 · decisión de Bryan · rama `microciclo/cadencia-7`**

`cadenciaDias` pasa de `8 | 15` a `7 | 8 | 15`.

## Por qué, y no es un tercer sabor

Hay asesorados cuyas sesiones se llaman **D1…D4 y nunca han tenido `dia`**. Durante meses
eso se leyó como un campo que alguien no rellenó. No lo es:

> **Un bloque de 8 días no cabe en una semana de 7.** Cada microciclo empieza un día más
> tarde que el anterior, así que unos días fijos de lunes a domingo se descuadran solos.

El caso que lo demostró es Jacobo Martínez. La app no guarda su `dia`, pero **sí guarda
cuándo hizo cada sesión**, en `preparacion[].hechoEn`. Sus 19 sellos, en hora de Bogotá:

| microciclo | primera | segunda | tercera | **cuarta** |
|---|---|---|---|---|
| M1 · 3-ago | mar 4 | mié 5 | jue 6 | **sáb 8** |
| M2 · 11-ago | *(sin sello)* | jue 13 | vie 14 | **sáb 15** |
| M3 · 17-ago | mar 18 | mié 19 | jue 20 | **sáb 22** |
| M4 · 24-ago | lun 24 | mar 25 | mié 26 | **dom 30** |
| M5 · 1-sep | mar 1 | mié 2 | jue 3 | **vie 4** |

Martes, miércoles y jueves firmes en tres de los cinco; **el cuarto salta** entre sábado,
domingo y viernes. No es desorden suyo: es la cadencia arrastrando el bloque.

Con 7 días el bloque cae siempre en los mismos días y el problema desaparece de raíz.

## Lo que este cambio NO arregla

`armarSemana()` ya reparte por `orden` las sesiones sin `dia`, y seguirá haciéndolo: hay
tres personas más sin día (Nasly Henao, Karen Michelle, María Isabel) y **ellas no tienen
sellos**, así que sus días siguen sin saberse. Esto no las toca.

## ⚠ El efecto que no se ve

**Acortar la entrega sube la carga semanal sin tocar una sola serie.**

| | series por bloque | días | **por semana** |
|---|---|---|---|
| Jacobo hoy (M5) | 80 | 8 | **70** |
| Jacobo con cadencia 7 | 80 | 7 | **80** ← +14 % |

Bryan lo decidió sabiéndolo (2026-09-06): deja las 80 y acepta la subida. Queda escrito
porque **contradice el freno que su propio plan tiene disparado** —las cuatro sesiones del
M5 cerraron en RPE 7, 7, 8 y 8, ninguna en 6— y se frena por microciclo mientras sube por
semana. **El M6 es el microciclo a vigilar.**

Al cambiar este número en cualquier persona, mirar el volumen **por semana**, no por
microciclo. Es la misma lección que la moneda de series y la escala de Borg: el número
viaja en la unidad que lleva el fenómeno.

## Alcance, medido antes de tocar

- `src/domain/types.ts` — la unión, con el aviso del volumen semanal en su docstring.
- `src/domain/rutaEntrenamiento.ts` — un comentario que decía «8 o 15».
- **Nadie compara `cadenciaDias` contra literales** (ni `===`, ni `switch`, ni `case`), y
  todos los cálculos son sumas de días, así que 7 funciona igual.
- `sanearMicrociclo()` no lo toca: el valor llega de la base intacto.

En el cerebro, el espejo es `dias_por_microciclo` de `dictamen.schema.json`, que pasa a
`[7, 8, 15]`. El enum legado de `cadencia` se queda en `[8, 15]` a propósito: es una puerta
que se está cerrando y no se ensancha.
