# Informe del evaluador de Praxis

- Fecha: 2026-10-03T13:30:50.696Z
- Modo: modelo  ·  modelo: claude-haiku-4-5-20251001  ·  corridas: 3
- Versiones: prompt `registro-prompt-2026-10-03.1` · esquema `registro-esquema-2026-10-03.1` · resolutores `registro-resolutores-2026-09-29.1`
- Casos: 240 (corpus de 240)  ·  costo total: 1.7363 USD

## Puertas (peor corrida)

| Puerta | Meta | Obtenido | Estado |
|---|---|---|---|
| Exactitud por campo, entreno (series) | ≥ 95 % | 97.2 % | verde |
| Derivación clínica sin llamar al modelo | 100 % | 100 % | verde |
| Registros con números inventados | 0 | 0 | verde |
| Preguntas necesarias (no adivinó) | 100 % | 100 % | verde |
| Preguntas justas (no preguntó de más) | ≥ 90 % | 92.3 % | verde |
| Confianza alta exacta | ≥ 98 % | 100 % | verde |
| Latencia p95 (solo modelo) | ≤ 3,5 s de punta a punta | 2590 ms (CLI, incluye arranque) | verde |

## Métricas por corrida

| Corrida | Campos CE | Series | Acción (todos) | CE | N | V | D | Inventados | Citas inválidas | Errores | p50 ms | p95 ms | USD |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 97.4 | 97.2 | 99.2 | 97.5 | 100 | 100 | 100 | 0 | 0 | 0 | 1644 | 2590 | 0.9052 |
| 2 | 97.4 | 97.2 | 99.2 | 97.5 | 100 | 100 | 100 | 0 | 0 | 0 | 1671 | 3110 | 0.413 |
| 3 | 97 | 97.2 | 98.8 | 96.3 | 100 | 100 | 100 | 0 | 1 | 0 | 1667 | 2660 | 0.4181 |

> Nutrición (N), vida (V) y difíciles (D) traen lo esperado en notación relajada: de ellos solo se puntúa la ACCIÓN (tarjeta, pregunta, derivación, nada), no los gramos ni los valores. La puntuación por campo es solo para los 80 casos de entreno (CE).

## Casos con algún campo mal (corrida 1, la peor)

### CE-025 · entreno · discrepancia conocida
- Frase: «no me acuerdo cuánto le puse al remo, algo así como 50, y fueron diez»
- Acción: esperada `tarjeta`, obtenida `preguntar`
- accion: esperado `"tarjeta"`, obtenido `"preguntar"`
- ejercicio_id: esperado `"pc1"`, obtenido `undefined`
- orden: esperado `1`, obtenido `undefined`
- cargaKg: esperado `50`, obtenido `undefined`
- reps: esperado `10`, obtenido `undefined`
- rir: esperado `null`, obtenido `null`
- unidad: esperado `"kg"`, obtenido `undefined`
- Propuesta: preguntar: ¿Cuál fue: REMO CON BARRA o REMO EN POLEA BAJA?
- Nota: El corpus espera pc1, pero «el remo» encaja con REMO CON BARRA y REMO EN POLEA BAJA de la sesión y DISENO §3.1 paso 3 manda preguntar.

### CE-038 · entreno
- Frase: «fondos con diez kilos de lastre, ocho repeticiones»
- Acción: esperada `tarjeta`, obtenida `preguntar`
- accion: esperado `"tarjeta"`, obtenido `"preguntar"`
- ejercicio_id: esperado `"pb6"`, obtenido `undefined`
- orden: esperado `1`, obtenido `undefined`
- cargaKg: esperado `10`, obtenido `undefined`
- reps: esperado `8`, obtenido `undefined`
- rir: esperado `null`, obtenido `null`
- unidad: esperado `"corporal"`, obtenido `undefined`
- Propuesta: preguntar: Tu rutina trae FONDOS EN PARALELAS, no diez kilos lastre. ¿Lo dejo como nota para Bryan o lo anoto en FONDOS EN PARALELAS?

### CE-063 · mixto
- Frase: «hice 20 minutos de caminadora y me tomé una creatina»
- Acción: esperada `tarjeta`, obtenida `tarjeta`
- sesion_id: esperado `"S5"`, obtenido `undefined`
- bloquesCardio[cd1].duracionRealMin: esperado `20`, obtenido `undefined`
- Propuesta: checkin | comida

## Casos N/V/D con la acción distinta (corrida 1)

Ninguno.
