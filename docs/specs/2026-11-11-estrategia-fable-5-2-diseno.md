# Cómo potenciar el sistema con Fable 5.2: estrategias y metodologías (diseño, sin código)

Fecha: 11-nov-2026. Estado: PROPUESTA para decidir con Bryan; no se cambió código, ni modelos, ni configuración. Marcas: [V] verificado hoy (documentación oficial de la API cargada en la sesión, o código leído, con ruta); [S] suposición o estimación mía, sin medir; [P] propuesta mía, sin firma de Bryan.

## 0. Respuesta corta

1. **Fable 5.2 no debe estar en el camino del asesorado.** Es el modelo más capaz, pero cada turno difícil puede tardar minutos y cuesta 8 y 40 dólares por millón de tokens [V]. Praxis necesita respuestas en segundos. Su lugar es detrás: juez, árbitro, diseñador de pruebas, revisor adversarial y orquestador del trabajo de los agentes.
2. **No debe ser el maestro del modelo propio.** La regla firmada del proyecto es que ningún texto de Claude entra al entrenamiento del alumno [V, plan del modelo propio]; además la propia API tiene un clasificador de rechazo para ayuda al desarrollo de modelos competidores (`frontier_llm`) [V]. Fable 5.2 juzga y filtra; DeepSeek sigue generando.
3. **La mejora más grande y más barata no es Fable 5.2, es pasar de Haiku 4.5 a Haiku 5.5.** Todo lo que corre hoy en producción usa `claude-haiku-4-5` [V, `registro/prompt.ts` l.15]. Haiku 5.5 cuesta una décima parte por token (0,10 y 0,50 dólares) [V] y su caché mínima baja de 4.096 a 512 tokens [V], con lo que el lector de riesgo (~1.600 tokens) por fin se puede cachear [S sobre el beneficio].
4. **Antes de cualquier cambio de modelo hay que medir con lo que ya existe**: el corpus de 240 casos con puertas duras (`scripts/praxis-eval`), el oro de 75 frases de riesgo y el banco del ingreso [V]. Sin eso, un modelo nuevo puede mejorar el promedio y romper la regla «riesgo 0 de 75».
5. **Lo que no destraba un modelo mejor**: las firmas, el saldo, las lecturas de Bryan, el permiso de Kaggle. Según el mapa de cuellos de botella, la mayoría son de proceso, no de calidad [V, informe del pipeline].

## 1. Qué es Fable 5.2 (verificado en la documentación oficial de la API)

| Dato | Valor |
|---|---|
| Identificador | `claude-fable-5-2` |
| Contexto y salida | 1 millón de tokens de contexto; hasta 128 mil de salida |
| Precio | 8 dólares de entrada y 40 de salida por millón de tokens; lectura de caché 0,20; en lote 4 y 20 |
| Razonamiento | Siempre encendido; se controla con el nivel de esfuerzo (`low`, `medium`, `high`, `xhigh`, `max`); Anthropic recomienda empezar en `high` |
| Parámetros prohibidos | `temperature`, `top_p`, `top_k`, relleno de la respuesta (prefill), herramienta forzada (`tool_choice` `any`/`tool`): devuelven error 400 |
| Rechazos | Puede devolver `stop_reason: "refusal"` con categorías (`cyber`, `bio`, `frontier_llm`, `reasoning_extraction`, `general_harms`); hay respaldo de servidor (`fallbacks`) hacia Opus |
| Datos | **Requiere retención de 30 días; no sirve con retención cero** (da error 400) |
| Otros límites | Sin Priority Tier; velocidad rápida a 16 y 80 dólares; límite de uso propio |
| Consejos de uso | A nivel `high` piensa antes de casi toda respuesta, incluso un saludo; las instrucciones de «piensa menos» no funcionan desde `medium`; a nivel bajo se detiene antes de terminar tareas largas |

Haiku 5.5 (el que importa para producción) [V]: `claude-haiku-5-5`; 0,10 y 0,50 dólares con prompts de hasta 100 mil tokens (0,50 y 2,50 por encima); 1 millón de contexto; razonamiento adaptativo encendido por defecto; esfuerzo por defecto `medium`; **acepta la herramienta forzada** (pero entonces no piensa antes de llamarla); rechaza `temperature` distinto de 1, `top_p` y `top_k` (error 400); el mismo texto cuenta unos 30 % más de tokens; los rechazos de seguridad son nuevos para quien viene de Haiku 4.5 y **no tiene respaldo de servidor**.

## 2. Cómo está hecho el sistema hoy (revisión de la estructura)

