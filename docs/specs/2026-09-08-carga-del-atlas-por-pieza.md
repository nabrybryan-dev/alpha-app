# La carga del atlas, pieza a pieza (2026-09-08)

## El fallo

El atlas anatómico son tres piezas —esqueleto, músculos y piel, un megabyte entre las
tres— y se pedían en bloque. El visor se protegía de pedirlas dos veces con esta línea:

```js
if (!atlas || atlas.length === 0 || atlasCargado.size > 0) return
```

`atlasCargado` se llenaba **pieza a pieza**, según llegaba cada una. Así que bastaba con
que una llegara para que la condición cortara el efecto **para siempre**: si otra había
fallado —un sótano con LTE malo, un 502 del CDN—, no se volvía a pedir nunca. En pantalla
eso es el cuerpo abierto sin músculos, sin un error en la consola y sin nada en rojo. Con
la sala del salón no se veía porque es una sola pieza: o está o no está.

## Qué cambia

Dos cosas, las dos en `visor/cargaDelAtlas.ts`, y ninguna en `VisorPatron.tsx`.

**1. `cargarPiezas` pide LO QUE FALTA, no la lista.** Hay una memoria de módulo
(`entregadas`) con las piezas cuyos bytes llegaron, se leyeron bien y se entregaron. Cada
llamada recorre la lista y se salta las que ya están; la que falló queda pendiente y se
vuelve a pedir en la siguiente ocasión. Una pieza que llega con la llamada ya cancelada
—el visor se desmontó por el camino— **no** se da por entregada: nadie la guardó, así que
sigue faltando.

**2. La reconexión reintenta sola.** El cargador escucha `online` mientras vive, y al
volver la red pide las que falten. Cuesta cero cuando no falta ninguna: el bucle recorre
la lista y no pide nada. Se deja de escuchar al cancelar.

Y una tercera que es la que arregla la línea de arriba sin tocarla: **`atlasCargado` se
llena de golpe, con la última pieza, y no una a una**. Ahora significa lo que el visor
cree que significa —«el atlas está entero»— y con dos de tres vale 0, así que el efecto no
se corta y la que falta se vuelve a pedir. Las capas que sí llegaron están en
`atlasPorCapa` y se dibujan igual: `atlasCargado` vacío no es «no hay nada», es «falta
algo».

## Cómo se comprobó

El test nace en rojo contra el código del 2026-09-07 (commit `3597a98`, el visor ya
partido pero con la carga vieja). Cuatro de las cinco pruebas fallan, y cada mensaje
nombra el fallo por un lado:

```
$ npx vitest run src/features/entrenar/visor/cargaDelAtlas.test.ts     # con el código anterior

 × cargarPiezas, pieza a pieza > una pieza que falla se vuelve a pedir; las que ya llegaron, no
   → expected [ '/piezas/falla-uno.pieza', …(2) ] to deeply equal [ '/piezas/falla-dos.pieza' ]
 × cargarPiezas, pieza a pieza > sin red al arrancar, la reconexión las trae sin que nadie vuelva a llamar
   → expected [] to deeply equal [ 'sinred-dos', 'sinred-tres', …(1) ]
 × cargarPiezas, pieza a pieza > una pieza que ya llegó no se pide dos veces
   → expected [ '/piezas/unavez-uno.pieza', …(2) ] to deeply equal []
 × el almacén del atlas > una descarga a medias NO cuenta como atlas cargado
   → expected 2 to be +0 // Object.is equality

 Test Files  1 failed (1)
      Tests  4 failed | 1 passed (5)
```

La quinta —que lo que llega cuelga de la raíz del sujeto— pasa en los dos: está para que
esa parte no se pierda en la mudanza.

Con el código nuevo:

```
$ npx vitest run src/features/entrenar/visor/cargaDelAtlas.test.ts
 ✓ src/features/entrenar/visor/cargaDelAtlas.test.ts (5 tests) 67ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Las tres pruebas del cargador usan listas con nombres propios (`falla-*`, `sinred-*`,
`unavez-*`) y no las piezas de verdad: la memoria de lo que ya llegó es de módulo —tiene
que serlo, o volver a abrir la anatomía se bajaría el megabyte otra vez— y dos pruebas
sobre la misma pieza se contaminarían la una a la otra.

## Qué queda

- **El reintento no tiene espera ni cuenta atrás.** Se reintenta cuando el visor vuelve a
  pedir (cada vez que se enciende o apaga una capa del cuerpo, que es cuando cambia la
  prop `atlas`) y cuando el navegador avisa de que hay red. No hay backoff: un bucle de
  reintentos por temporizador contra un CDN caído es un martillo, y aquí lo que falta se
  ve —el cuerpo sin músculos— así que la persona ya tiene un motivo para tocar algo.
- **Nadie avisa de que falta una pieza.** Si el esqueleto llega y los músculos no, el
  cuerpo se abre sin músculos y no lo dice. Ponerle un aviso es de la capa de interfaz y
  no entra en esta tarea; queda escrito aquí para que se decida a propósito.
- **La sala del salón pasa por el mismo cargador** y se lleva la mejora de balde: hoy es
  una sola pieza, así que lo único que cambia para ella es que no se vuelve a pedir si ya
  está.
