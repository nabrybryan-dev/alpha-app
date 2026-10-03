# QA — salón cuadridimensional

Fecha: 2026-09-01  
Estado: **RECHAZA el cierre semanal** mientras `npm.cmd run verify` no quede verde y
no exista medición en un iPhone 15 Pro Max físico.

## Resultado contractual

| Criterio | Veredicto | Evidencia |
|---|---|---|
| Exactamente ocho campos y claves | ACEPTA | C01, verde 12/12; sabotaje con novena clave falló |
| Validación de bordes, ausencias y no finitos | ACEPTA | C02; mínimos/máximos inclusivos y exterior inválido; sabotaje dio `expected true to be false` |
| Persistencia aislada por usuario y escritura interrumpida | ACEPTA | C03 conserva `alpha-db-v2`, usa `alpha-antropometria-v1` y conserva la foto previa; sabotaje la reemplazó por `[]` y falló |
| Cinco ejercicios comprometidos | ACEPTA | C04; sabotaje cambió dominada por jalón y recibió `traccion_vertical` |
| Dominada cerrada, manos fijas y cuerpo móvil | ACEPTA | C05; sabotaje con jalón falló contra `dominada` |
| Peso muerto convencional distinto del rumano y desde suelo | ACEPTA | C06; sabotaje recibió `bisagra_cadera` |
| Cinco capas W reales | ACEPTA | C07 exige cinco firmas de malla distintas y catálogos completos; sabotaje redujo el conjunto a 4 |
| Suelo, techo y tres paredes literales | ACEPTA tras devolución a INTERFAZ | C08 primero detectó que faltaba el muro del fondo; después pasó. El sabotaje quitó el muro derecho y falló |
| Análisis trazable sin encender grabación | ACEPTA | C09A coteja reglas/aprobaciones y busca negativamente APIs de grabación; sabotaje rompió la correspondencia |
| Encoder posterior: sin grabación, analizado e incompatible por firma | ACEPTA tras devolución a SERVIDOR | C09B primero recibió `undefined`; después pasó con firma patrón/variante/carga/ROM/escala/FPS/versión. El sabotaje convirtió el incompatible en `analizado` |
| WebGL vacío, carga y error con prescripción real visible | ACEPTA | C10; sabotaje ocultó el error y Testing Library no encontró `El sujeto no pudo cargar` |
| Guardar una serie desde el salón | ACEPTA | C11 usa `SesionPage`, pulsa el botón real y verifica la serie persistida; sabotaje elimina el botón y falla |
| Flujo completo de sesión sin regresiones | RECHAZA — INTERFAZ | La batería existente de cambio de sesión falla 3/3 por dos cronómetros vivos y dos botones `Pausar cronómetro` |
| Gate de 30 FPS y apertura ≤5 s | ACEPTA solo el validador | La autoprueba acepta 30 FPS/5 s y rechaza 29,9/5,01/no físico/autoprueba; su propio sabotaje falló |
| Rendimiento en iPhone 15 Pro Max físico | RECHAZA — NO VERIFICABLE | No existe evidencia física; `node scripts/medir-salon.mjs` termina 1. No se infiere una medición de emulador ni de fixture |
| Verificación completa del repositorio | RECHAZA | `npm.cmd run verify`: 6 archivos y 10 tests fallidos, aunque typecheck y lint pasan (5 warnings ya existentes) |

La evidencia detallada de cada pareja rojo/verde está en
`pruebas/salon-cuadridimensional/SABOTAJES.md`.

## Comandos y salidas

### Batería contractual propia

```powershell
npm.cmd test -- --run src/test/salon-cuadridimensional/contratos.test.tsx --reporter=dot
```

```text
✓ src/test/salon-cuadridimensional/contratos.test.tsx (12 tests) 405ms
Test Files  1 passed (1)
Tests  12 passed (12)
```

### Medición exigida

```powershell
node scripts/medir-salon.mjs
```

```text
MEDICION SALON: FALLO (no existe evidencia física en pruebas/salon-cuadridimensional/evidencia-iphone-15-pro-max.json)
```

Exit code: 1. El archivo no se crea con datos inventados. Para cambiar este
veredicto se necesita una corrida reproducible en el dispositivo físico con todas
las muestras ≥30 FPS y apertura ≤5 s.

### Verificación global observada

```powershell
npm.cmd run verify
```

```text
Test Files  6 failed | 226 passed (232)
Tests  10 failed | 2876 passed (2886)
```

Typecheck terminó verde. ESLint terminó sin errores y con cinco warnings existentes.
Los rojos se devuelven a sus dueños a continuación.

## Devolución a INTERFAZ

### Blur sin contrato de superficie

- Comando: `npm.cmd test -- --run src/test/blur-solo-en-superficies-fijas.test.ts --reporter=dot`
- Archivo/test: `src/test/blur-solo-en-superficies-fijas.test.ts:81`.
- Mensaje observado: `Usan backdrop-blur suelto: salon\\SalonCuadridimensional.tsx`; `expected ['salon\\SalonCuadridimensional.tsx'] to deeply equal []`.
- Cambio requerido: usar el contrato `.glass-blur`, retirar el blur si pertenece a una superficie que desplaza o declarar una excepción real y justificada en el allowlist del guardián.

