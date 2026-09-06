# El atlas anatómico

De dónde sale el cuerpo real que se ve en el estudio del patrón, y cómo se vuelve a generar.

## De dónde viene

De [`ashemag/human-atlas`](https://github.com/ashemag/human-atlas) (código MIT), que a su
vez empaqueta **BodyParts3D 4.0** del Database Center for Life Science japonés, con licencia
**CC BY 4.0** — comprobada en su [página oficial](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html),
no solo en el repo: el OBJ original lleva en los comentarios una licencia vieja (CC BY-SA
2.1 Japan) que la actual sustituye. **Obliga a dar crédito**, y ese crédito está en
`src/features/entrenar/visor/creditos.ts`, no aquí.

## Cómo se regenera

```sh
# 1. Bajar el atlas (33 MB) a una carpeta de trabajo, fuera del repo.
mkdir atlas && cd atlas
curl -sLO https://raw.githubusercontent.com/ashemag/human-atlas/main/public/models/atlas.json
for i in $(seq 0 14); do curl -sLO "https://raw.githubusercontent.com/ashemag/human-atlas/main/public/models/body-$i.bin.gz"; done
# descomprimir cada body-*.bin.gz a body-*.bin

# 2. El simplificador. Es WebAssembly, sin binarios nativos: pasa el WDAC de esta máquina.
npm i meshoptimizer

# 3. Convertir (desde la raíz del repo)
npx vite-node scripts/atlas/convertir-atlas.mts -- /ruta/a/atlas
```

Salen `public/piezas/atlas-esqueleto.pieza(.br)` y `atlas-musculos.pieza(.br)`.
`src/features/entrenar/visor/atlas.test.ts` comprueba que están, que vienen a la escala del
sujeto, que la copia comprimida coincide y que el crédito sigue puesto.

## Los tres números que importan

| | triángulos | comprimido |
|---|---|---|
| atlas entero, 15 sistemas | 2.288.268 | 33 MB |
| esqueleto + musculatura, como viene | 994.176 | ~6,9 MB |
| **lo que se sirve** | **150.066** | **1,09 MB** |

## Lo que se aprendió, y sin lo cual nada de esto cabe

**Coser antes de recortar.** La malla llega descosida —0,91 vértices por triángulo cuando
una superficie sellada tiene 0,5— y un simplificador por colapso de aristas no puede cerrar
un borde. En el intercostal externo, la pieza más grande: suelto se atasca en 20.272
triángulos *aunque le permitas un 100 % de error*; cosido baja a 194 con un 2 %.

**El atlas no está en nuestra escala.** Viene en metros de persona (1,709 m). El sujeto de
`domain/patrones/` mide 0,555. Se hornea la conversión al convertir, porque es una propiedad
del dato y no una decisión de pantalla.

**Y no se mueve.** Es una postura fija. El sujeto que se contrae —el vientre engorda al
acortarse— sigue siendo el de `domain/patrones/`. Conviven: uno es la anatomía cierta, el
otro es el movimiento.
