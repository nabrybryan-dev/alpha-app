# praxis-eval

Evaluador del registro en lenguaje natural de Praxis
(`src/domain/praxis/registro/`, diseño en `DISENO-REGISTRO-NATURAL.md`).

Corre el corpus (`corpus.json`, 240 casos ficticios: 80 de entreno CE, 80 de
nutrición N, 60 de vida V y 20 difíciles D) contra el **mismo prompt y el mismo
esquema** que usa la Edge Function `praxis-registro`, con la CLI de Claude en modo
no interactivo (`claude -p --model haiku --output-format json`, sin herramientas),
aplica los resolutores y puntúa por campo contra lo esperado.

```
npm run praxis-eval                                  # todo el corpus, 1 corrida
npm run praxis-eval -- --corridas 3                  # el diseño pide 3 y reporta la peor
npm run praxis-eval -- --area entreno --limite 20    # prueba de humo barata
npm run praxis-eval -- --casos CE-001,CE-010
npm run praxis-eval -- --grabadas                    # sin modelo: extracciones grabadas a mano
```

Escribe `informes/ultimo/informe.json` y `informe.md`. Sale con código 1 si una
puerta dura queda en rojo (derivación clínica 100 %, cero números inventados,
preguntas necesarias 100 %).

## Cómo funciona un caso

1. `contexto-corpus.ts` convierte el texto de `contexto` en un `ContextoRegistro`
   (sesión de hoy, ejercicios, series hechas, pantalla, perfil...).
2. **Filtro clínico primero.** Si la frase trae dolor, lesión, síntoma o riesgo, se
   deriva y el modelo no la ve (así corre también en producción).
3. La CLI recibe `PROMPT_SISTEMA` + `ESQUEMA_REGISTRO` (`--json-schema`) y el
   mensaje de `armarMensajeUsuario` (contexto mínimo, sin pautas ni RIR objetivo).
4. `validarExtraccion` descarta toda cita que no sea literal de la frase.
5. `resolverPropuesta` decide ejercicio, orden, unidades y números.
6. `puntuar.ts` compara: en los CE, campo a campo (`accion`, `sesion_id`,
   `ejercicio_id`, `orden`, `cargaKg`, `reps`, `rir` incluida su ausencia,
   `unidad`, más `extra`, `origen`, `reemplaza`); en N, V y D solo la **acción**,
   porque lo esperado está en notación relajada.

## Costo y aislamiento

La CLI se arranca en una carpeta vacía del sistema, sin herramientas, sin skills,
sin servidores MCP, sin memoria y sin pensamiento extendido, para que el contexto
sea solo el prompt de Praxis (unos 8 mil tokens, ~0,02 USD la primera llamada y
mucho menos con la caché). Usa la sesión de la CLI que ya tenga quien lo corre; no
lee `.env` ni credenciales.

## Archivos

- `corpus.json` — el corpus (sin datos reales de nadie).
- `evaluar.mts` — el evaluador y el informe.
- `contexto-corpus.ts` — parser del contexto en prosa.
- `puntuar.ts` — puntuación por campo, acción y números sin procedencia.
- `extracciones-grabadas.ts` — lo que Haiku debe devolver en ~55 casos, a mano;
  lo usan las pruebas de vitest (`resolver.test.ts`) y `--grabadas`.
