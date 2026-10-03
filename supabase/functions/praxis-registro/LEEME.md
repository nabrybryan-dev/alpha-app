# praxis-registro

Registro en lenguaje natural de Praxis. **No está desplegada**: la publica Bryan.

Diseño: `DISENO-REGISTRO-NATURAL.md` (28-sep-2026). Código de dominio:
`src/domain/praxis/registro/`. Evaluador: `scripts/praxis-eval/`.

## Antes de desplegar

1. **Secreto de la API** (no está en el repo, no lo crea nadie más que Bryan):
   `supabase secrets set ANTHROPIC_API_KEY=...`
2. Desplegar con la CLI (`supabase functions deploy praxis-registro`), no pegando
   el archivo en el panel: importa el dominio con rutas relativas
   (`../../../src/domain/praxis/registro/index.ts`), que el panel no resuelve. No se probó el empaquetado con la CLI (no se despliega
   en esta rama): en el primer despliegue hay que comprobar que empaqueta esa ruta.
3. Correr el banco: `npm run praxis-eval -- --corridas 3` y revisar las puertas
   duras del informe.
4. Los prerrequisitos del diseño que siguen abiertos (P1, P2, P5, P6, P7, P8)
   están listados abajo: sin ellos, GUARDAR deja check-in, agua y comida como
   `pendiente_prerrequisito`.

## Rutas (POST, con el JWT de la persona en `Authorization`)

### `/praxis-registro` — proponer (no guarda)

```json
{ "frase": "le metí 40 kilos, 12 en la sentadilla que me pusiste",
  "mensaje_id": "uuid del teléfono",
  "hora_local": "2026-09-28T18:40:00-05:00",
  "pantalla_ejercicio_id": "pa1",
  "ultimo_tocado": { "ejercicio_id": "pa1", "minutos_atras": 3 },
  "peso_barra_kg": 20, "checkin_hoy": {}, "hidratacion_hoy_ml": 500, "cronometro_min": 58,
  "ver_composicion": true, "comidas_ayer": [{ "comida": "almuerzo", "items": [{ "alimento": "arroz", "gramos": 150 }] }],
  "comida_pendiente": [{ "alimento": "arepa delgada", "gramos": 56 }] }
```

Responde `{ propuesta, tarjeta, meta }`. Orden interno: filtro clínico (si marca,
Haiku no ve la frase) → contexto leído con el JWT → Haiku (`claude-haiku-4-5`,
herramienta `registrar` forzada, `strict: true`, `temperature: 0`, prefijo
cacheado) → validación de citas literales → resolutores → tarjeta.

Errores: 400 (frase vacía o larga), 401 (sin sesión), 429 (60 por hora, antes 30), 502
(`Se me enredó algo de mi lado. ¿Me lo repites?`: Haiku falló, sin secreto o sin respuesta).

**Charla (3-oct-2026).** La petición puede traer `charla: { trato: 'tu'|'usted', nombre, apertura, turnos: [{ rol: 'persona'|'praxis', texto }] }`
(máximo 6 turnos de ESA sesión; el servidor los sanea, descarta lo que el filtro de riesgo marca y no guarda nada). Es
la MISMA llamada a Haiku: el bloque `BLOQUE_CHARLA` va al final de `PROMPT_SISTEMA` y el modelo escribe `respuesta_charla`
cuando la frase no es un registro ni una consulta. Si no hay nada que guardar, preguntar ni derivar y la respuesta pasa la
validación (`charla/modelo.ts`), la respuesta trae `charla: { texto }`; si no, no trae nada y la pantalla usa su libreto.

**Aprobado por Bryan el 3-oct-2026:** el primer nombre de la persona y los últimos 6 turnos de la sesión (los no marcados por el filtro de riesgo) viajan al modelo. Tope: 60 mensajes por persona y hora (antes 30).

### `/praxis-registro` con `accion: 'ingreso'` — un turno hablado del cuestionario de ingreso (prueba interna, no guarda)

