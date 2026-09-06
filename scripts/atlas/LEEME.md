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
