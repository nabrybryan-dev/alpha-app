# Biblioteca de Praxis: búsqueda híbrida y respuestas con respaldo (31-oct-2026)

## Pedido

Bryan, 31-oct: aprobó cuatro temas (técnicas de intensidad, series por semana, periodización y velocidad de la
barra) y pidió que la biblioteca se construya con las referencias de quienes crean estos modelos, con bases
vectoriales actualizadas, respuestas eficientes y ajustadas a lo preguntado, y no robóticas.

Aprobar los temas es una decisión, no una firma. Cada pieza sigue en borrador hasta que Bryan la revise.

## Lo que ya existe (comprobado el 31-oct)

- Supabase: pgvector 0.8.2, `pg_trgm` y `unaccent` activos. `fichas_respuesta.embedding` usa 1536 dimensiones de OpenAI `text-embedding-3-small`, con `buscar_ficha`.
- Portero: tabla de frecuentes y n-gramas en el portátil; e5-large en camilin cuando está encendido. Examen v2: cobertura 74,4 %, acierto 94,7 % (TAXONOMIA 6.20).
- `praxis-registro` v22 con respaldo sin modelo. Usa `claude-haiku-4-5`.
- `F:/alpha-corridas/_estado/praxis-entrenamiento-20261010/biblioteca`: 8.608 piezas sin revisar, que aciertan el tema de 2 a 4 de cada 10. No se reutilizan como respaldo.

## Referencias

| Fuente | Qué aporta | Nivel |
|---|---|---|
| [Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) | Contexto por pieza, búsqueda por palabras más vectores, fusión por rangos y reordenado. Fallos de recuperación entre las 20 primeras: 5,7 % a 2,9 % con contexto híbrido y 1,9 % con reordenado | Medido por el autor en sus corpus, no en español ni en el nuestro |
| [Supabase, Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search) | Plano del esquema: `tsvector`, GIN, HNSW y fusión con `rrf_k = 50`. El ejemplo usa `english`: aquí será `spanish` | Documentación oficial |
| [pgvector](https://github.com/pgvector/pgvector) | HNSW, `halfvec`, y filtrado con búsquedas iterativas (desde 0.8.0) | Documentación oficial |
| [Robustez de embeddings multilingües, arXiv 2605.31142](https://arxiv.org/pdf/2605.31142) | En recuperación en español destacan `bilingual-embedding-large` y `jina-embeddings-v3` | Un estudio; visto solo en el resumen de la búsqueda, falta leerlo |
| [RAG, LoRA y DoRA, arXiv 2502.10497](https://arxiv.org/pdf/2502.10497) | RAG para anclar el conocimiento y LoRA para adaptar a menor costo | Un estudio; visto solo en el resumen de la búsqueda |

Los reordenadores abiertos (`bge-reranker-v2-m3`, Qwen3-Reranker) solo tienen cifras de terceros o de proveedores: se medirían aquí antes de elegir.

## Decisión de diseño

1. **Piezas curadas, no archivos crudos.** Cada pieza responde una idea, con su fuente y un contexto corto al inicio. Sin nombres del equipo, asesorados ni rutas internas.
2. **Tabla `praxis_conceptos`**, separada de las fichas, con `estado` (`borrador` o `aprobada`). Solo lo aprobado se busca. Solo el equipo lee.
3. **Búsqueda híbrida.** `tsvector` con `spanish`, más vectores, con fusión por rangos. Los vectores van en HNSW, aunque con tan pocas piezas una búsqueda exacta también serviría: se mide la latencia antes de decidir.
4. **Reordenador solo si la medida lo pide.** Son pocas piezas: añadirlo sin evidencia es complejidad sin beneficio.
5. **Respuesta con Haiku.** Solo con las piezas recuperadas, con cita de su fuente, en la voz de Praxis y adaptada a lo preguntado. Sin respaldo, dice que no lo sabe y la duda va a la cola. Se evalúa `claude-haiku-5-5` para esta capa nueva: según la tabla de precios del 6-oct cuesta una décima parte que `claude-haiku-4-5` (comprobar el precio y su disponibilidad antes). El lector de riesgo no cambia de modelo sin repetir su medida.
6. **No se entrena una red desde cero.** Con este volumen no compite. La vía sigue siendo la del 10-oct: el circuito datos, entrenar, medir y guardar sobre un modelo ya entrenado. LoRA se reconsidera cuando haya respuestas corregidas por Bryan.

## Decisión abierta: quién convierte la pregunta en vector

| Opción | A favor | En contra |
|---|---|---|
| OpenAI `text-embedding-3-small` | Ya en uso, sin máquina propia | Texto del equipo a otro proveedor; depende de pago |
| e5-large en camilin | Propio, el mejor medido | Solo cuando camilin está encendido (hoy no respondió) |
| Modelo pequeño en el portátil de Manu | Propio, siempre encendido | Memoria justa: MiniLM ocupa 575 MB de ~1 GB libre |

Se compara con el examen de abajo antes de pedirle la decisión a Bryan.

## Criterio, fijado antes de medir

Examen pequeño de partida: 20 preguntas de entreno escritas a mano para las piezas aprobadas, más 10 sin respaldo. Sirve para probar el circuito. **Se sustituye por dudas reales de la cola en cuanto existan** (Bryan: nada de más síntesis).

| Medida | Mínimo |
|---|---|
| La pieza correcta entra entre las 5 primeras | 18 de 20 |
| Preguntas sin respaldo que Praxis se niega a contestar | 9 de 10 |
| Cada afirmación de la respuesta sale de una pieza citada (lectura de una persona) | 19 de 20 |
| Frases de riesgo o salud que llegan a la búsqueda | 0 |
| Respuesta completa, mediana | 4 s o menos |

«Que no suene robótica» no se mide con un porcentaje: Bryan lee 10 respuestas y las marca. Si no pasan, se ajusta el prompt, no la búsqueda.

## Orden

1. Borrador de piezas y revisión de Bryan.
2. Migración y carga de lo aprobado.
3. Búsqueda híbrida y examen, sin modelo de respuesta.
4. Respuesta con Haiku, cuando haya saldo. Cada paso que toque producción, con su sí.

Asesorados: fuera. Siguen las condiciones de `acceso.ts`.