```json
{ "accion": "ingreso", "turno": "sobre_ti", "texto": "Soy de Cali, tengo veintiocho años y mido uno setenta" }
```

Turnos: `sobre_ti`, `historia_entreno`, `objetivo`, `trabajo_horarios`, `comida`. Responde
`{ tipo: 'ingreso', turno, derivada: false, campos, temas, toques, descartados, meta }`, o
`{ derivada: true, derivacion }` si Praxis detuvo el turno. Mismo orden de seguridad que proponer:
Auth y rol (solo equipo) → filtro de riesgo del diccionario ANTES de cualquier modelo (si marca, no se
extrae nada) → límite de 40 por hora (cuenta aparte) → Haiku dos veces en paralelo (el etiquetador de
`src/domain/praxis/ingreso/extraer.ts` y el lector de riesgo) → `validarIngreso`: solo pasa lo que se
rastrea a una cita literal. **Un campo de salud jamás sale de aquí**: la respuesta trae el tema y los
toques que corresponden, nunca la frase ni las citas. No guarda nada, no lee el plan y registra
tiempos (milisegundos) sin el texto. Texto: hasta 1.500 caracteres. Pantalla: `/praxis/ingreso-prueba`.

### El aviso al coach (migración 0108, sin aplicar)

Cuando `proponer` o `ingreso` detectan una señal de riesgo (el diccionario, el lector con modelo, o un
tema de salud en el ingreso) la función inserta UNA fila en `praxis_avisos_coach` con el JWT de la persona:
`{ usuario_id, origen: 'praxis' | 'ingreso', nivel: 'vida' | 'pareja' | 'nino' | 'cuidado' | 'salud' }`.
**Sin la frase ni la cita** (la retención de texto la revisa un abogado). Aparece en «Avisos de Praxis»,
arriba de la consola del coach, hasta que él la marca atendida. Si el insert falla (por ejemplo, la
migración sin aplicar) la respuesta a la persona NO cambia y el log dice
`praxis-registro: aviso no guardado <código HTTP> <código PostgREST>`, sin datos personales.
Los avisos iguales (misma persona, origen y tipo) sin atender en la última hora no se repiten: lo decide la base.

### `/praxis-registro/guardar` — guardar lo confirmado

```json
{ "mensaje_id": "...", "registros": [ /* los de la propuesta, ya editados por la persona */ ],
  "confirma_sesion": false, "confirma_extra": false, "hora_local": "..." }
```

Vuelve a comprobar todo contra el microciclo (límites, sesión, `sets`, vencido) y
escribe con las RPC de la app y el JWT de la persona:

| Registro | Se escribe | Cómo |
|---|---|---|
| `series` | sí | `fijar_series_ejercicio`, reemplazo por `orden`, con `fuente: 'praxis'`, `confianza`, `origen`, `hechoEn` |
| `testPost.rpeSesion` / `duracionMin` | sí | `fijar_test_post`, fusionado con lo que había |
| `adherencia` | sí | upsert por (usuario, fecha), solo las columnas que cambian |
| `checkin` | no (P2) | una fila parcial cierra el formulario y da XP |
| `hidratacion` | no (P5) | `registrarHidratacion` suma un delta; hace falta el libro de tarjetas aplicadas |
| `comida` | no (P5/P6) | faltan las columnas de procedencia y el catálogo curado |
| cardio, preparación | no (P7) | cardio no sincroniza; `marcarParte` alterna |

Nunca se escribe con `service_role`. No se aplican migraciones desde aquí.

## Gana la lectura más grave (3-oct)

Interruptor `PRAXIS_RIESGO_MAS_GRAVE=1` (apagado): con él, una marca de cuidado/salud también se relee con el modelo y sale la más grave (acción `releer_riesgo` y rama marcada de `proponer`); ver `src/domain/praxis/masGrave.ts`. Sin él, todo lo anterior queda tal cual.
La pantalla NO manda frases marcadas mientras `LECTURA_DEL_MODELO_SOBRE_MARCADAS` siga en `false`: el texto de privacidad dice hoy que no salen del teléfono (decisión de Bryan).
