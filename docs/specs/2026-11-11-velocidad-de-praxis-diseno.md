# Velocidad de Praxis: dónde se va el tiempo y cómo hacerlo inmediato (revisión, sin código)

Fecha: 11-nov-2026. Estado: REVISIÓN con propuestas; no se cambió código de producción, ni la Edge Function, ni se aplicó nada. Marcas: [V] lo leí o medí hoy (con ruta); [S] suposición mía, sin medir; [P] propuesta mía, sin firma de Bryan.

## 0. Respuesta corta

- Lo que la persona dice y Praxis resuelve en el teléfono ya es inmediato: el filtro de riesgo local tarda 4 microsegundos y la charla local 3 microsegundos [V, medido hoy]. La nueva gramática de organizar la app (PR #472) tarda 0,3 milisegundos [V].
- Lo que sale al servidor paga siempre un piso: el lector de riesgo con modelo (Haiku) corre en TODO mensaje, incluso en los que el «camino rápido» arma sin modelo, y la respuesta espera al más lento de los dos modelos (`index.ts` l.441 [V]).
- Los dos mensajes más recurrentes al abrir la conversación, el saludo y el «¿cómo estás?», van al modelo a propósito (`charla.ts` l.308 [V]) aunque el texto local ya existe.
- Después de los modelos hay una cola en serie (guardar el mensaje del equipo, el portero hasta 4 s, la cola de dudas, el aviso al coach) que se puede sacar del camino de la respuesta [V que existe en el código; el ahorro es S].
- No se puede decir hoy cuánto tarda de verdad: en las últimas 24 h no hubo ni una llamada a `praxis-registro` [V, registros de la función], y la tabla de mensajes del equipo tiene 15 frases de una persona, todas sin modelo [V]. El saldo de Anthropic está en cero [M]. Primero hay que medir (§6).

## 1. Qué se midió y qué no

| Dato | Resultado | Fuente |
|---|---|---|
| Llamadas a `praxis-registro` en las últimas 24 h | 0 | `function_edge_logs` del proyecto, consulta de hoy [V] |
| Líneas «praxis-registro: tiempos» en el registro | 0 | `function_logs`, consulta de hoy [V] |
| Frases del equipo guardadas (0159) | 15, de 1 persona, del 3 al 10 de nov, largo medio 33 caracteres, todas con intención `sin_modelo` | `praxis_mensajes_equipo`, solo conteos [V] |
| Filtro de riesgo local | 4,4 µs por frase | prueba temporal, 5.000 repeticiones [V] |
| Normalizar la charla local | 3,4 µs | idem [V] |
| Gramática de organización con una orden | 333 a 341 µs | idem [V] |
| Gramática de organización con una frase que no es orden | 4,3 µs | idem [V] |
| Tiempo de los modelos y del portero | SIN MEDIR | no hay tráfico ni saldo |

Consecuencia: la lista de «palabras recurrentes» de este documento sale del diseño del código (qué frases ya tienen camino local) y no de un conteo real de uso. Un conteo real todavía no existe.

## 2. Las capas, de la más rápida a la más lenta

| Capa | Dónde corre | Qué resuelve | Costo | Evidencia |
|---|---|---|---|---|
| L0 filtro de riesgo | teléfono | lo que va a seguridad | 4 µs | `riesgo.ts` [V] |
| L1 charla local | teléfono | gracias, quién eres, eres real, qué puedes hacer, chao, perdón, cariño, «bien/mal» tras una pregunta de ánimo | 3 µs | `charla.ts` l.258-281 [V] |
| L2 organizar y navegar | teléfono | traer, ocultar, mover, fijar, deshacer, restablecer, «qué tengo escondido» | 0,3 ms | #472 [V], sin enchufar |
| L3 preguntas por el plan | teléfono | lo que el plan dice (lista blanca) | local [S] | `conversacion.ts` l.35 [V] |
| L4 saludo y «¿cómo estás?» | teléfono + modelo | «hola», «buenas», «qué tal» | apertura al instante («Buenos días.») y espera hasta 7 s por el modelo, con libreto local si falla | `charla.ts` l.308, `conversacion.ts` l.171, 246 [V] |
| L5 deshacer por frase | servidor, sin modelo | «deshaz lo del agua» | un viaje al servidor [S] | `index.ts` l.430 [V] |
| L6 camino rápido del registrador | servidor, sin registrador | una serie con número claro de un ejercicio del plan de hoy | evita ~2 s del registrador, PERO espera al lector de riesgo | `rapido.ts` cabecera, `index.ts` l.434-441 [V] |
| L7 registro con modelo | servidor, 2 llamadas a Haiku en paralelo | todo lo demás que se anota | el más lento de los dos [S: 1 a 2,5 s] | `index.ts` l.401, 441 [V] |
| L8 consulta con ficha | servidor, en serie tras L7 | preguntas de conocimiento que contesta el portero | hasta 4 s extra, el portero está en un portátil | `portero.ts` l.8 [V], `index.ts` ~l.470 [V] |

## 3. Hallazgos

### H1. El piso de todo mensaje al servidor es el lector de riesgo con modelo

`leerRiesgoConModelo` arranca en cada mensaje (`index.ts` l.401) y la respuesta espera a `Promise.all([registrador, riesgo])` (l.441). El camino rápido (L6) quita el registrador, que es la llamada larga (hasta 800 tokens de salida con un prefijo de unos 8.800 tokens cacheado), pero la respuesta sigue esperando al lector de riesgo. La ganancia real del camino rápido es la diferencia entre los dos modelos, no los ~2 s que dice su cabecera [S, sin medir]. Esa espera es una decisión de seguridad firmada («una frase de riesgo no se pierde en silencio»), no un descuido.

### H2. Saludo y estado van al modelo por decisión de producto

`AL_MODELO = {saludo, estado}` (`charla.ts` l.308). La persona oye la apertura al instante, pero el resto del saludo espera al modelo hasta 7 s antes de caer al libreto. El libreto local (aperturas y colas por hora del día, tuteo o usted) ya existe y es hoy el respaldo.

### H3. La cola en serie después de los modelos

Tras los modelos, en orden y esperando cada una [V]: guardar el mensaje del equipo (`guardarMensajeEquipo`, l.464), el portero si la frase es consulta (l.470-473, hasta 4 s), la cola de dudas, el aviso al coach y la memoria de la charla. El diseño del enrutador (`DISENO-ENRUTADOR-REAL-20261104.md` §3, paso 7) pedía el portero EN PARALELO con el registrador; el código lo espera después. Guardar el mensaje, la cola de dudas y la memoria no cambian lo que se le contesta a la persona: no tienen por qué estar antes de la respuesta [S].

### H4. No hay datos de uso real

El reloj por pasos existe (`reloj.ts`, `meta.tiempos_ms` y una línea de registro sin la frase). No hay con qué llenarlo mientras el saldo esté en cero. Sin eso, cualquier cifra de modelos es una suposición.

### H5. La gramática de organizar reconstruye el catálogo en cada frase

333 µs por orden frente a 4 µs por frase que no es orden: la diferencia es `piezasPara`, que se recalcula en cada llamada. No importa a 0,3 ms (un cuadro de pantalla dura 16 ms), pero memoizarla por perfil la bajaría a unos 5 µs [S]. Es la última prioridad.

## 4. Optimizaciones propuestas, ordenadas

| # | Qué | Efecto esperado | Riesgo | Toca | Decide |
|---|---|---|---|---|---|
| A | «Hola» y «¿cómo estás?» se contestan en el teléfono con el libreto que ya existe, sin modelo. El modelo queda para la charla que no es saludo | De ~1 a 2 s a 0 ms en el primer mensaje del día y ahorra tokens [S] | Bajo en seguridad (pasa después del filtro); se pierde el saludo personalizado del modelo | `charla.ts` (una línea) | Bryan |
| B | La gramática de organizar y navegar (#472) responde en el teléfono sin red | 0,3 ms en lugar de un viaje al servidor [V] | Bajo: no guarda nada y riesgo gana | #472, falta enchufarla | ya decidido |
| C | Sacar del camino de la respuesta lo que no cambia la respuesta: guardar el mensaje del equipo, la cola de dudas y la memoria de la charla, con `EdgeRuntime.waitUntil` | Quita unos viajes a la base por mensaje [S] | Bajo; si el proceso se corta, se pierde una línea de etiquetado, no una respuesta | Edge Function | Bryan (despliegue) |
| D | Portero en paralelo con los modelos cuando la frase parece pregunta | Quita hasta 4 s en consultas [S] | Medio: gasta el portátil en frases que luego no son consulta | Edge Function | Bryan |
| E | Caché de consultas repetidas: la misma pregunta normalizada, con la versión de la ficha en la clave, contesta sin portero ni lectura de fichas | Casi 0 s en las preguntas que más se repiten [S] | Medio: hay que invalidar al publicar una ficha | Edge Function | Bryan |
| F | Tarjeta optimista: en el teléfono se arma YA la propuesta de las frases simples (misma gramática del camino rápido) y se muestra con «Guardar» bloqueado hasta que el servidor confirme el riesgo | La persona ve su tarjeta al instante; lo que se guarda no cambia | Medio en seguridad: hay que definir qué se muestra si el lector de riesgo marca algo después | cliente | Bryan |
| G | Lector de riesgo con modelo solo cuando el filtro local o el contexto lo pidan | Quita el piso de ~1 s | ALTO: la revisión adversarial midió que el filtro local acierta 47 % en frases nuevas; se perdería la red de seguridad | Edge Function | Bryan; NO recomendada sin medir |
| H | Memoizar `piezasPara` por perfil | 333 µs a ~5 µs [S] | Ninguno | #469 | yo |
| I | Medir antes de tocar más: 50 mensajes de prueba con los tiempos por paso (§6) | Convierte las suposiciones en cifras | Gasta saldo | ninguno | Bryan (saldo) |

Recomendación de orden: I (cuando haya saldo) en paralelo con A y C, que no cambian la seguridad. D y E después de medir. F solo si Bryan lo quiere. G, no.

## 5. Meta de velocidad propuesta [P]

| Tipo de frase | Meta |
|---|---|
| Saludo, gracias, chao, órdenes de organizar y navegar | menos de 50 ms |
| Registro simple (camino rápido) | menos de 1 s en el percentil 50 |
| Registro o charla con modelo | menos de 2,5 s en el percentil 50 |
| Consulta con ficha | menos de 3 s en el percentil 50 |

Las metas son una propuesta para que Bryan las ajuste; no hay cifras actuales con qué compararlas.

## 6. Cómo se mediría de verdad

Cuando haya saldo: 50 frases de prueba (las del formulario de Bryan y Manuela, no las inventadas por Claude), una por una, leyendo `meta.tiempos_ms` por paso (`auth`, `puesto`, `plan`, `riesgo`, `registro`, `portero`, `cola`, `total`) desde la propia respuesta, sin tocar la base. Con eso salen el piso (riesgo), el peso del registrador y del portero, y si C o D valen la pena. El umbral de éxito lo fija Bryan antes de correr.

Para saber cuáles son las frases más recurrentes en uso real: contar frases normalizadas de `praxis_mensajes_equipo` (solo equipo, 0159) y del formulario; nunca de asesorados mientras Praxis esté cerrada para ellos (P8). Todo lo que supere un umbral de repetición se evalúa para subirlo a la capa local.

## 7. Verificado y no verificado

Verificado hoy: `index.ts` l.400-470 (orden de pasos, `Promise.all`, cola en serie); `charla.ts` l.22-340 (intenciones y `AL_MODELO`); `conversacion.ts` l.22-46 y 172-262 (lo local, la apertura, el límite de 7 s); `portero.ts` l.1-60 (tiempo máximo de 4 s); `rapido.ts` cabecera; `reloj.ts`; consultas de conteo a la base y a los registros de la función; microprueba de las capas locales (con prueba temporal ya borrada).

No verificado: cuánto tardan Haiku y el portero; cuánto cuesta cada viaje a la base desde la función; el arranque en frío y la región (la función está en us-east-1 y la persona en Colombia [S: ~100 ms de ida y vuelta]); cuánto del tiempo percibido es la voz sintetizada (`hablar.ts`); si `EdgeRuntime.waitUntil` está disponible en la versión de la función desplegada.

## 8. Decisiones que le tocan a Bryan

1. ¿Saludo y «¿cómo estás?» locales sin modelo (A)?
2. ¿Se autoriza sacar del camino de la respuesta lo que no la cambia (C), con despliegue a mano?
3. ¿Portero en paralelo (D) y caché de consultas (E) después de medir?
4. ¿Tarjeta optimista en el teléfono (F)?
5. Las metas de la §5.
6. Cuándo se recarga el saldo para medir (I).
