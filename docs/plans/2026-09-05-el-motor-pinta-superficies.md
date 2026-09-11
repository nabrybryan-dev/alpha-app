# Plan: el motor pinta superficies

Spec: `docs/specs/2026-09-05-el-motor-pinta-superficies.md`.

Pruebas primero, en rojo, y después el código. Cada paso deja `npm run verify` en verde.

1. **Pruebas en rojo.**
   - `src/domain/patrones/malla.test.ts`: `uv` nace en cero, se escribe, sobrevive al
     crecimiento del búfer y a `hornear`; `textura` nace en `null` y `hornear` la lleva.
   - `src/features/entrenar/visor/ordenarPorOpacidad.test.ts`: las mallas con la misma
     textura quedan contiguas dentro de su tanda; los tramos cubren todos los índices sin
     solaparse; sin texturas, un tramo por tanda.
   - `src/features/entrenar/visor/motor.subir.test.ts`: el `gl` de mentira nombra los
     búferes en el orden REAL de creación (hasta hoy le faltaba `alfa` y acertaba de
     casualidad) y comprueba `uv` byte a byte.
   - `src/features/entrenar/escena/suelo.test.ts`: disco a `y = 0`, todas las caras hacia
     arriba, `uv` = posición / 3 m, `textura = 'suelo-goma'`.
   - `src/features/entrenar/visor/texturas.test.ts`: carga por nombre, avisa al terminar,
     y se puede cancelar antes de que llegue la imagen.
2. **`Malla`**: búfer `uv`, `textura`, `hornear`.
3. **`ordenarPorOpacidad`**: agrupar por textura y devolver `tramos`.
4. **`Motor`**: atributo `a_uv`, `u_textura` + `u_conTextura`, textura blanca de 1×1,
   `cargarTextura()`, `dibujar()` por tramos.
5. **`escena/suelo.ts`** y `visor/texturas.ts`.
6. **`VisorPatron.tsx`**: empujar el suelo con la sala y cargar las texturas al montar.
7. `npm run verify`; `node testigo/salon-visible.mjs`; captura para Bryan.