**Aplicación** [V, informe de lectura]: PWA React y TypeScript con Supabase. `src/domain/praxis` tiene 87 archivos y unas 14.900 líneas con sus pruebas. Cuatro Edge Functions: `praxis-registro` (6 archivos, 1.239 líneas), `responder-chat`, `avisos-plan`, `alta-cliente`. 137 migraciones.

**Llamadas a modelos** [V]: todas a `claude-haiku-4-5`, ninguna a un modelo mayor.

| Uso | Qué hace | Detalle relevante |
|---|---|---|
| Registrador | Entrena, comida, vida y charla en una sola llamada | herramienta `registrar` forzada; `temperature` 0; 800 tokens de salida; prefijo de ~8.800 tokens cacheado |
| Lector de riesgo | Clasifica riesgo de cada mensaje | 200 tokens de salida; prefijo de ~1.600 tokens SIN caché; corre en todo mensaje |
| Ingreso | Etiqueta el cuestionario inicial | dos llamadas por turno |
| Juez de la cola de dudas | Elige una ficha para el equipo | nunca afecta la respuesta |
| Portero | Elige la ficha que contesta una consulta | servicio externo en un portátil, con límite de 4 s |

**Evaluación** [V]: `scripts/praxis-eval` con 240 casos ficticios (80 entreno, 80 nutrición, 60 vida, 20 difíciles) y puertas duras (derivación clínica 100 %, cero números inventados, preguntas necesarias 100 %); banco del ingreso con corridas por semilla; pruebas con modelo simulado y mutantes. **No hay juez de calidad con modelo en el repositorio.**

**Cadena de agentes** [V]: cuatro pasos y una lupa (valoración, planificación, prescripción, ejecución, discrepancia), con contratos entre pasos, validadores deterministas y baterías de mutación. Jerarquía de modelos escrita en Hermes (script, Qwen local, Haiku, Sonnet, Opus); Fable 5.1 «no se usa salvo orden de Bryan».

**Modelo propio** [V]: DeepSeek genera las respuestas-maestro; Claude solo juzga (sí o no) y construye herramientas; el alumno es un modelo pequeño. Cifras vigentes: sostén 31 de 41 (75,6 %) frente a una vara de 95 %; latencia 68,8 s frente a 4 s pedidos; las tandas 6 y 7 aceptaron 3 de 18 ejemplos; en esa corrida cerca del 80 % de los rechazos eran del filtro o del revisor, no del generador.

**Reglas duras** [V]: «riesgo 0 de 75, sin excepción»; ningún dato de asesorados sale a un servicio externo sin autorización; nada a producción sin orden de Bryan; el filtro de riesgo va antes de cualquier modelo.

## 3. Qué dice la investigación reciente (búsqueda web de hoy; no verifiqué las cifras de cada trabajo)

- **Destilación**: los trabajos de 2026 prefieren verificadores objetivos (pruebas de código, reglas) a un modelo que haga de juez, porque el juez tiende a favorecer lo suyo; filtrar cambia la distribución que aprende el alumno; sirve más muestrear más candidatos y verificar con más presupuesto.
- **Jueces con modelo**: pueden ser muy consistentes entre corridas y aun así tener sesgo de posición; permutar el orden de las opciones del rubro lo reduce y acerca el juez al humano; se recomienda una auditoría de 100 a 300 casos contra marcas humanas.
- **Más cómputo al responder**: tiene techo; subir el esfuerzo cuesta mucho más en tareas fáciles; conviene gastar más solo en las decisiones difíciles.

Prueba local de la misma lección [V]: hoy la gramática de organizar la app subió a 92 % en las frases con que se afinó y a 71 % en las frases de examen que no se usaron. Una cifra sin examen aparte se infla.

## 4. Estrategias y metodologías

### E1. Pasar la producción de Haiku 4.5 a Haiku 5.5 (la mejora con mejor relación)

Qué cambia en el código [V, guía de migración]: quitar `temperature: 0` de las llamadas (hoy da error 400 en Haiku 5.5); fijar `effort` explícito (`low` para el lector de riesgo, `medium` para el registrador, a probar); subir `max_tokens` porque el razonamiento cuenta; leer los bloques de respuesta por tipo, no por posición; recontar tokens (~30 % más); tratar `stop_reason: "refusal"` como una señal.

**Regla de seguridad propia [P]:** un rechazo del lector de riesgo se trata como riesgo (se falla cerrando hacia la derivación), nunca como «sin riesgo». El clasificador de rechazos es nuevo para este uso y su comportamiento con frases de angustia o violencia hay que medirlo.

