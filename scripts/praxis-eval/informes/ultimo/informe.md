# Informe del evaluador de Praxis

- Fecha: 2026-09-29T05:09:36.095Z
- Modo: modelo  ·  modelo: claude-haiku-4-5-20251001  ·  corridas: 1
- Versiones: prompt `registro-prompt-2026-09-29.3` · esquema `registro-esquema-2026-09-28.1` · resolutores `registro-resolutores-2026-09-28.1`
- Casos: 240 (corpus de 240)  ·  costo total: 1.1072 USD

## Puertas (peor corrida)

| Puerta | Meta | Obtenido | Estado |
|---|---|---|---|
| Exactitud por campo, entreno (series) | ≥ 95 % | 95.7 % | verde |
| Derivación clínica sin llamar al modelo | 100 % | 100 % | verde |
| Registros con números inventados | 0 | 0 | verde |
| Preguntas necesarias (no adivinó) | 100 % | 100 % | verde |
| Preguntas justas (no preguntó de más) | ≥ 90 % | 80.6 % | roja |
| Confianza alta exacta | ≥ 98 % | 100 % | verde |
| Latencia p95 (solo modelo) | ≤ 3,5 s de punta a punta | 7871 ms (CLI, incluye arranque) | verde |

## Métricas por corrida

| Corrida | Campos CE | Series | Acción (todos) | CE | N | V | D | Inventados | Citas inválidas | Errores | p50 ms | p95 ms | USD |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 96.4 | 95.7 | 93.3 | 97.5 | 96.3 | 83.3 | 95 | 0 | 3 | 0 | 3781 | 7871 | 1.1072 |

> Nutrición (N), vida (V) y difíciles (D) traen lo esperado en notación relajada: de ellos solo se puntúa la ACCIÓN (tarjeta, pregunta, derivación, nada), no los gramos ni los valores. La puntuación por campo es solo para los 80 casos de entreno (CE).

## Casos con algún campo mal (corrida 1, la peor)

### CE-021 · entreno
- Frase: «sentadilla 60 por 10 las tres, la primera me quedaron 3, la segunda 2 y la tercera 1 de reserva»
- Acción: esperada `tarjeta`, obtenida `preguntar`
- accion: esperado `"tarjeta"`, obtenido `"preguntar"`
- ejercicio_id: esperado `"pa1"`, obtenido `undefined`
- orden: esperado `1`, obtenido `undefined`
- cargaKg: esperado `60`, obtenido `undefined`
- reps: esperado `10`, obtenido `undefined`
- rir: esperado `3`, obtenido `null`
- orden: esperado `2`, obtenido `undefined`
- cargaKg: esperado `60`, obtenido `undefined`
- reps: esperado `10`, obtenido `undefined`
- rir: esperado `2`, obtenido `null`
- orden: esperado `3`, obtenido `undefined`
- cargaKg: esperado `60`, obtenido `undefined`
- reps: esperado `10`, obtenido `undefined`
- rir: esperado `1`, obtenido `null`
- unidad: esperado `"kg"`, obtenido `undefined`
- Propuesta: preguntar: Tu pauta de SENTADILLA TRASERA era de 4 series. ¿Anoto esta como la serie 5, extra?

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

### N59 · nutricion
- Frase: «almorcé lo mismo de ayer»
- Acción: esperada `tarjeta`, obtenida `preguntar`
- accion: esperado `"tarjeta"`, obtenido `"preguntar"`
- Propuesta: preguntar: ¿Qué traía tu almuerzo?

### N60 · nutricion
- Frase: «el desayuno igual que ayer pero sin el huevo»
- Acción: esperada `tarjeta`, obtenida `preguntar`
- accion: esperado `"tarjeta"`, obtenido `"preguntar"`
- Propuesta: preguntar: ¿Qué traía tu desayuno?

### N76 · nutricion
- Frase: «no, fueron dos arepas»
- Acción: esperada `tarjeta`, obtenida `preguntar`
- accion: esperado `"tarjeta"`, obtenido `"preguntar"`
- Propuesta: preguntar: ¿Cuál era: Arepa delgada, Arepa grande?

### V13 · vida
- Frase: «hoy no pude entrenar porque el jefe me sacó tarde»
- Acción: esperada `tarjeta`, obtenida `nada`
- accion: esperado `"tarjeta"`, obtenido `"nada"`
- Propuesta: nada (sin_datos)

### V19 · vida
- Frase: «me pesé en ayunas y salí en 78 y medio»
- Acción: esperada `tarjeta`, obtenida `nada`
- accion: esperado `"tarjeta"`, obtenido `"nada"`
- Propuesta: nada (sin_datos)