### Opacidad que no genera CSS

- Comando: `npm.cmd test -- --run src/styles/opacidad-de-color.test.ts --reporter=dot`
- Archivo/test: `src/styles/opacidad-de-color.test.ts:96`.
- Mensaje observado: `silver-500 -> /src/features/entrenar/salon/sala/ArquitecturaSala.tsx: "stroke-silver-500/20"`; `expected ['silver-500'] to deeply equal []`.
- Cambio requerido: usar un token que soporte canal alfa o declarar correctamente sus canales; la clase actual no produce CSS utilizable.

### Dos cronómetros vivos rompen los tres contratos de cambio de sesión

- Comando: `npm.cmd test -- --run src/features/entrenar/SesionPage.cambio-de-sesion.test.tsx --reporter=dot`.
- Archivo/tests: `src/features/entrenar/SesionPage.cambio-de-sesion.test.tsx`, tres casos: no arrastrar el tiempo, no heredar el inicio y no borrar un descanso en curso.
- Mensaje observado en los tres: `Found multiple elements with the text: 00:00:00`; el DOM contiene dos botones con nombre accesible `Pausar cronómetro`.
- Cambio requerido: mantener una sola instancia y una sola fuente de estado del cronómetro en `SesionPage`/salón, preservando el descanso del usuario al navegar.

### Código huérfano

- Comando: `npm.cmd test -- --run src/test/codigo-huerfano.test.ts --reporter=dot`.
- Archivo/test: `src/test/codigo-huerfano.test.ts:188`.
- Mensaje observado: `Estas exportaciones no las usa nadie... src/domain/patrones/gravedad.ts#desequilibrioDelPatron`; `expected [Array(1)] to deeply equal []`.
- Cambio requerido: conectar la exportación a un consumidor real del salón/visor, hacerla interna o retirarla; un allowlist solo sería válido con una razón verificable.

## Devolución a SERVIDOR

### Pérdida de datos durante hidratación concurrente

- Comando: `npm.cmd test -- --run src/data/nube/perdida-datos.test.ts --reporter=dot`.
- Archivo/tests: `src/data/nube/perdida-datos.test.ts:247`, `:283` y `:342`.
- Mensaje observado en los tres: `expected 1 to be greater than or equal to 11`.
- Casos afectados: series registradas durante descarga, series borradas pero aún en cola y fallo transitorio de hidratación que no debe bloquear la sincronización de agua.
- Cambio requerido: incorporar la lectura antropométrica al flujo concurrente/fallback sin bloquear las lecturas históricas originales y conservar las protecciones de versión/cola ante una hidratación parcial.

### Hidratación antropométrica repetida aunque la firma no cambió

- Comando: `npm.cmd test -- --run src/data/nube/hidratar-firma.test.ts --reporter=dot`.
- Archivo/test: `src/data/nube/hidratar-firma.test.ts:119`.
- Mensaje observado: `expected ['perfiles_antropometricos'] to deeply equal []`.
- Cambio requerido: incluir antropometría en una firma/frescura que omita la consulta cuando nada cambió y que se invalide explícitamente al migrar o actualizar ese recurso.

## Cobertura feliz, borde y fallo a media operación

| Entrega | Caso feliz | Caso borde | Fallo a media operación |
|---|---|---|---|
| Antropometría | Ocho medidas válidas y dos usuarios aislados | límites inclusivos, exterior, ausente y NaN | `Storage.setItem` lanza y la foto previa permanece |
| Patrones y capas | cinco ejercicios y cinco firmas W | dominada/jalón y convencional/rumano no colisionan | el sabotaje reemplaza patrón/capa y el guardián falla |
| Arquitectura/WebGL | cinco superficies y estado listo | vacío y carga | contexto WebGL en error conserva explicación y prescripción |
| Encoder | captura actual compatible queda `analizado` | sin captura queda `sin-grabacion` | dos firmas incompatibles quedan `incompatible` con motivos |
| Registro | guardar serie persiste carga/reps/RIR | propuesta activada y sesión resuelta por ruta | la suite histórica detecta la regresión de estado al cambiar sesión; por eso el flujo completo sigue rechazado |
| Rendimiento | gate sintético acepta exactamente 30 FPS/5 s | rechaza 29,9 FPS y 5,01 s | ausencia de evidencia física da exit 1, no un falso verde |

## Estado de cierre

No se publica un ACEPTA global. Faltan:

1. Corrección de los rojos focalizados de INTERFAZ y SERVIDOR.
2. Una repetición verde de `npm.cmd run verify` después de esas correcciones.
3. Evidencia real de un iPhone 15 Pro Max físico que haga terminar 0 a
   `node scripts/medir-salon.mjs`.