Cómo se decide: se corre el mismo corpus de 240 casos, el oro de 75 y el banco del ingreso con Haiku 4.5 (línea base) y con Haiku 5.5 en dos niveles de esfuerzo. Pasa solo si cumple las puertas duras y los 75 de 75. Se mide también tiempo por llamada y costo por mensaje. Costo orientativo del lector de riesgo por mensaje [S]: ~0,003 dólares con Haiku 4.5 y ~0,0004 con Haiku 5.5. Una corrida completa del corpus cuesta del orden de 0,3 dólares frente a ~3 [S].

### E2. Portero dentro de la API, sin depender del portátil

Idea [P]: con 1 millón de contexto y caché de 512 tokens, las fichas publicadas (sin las de salud) caben en un prefijo cacheado y Haiku 5.5 elige la ficha; así se elimina el portátil y su límite de 4 s. Se mide contra el examen de búsqueda (64 más 6 casos, hoy 88 %) y contra la meta de 18 de 20. Primero se cuentan los tokens reales de las fichas (`count_tokens`). Riesgo: las fichas con bandera de salud siguen fuera.

### E3. Fable 5.2 como juez y árbitro escalonado, no como maestro

Metodología [P], basada en el juez ciego que ya existe (calibrado contra marcas humanas, defectos sembrados):
1. Un juez barato (Sonnet 5.5) califica todo; Fable 5.2 solo arbitra los casos donde el juez barato y la marca humana discrepan, o donde la confianza es baja (gastar cómputo solo en lo difícil).
2. Se permuta el orden de las opciones del rubro y se promedia (sesgo de posición).
3. Antes de confiar: auditoría de 100 a 300 casos contra marcas de Bryan; exigir acierto de 90 % o más y cero «sí» donde la persona dijo «no» (la regla ya vigente).
4. Se mantienen los defectos sembrados: si el juez deja pasar uno, se detiene la tanda.
5. Trabajo no urgente en lote (la mitad del precio, 4 y 20 dólares).
Regla que se respeta: el juez solo clasifica sí o no y razona sobre texto ficticio o con código; ningún texto de Claude entra al entrenamiento. Se revisan los términos de uso antes de ampliar este papel.

### E4. Auditar los filtros antes de gastar más en el generador

Lección del 9-nov [V]: el 80 % de los rechazos eran del filtro o del revisor. Estrategia [P]: Fable 5.2 lee los casos rechazados (ficticios) y marca «rechazo correcto» o «rechazo injusto», con la regla de explicar la causa; se recalibran los filtros con eso y se mide de nuevo la tasa de aceptación. Es la forma más barata de subir las tandas de 3 de 18 sin tocar a DeepSeek.

### E5. Verificadores objetivos primero, jueces después

Principio de la investigación y del proyecto [V]: lo que se puede comprobar con reglas no se le pregunta a un modelo. Fable 5.2 es muy útil para ESCRIBIR validadores y pruebas de mutación (revisar el filtro clínico, la taxonomía, los resolutores) y para atacar a los existentes (revisión adversarial, como la de esta semana, que encontró un error alto en la gramática de organizar).

### E6. Seguridad: revisión adversarial y arbitraje de riesgo

[P] Usar Fable 5.2 para: (a) atacar el filtro de riesgo local, que según una revisión acierta solo 47 % en frases nuevas, y proponer ampliaciones para que las firme un profesional de salud mental; (b) arbitrar los dos casos de riesgo pendientes del alumno («embaraz» dentro de una frase que deriva); (c) generar casos difíciles para el oro, que sirve solo para evaluar y nunca para entrenar. Límite: Fable 5.2 no sustituye el lector de riesgo en producción; la lectura con modelo sigue siendo la red de seguridad.

### E7. Cadena de agentes (Hermes): revisor de frontera para casos de frontera

[P] En el piloto mínimo, usar Fable 5.2 como único revisor adicional en los casos donde hoy se escala a Opus (veredictos de frontera, decisiones de seguridad y clínica, síntesis). Condición previa: que el custodio de datos confirme qué parte del dossier puede salir a la API y bajo qué retención, porque Fable 5.2 exige retención de 30 días y no admite retención cero.

### E8. Cómo se trabaja con agentes (metodología de desarrollo)