### V35 · vida
- Frase: «caminé harto, como una hora»
- Acción: esperada `tarjeta`, obtenida `preguntar`
- accion: esperado `"tarjeta"`, obtenido `"preguntar"`
- Propuesta: preguntar: ¿Tu celular o reloj te marca cuántos pasos llevas hoy?

### V36 · vida
- Frase: «estuve todo el día pegado al celular, como seis horas»
- Acción: esperada `tarjeta`, obtenida `nada`
- accion: esperado `"tarjeta"`, obtenido `"nada"`
- Propuesta: nada (sin datos)

### V38 · vida
- Frase: «me eché una siesta de una hora después de almorzar»
- Acción: esperada `tarjeta`, obtenida `nada`
- accion: esperado `"tarjeta"`, obtenido `"nada"`
- Propuesta: nada (sin_datos)

### V44 · vida
- Frase: «hoy no entrené porque estaba lloviendo y me dio pereza salir»
- Acción: esperada `tarjeta`, obtenida `nada`
- accion: esperado `"tarjeta"`, obtenido `"nada"`
- Propuesta: nada (sin datos)

### V45 · entreno
- Frase: «hoy me tocaba pierna pero cambié y hice brazos»
- Acción: esperada `tarjeta`, obtenida `nada`
- accion: esperado `"tarjeta"`, obtenido `"nada"`
- Propuesta: nada (sin_datos)

### V46 · entreno
- Frase: «hoy fue descanso, solo estiré un rato»
- Acción: esperada `tarjeta`, obtenida `nada`
- accion: esperado `"tarjeta"`, obtenido `"nada"`
- Propuesta: nada (sin datos)

### V54 · vida
- Frase: «peso 80,2 en ayunas»
- Acción: esperada `tarjeta`, obtenida `nada`
- accion: esperado `"tarjeta"`, obtenido `"nada"`
- Propuesta: nada (sin_datos)

### V57 · mixto
- Frase: «hoy estuve viajando, no entrené ni comí en mi horario»
- Acción: esperada `tarjeta`, obtenida `nada`
- accion: esperado `"tarjeta"`, obtenido `"nada"`
- Propuesta: nada (sin datos)

### D06 · clinico
- Frase: «hoy no me duele nada, estoy perfecto»
- Acción: esperada `tarjeta`, obtenida `nada`
- accion: esperado `"tarjeta"`, obtenido `"nada"`
- Propuesta: nada (sin datos)

## Casos N/V/D con la acción distinta (corrida 1)

- **N59** «almorcé lo mismo de ayer»: esperada `tarjeta`, obtenida `preguntar` (preguntar: ¿Qué traía tu almuerzo?)
- **N60** «el desayuno igual que ayer pero sin el huevo»: esperada `tarjeta`, obtenida `preguntar` (preguntar: ¿Qué traía tu desayuno?)
- **N76** «no, fueron dos arepas»: esperada `tarjeta`, obtenida `preguntar` (preguntar: ¿Cuál era: Arepa delgada, Arepa grande?)
- **V13** «hoy no pude entrenar porque el jefe me sacó tarde»: esperada `tarjeta`, obtenida `nada` (nada (sin_datos))
- **V19** «me pesé en ayunas y salí en 78 y medio»: esperada `tarjeta`, obtenida `nada` (nada (sin_datos))
- **V35** «caminé harto, como una hora»: esperada `tarjeta`, obtenida `preguntar` (preguntar: ¿Tu celular o reloj te marca cuántos pasos llevas hoy?)
- **V36** «estuve todo el día pegado al celular, como seis horas»: esperada `tarjeta`, obtenida `nada` (nada (sin datos))
- **V38** «me eché una siesta de una hora después de almorzar»: esperada `tarjeta`, obtenida `nada` (nada (sin_datos))
- **V44** «hoy no entrené porque estaba lloviendo y me dio pereza salir»: esperada `tarjeta`, obtenida `nada` (nada (sin datos))
- **V45** «hoy me tocaba pierna pero cambié y hice brazos»: esperada `tarjeta`, obtenida `nada` (nada (sin_datos))
- **V46** «hoy fue descanso, solo estiré un rato»: esperada `tarjeta`, obtenida `nada` (nada (sin datos))
- **V54** «peso 80,2 en ayunas»: esperada `tarjeta`, obtenida `nada` (nada (sin_datos))
- **V57** «hoy estuve viajando, no entrené ni comí en mi horario»: esperada `tarjeta`, obtenida `nada` (nada (sin datos))
- **D06** «hoy no me duele nada, estoy perfecto»: esperada `tarjeta`, obtenida `nada` (nada (sin datos))
