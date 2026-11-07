# Conectores: de lo que la persona cuenta al check-in medible (diseño, 7-nov-2026)

Estado: DISEÑO. Sin código, sin migración, sin publicar. Rama `praxis/conectores-checkin` sobre main 0236b22a.

Pedido de Bryan (7-nov, `LO-YA-HECHO-PRAXIS.md` última fila): Praxis debe tener «conectores» rigurosos que conviertan lo que la persona cuenta de su estilo de vida, en mensajes largos y poco medibles («estoy ahí», «como medio», «no tan bien»), en las respuestas medibles de cada pregunta del check-in, amoldándose a cómo lo dice cada persona. La frase va como cita y la persona confirma antes de guardar.

Marcas: [V] verificado en el código de main 0236b22a con ruta y línea. [R] verificado en la rama de #442 (`origin/praxis/ranuras-en-charla`). [P] propuesta, sin decidir.

## 1. Las preguntas reales del check-in

Fuente: `src/features/bienestar/CheckinForm.tsx` [V]. Tipos: `src/domain/types.ts:545-600` [V].

| # | Pregunta en pantalla | Campo | Escala | Obligatorio | Línea |
|---|---|---|---|---|---|
| 1 | Peso ayunas | `pesoKg` | 30-250 kg, paso 0,1 | no (y oculto si `verComposicion` es falso) | 209 |
| 2 | Pasos de ayer | `pasos` | 0-100.000, paso 500 | no | 213 |
| 3 | ¿Qué entrenaste hoy? | `entreno` | texto libre | no | 218 |
| 4 | ¿Cómo estuvo tu rendimiento? | `rendimiento` | MALA / REGULAR / BUENA | sí | 222 |
| 5 | Motivación | `motivacion` | POCO / REGULAR / MUCHO | sí | 223 |
| 6 | Hambre de hoy | `hambreEscala` | 1-10; tramos leve 1-3, moderada 4-6, intensa 7-8, insostenible 9-10 (`senales/hambre.ts:29-32`) | sí | 224 |
| 7 | Cansancio | `cansancio` | POCO / REGULAR / MUCHO | sí | 225 |
| 8 | Estrés | `estres` | POCO / REGULAR / MUCHO | sí | 226 |
| 9 | Dolor de hoy | `dolor` + `dolorDonde` | 0-10 (EVA); tramos ninguno 0, leve 1-3, moderado 4-6, intenso 7-10 (`senales/dolor.ts:29-32`); con dolor > 0 el dónde es obligatorio | sí | 227, 138 |
| 10 | Horas de sueño | `horasSueno` | 0-14, paso 0,5 | trae 7 puesto; cuenta como anotado solo si se movió (`anotadoHoy`) | 233, 151 |
| 11 | Me acosté / me levanté a las | `horaAcostarse`, `horaLevantarse` | HH:MM | no | 241-258 |
| 12 | Calidad del sueño | `calidadSueno` | MALA / REGULAR / BUENA | sí | 261 |
| 13 | ¿Cómo estuvo tu alimentación? | `alimentacion` | MALA / REGULAR / BUENA | sí | 262 |
| 14 | Comentarios para tu coach | `comentarios` | texto libre | no | 264 |

Los 8 obligatorios son los cualitativos (`CheckinForm.tsx:136`): rendimiento, motivación, hambre, cansancio, estrés, calidad del sueño, alimentación y dolor. Sin ellos el formulario no guarda.

Dos polaridades que el conector debe respetar: en `cansancio` «mucha energía» es POCO (`vida.ts:31`); en `estres` «tranquila» es POCO (`vida.ts:36`). Un «no tan bien» no se puede pasar a un campo sin saber cuál, porque el sentido se invierte según el campo.

## 2. Lo que ya existe y se reutiliza

