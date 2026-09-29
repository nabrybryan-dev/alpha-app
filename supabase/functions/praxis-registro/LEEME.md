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
  "peso_barra_kg": 20, "checkin_hoy": {}, "hidratacion_hoy_ml": 500, "cronometro_min": 58 }
```

Responde `{ propuesta, tarjeta, meta }`. Orden interno: filtro clínico (si marca,
Haiku no ve la frase) → contexto leído con el JWT → Haiku (`claude-haiku-4-5`,
herramienta `registrar` forzada, `strict: true`, `temperature: 0`, prefijo
cacheado) → validación de citas literales → resolutores → tarjeta.

Errores: 400 (frase vacía o larga), 401 (sin sesión), 429 (30 por hora), 502
(`No te entendí bien, ¿lo anotas aquí?`: Haiku falló, sin secreto o sin respuesta).

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
