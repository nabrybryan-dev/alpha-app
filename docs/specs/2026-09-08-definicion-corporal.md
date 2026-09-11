# Una sola definición corporal

2026-09-08 · capa de dominio y datos · `src/domain/patrones/definicionCorporal.ts`

## 1. El fallo

El visor de patrones saca el cuerpo del asesorado de **dos sitios a la vez**.

En `src/features/entrenar/visor/VisorPatron.tsx`, dentro del efecto que monta el motor:

```ts
const definicion = esqueletoDe(sexo)                                  // línea 702
const { huesos, reposo } = precalculado(sexo, estaturaCm, proporciones) // línea 703
```

- `huesos` (la malla ósea) y `reposo` (las longitudes musculares de referencia) salen de
  `precalculado`, que llama a `definicionDelSujeto(sexo, estaturaCm, proporciones)`: **el
  cuerpo de la persona**, con su estatura y sus palancas.
- `definicion` sale de `esqueletoDe(sexo)`: **el cuerpo del atlas**, definido solo por el
  sexo, ignorando estatura y proporciones.

Y `definicion` no alimenta un adorno. Alimenta:

| línea | qué |
|---|---|
| 712 | `trazaDelPatron(patron, definicion)` — el arco ámbar del movimiento |
| 713 | `encuadrar(patron, definicion)` — la distancia y el centro de cámara |
| 780 | `resolver({}, [0, 0.95, 0], [0, 0, 0], definicion)` — las matrices del primer dibujo |
| 789 | `esqueletoEnFase(…, definicion)` — **las matrices de cada fotograma** |
| 927 | `esqueletoEnFase(…, definicion)` — las del fantasma articular |

O sea: la malla ósea de una persona de 1,62 con fémur corto se deforma con las matrices de
un varón de 1,714 del atlas. No revienta nada —los veintiún huesos son los mismos y las
matrices caben en los mismos huecos— y por eso lleva ahí sin que nadie lo vea: se lee como
una traza que va «un poco por encima» de las manos y como una carne que no acaba de encajar
en el hueso.

Medido: dos cuerpos de 1,75 con el fémur ±15 % separan su traza de sentadilla **141 mm** y
sus brazos de momento hasta **168 mm** (`informes/definicion-corporal.json`). Eso es lo que
hoy se le dibuja de más o de menos a alguien.

## 2. Lo que entra: `src/domain/patrones/definicionCorporal.ts`

Una definición corporal es el juego de medidas de una persona **y** los veintiún huesos
que salen de él, juntos y con nombre. Todo lo que dibuja o mide a esa persona se le pide a
ella, y por eso no puede mezclar dos cuerpos: no hay dos de donde elegir.

### API exacta

```ts
export const ALTURA_DE_REPOSO = 0.95

export interface DefinicionCorporal {
  sexo: Sexo
  estaturaCm?: number
  proporciones?: ProporcionesDelCuerpo
  juego: JuegoDeHuesos
  huesos: readonly DefinicionHueso[]
  clave: string
}

export function claveDeCuerpo(
  sexo: Sexo,
  estaturaCm?: number,
  proporciones?: ProporcionesDelCuerpo,
): string

export function definicionDe(
  sexo?: Sexo,                      // por defecto SEXO_POR_DEFECTO
  estaturaCm?: number,
  proporciones?: ProporcionesDelCuerpo,
): DefinicionCorporal

export function mallaOsea(definicion: DefinicionCorporal): Malla
export function esqueletoEnReposo(definicion: DefinicionCorporal): EsqueletoResuelto
export function reposoMuscular(definicion: DefinicionCorporal): Record<string, number>
export function largosDeHueso(definicion: DefinicionCorporal): Record<string, number>

export function esqueletoDeFase(
  definicion: DefinicionCorporal,
  patron: Patron,
  fase: number,
  sentido?: number,                 // por defecto 1
  reloj?: number,                   // por defecto 0
  medida?: Pose,                    // la pose medida del fantasma articular
): EsqueletoResuelto

export function trazaDe(definicion: DefinicionCorporal, patron: Patron): Vec3[] | null
export function encuadreDe(definicion: DefinicionCorporal, patron: Patron): Encuadre

export function angulosArticulares(
  esq: EsqueletoResuelto,
  huesos?: readonly DefinicionHueso[],   // por defecto HUESOS_POR_DEFECTO
): Record<string, number>                // grados, uno por hueso
```

