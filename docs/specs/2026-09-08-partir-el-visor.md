# Partir el visor (2026-09-08)

`VisorPatron.tsx` tenía 1.523 líneas y `motor.ts` 999. Dentro había cuatro cosas que no
tienen nada que ver entre sí —el sombreado GLSL, con qué huesos se dibuja a esta persona,
cómo llegan las piezas por la red y en qué punto del gesto está el sujeto— y todas se
leían de paso para llegar a otra. Además ninguna de las cuatro se podía probar sin montar
un contexto WebGL, que en jsdom no existe.

Esto es una MUDANZA, no un rediseño: no hay una línea de lógica nueva.

## Qué sale de dónde

| Módulo nuevo | Qué se lleva | De dónde |
|---|---|---|
| `visor/sombreado.ts` | `MAX_HUESOS`, los dos programas GLSL (`VS`, `FS`) y `compilar()` | `motor.ts` |
| `visor/definicionCorporal.ts` | `claveDelSujeto`, `definicionDelSujeto`, `precalculado`, `huesosDelFantasma` y las dos cachés (`sujetoCache`, `fantasmaCache`); reexporta `esqueletoDe` | `VisorPatron.tsx` |
| `visor/cargaDelAtlas.ts` | `traerDeRed`, `cargarPiezas` (con su firma `PIEZ`) y la caché del atlas (`atlasCache`, `atlasCargado`, `atlasPorCapa`) | `piezas.ts` y `VisorPatron.tsx` |
| `visor/controlDelTiempo.ts` | La única puerta por la que el visor pregunta la hora del gesto: `faseDeTiempo`, `DURACION_CICLO`, `duracionDelCiclo`, `TempoDeRepeticion` | reexporta `domain/patrones/escena` |

Cuentas de líneas:

| Archivo | Antes | Después |
|---|---:|---:|
| `VisorPatron.tsx` | 1.523 | 1.422 |
| `motor.ts` | 999 | 851 |
| `piezas.ts` | 189 | 121 |
| `sombreado.ts` | — | 162 |
| `definicionCorporal.ts` | — | 102 |
| `cargaDelAtlas.ts` | — | 128 |
| `controlDelTiempo.ts` | — | 27 |

Dos decisiones que no se ven en la tabla:

- **`piezas.ts` se queda con el CATÁLOGO** —qué piezas hay y en qué punto de la sala se
  plantan— y suelta el viaje. Un catálogo es una lista de datos y no debería tocar la red.
- **`atlasPorCapa.set(capa, mallas)` significa «esta capa acaba de llegar»**, y hace las
  cuatro cosas que antes estaban sueltas en el efecto del visor: colgar cada malla de la
  raíz del sujeto, sumarlas a la lista plana que se sube a la tarjeta, anotar la capa y
  guardarla por su nombre. Van juntas porque separarlas ya costó un fallo mudo —una caché
  con las mallas y otra sin ellas se ven igual desde fuera.

## Qué no cambia

Los dos archivos partidos **solo pierden líneas**. Lo único que ganan son imports, y eso
se comprueba con un comando, no con la palabra de nadie:

```
$ git diff origin/main -- src/features/entrenar/visor/VisorPatron.tsx \
      src/features/entrenar/visor/motor.ts | grep '^+' | grep -v '^+++' | grep -v import
$ echo $?
1        # ni una línea añadida que no sea un import
```

Las seis líneas añadidas entre los dos archivos son:

```
+import { anunciarSalaDeBlender, PIEZAS_DEL_ATLAS, SALA_GIMNASIO } from './piezas'
+import { type EsqueletoResuelto, INDICE_RAIZ, puntoDeHueso, resolver } from '../../../domain/patrones/esqueleto'
+import { atlasCache, atlasCargado, atlasPorCapa, cargarPiezas } from './cargaDelAtlas'
+import { DURACION_CICLO, faseDeTiempo, type TempoDeRepeticion } from './controlDelTiempo'
+import { esqueletoDe, huesosDelFantasma, precalculado } from './definicionCorporal'
+import { compilar, FS, MAX_HUESOS, VS } from './sombreado'
```

No cambia tampoco lo que el asesorado ve: ni el JSX del visor, ni el orden en que se
suben las mallas, ni un número.

## Cómo se comprobó

Tres medidas, y ninguna se cree sola.

**1. El compilador y la batería.**

```
$ npx tsc -b            → exit 0, sin errores
$ npm run verify        → 316 archivos, 3.897 tests en verde, 4 saltados, exit 0
```

(Para comparar: `npm run verify` sobre `origin/main`, antes de tocar nada, daba los
mismos 316 archivos y 3.897 tests. No hay ninguna roja, tampoco la del núcleo del
encoder: este equipo no tiene clonado el repo de herramientas y esa comprobación se salta
sola.)

**2. El testigo del salón** —Chrome de verdad, capturas de pantalla, restas—:

```
$ node testigo/salon-visible.mjs --url=http://127.0.0.1:5181/entrenar --puerto=9351
  → exit 0, rama conSujeto, usuario del seed
    sala:        visible true (289.367 px)
    letras3D:    visible true (304.704 px)
    sujeto:      visible true (4.330 px)
    camara:      visible true (2.704 px)
    implementos: visible true (4.582 px)
```

El acta queda en `informes/testigo-salon.json`.

**3. La resta de las capturas, que es la que firma que no se movió un píxel.**

`informes/partir-el-visor-medir.mjs` saca cuatro fotos —dos patrones (empuje horizontal y
tracción horizontal, cambiando por la tira de puntos) por dos capas del eje W (la piel, 0,
y el hueso, 4, hundiendo el dedo sobre el cuerpo)— y se corre dos veces: una con el visor
de `origin/main` puesto en el árbol y otra con el partido. Después resta las parejas con
`mascaraDeCambio` de `testigo/comun.mjs`:

| Vista | Píxeles | Cambiados |
|---|---:|---:|
| p1-w0 (empuje horizontal, piel) | 304.704 | **0** |
| p1-w4 (empuje horizontal, hueso) | 304.704 | **0** |
| p2-w0 (tracción horizontal, piel) | 304.704 | **0** |
| p2-w4 (tracción horizontal, hueso) | 304.704 | **0** |
| | | **total 0** |

Las ocho capturas están en `informes/partir-el-visor-{antes,despues}-p{1,2}-w{0,4}.png` y
los números en `informes/partir-el-visor-mascara.json`.

Dos cautelas metidas en el medidor, y ninguna sobra:

- **Se fotografía el LIENZO**, no la pantalla entera: antes de disparar se ocultan con
  `visibility` todos los nodos que no cuelgan de `[data-testigo="sujeto"]`. El salón lleva
  encima un reloj de sesión que cambia de segundo, y entre dos corridas separadas por
  minutos marca otra hora: sin esconderlo la resta no daría cero nunca, por una razón que
  no tiene nada que ver con lo que se mide. El reloj no lo dibuja el visor.
- **El movimiento se para** emulando `prefers-reduced-motion: reduce`, como hace el
  testigo. El sujeto no se mueve por CSS: lo mueve un bucle de `requestAnimationFrame`, y
  con el gesto corriendo todos los píxeles del cuerpo cambian solos.

Y una comprobación de que la corrida «antes» medía de verdad el código viejo: entre las
dos se preguntó al servidor de desarrollo qué estaba sirviendo
(`curl .../src/features/entrenar/visor/VisorPatron.tsx | grep -c definicionCorporal`),
que dio `0` en la primera y `1` en la segunda.