[V guía de prompting de Fable 5.2, aplicada] 1) Un orquestador (Fable 5.2 con esfuerzo `high`) con trabajadores Sonnet 5.5 en segundo plano: ya es la regla de memoria; mantenerla. 2) Probar primero y ajustar con tres conjuntos: ajuste, validación y prueba (como se hizo hoy con las frases a ciegas). 3) Revisar instrucciones heredadas: el modelo sigue de cerca las precauciones acumuladas, así que auditar `CLAUDE.md`, la memoria y las skills para quitar las que ya no valen (el índice de memoria pasa de 100 entradas). 4) Mantener la historia de la conversación solo añadiendo, no editando, para no romper el razonamiento guardado. 5) Para tareas largas sin supervisión, añadir un párrafo de «terminar el trabajo» y vigilar paradas tempranas.

### E9. Velocidad (resumen; detalle en el PR #476)

Haiku 5.5 más caché del lector de riesgo, saludo local, guardado después de responder, portero en paralelo, caché de consultas repetidas; Fable 5.2 nunca en el camino de la persona.

## 5. Lo que NO se debe hacer

| No hacer | Por qué |
|---|---|
| Entrenar el modelo propio con texto de Claude | Regla firmada del plan; además existe el clasificador `frontier_llm` y los términos de uso |
| Mandar datos reales de asesorados a Fable 5.2 sin permiso del custodio | Exige retención de 30 días; la regla de privacidad del proyecto |
| Quitar el lector de riesgo con modelo para ganar velocidad | Choca con «riesgo 0 de 75»; el filtro local acierta 47 % en frases nuevas |
| Poner a Fable 5.2 a juzgar a un alumno de su propia familia | Sesgo de autopreferencia; hoy el alumno es de otra familia, hay que mantenerlo así |
| Subir todo a esfuerzo `max` | Cuesta hasta decenas de veces más en tareas fáciles y tiene techo |
| Cambiar de modelo sin correr el corpus y el oro antes | Un promedio mejor puede esconder un fallo de seguridad |

## 6. Hoja de ruta propuesta (con costo orientativo [S])

| Fase | Qué | Gasto | Depende de |
|---|---|---|---|
| 0 | Inventario de compatibilidad con Haiku 5.5 en el código (parámetros, `max_tokens`, bloques, rechazos); PR en borrador, sin desplegar | 0 | nada |
| 1 | Medir Haiku 4.5 contra Haiku 5.5 en corpus de 240, oro de 75 y banco del ingreso, con dos niveles de esfuerzo | ~1 a 5 dólares | saldo de Anthropic (hoy en cero) |
| 2 | Portero con fichas en el prefijo cacheado, contra el examen de búsqueda | ~1 dólar | fase 1 |
| 3 | Juez escalonado con Fable 5.2 para arbitrar; auditoría de filtros del corpus | ~10 a 25 dólares por ronda de 200 juicios [S] | fase 1 y permiso de Bryan |
| 4 | Velocidad: saludo local, guardado después de responder (PR #476) | 0 | decisiones de Bryan |
| 5 | Revisor de frontera en Hermes | por definir | custodio de datos |

El costo de Fable 5.2 de la fase 3 es una estimación (supuse 3.000 tokens de entrada, 300 de salida y 2.000 de razonamiento por juicio); se mide en la primera ronda.

## 7. Qué hay que decidir

1. ¿Se autoriza la fase 1 (medir Haiku 5.5) y recargar saldo de Anthropic para correrla?
2. ¿Fable 5.2 entra como juez y árbitro escalonado (fase 3), con la regla de que ningún texto suyo entra al entrenamiento?
3. ¿Se pide primero al custodio de datos y a un profesional de salud que revisen qué puede ver Fable 5.2 en Hermes y en riesgo?
4. ¿Qué rechazo del lector de riesgo cuenta como riesgo (propuesta: todos)?

## 8. Verificado y no verificado

Verificado hoy: la documentación oficial de la API cargada en la sesión (modelos, precios, parámetros, migración a Haiku 5.5 y Fable 5.2); los informes de lectura del código de la aplicación y del pipeline (rutas citadas); la búsqueda web (tres consultas estándar).

No verificado: los resultados de los trabajos citados (leí resúmenes, no los artículos); el comportamiento de Haiku 5.5 con nuestras frases, sobre todo del clasificador de rechazos; tiempos reales de cualquier modelo (no hay tráfico); el costo real de las fichas en tokens; qué modelo usa cada paso de la cadena (no está fijado en los comandos); si la regla de privacidad ya autoriza el uso de la API de Anthropic con dossiers reales; que los términos de uso permitan el papel de juez en el filtrado del corpus.

No encontré: una carpeta propia de artículos sobre modelos de frontera; un juez de calidad con modelo en el repositorio; el banco del «riesgo 0 de 75» dentro del repositorio de la aplicación (vive en la biblioteca de Praxis).