### Garantías

1. **Identidad estable.** `definicionDe(a, b, c)` devuelve **el mismo objeto** para el mismo
   cuerpo. Sirve de llave de caché; `mallaOsea`, `esqueletoEnReposo` y `reposoMuscular` ya
   cachean por ella internamente (`WeakMap`), así que llamarlas en cada cuadro no construye
   nada.
2. **El camino por defecto no cambia ni un byte.** `definicionDe('hombre').huesos` **es**
   `esqueletoDe('hombre')` y `definicionDe('neutro').huesos` **es** `ESQUELETO`, el mismo
   array. Las 26 huellas de `juegoDeHuesos.test.ts` siguen en verde sin tocar ni una: no
   hubo nada que re-clavar.
3. **Un cuerpo distinto no es otro ejercicio.** Los ángulos articulares de las fases 0, 0,5
   y 1 son **idénticos** entre dos cuerpos —sin tolerancia—, porque la parte de rotación de
   una matriz de mundo es el producto de las rotaciones de la cadena y los largos solo
   entran en la traslación. Lo que cambia son las palancas, que es de lo que iba el encargo.
4. **`clave` distingue los cinco segmentos**, no los tres que levantan del suelo. El
   `claveDelSujeto` del visor (línea 228) solo mete fémur, tibia y torso, y
   `juegoConProporciones` también ata los brazos al fémur con `humero` y `antebrazo`: dos
   pistas con las mismas piernas y distintos brazos son dos cuerpos y compartían caché.

## 3. Lo que tiene que hacer la capa de interfaz, línea por línea

Todo en `src/features/entrenar/visor/VisorPatron.tsx`. **No lo toca esta capa.**

**(a) Importar.** Sustituir en el bloque de imports:

```ts
import { construirHuesos } from '../../../domain/patrones/huesos'          // línea 17: BORRAR
import { esqueletoConJuego, esqueletoDe, JUEGOS, SEXO_POR_DEFECTO, type Sexo }
  from '../../../domain/patrones/juegoDeHuesos'                            // líneas 19-24
import { juegoConProporciones } from '../../../domain/patrones/estatura'   // línea 25: BORRAR
```

por:

```ts
import { SEXO_POR_DEFECTO, type Sexo } from '../../../domain/patrones/juegoDeHuesos'
import {
  definicionDe,
  encuadreDe,
  esqueletoDeFase,
  esqueletoEnReposo,
  mallaOsea,
  reposoMuscular,
  trazaDe,
  type DefinicionCorporal,
} from '../../../domain/patrones/definicionCorporal'
```

De `escena` dejan de hacer falta `esqueletoEnFase` (línea 11), `trazaDelPatron` (15) y
`encuadrar` (14, salvo que la use otra cosa); de `musculos`, `longitudesEnReposo` (52). Y
`construirHuesos` sigue haciendo falta **solo** para el fantasma (ver (d)).

**(b) Borrar lo que ahora vive en el dominio.** Se van enteras:

- `claveDelSujeto` (líneas 228-241) → `claveDeCuerpo`, pero ya no hace falta llamarla: la
  llave es el propio objeto.
- `definicionDelSujeto` (líneas 243-258) → `definicionDe`.
- `precalculado` (líneas 260-272) → `mallaOsea` + `reposoMuscular`.
- `sujetoCache` (línea 77) → lo cachea el dominio.
- El `import { resolver }` de `esqueleto` (línea 51) si no queda otro uso; el reposo lo da
  `esqueletoEnReposo`.

**(c) El corazón del arreglo.** Sustituir las líneas 699-703:

```ts
        // EL JUEGO DE HUESOS va a todo lo que resuelve el sujeto —malla, reposo, traza,
        // encuadre y cada fotograma— o la carne se dibujaría sobre unas articulaciones y
        // el hueso sobre otras.
        const definicion = esqueletoDe(sexo)
        const { huesos, reposo } = precalculado(sexo, estaturaCm, proporciones)
```

por:

