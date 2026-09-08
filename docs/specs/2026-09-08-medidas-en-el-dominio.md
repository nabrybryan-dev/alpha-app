# Las ocho medidas, en el dominio

2026-09-08 · capa de dominio y datos · `src/domain/medidas.ts`

## 1. Qué pide la ficha

Ocho medidas, todas en centímetros y todas tomadas con cinta por una persona. Seis son
longitudes de segmento y dos son perímetros.

| clave | etiqueta | unidad | rango |
|---|---|---|---|
| `tibiaCm` | Tibia y peroné | cm | 22 – 56 |
| `femurCm` | Fémur | cm | 27 – 69 |
| `torsoCm` | Torso | cm | 32 – 79 |
| `antebrazoCm` | Antebrazo | cm | 14 – 34 |
| `brazoCm` | Brazo | cm | 19 – 46 |
| `anchoClavicularCm` | Ancho clavicular | cm | 24 – 57 |
| `cinturaCm` | Cintura | cm | 40 – 200 |
| `caderasCm` | Caderas | cm | 50 – 200 |

Ese es también el orden en que se preguntan —las longitudes de abajo arriba y después los
dos perímetros— y el orden es parte del contrato: `CLAVES_DE_MEDIDA` lo fija y
`medidas.test.ts` lo clava.

### Entre qué dos puntos va la cinta

Sin esto el número no significa nada, porque cada persona la pondría donde le pareciera.
Va en `MEDIDAS[].comoSeMide` y es lo que el formulario tiene que enseñar debajo de cada
campo:

- **Tibia y peroné** — de extremo a extremo: del hueco de la rodilla (interlínea articular)
  al hueso que sobresale en el tobillo, con la pierna estirada.
- **Fémur** — del bulto del lateral de la cadera (trocánter mayor) al hueco de la rodilla,
  de pie y con el peso repartido.
- **Torso** — de la cresta de la cadera a la punta del hombro (acromion), sentado y con la
  espalda recta.
- **Antebrazo** — del pliegue del codo al pliegue de la muñeca, con el brazo estirado.
- **Brazo** — de la punta del hombro (acromion) al pliegue del codo, con el brazo colgando.
- **Ancho clavicular** — de una punta del hombro a la otra, por delante, de pie y relajado.
- **Cintura** — en el punto más estrecho entre la última costilla y la cresta de la cadera,
  al final de una espiración normal y sin apretar.
- **Caderas** — en la parte más ancha de los glúteos, de pie y con los pies juntos.

## 2. Por qué las claves están cerradas

`MedidaCorporal.perimetros` es un `Record<string, number>` con las claves libres. Se ve lo
que pasa cuando nadie cierra un catálogo: hoy en la app conviven «Cadera» y «Glúteos»,
«Brazo» y «Brazos», «Abdomen» y «Abdomen medio» para el mismo dato, porque cada pantalla y
cada semilla escribió la etiqueta que le pareció. Un mapa así **no se puede consultar**:
nadie sabe si la persona no tiene el dato o lo tiene con otro nombre.

Las ocho de aquí están cerradas y lo que no está en la lista se **rechaza** en vez de
guardarse. Es la diferencia entre un formulario y un catálogo.

Las claves van en camelCase con sufijo de unidad, como el resto de `types.ts`
(`alturaCm`, `pesoKg`, `masaMagraKg`): la app nombra en camelCase y la base en snake_case,
y aquí no hay traducción que hacer porque no son columnas.

## 3. De dónde salen los rangos

**No son rangos de normalidad clínica** y no sirven para decirle nada a nadie sobre su
cuerpo. Son lo mismo que `ESTATURA_MINIMA_CM`/`ESTATURA_MAXIMA_CM` en `patrones/estatura.ts`:
el filtro del **dato mal metido** —el fémur en milímetros, la coma corrida, el campo de al
lado—. Todo lo que un cuerpo humano puede medir de verdad pasa.

Las seis longitudes se derivan de los dos atlas que ya usa la app
(`patrones/juegoDeHuesos.ts`): la razón del segmento sobre la estatura, escalada a las dos
estaturas extremas que la ficha admite (130 y 220 cm) y con un ±15 % de holgura individual
encima, porque dos personas de la misma altura no tienen el mismo fémur —que es justo el
motivo de medir—. Redondeado hacia fuera:

| medida | razón sobre la estatura (mujer / hombre) | derivado | rango |
|---|---|---|---|
| tibia | 0,2047 / 0,2200 | 22,6 – 55,6 | 22 – 56 |
| fémur | 0,2509 / 0,2701 | 27,7 – 68,3 | 27 – 69 |
| torso | 0,3110 / 0,2910 | 32,2 – 78,7 | 32 – 79 |
| antebrazo | 0,1319 / 0,1319 | 14,6 – 33,4 | 14 – 34 |
| brazo | 0,1772 / 0,1779 | 19,6 – 45,0 | 19 – 46 |
| ancho clavicular | 0,2217 / 0,2217 | 24,5 – 56,1 | 24 – 57 |

