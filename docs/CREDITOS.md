# Créditos del gimnasio 3D

El equipamiento que se ve en el salón de `/entrenar` **no está modelado por nosotros**.
Sale de Sketchfab bajo licencia **CC Attribution (CC BY 4.0)**, que permite usarlo en una
app comercial **a condición de nombrar al autor de forma visible**. No es una cortesía: es
la condición que hace lícito el uso. Sin el crédito en pantalla, el gimnasio se está
usando fuera de licencia.

## Dónde está el crédito, de verdad

En la app, en el panel inferior del salón, recuadro **«El gimnasio»**
(`src/features/entrenar/salon/panel/recuadros/RecuadroCreditos.tsx`).

**La lista que manda es `src/features/entrenar/visor/creditos.ts`**, no este documento. Un
`.md` no se despliega con la app; el código sí. Este archivo existe para explicar *por qué*
hay que mantenerla, no para duplicarla.

Lo vigilan `creditos.test.ts` (que el dato esté completo y que nadie pueda rebajar una
licencia escribiendo) y `RecuadroCreditos.test.tsx` (que el autor se **vea** y se pueda
llegar a su ficha). Los cuatro se vieron fallar a propósito el 2026-09-06.

## Qué hay dentro de `sala-gimnasio.pieza`

| Obra | Autor | Licencia | Ficha |
|---|---|---|---|
| GAME READY GYM ENVIRONMENT ASSET PACK | Oxygen3D | CC Attribution | `sketchfab.com/3d-models/8aef4a478bbe49d483280968aff59064` |
| Squat Rack With Bar | Sousinho | CC Attribution | `sketchfab.com/3d-models/squat-rack-with-bar-8e3109a049274de2941e7a2e014aa10d` |
| Inspire - FT1 Functional Trainer | Douglas.Alves1 | CC Attribution | `sketchfab.com/3d-models/inspire-ft1-functional-trainer-71a03da0c43f4054a5c9249f62b29ddc` |

## La anatomía del estudio del cuerpo

| Obra | Autor | Licencia |
|---|---|---|
| BodyParts3D 4.0 | The Database Center for Life Science (DBCLS) | CC Attribution 4.0 |
| Human Atlas (adaptación) | Ashe Magalhaes | CC Attribution / código MIT |

Comprobada en la [página oficial de licencia](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html),
no solo en el repo: los OBJ originales llevan en sus comentarios una licencia antigua
(CC BY-SA 2.1 Japan) que la actual sustituye. Cómo se regenera: `scripts/atlas/LEEME.md`.

Las **superficies** (suelo de goma `anti_skid_tiles`, hormigón `concrete_wall_008`, acero
`metal_plate_02`) son de **Poly Haven**, **CC0**: dominio público, no obligan a nada. Se
nombran igual, porque saber cuál obliga y cuál no es lo primero que se pierde.

La **sala** —muros, techo, pilares, conductos, rótulos, luces— está construida por
nosotros en `scripts/blender/`.

## Descargadas y disponibles, todavía sin usar en la escena

No hace falta citarlas mientras no se vean, pero si entran, entran también en la lista:

| Obra | Autor | Licencia |
|---|---|---|
| Modular Gym Equipment | Tyler McManus | CC Attribution |
| Gym Set | B4Visuals | CC Attribution |

## Si un día molesta la obligación

Dos salidas: comprar equipamiento con licencia comercial sin atribución, o modelarlo desde
cero. Las dos cuestan dinero o tiempo. Mientras tanto, el crédito es el precio, y es barato.

## Regla al añadir una pieza nueva

Cuando el exportador meta un modelo nuevo en la pieza, **añadirlo a `creditos.ts` en el
mismo commit**. Los tests comprueban que no desaparezca ninguno de los que ya están, pero
no pueden saber que ha entrado uno nuevo: eso depende de quien lo mete.
