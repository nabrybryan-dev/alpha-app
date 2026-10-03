# Evidencia de sabotajes — salón cuadridimensional

Fecha: 2026-09-01

Regla aplicada: ningún check se declara verde hasta ejecutar el mismo check con
`SALON_SABOTAJE` y observarlo fallar por la condición que pretende vigilar. Los
sabotajes viven únicamente en la batería de QA; no modifican código de producto.

## Corrida verde común C01–C11

Comando:

```powershell
npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx --reporter=dot
```

Salida literal:

```text
✓ src/test/salon-cuadridimensional/contratos.test.tsx (12 tests) 405ms
Test Files  1 passed (1)
Tests  12 passed (12)
```

## Corridas rojas deliberadas

Cada comando siguiente usa la misma prueba que después pasó en la corrida verde.

| Check | Sabotaje deliberado | Comando | Mensaje rojo observado |
|---|---|---|---|
| C01 | Añadir la novena clave `estaturaCm` | `$env:SALON_SABOTAJE='C01'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C01" --reporter=dot` | `expected [...] to deeply equal [...]` y el diff contiene `+ "estaturaCm"` |
| C02 | Usar el mínimo inclusivo donde el caso exige `minimoCm - 0.1` inválido | `$env:SALON_SABOTAJE='C02'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C02" --reporter=dot` | `expected true to be false` |
| C03 | Reemplazar la fotografía persistida por `[]` después de simular una escritura interrumpida | `$env:SALON_SABOTAJE='C03'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C03" --reporter=dot` | `expected '[]' to be '[{"usuarioId":"u-1"...'` |
| C04 | Resolver la dominada como jalón | `$env:SALON_SABOTAJE='C04'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C04" --reporter=dot` | `expected ... "dominada" ...`; recibido `"traccion_vertical"` |
| C05 | Pedir el patrón de jalón en vez de dominada | `$env:SALON_SABOTAJE='C05'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C05" --reporter=dot` | `expected 'traccion_vertical' to be 'dominada'` |
| C06 | Sustituir el id convencional por el del rumano | `$env:SALON_SABOTAJE='C06'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C06" --reporter=dot` | `expected 'bisagra_cadera' to be 'peso_muerto_convencional'` |
| C07 | Duplicar la firma de malla W2 en W3 | `$env:SALON_SABOTAJE='C07'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C07" --reporter=dot` | `expected 4 to be 5` |
| C08 | Quitar del SVG renderizado el muro derecho | `$env:SALON_SABOTAJE='C08'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C08" --reporter=dot` | `expected [...] to deeply equal ArrayContaining{…}`; falta `M 360 0 L 294 108 L 294 452 L 360 640 Z` |
| C09A | Eliminar una regla de la lista trazada, conservando las aprobaciones originales | `$env:SALON_SABOTAJE='C09A'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C09A" --reporter=dot` | `expected [...] to deeply equal [...]`; las aprobaciones aún incluyen `BIO-HOMBRO-ANCHO-BRAZO-05` |
| C09B | Igualar las firmas de semana actual y anterior | `$env:SALON_SABOTAJE='C09B'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C09B" --reporter=dot` | `expected { estado: 'analizado', …(4) } to match object { estado: 'incompatible', …(3) }` |
| C10 | Renderizar estado `listo` en el caso WebGL de error | `$env:SALON_SABOTAJE='C10'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C10" --reporter=dot` | `Unable to find an element with the text: El sujeto no pudo cargar` |
| C11 | Quitar del DOM el botón real de guardado antes de usarlo | `$env:SALON_SABOTAJE='C11'; npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx -t "C11" --reporter=dot` | `Unable to find an accessible element with the role "button" and name "Guardar serie 1"` |

Después de cada corrida se eliminó la variable con:

```powershell
Remove-Item Env:SALON_SABOTAJE -ErrorAction SilentlyContinue
```

## Gate de medición

Caso feliz y bordes sintéticos del **validador**, no del rendimiento del dispositivo:

```powershell
node pruebas/salon-cuadridimensional/casos/medir-salon.autoprueba.mjs
```

Salida verde literal:

```text
AUTOPRUEBA MEDICION: OK (límites 30 FPS/5 s y evidencia física distinguidos)
```

Sabotaje del mismo check:

```powershell
node pruebas/salon-cuadridimensional/casos/medir-salon.autoprueba.mjs --sabotaje
```

Salida roja literal (exit 1):

```text
AssertionError [ERR_ASSERTION]: el caso límite válido fue rechazado:
false !== true
```

La autoprueba incluye el límite feliz exacto (30 FPS y 5 s) y rechaza 29,9 FPS,
5,01 s, `fisico: false` y `soloAutoprueba: true`. Esto acredita el gate, pero no
acredita rendimiento real.

## Rojos de producto observados y posteriormente corregidos

- C08 nació rojo antes de la corrección de INTERFAZ porque
  `ArquitecturaSala` calculaba `muroDelFondo` pero no lo pintaba. La aserción
  `arrayContaining` informó que faltaba ese trazado. Tras renderizar
  `SALON.muroDelFondo`, C08 pasó y su sabotaje independiente volvió a demostrar
  que el guardián detecta una pared ausente.
- C09B nació rojo antes de la corrección de SERVIDOR con
  `expected undefined to deeply equal { estado: 'sin-grabacion' }`. El analizador
  no aceptaba capturas ni firma semanal. Tras añadir los estados y la firma de
  compatibilidad, C09B pasó y su sabotaje de firmas iguales produjo el rojo
  explícito documentado arriba.