```ts
        // UNA SOLA DEFINICIÓN CORPORAL para todo lo que resuelve al sujeto: malla, reposo,
        // traza, encuadre y cada fotograma. Antes eran dos —la malla salía del cuerpo de la
        // persona y las matrices del atlas de su sexo—, y la carne se deformaba con las
        // articulaciones de otro.
        const cuerpo = definicionDe(sexo, estaturaCm, proporciones)
        const huesos = mallaOsea(cuerpo)
        const reposo = reposoMuscular(cuerpo)
```

Y con eso las cinco líneas que leían `definicion` pasan a leer `cuerpo`:

| línea | antes | después |
|---|---|---|
| 712 | `trazaDelPatron(patron, definicion)` | `trazaDe(cuerpo, patron)` |
| 713 | `encuadrar(patron, definicion)` | `encuadreDe(cuerpo, patron)` |
| 780 | `conRaiz(resolver({}, [0, 0.95, 0], [0, 0, 0], definicion))` | `conRaiz(esqueletoEnReposo(cuerpo))` |
| 783-790 | `esqueletoEnFase(patron, fase, sentido, reloj, undefined, definicion)` | `esqueletoDeFase(cuerpo, patron, estado.current.fase, estado.current.sentido, estado.current.reloj)` |
| 921-928 | `esqueletoEnFase(patron, faseF, sentidoDeHuella(…), tFantasma, poseDeHuella(…), definicion)` | `esqueletoDeFase(cuerpo, patron, faseF, sentidoDeHuella(huella, tFantasma), tFantasma, poseDeHuella(huella, tFantasma))` |

Ojo con el orden de los argumentos: en `esqueletoDeFase` la definición va **primera** y el
patrón segundo; el resto queda igual que en `esqueletoEnFase`.

**(d) El fantasma.** `huesosDelFantasma` (líneas 274-282) sigue existiendo —su malla no
puede ser la misma instancia que la del sujeto, porque el alfa es de la malla— pero cambia
de llave: en vez de `claveDelSujeto(sexo, estaturaCm, proporciones)` usa la propia
definición.

```ts
const fantasmaCache = new WeakMap<DefinicionCorporal, Malla>()

function huesosDelFantasma(cuerpo: DefinicionCorporal): Malla {
  let malla = fantasmaCache.get(cuerpo)
  if (!malla) {
    malla = construirHuesos(cuerpo.huesos)
    fantasmaCache.set(cuerpo, malla)
  }
  return malla
}
```

Y la llamada de la línea 929 pasa de
`huesosDelFantasma(sexo, estaturaCm, proporciones)` a `huesosDelFantasma(cuerpo)`.

**(e) Las dependencias del efecto** (línea 1202) se quedan **igual**:
`[patron, conEscenario, orbitaConUnDedo, sexo, estaturaCm, proporciones, superficieDeGesto]`.
Los tres siguen siendo lo que decide el cuerpo; lo único que cambia es que ahora hay un solo
sitio que los lee.

**(f) Lo que NO hay que hacer.** No pasar `cuerpo.huesos` a `esqueletoEnFase`,
`trazaDelPatron` ni `encuadrar` «porque también vale». Vale, y por eso volvió a haber dos
caminos la última vez. Las funciones que empiezan por la definición son las que impiden que
alguien pase medio cuerpo.

## 4. Cómo se comprueba

- `src/domain/patrones/definicionCorporal.test.ts` — 14 pruebas. Las que sostienen el
  contrato:
  - «hacen EL MISMO ejercicio»: ángulos articulares idénticos en fases 0, 0,5 y 1.
  - «y aun así la traza NO es la misma»: si alguien vuelve a atar la traza al sexo, las dos
    trazas se vuelven idénticas y esto se pone rojo. Es el guardián que no nace verde.
  - «la malla ósea se estira en la MISMA razón que el hueso que resuelve la traza»: es la
    comprobación de que malla y traza salen del mismo cuerpo.
- `informes/definicion-corporal.json` — los números, generados con
  `npx vite-node informes/definicion-corporal.mjs`.
- `src/domain/patrones/juegoDeHuesos.test.ts` — sin tocar, 26 en verde: el camino por
  defecto no se movió.