| Pieza | Qué hace | Qué le falta para este pedido |
|---|---|---|
| `registro/vida.ts` (en producción) | Tablas cerradas por campo: CANSANCIO, ESTRES, RENDIMIENTO, ALIMENTACION (`vida.ts:28-48`), `calidadDeSueno` (56-65), ganas de entrenar (68-74), hambre solo con número 1-10 (264-270), dolor solo el cero explícito (87-97, 331-334) [V] | No conoce lo vago: «estoy ahí», «como medio», «no tan bien», «ahí vamos» no están en ninguna tabla, así que hoy se descartan |
| `registro/mensajeLargo.ts` (#424, en sombra) | Filtro de riesgo primero; parte el texto en trozos; decide el área por palabras; aplica la tabla de `vida.ts`; cita literal; dos valores distintos del mismo campo quedan «dudosos»; negación fuera de tabla se descarta (`mensajeLargo.ts:86-153`) [V] | Un trozo vago sin palabra de área («estoy ahí») no tiene área y se pierde; no usa la pregunta anterior de Praxis; no distingue «hoy» de «normalmente» |
| `charla/ranuras.ts` (#442, abierto, bandera apagada) | Cita literal + número de turno; lo clínico por oración va «al coach» y no llena nada; correcciones quedan dudosas; una pregunta por turno, abierta, enlazada a lo último dicho; resumen final con las palabras de la persona [R] | Sus 13 ranuras son de PERFIL (lo habitual: objetivo, días, trabajo…), no del día. Solo dos se cruzan con el check-in: `sueno_horas` y `estres`, y `estres` usa otra escala (bajo/medio/alto, no POCO/REGULAR/MUCHO) [R] |
| `CAMBIO-PROPUESTO-TABLA-MENSAJE-LARGO-20261105.md` | Palabras nuevas propuestas (pesado, duro, genial…) | Sin firma; Bryan aprueba por muestra |

Conclusión: no hace falta un tercer extractor. Hace falta una capa que (a) dé área a lo vago usando el turno anterior, (b) separe hoy de lo habitual, (c) traduzca lo vago a un candidato con confianza baja que SIEMPRE se confirma, y (d) aprenda de las confirmaciones de cada persona.

## 3. El conector, paso a paso

Un conector por pregunta del check-in. Todos pasan por el mismo orden:

1. **Riesgo primero.** `filtroDeRiesgo` sobre el texto entero (como hoy en `mensajeLargo.ts:87`). Si marca, nada se extrae.
2. **Clínico por oración.** La oración con dolor, lesión, medicación o diagnóstico no llena ningún campo y va «al coach» (regla de `ranuras.ts`, `clinicoDe`) [R]. El dolor > 0 nunca se escribe por Praxis (`vida.ts:12-13`) [V].
3. **Tiempo: hoy o habitual.** «Anoche dormí seis», «hoy estoy cansada» → check-in. «Duermo como seis», «siempre ando estresado» → ranura de perfil (#442), no check-in. Sin marca de tiempo se lee como de hoy: la tarjeta muestra la fecha y la persona confirma. Preguntar «¿esto es de hoy?» en cada trozo volvería la charla un cuestionario (criterio del 6-nov). Construido así en el paso 1.
4. **Área.** Primero por palabras (lo que ya hace `mensajeLargo.ts`). Si el trozo es vago y no nombra el área, se toma del turno anterior de Praxis solo cuando ese turno fue una pregunta de un único campo («¿Y el estrés, cómo vas?» → «ahí, como medio» = estrés). Si la pregunta anterior tocaba dos campos, o no hubo pregunta, el trozo queda sin área y no se usa. [P]
5. **Grado.** Tres niveles de origen, en este orden:
   - **Tabla cerrada** (la de `vida.ts`, más lo que Bryan apruebe de la propuesta del 5-nov). Confianza media, como hoy.
   - **Lexicón de lo vago** [P], nuevo y separado de `vida.ts`, con valor de grado, no de campo:

     | Forma (normalizada) | Grado propuesto | Confianza |
     |---|---|---|
     | ahí / estoy ahí / ahí vamos / ahí voy | medio | baja |
     | como medio / medio / más o menos / normal / regular | medio | baja |
     | no tan bien / no muy bien / no del todo | medio-bajo (entre REGULAR y MALA) | baja: se pregunta entre las dos |
     | no tan mal / no me fue mal | medio | baja |
     | bien no más / bien nada más | medio-alto (entre REGULAR y BUENA) | baja: se pregunta entre las dos |

     El grado se traduce a la escala del campo con su polaridad: «medio» en estrés = REGULAR; «no tan bien» de energía = cansancio entre REGULAR y MUCHO. Esta tabla es de IA, sin firma: Bryan la aprueba por muestra (regla del 11-oct).
   - **Lexicón de la persona** (sección 5). Solo sube la confianza; nunca evita la confirmación.
6. **Números.** Hambre y dolor no se sacan de palabras. «Hambre como medio» no es un 5: se pregunta con los tramos del formulario como opciones («Molesta, pero se lleva» 1-3 · «Cuesta, distrae» 4-6 · «Interfiere» 7-8 · «No la puedes sostener» 9-10, `CheckinForm.tsx:352-357`) y luego el número dentro del tramo. Sueño y pasos: solo con cifra (como hoy). Ojo: `numeros.ts:125` lee «medio» como 0,5; el conector debe impedir que «como medio» se convierta en 0,5 horas o 0,5 de hambre (prueba negativa obligatoria).
7. **Conflictos y correcciones.** Dos valores distintos del mismo campo o un «mejor dicho» quedan dudosos (reglas ya existentes en `mensajeLargo.ts:143-151` y `ranuras.ts`).
8. **Salida: una tarjeta, nunca un guardado.** Por campo: valor propuesto, la cita literal, de dónde salió (tabla, vago o «como lo dices tú»), y las tres opciones del formulario para cambiarlo. Botones: «Sí, así» · «Cambiar» · «No anotar».

## 4. Lo que falta del check-in: conversar, no interrogar

Después de la tarjeta, Praxis mira cuáles de los 8 obligatorios siguen vacíos y pregunta UNO por turno, con pregunta abierta enlazada a lo último que dijo la persona (criterio del 6-nov y regla de `siguientePregunta` en #442). Nunca un formulario en voz. Si la persona no quiere seguir, se guarda lo confirmado como parcial (sección 6).

## 5. Amoldarse a cada persona [P]

- Cada vez que la persona confirma o corrige un valor, se guarda el par (forma normalizada, campo, valor final). Ejemplo: alguien dice «estoy ahí» y elige REGULAR en estrés tres veces seguidas.
- Regla propuesta: con 3 confirmaciones iguales y 0 correcciones para la misma forma y campo, la tarjeta llega con ese valor preseleccionado y la etiqueta «como lo dices tú». Una corrección la vuelve a cero. Nunca se guarda sin tarjeta.
- Es por persona y aislado: el lexicón de una persona no se usa con otra, ni entra al entrenamiento del modelo propio (las frases son de asesorados; «nada del laboratorio a asesorados» y P8).
- Necesita tabla nueva (`praxis_lexico_persona`, migración 0168 si sigue libre) con RLS solo dueño. Se escribe en rama, sin aplicar. Sin la tabla, todo lo demás funciona; solo no aprende.

## 6. Guardar y el check-in a medias

Hechos [V]:
- Cualquier fila del día cierra el formulario: `BienestarPage.tsx` pinta «Registrado — buen hábito +10 XP» si existe `deHoy` (líneas 37 y 77-85), sin mirar qué campos trae.
- Los puntos cuentan filas: `useGamificacion.ts:93-94` pasa `checkins.length` a `calcularXp`, y cada check-in vale 10 (`gamification.ts:59-60`). Hay otro conteo en el servidor que llega a `hidratar.ts:595` (no lo abrí).
- Por eso Praxis hoy no guarda check-in: `guardado.ts:110` devuelve P2 («una fila parcial cierra el formulario del check-in y da XP»).

Diseño [P]:
- Marca `datos.parcial = true` dentro del jsonb (no pide migración de `checkins`, `types.ts:560-562`) mientras falte alguno de los 8 obligatorios.
- Con la marca, la pantalla de Bienestar NO muestra «Registrado»: abre el formulario con lo confirmado ya puesto. Al completar los 8 (por Praxis o a mano), se quita la marca.
- Guardado por el libro (0161) con una función nueva tipo `praxis_aplicar_checkin`: fusión `datos || parche`, `antes` por campo, `auth.uid()`, clave única por mensaje, y añade a `anotadoHoy` lo que Praxis anotó. Migración nueva, sin aplicar.
- Decisión del 7-nov que cambia código existente: no se crean días futuros. Hoy `vida.ts:239-240` y `:339` mandan los pasos dichos después de las 20:00 a la fila de mañana (`diferido`). Debe quedar en espera hasta que se abra ese día.

**DECIDIDO por Bryan (7-nov, selector): opción a.** Un check-in a medias no da puntos; al completar los 8 obligatorios da los 10 de siempre. Opciones que se presentaron:
- a) No da puntos hasta completar los 8; luego da los 10 de siempre. (Recomendada: así los puntos siguen premiando el check-in completo que lee el coach, y un «estoy ahí» no vale lo mismo que el formulario lleno.)
- b) Da 5 puntos al guardar lo parcial y 5 más al completar (como la adherencia parcial, `gamification.ts:63`).
- c) Da los 10 con cualquier dato, como hoy.

## 7. Pruebas que deben existir (antes del código)

Positivas:
- «¿Y el estrés?» → «ahí, como medio» = estrés REGULAR, confianza baja, cita «ahí, como medio».
- «Dormí 6 horas pero no tan bien» = horas 6; calidad entre REGULAR y MALA, preguntada.
- Tres confirmaciones iguales de «estoy ahí» → la cuarta llega preseleccionada.

Negativas (cada una debe fallar con el código de hoy o con una mutación):
- «Estoy ahí» sin pregunta previa no llena nada.
- «Como medio» nunca da 0,5 horas ni hambre 0,5.
- «Hambre como medio» no da un número; pregunta por tramo.
- «Siempre duermo seis» no escribe el check-in de hoy.
- «No tan bien» con pregunta de energía no da POCO en cansancio (polaridad).
- Oración con dolor de rodilla no llena ningún campo.
- El lexicón de la persona A no aparece en la tarjeta de la persona B.
- Una fila parcial no cierra el formulario ni suma puntos (si Bryan elige a).
- Pasos dichos a las 21:00 no crean la fila de mañana.

Las frases de prueba son inventadas por IA y no sirven para entrenar el modelo propio.

## 8. Orden de construcción [P]

1. Lexicón de lo vago + área por turno anterior + tiempo hoy/habitual, puro y en sombra dentro de `mensajeLargo.ts` (sin tokens de pago, sin base).
2. Tarjeta de confirmación por campo (pantalla), detrás de bandera.
3. Marca parcial en la app y la decisión de puntos.
4. Función de guardado por el libro (migración nueva, sí de Bryan para aplicar).
5. Lexicón por persona (migración nueva, sí de Bryan).

Las piezas 1-2 no dependen del saldo de Anthropic: la extracción es por tablas. Lo que sí depende es la frase libre que hoy procesa Haiku en `proponer`.

## 8b. Paso 1 construido (7-nov)

`src/domain/praxis/registro/conectores.ts` (`conectarMensaje`) y `conectores.test.ts` (14 casos; 6 mutaciones, las 6 caen). Puro, sin enchufar: ni la función ni la app lo llaman todavía. Dos cosas que se vieron al probar:
- `filtroDeRiesgo` ya manda a la ruta de salud cualquier mensaje con «dolor» o «me duele» (devuelve `{ tipo: 'salud', filtro: 'dolor' }`). El conector no ve esos mensajes: más estricto que lo que suponía la sección 3.
- `mensajeLargo.ts` no reconoce «duermo» como sueño (su patrón es `dorm\w*`). «Siempre duermo fatal» no da nada, ni de hoy ni habitual. Queda como hueco conocido; no se tocó `mensajeLargo.ts`.

## 9. Decisiones que son de Bryan

1. ~~¿Un check-in a medias da puntos?~~ Decidido: no hasta completar (sección 6).
2. Aprobar por muestra el lexicón de lo vago (sección 3, paso 5).
3. Regla de «como lo dices tú»: 3 confirmaciones iguales y ninguna corrección (sección 5).
4. Que el lexicón por persona exista (tabla nueva con datos de asesorados, solo dueño).

## 10. No verificado

- El conteo de check-ins del servidor que llega a `hidratar.ts:595` (qué RPC lo calcula y si mira campos).
- Si `readiness.ts` o `bucleDelDia.ts` tratan una fila con campos ausentes igual que una completa (leen campo a campo; no lo comprobé con una fila parcial).