La derivación no está copiada en el test: `medidas.test.ts` la **recalcula** contra
`JUEGOS` y contra el esqueleto resuelto, así que si alguien toca un atlas y un rango deja
de cubrir a una persona real, sale en rojo.

Los dos perímetros no tienen atlas del que derivarlos —un contorno no tiene techo
anatómico como un hueso— así que su rango es generoso a propósito: por debajo de 40 cm de
cintura no hay un adulto, y por encima de 200 el dato está mal escrito.

## 4. La API

```ts
export const CLAVES_DE_MEDIDA: readonly ClaveDeMedida[]      // las ocho, en orden
export type ClaveDeMedida = 'tibiaCm' | 'femurCm' | …
export type MedidasDelCuerpo = Partial<Record<ClaveDeMedida, number>>

export interface DefinicionDeMedida {
  clave: ClaveDeMedida
  etiqueta: string        // lo que lee la persona
  comoSeMide: string      // entre qué dos puntos va la cinta
  unidad: 'cm'
  minimo: number
  maximo: number
}
export const MEDIDAS: readonly DefinicionDeMedida[]
export const MEDIDA_POR_CLAVE: Record<ClaveDeMedida, DefinicionDeMedida>
export function esClaveDeMedida(clave: string): clave is ClaveDeMedida

export interface ReparoDeMedida { campo: string; motivo: string }
export function revisarMedidas(entrada: unknown): ReparoDeMedida[]   // vacío = se guarda
```

`revisarMedidas` devuelve **todos** los reparos, no el primero: quien rellena ocho campos
merece verlos marcados de una vez. Rechaza tres cosas —lo que no es un número, lo que está
fuera de rango, y **una clave que no es una de las ocho**— y el mensaje de cada reparo está
escrito para pintarse, no para depurar:

```
Fémur: 473 cm está fuera de lo posible (27–69 cm).
«gluteosCm» no es una de las ocho medidas de la ficha.
```

**Todas opcionales.** Alguien puede tomarse el fémur y no la cintura, y lo que falta no se
rellena: no medido no es cero ni es «lo que suele medir la gente», que es la misma regla
que ya aplican `pesoKg` en `types.ts` y `juegoParaEstatura` en `patrones/estatura.ts`. Una
clave presente con `undefined` —un campo del formulario en blanco— tampoco es un error.

## 5. Dónde se guardan, y por qué NO hace falta migración

En un campo nuevo de la medida:

```ts
export interface MedidaCorporal {
  fecha: string
  pesoKg?: number
  alturaCm: number
  perimetros: Record<string, number>
  pgPct?: number
  masaMagraKg?: number
  cuerpo?: MedidasDelCuerpo   // ← las ocho
}
```

Y de ahí a la nube **sin tocar nada más**. La cadena entera pasa el objeto de la medida
completo, sin nombrar una sola clave:

| capa | archivo | qué hace | ¿cambia? |
|---|---|---|---|
| local | `src/data/mockDb.ts#agregarMedida` | sustituye la del mismo día y ordena por fecha | no |
| cola | `src/data/nube/sync.ts#subirMedida` | encola `{ p_medida: medida }` | no |
| lectura optimista | `src/data/nube/fusion.ts#conMedidaPendiente` | pone la pendiente sobre la descargada | no |
| servidor | `registrar_medida(p_medida jsonb)` (migración 0057) | `jsonb_agg` sobre el array `medidas` | **no** |

`registrar_medida` es opaca al contenido: solo comprueba que la medida traiga `fecha` y
mete el jsonb tal cual. Y `proteger_perfil` (0057) mira las claves del blob de la ficha
—`medidas` y `usuarioId`—, no las de dentro de una medida. **Así que no hay `0058`, y no
haberla escrito es la decisión, no un olvido**: en este repo las migraciones se aplican a
mano y sin registro de versiones (`CLAUDE.md` §3), así que una migración que no cambia nada
es un despliegue manual con riesgo y cero beneficio.

Lo que sí se clava, porque es lo único que podría romperlo, es que esta capa **no empiece a
copiar campo a campo**: `src/data/nube/medidas-del-asesorado.test.ts` comprueba que las
ocho llegan enteras a la cola, vuelven enteras de la fusión y quedan enteras en el almacén
local.

Si algún día se quisiera **validar en el servidor**, entonces sí haría falta un `0058` que
reemplace `registrar_medida` con `create or replace` (molde: la propia 0057) y su fila en
`supabase/comprobar-migraciones.sql`. Hoy la validación vive en el dominio, que es donde
está el formulario que la enseña.

## 6. Cómo se comprueba

```
npx vitest run src/domain/medidas.test.ts
npx vitest run src/data/nube/medidas-del-asesorado.test.ts
```
