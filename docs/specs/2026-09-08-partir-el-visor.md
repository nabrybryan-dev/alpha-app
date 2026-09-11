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

Y no cambia **nada fuera del visor**: `src/components/`, `src/styles/`, `src/app/` e
`index.html` son byte a byte los de `main` en esta rama —`git diff origin/main...HEAD --
src/components src/styles src/app index.html` no devuelve una sola línea—, así que la
barra de abajo, el botón de la cámara y el del mando no pueden haberse movido. Eso importa
porque el testigo de la capa de pruebas dice que sí: ver «Los 1.265 píxeles del testigo»
más abajo.

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

## Los 1.265 píxeles del testigo, y de quién son

La capa de pruebas escribió su propio testigo (`testigo/partir-el-visor.mjs`), que no mide
el lienzo sino **la pantalla entera** —1.316.640 px de un 390×844 al doble—, y le sale
`todoCero: false`: ~1.265 píxeles distintos en cada uno de sus cuatro escenarios, siempre
en la misma caja (x 41-753, y 102-1657). Dos medidas que dan cero y una que no piden
explicación, no elegir la que gusta.

**Son del arnés.** Y no es una opinión: es la corrida de control.

### 1. Qué píxeles son

Cruzando cada píxel encendido de la máscara contra el rect **más pequeño** del DOM que lo
contiene (`informes/partir-el-visor/capaProfunda-mascara.png`, en la app viva):

| Elemento | px |
|---|---:|
| `path` y `svg` — los cinco iconos de la barra de abajo, el de la cámara, el del mando y el galón de «LUNES» | 771 |
| `div[data-testigo="camara"]` — el aro del botón de cámara | 205 |
| `button[data-noOrbita]` — el aro del botón del mando | 192 |
| `div.glass.glass-blur` — el borde redondeado de la barra | 44 |
| las píldoras de la tira y los rótulos de la barra | ~50 |

**Ni un solo píxel del lienzo**, que es lo que esta tarea toca. Todos son vectores —trazos
SVG y bordes redondeados— dentro de capas que el CSS promueve: `.glass-blur` lleva
`backdrop-filter`, `.relieve` lleva `perspective(...) translateZ(0)`.

Y lo que cambia en ellos no es dónde están: el fondo (38,38,38) y el trazo (168,168,168)
son idénticos píxel a píxel, y lo único que se mueve son los valores intermedios de la
rampa de antialiasing. La forma está en el mismo sitio, dibujada con otra cobertura.

### 2. Ese código no lo toca esta rama

`git diff origin/main...HEAD -- src/components src/styles src/app index.html` no devuelve
una línea: `BottomNav.tsx`, `tokens.css` y `CamaraDelSalon.tsx` son byte a byte los de
`main`. `Joystick.tsx` sí cambia, pero su JSX no: el diff no tiene ni una línea con `<`.

### 3. La corrida de control: `main` contra sí misma

El mismo testigo, con `--ref-base=origin/main --ref-nueva=origin/main` —el código idéntico
a los dos lados— da esto:

| Escenario | main vs main | main vs `capa/interfaz` (acta del 07-09) |
|---|---:|---:|
| patronA | 1.278 | 1.278 |
| patronB | 1.253 | 1.253 |
| capaIntermedia | 1.276 | 1.276 |
| capaProfunda | 1.265 | 1.265 |

**Los cuatro números coinciden dígito a dígito.** El testigo mide lo mismo tanto si las dos
ramas son distintas como si son la misma: lo que cuenta no es el código. La salida entera
está en `informes/rojos/partir-el-visor-control-main-vs-main.txt`.

### 4. Y la resta que sí separa el código: cero

`informes/partir-el-visor-arbol-unico.mjs` hace la misma resta quitando las dos variables
que el testigo mete de más: un solo worktree, un solo `node_modules`, la misma máquina, y
entre las dos capturas **solo** cambia `src`.

```
$ node informes/partir-el-visor-arbol-unico.mjs
  píxeles distintos: 0 de 1316640
$ node informes/partir-el-visor-arbol-unico.mjs --cebo
  píxeles distintos: 88044 de 1316640      # el cebo se vio: la medida sabe decir que no
```

El cebo no sobra: un cero de una medida que nunca se ha visto romperse no es un cero. Las
dos salidas quedan en `informes/rojos/partir-el-visor-arbol-unico{,-cebo}.txt`.

### 5. Lo que le falta al testigo, y por qué no se toca aquí

`testigo/` es de la capa de pruebas y no se toca desde aquí. Queda escrito el sitio:
`arrancarChrome` (`testigo/comun.mjs:63`) da a los dos Chrome **el mismo perfil**
—`join(tmpdir(), 'testigo-salon-' + process.pid)`—, así que el primero lo estrena frío y
el segundo lo hereda caliente; y en `medirCheckout` la captura se dispara tras
`SALON_MONTADO` + `--asiento` sin esperar nunca a `document.fonts.ready`, con unas
tipografías que salen de `fonts.googleapis.com` con `display=swap` (`index.html:28`). El
turno, y no el código, es lo único asimétrico entre las dos mitades de esa medida — que es
exactamente lo que dice la tabla del punto 3.

Mientras eso siga así, `todoCero` de ese testigo no puede llegar a `true` ni con el código
de `main` a los dos lados, y el acta que deja
(`informes/testigo-partir-el-visor.json`, `todoCero: false`) está midiendo su propio arnés.

