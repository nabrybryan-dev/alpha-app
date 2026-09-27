# El atlas anatómico

De dónde sale el cuerpo real que se ve en el estudio del patrón, y cómo se vuelve a generar.

## De dónde viene

De [`ashemag/human-atlas`](https://github.com/ashemag/human-atlas) (código MIT), que
empaqueta dos fuentes, y **no son simétricas**:

- **Masculino: BodyParts3D 4.0** del Database Center for Life Science japonés, **CC BY 4.0**
  — comprobada en su [página oficial](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html),
  no solo en el repo: el OBJ original lleva en los comentarios una licencia vieja (CC BY-SA
  2.1 Japan) que la actual sustituye. 296 huesos y 402 músculos con nombre.
- **Femenino: 3D Reference Organ Set for Female v1.5** (Human Reference Atlas, HuBMAP;
  Browne y Schlehlein, 2023), **CC BY 4.0**. Estuvo en el repo hasta el commit `e6743fa1`
  y de ahí se bajan `atlas-female.json` y `female-*.bin.gz`. Trae órganos y **una piel
  entera**; de músculos solo 16 —los del ojo— y de esqueleto 91 piezas que son la columna
  y las dos rodillas: sin cráneo, costillas, brazos ni pies. Por eso de aquí sale UNA
  pieza, la piel, y no un esqueleto.

**Las dos obligan a dar crédito**, y ese crédito está en
`src/features/entrenar/visor/creditos.ts`, no aquí.

## Cómo se regenera

```sh
# 1. Bajar los dos atlas (33 + 24 MB) a una carpeta de trabajo, fuera del repo.
mkdir atlas && cd atlas
curl -sLO https://raw.githubusercontent.com/ashemag/human-atlas/main/public/models/atlas.json
for i in $(seq 0 14); do curl -sLO "https://raw.githubusercontent.com/ashemag/human-atlas/main/public/models/body-$i.bin.gz"; done
curl -sLO https://raw.githubusercontent.com/ashemag/human-atlas/e6743fa1/public/models/atlas-female.json
for i in $(seq 0 9); do curl -sLO "https://raw.githubusercontent.com/ashemag/human-atlas/e6743fa1/public/models/female-$i.bin.gz"; done
# descomprimir cada *.bin.gz a *.bin

# 2. El simplificador. Es WebAssembly, sin binarios nativos: pasa el WDAC de esta máquina.
npm i meshoptimizer

# 3. Convertir (desde la raíz del repo)
npx vite-node scripts/atlas/convertir-atlas.mts -- /ruta/a/atlas
```

Salen `public/piezas/atlas-esqueleto.pieza(.br)`, `atlas-musculos.pieza(.br)` (masculino) y
`atlas-piel.pieza(.br)` (femenino).
`src/features/entrenar/visor/atlas.test.ts` comprueba que están, que vienen a la escala del
sujeto, que la copia comprimida coincide y que el crédito sigue puesto.

## Los tres números que importan

| | triángulos | comprimido |
|---|---|---|
| atlas entero, 15 sistemas | 2.288.268 | 33 MB |
| esqueleto + musculatura, como viene | 994.176 | ~6,9 MB |
| **lo que se sirve (masculino)** | **150.066** | **1,09 MB** |
| piel femenina, como viene | 84.180 | — |
| **lo que se sirve (piel)** | **25.254** | **0,18 MB** |

## Lo que se aprendió, y sin lo cual nada de esto cabe

**Coser antes de recortar.** La malla llega descosida —0,91 vértices por triángulo cuando
una superficie sellada tiene 0,5— y un simplificador por colapso de aristas no puede cerrar
un borde. En el intercostal externo, la pieza más grande: suelto se atasca en 20.272
triángulos *aunque le permitas un 100 % de error*; cosido baja a 194 con un 2 %.

**El atlas no está en nuestra escala.** Viene en metros de persona (1,709 m). El sujeto de
`domain/patrones/` mide 0,555. Se hornea la conversión al convertir, porque es una propiedad
del dato y no una decisión de pantalla.

**El encaje deforma al que no manda.** Nuestro sujeto tiene las proporciones que tiene
—y no son las de una mujer de referencia: su cadera está a 0,955 y la de la HRA a 0,833—.
Para que la piel coincida con él, se le estiran las piernas y se le comprime el tronco un
12 %. Es lo que Bryan pidió para el masculino (que coincidan) y se aplica igual; la salida
honesta a largo plazo es que el sujeto tenga huesos con longitudes por sexo, no que cada
atlas se deforme hacia él.

**Y los brazos se cuelgan.** La HRA viene en posición anatómica (brazos a 18°); el sujeto
los lleva a 7°. Se giran alrededor del hombro con un peso que crece con la distancia, para
no arrancar la axila.

**Y no se mueve.** Es una postura fija. El sujeto que se contrae —el vientre engorda al
acortarse— sigue siendo el de `domain/patrones/`. Conviven: uno es la anatomía cierta, el
otro es el movimiento.

## Versión alta (landing)

Para el sujeto 3D de la landing (que se ve de cerca, no en una pantalla de teléfono) se
regenera con menos recorte, y en otra carpeta para no tocar lo que usa la app.
`convertir-atlas.mts` admite ahora un modo aparte por variables de entorno —sin variables,
produce EXACTAMENTE lo mismo que antes—:

```sh
ATLAS_LANDING=1 \
ATLAS_SALIDA_DIR=public/piezas/landing \
ATLAS_SUFIJO=-alta \
npx vite-node scripts/atlas/convertir-atlas.mts -- /ruta/a/atlas
```

`ATLAS_LANDING=1` cambia tres cosas:

- **solo usa el atlas masculino** (BodyParts3D): no hace falta bajar ni el atlas femenino
  ni sus `female-*.bin.gz`, solo los 15 `body-*.bin.gz`;
- **la piel sale del propio `Skin` de BodyParts3D** (sistema `integumentary`, una sola
  malla de 44.744 triángulos que cubre el cuerpo entero), no del atlas femenino: comparte
  postura y escala con el esqueleto y los músculos de esa misma fuente, así que no necesita
  el giro de brazos (`colgarBrazos`) que sí hace falta con la piel femenina;
- **recorta menos**: músculos al 40 % (antes 15 %), esqueleto al 25 % con un error máximo
  de 1,5 % (antes 15 % con 3 %), y la piel se deja en el mismo 15 % de siempre
  (`ATLAS_RECORTE_PIEL`, que por defecto es la constante `RECORTE` del script).

Salen a `public/piezas/landing/atlas-{esqueleto,musculos,piel}-alta.pieza(.br)`, sin
reemplazar los de la app (que quedan en `public/piezas/atlas-*.pieza`).

Medido el 2026-09-27, sobre los 15 `body-*.bin.gz` de `ashemag/human-atlas`:

| capa | estructuras | triángulos (bruto → final) | `.pieza` | comprimida | error máx |
|---|---|---|---|---|---|
| esqueleto (alta) | 296 | 338.056 → 89.362 | 1,09 MB | 0,64 MB | 1,50 % |
| músculos (alta) | 402 | 656.120 → 261.178 | 3,16 MB | 1,87 MB | 1,56 % |
| piel (alta, `Skin` de BodyParts3D) | 1 | 44.744 → 6.710 | 0,08 MB | 0,05 MB | 0,14 % |

Ningún archivo pasa de 1 MB de sobra: el conjunto pesa 4,33 MB sin comprimir y 2,56 MB
comprimido, muy lejos del límite de 50 MB por archivo.

## Músculos y tendones de Z-Anatomy (landing)

**Crédito: Músculos y tendones: Z-Anatomy, CC BY-SA 4.0, basado en BodyParts3D (DBCLS).**
CC BY-SA obliga a dar crédito y a compartir igual las obras derivadas de esta malla.

Sustituye la aproximación de pintar de blanco los extremos de cada músculo por el tendón
real: Z-Anatomy lo trae como 2.º material («Tendon») de cada músculo y, además, como
objetos propios (tendón calcáneo, aponeurosis epicraneal, palmar, plantar, vainas...).

```sh
# 1. Blender en consola: exporta los objetos de «4: Muscular system» (sin fascias, bolsas
#    ni ligamentos sueltos) y unos huesos de referencia, en coordenadas de mundo.
blender -b Startup.blend --python scripts/atlas/exportar-zanatomy.py   # escribe en F:\alpha-estudio\_z-anatomy\export
# 2. Encaje, cosido, recorte y escritura
npx vite-node scripts/atlas/convertir-zanatomy.mts -- /ruta/a/export /ruta/a/atlas
```

- **Color**: todo vértice de una cara con material «Tendon», o de un objeto tendón/aponeurosis,
  va en blanco puro (255,255,255); el resto en el rojo de músculo de siempre (±6 %). Se
  recorta con `simplifyWithAttributes` usando el tendón como atributo, para que la frontera
  músculo–tendón sobreviva al recorte.
- **Encaje**: semejanza por mínimos cuadrados (Horn: giro, escala uniforme, traslación) entre
  24 puntos de referencia del esqueleto de Z-Anatomy y de `atlas-esqueleto-alta.pieza`
  (coronilla, cabezas de fémur, cóndilos, rótulas, talones, cabezas de húmero y centroides
  de fémur, tibia, calcáneo, húmero, clavícula, escápula y cráneo). Sale escala 1,0011,
  giro 0,56° y RMS 1,57 cm: Z-Anatomy ya viene en la misma escala que BodyParts3D.
- **Nombre**: cada parte lleva el nombre del objeto de Z-Anatomy en el campo de nombre (el
  de textura del formato v3), p. ej. `Calcaneal tendon.r`.
- `coser()` vive ahora en `coser.mts`, compartido con `convertir-atlas.mts` (mismo cuerpo).

Medido el 2026-09-27:

| capa | estructuras | triángulos (bruto → final) | `.pieza` | comprimida | error máx |
|---|---|---|---|---|---|
| músculos + tendones (Z-Anatomy) | 522 | 1.966.086 → 260.660 | 3,18 MB | 1,93 MB | 3,00 % |

- Tendón: 25,7 % de los vértices en blanco.
- Mediana de distancia vértice → hueso más cercano de `resolver({}, [0,0,0], [0,0,0])`:
  6,01 cm (la de `atlas-musculos-alta`, 5,70 cm).
- Alto: de 0,015 a 1,717 m. Pasa de los 1,611 de los músculos de BodyParts3D porque
  BodyParts3D no trae los músculos del cuero cabelludo: la aponeurosis epicraneal cubre el
  cráneo (que llega a 1,710) y la piel alta llega a 1,716. Sin la cabeza, el resto del
  cuerpo encaja con el esqueleto como se ve arriba.
