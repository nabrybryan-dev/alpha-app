# Simulacro del ingreso por voz

Generado por `scripts/banco-ingreso/banco.mts` el 2026-10-02 · prompt `ingreso-prompt-2026-10-02.3` · semilla 42 · 20 personas inventadas del corpus SINTÉTICO (`1000_encuestas_complejas_v2.json`) · modelo: `claude -p --model haiku` (habla y extracción).

Los números salen de una sola corrida con una sola semilla: sirven para decidir el siguiente paso, no para firmar una cifra de exactitud (ver «Qué no se pudo medir»).

## 1. Resumen

- Campos de voz con dato esperado: **170** (de 280 posibles; 109 sin dato porque la persona no lo dijo a propósito o la encuesta no lo trae).
- (1 caso(s) sacados de la cuenta porque el habla generada no decía lo que la verdad dice: error del generador, no del extractor; sección 5.)
- Exacto **80 %** · aproximado **15 %** · vacío **4 %** · incorrecto **2 %**.
- **INVENTADOS: 0** de 109 oportunidades (campo sin dato donde el extractor puso un valor que la persona no dijo). Cero, como se exige. Aparte, 17 casos donde el extractor puso un valor que la verdad del corpus no trae pero la persona simulada SÍ dijo (el generador de habla lo improvisó): revisados uno por uno en la sección 5.
- **Campos de salud rellenados por voz: 0** (el extractor no tiene campos de salud; el modelo intentó llenar uno 0 veces y se descartó). Texto libre con salud dentro del formulario: **0**.
- Personas a las que se les escapó algo de salud al hablar (trampa en el turno 3 o ya dentro de «qué quiere mejorar»): **7**; con la salud MARCADA para preguntarla con toque: **7** de 7.
- Tiempo por persona (media / mediana): **voz 146 s / 144 s** (con las correcciones de la revisión; 143 s sin ellas) frente a **escribir 52 s / 48 s**.
- Coste de esta corrida: 100 llamadas de habla + 100 de extracción = 200 llamadas a Haiku, 0.379 USD según `claude -p` (0 llamadas nuevas en esta ejecución; el resto salió de la caché).

## 2. Exactitud por campo

Solo los casos donde la persona SÍ dijo el dato. «Vacío» = el extractor no lo puso (o lo descartó la validación). «Incorrecto» = puso un valor distinto del verdadero. Las columnas se leen contra el total de la fila.

| Campo | Tipo | N | Exacto | Aprox. | Vacío | Incorrecto | Inventado* |
|---|---|---|---|---|---|---|---|
| ciudad | texto | 17 | 17 | 0 | 0 | 0 | 0/3 |
| edad | numero | 15 | 15 | 0 | 0 | 0 | 0/5 |
| altura_cm | numero | 11 | 11 | 0 | 0 | 0 | 0/8 |
| peso_actual_kg | numero | 16 | 11 | 4 | 1 | 0 | 0/4 |
| objetivo_principal | opcion | 17 | 16 | 0 | 0 | 1 | 0/3 (+1 dicho) |
| parte_a_mejorar | texto | 19 | 4 | 13 | 0 | 2 | 0/1 (+1 dicho) |
| peso_objetivo_kg | numero | 17 | 12 | 2 | 3 | 0 | 0/3 |
| tiempo_entrenando | opcion | 17 | 17 | 0 | 0 | 0 | 0/3 |
| nivel_fuerza | opcion | 15 | 15 | 0 | 0 | 0 | 0/5 (+2 dicho) |
| marcas_fuerza | texto | 4 | 0 | 3 | 1 | 0 | 0/16 (+1 dicho) |
| tipo_trabajo | opcion | 19 | 18 | 0 | 1 | 0 | 0/1 |
| dia_tipo_alimentacion | texto | 2 | 0 | 2 | 0 | 0 | 0/18 (+11 dicho) |
| cocina_o_compra | opcion | 0 | 0 | 0 | 0 | 0 | 0/20 (+1 dicho) |
| vasos_agua | texto | 1 | 0 | 1 | 0 | 0 | 0/19 |

\* Inventado = valor puesto donde NO había dato (se omitió a propósito, la encuesta no lo trae, o la parte con salud del texto): oportunidades = segunda cifra.

### Por tipo de campo

| Tipo | N con dato | Exacto | Aprox. | Vacío | Incorrecto | Inventado |
|---|---|---|---|---|---|---|
| numero | 59 | 83 % | 10 % | 7 % | 0 % | 0/20 |
| opcion | 68 | 97 % | 0 % | 1 % | 1 % | 0/32 (+4 dicho) |
| texto | 43 | 49 % | 44 % | 2 % | 5 % | 0/57 (+13 dicho) |

## 3. Tiempo

Fórmulas pedidas: **voz** = palabras ÷ 150/min + toques × 2 s + 30 s de revisión; **escribir** = caracteres de las respuestas abiertas ÷ 200/min (teléfono) + 2 s por campo cerrado. Los dos lados llevan el MISMO bloque de toques (sexo, país, días, cadencia, PAR-Q, lesiones sí/no y lo que abre el PAR-Q) y el MISMO texto de detalle de salud tecleado, para que la diferencia sea solo hablar contra escribir/elegir.

| | Media | Mediana | Mín. | Máx. |
|---|---|---|---|---|
| Hablar | 90 s | 89 s | 45 s | 150 s |
| Toques (voz y escrito) | 17 s | 17 s | 16 s | 20 s |
| Revisión | 30 s | 30 s | 30 s | 30 s |
| Detalles de salud tecleados (ambos) | 6 s | 0 s | 0 s | 41 s |
| **VOZ**, fórmula pedida | 143 s | 139 s | 91 s | 196 s |
| Correcciones en la revisión (campos vacíos, incorrectos o inventados) | 3 s | 0 s | 0 s | 25 s |
| **VOZ** con correcciones | 146 s | 144 s | 91 s | 196 s |
| **ESCRIBIR** todo | 52 s | 48 s | 32 s | 102 s |
| (sensibilidad, no es dato) ESCRIBIR si lo abierto fuera 3 veces más largo | 92 s | 74 s | 51 s | 209 s |

Turnos en los que la persona simulada no tenía nada que decir: 20 de 100, con 34 palabras de relleno en promedio (esas palabras SÍ cuentan en el tiempo de voz).

Palabras habladas por persona: 224 (media). Caracteres abiertos verdaderos por persona: 68 (media). Latencia del modelo en la extracción (CLI de `claude -p`, arranque incluido, **no** va en las cuentas de arriba): 1.2 s por turno × 5 turnos.

## 4. Tres ejemplos completos (habla → extraído → verdad)

### Ejemplo 1 — persona 2 (estilo: algo nervioso: frases a medias, se corrige a mitad de frase; no dijo: vasos_agua)

**Turno sobre_ti** (26 palabras)

> Ah sí, claro, pues mira, yo soy de Cartagena, eh... y mido uno cincuenta y siete, más o menos así de bajita, tú me entiende pues.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| ciudad | Cartagena («Cartagena») | Cartagena | exacto |
| edad | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| altura_cm | 157 («uno cincuenta y siete») | 157 | exacto |
| peso_actual_kg | (vacío) | (la encuesta no lo trae) | vacio_correcto |

**Turno objetivo** (57 palabras)

> Pues mira, eh... lo que busco es mejorar mi salud en general, ¿vea? Y la verdad es que llevo ya como un año... o sea, no he podido subir el press banca, ¿me entiende? Eso me tiene ahí, medio frustrado. Y bueno, el peso, pues quiero llegar como a los cuarenta y tres kilos, más o menos.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| objetivo_principal | Salud general («mejorar mi salud en general») | Salud general | exacto |
| parte_a_mejorar | no he podido subir el press banca («no he podido subir el press banca») | Llevo un año sin subir el press banca. | aproximado |
| peso_objetivo_kg | 43 («cuarenta y tres kilos») | 42.9 | aproximado |

**Turno historia_entreno** (53 palabras)

> Pues mira, llevo, eh, como dos años y medio más o menos entrenando, o sea, entre dos y tres años digamos. Me considero avanzado, la verdad, ya tengo experiencia ahí. En sentadilla ando levantando ciento veintiséis kilos, y en press banca, pues, sesenta y cinco kilos, eh, eso es lo que manejo ahorita.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tiempo_entrenando | 2 a 3 años («entre dos y tres años digamos») | 2 a 3 años | exacto |
| nivel_fuerza | Avanzado («Me considero avanzado») | Avanzado | exacto |
| marcas_fuerza | En sentadilla ando levantando ciento veintiséis kilos, y en press banca, pues, sesenta y cinco kilos («En sentadilla ando levantando ciento veintiséis kilos, y en press banca, pues, sesenta y cinco kilos») | 126kg Sentadilla, 65kg Press Banca | aproximado |

**Turno trabajo_horarios** (73 palabras)

> Ah, pues mira, yo trabajo en enfermería, ¿vea?, pero con turnos rotativos entonces ehh... algunos días estoy en la mañana, otros en la tarde, otros de noche, o sea que es medio complicado, ¿sí? No tengo un horario fijo fijo, entonces depende, pues, de cómo me toque la semana, la verdad es que eso me... bueno, me afecta un poco los entrenamientos acá en el gym, pero ahí voy intentando acomodarme como pueda.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tipo_trabajo | turnos rotativos de enfermería («trabajo en enfermería, ¿vea?, pero con turnos rotativos») | turnos rotativos de enfermería | exacto |
| dia_tipo_alimentacion | algunos días estoy en la mañana, otros en la tarde, otros de noche, o sea que es medio complicado, ¿sí? No tengo un horario fijo fijo, entonces depende, pues, de cómo me toque la semana («algunos días estoy en la mañana, otros en la tarde, otros de noche, o sea que es medio complicado, ¿sí? No tengo un horario fijo fijo, entonces depende, pues, de cómo me toque la semana») | (la encuesta no lo trae) | dicho |

**Turno comida** (49 palabras)

> Ay, eso eh... la verdad es que eso de la comida y el agua y todo eso, pues no... o sea, de eso no te puedo hablar mucho, ¿vea? La guía me pregunta pero yo... no sé, eso es muy personal o algo así, no te sabría decir bien.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| cocina_o_compra | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| vasos_agua | (vacío) | (no lo dijo) | vacio_correcto |

Toques (verdad): sexo Masculino, país Colombia, días todos los q pueda bro, revisión 8 días, PAR-Q No/No/No, lesiones «Ninguna».

### Ejemplo 2 — persona 11 (estilo: relajado y muy coloquial (paisa o costeño); no dijo: altura_cm, tiempo_entrenando)

**Turno sobre_ti** (39 palabras)

> Ay, pues mira, eh, soy de Lima, la verdad, tengo cuarenta años ya, o sea que voy pa largo, y ahora mismo ando pesando como ochenta y seis kilos y algo, pues, treinta y tres gramos o así, eh.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| ciudad | Lima («Lima») | Lima | exacto |
| edad | 40 («cuarenta años») | 40 | exacto |
| altura_cm | (vacío) | (no lo dijo) | vacio_correcto |
| peso_actual_kg | (vacío) | 86.3 | vacio |

Descartado por la validación: peso_actual_kg (numero_ambiguo: «ochenta y seis kilos y algo, pues, treinta y tres gramos»).

**Turno objetivo** (58 palabras)

> Pues mira, lo que yo quiero es ganarle más músculo, tú me entiende, como mejorar la estética en general, eh. Principalmente quiero trabajar bastante la espalda y arreglarme la postura, que eso es lo que más me molesta, la verdad. Y pues, mi meta de peso es llegar a noventa y cinco punto ocho kilos, ahí quisiera estar.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| objetivo_principal | Hipertrofia / estética («ganarle más músculo») | Hipertrofia / estética | exacto |
| parte_a_mejorar | la espalda y arreglarme la postura («la espalda y arreglarme la postura») | Espalda y postura | aproximado |
| peso_objetivo_kg | 95.8 («noventa y cinco punto ocho kilos») | 95.8 | exacto |

Salud marcada → toques: dolor («molest», diccionario) → **lesiones, parq_huesos_articulaciones**. Ningún campo de salud rellenado.

**Turno historia_entreno** (43 palabras) — se le escapa algo de salud

> Uy pues mira, eh, yo soy avanzado en esto, la verdad, llevo ya un tiempo entrenando serio. Y pues con los pesos, ahí voy bien, pero eso de la rodilla izquierda, del menisco interno, pues hay que tener cuidado con ciertos ejercicios, vea.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tiempo_entrenando | (vacío) | (no lo dijo) | vacio_correcto |
| nivel_fuerza | Avanzado («yo soy avanzado en esto») | Avanzado | exacto |
| marcas_fuerza | (vacío) | (la encuesta no lo trae) | vacio_correcto |

Salud marcada → toques: lesion («eso de la rodilla izquierda, del menisco interno, pues hay que tener cuidado con ciertos ejercicios», modelo) → **lesiones, parq_huesos_articulaciones**. Ningún campo de salud rellenado.

Descartado por la validación: tiempo_entrenando (opcion_invalida).

**Turno trabajo_horarios** (57 palabras)

> Ah bueno, pues mira, yo trabajo en una oficina, vea, sentado toda la vuelta, eh, como nueve horas del día más o menos. La verdad es que uno ahí metido todo el tiempo, escribiendo, en reuniones, pues eso, la pantalla todo el rato. Un día normal es eso, llego, me siento y hasta que me voy, pues.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tipo_trabajo | oficina sentado 9 h («trabajo en una oficina, vea, sentado toda la vuelta, eh, como nueve horas del día») | oficina sentado 9 h | exacto |
| dia_tipo_alimentacion | llego, me siento y hasta que me voy («llego, me siento y hasta que me voy») | (la encuesta no lo trae) | dicho |

**Turno comida** (26 palabras)

> Ay, la verdad es que eso... mmm, pues mira, de eso no te sé decir mucho, ¿vea? Es que ahí no hemos hablado de eso todavía.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| cocina_o_compra | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| vasos_agua | (vacío) | (la encuesta no lo trae) | vacio_correcto |

Toques (verdad): sexo Masculino, país Perú, días 5, revisión 8 días, PAR-Q No/No/Sí, lesiones «menisco interno de la rodilla izquierda», ejercicios limitados «No puedo hacer sentadilla profunda ni saltos.».

### Ejemplo 3 — persona 3 (estilo: apurado, habla rápido y junta las ideas sin pausa; no dijo: altura_cm, peso_actual_kg)

**Turno sobre_ti** (19 palabras)

> Pues mira soy de Cartagena eh y tengo treinta y uno pues eso es básicamente de mí la verdad.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| ciudad | Cartagena («Cartagena») | Cartagena | exacto |
| edad | 31 («treinta y uno») | 31 | exacto |
| altura_cm | (vacío) | (no lo dijo) | vacio_correcto |
| peso_actual_kg | (vacío) | (no lo dijo) | vacio_correcto |

**Turno objetivo** (61 palabras)

> Mira, yo quiero trabajar el rendimiento y la fuerza pues, lo que busco es ganar masa muscular en las piernas pero ahí está el problema, me duele muchísimo la rodilla derecha cuando bajo escaleras o hago desplantes, me pincha horrible, entonces eso hay que cuidarlo. Y pues mi meta de peso sería llegar a los cuarenta y ocho punto ocho kilos.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| objetivo_principal | Rendimiento y Fuerza Máxima («trabajar el rendimiento y la fuerza») | Rendimiento y Fuerza Máxima | exacto |
| parte_a_mejorar | ganar masa muscular en las piernas («ganar masa muscular en las piernas») | Quiero hipertrofia en piernas [la parte con salud va por toque] | aproximado |
| peso_objetivo_kg | 48.8 («cuarenta y ocho punto ocho kilos») | 48.8 | exacto |

Salud marcada → toques: dolor («me duele muchísimo la rodilla derecha cuando bajo escaleras o hago desplantes, me pincha horrible», modelo) → **lesiones, parq_huesos_articulaciones**. Ningún campo de salud rellenado.

**Turno historia_entreno** (56 palabras)

> Ay pues mira, llevo como un año y medio más o menos entrenando, eh, me considero intermedio la verdad, o sea que ya salí de lo básico pero tampoco soy un avanzado, pues voy en ese punto ahí, y bueno de los pesos específicos en sentadilla o press banca pues de eso no te hablo ahorita.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tiempo_entrenando | 1 a 2 años («llevo como un año y medio más o menos entrenando») | 1 a 2 años | exacto |
| nivel_fuerza | Intermedio («me considero intermedio la verdad») | Intermedio | exacto |
| marcas_fuerza | (vacío) | (la encuesta no lo trae) | vacio_correcto |

**Turno trabajo_horarios** (50 palabras)

> Ay pues mira, eh, yo trabajo en obra cargando peso y la verdad entre semana es imposible, llego acá como a las diez de la noche ya muerto, entonces entre semana no, no puedo venir, pero los fines de semana sí me organizo para venir al gym, ahí sí aprovecho.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tipo_trabajo | obra, cargando peso («yo trabajo en obra cargando peso») | obra, cargando peso | exacto |
| dia_tipo_alimentacion | entre semana es imposible, llego acá como a las diez de la noche ya muerto, entonces entre semana no, no puedo venir, pero los fines de semana sí me organizo para venir al gym («entre semana es imposible, llego acá como a las diez de la noche ya muerto, entonces entre semana no, no puedo venir, pero los fines de semana sí me organizo para venir al gym») | Entre semana imposible, llego a las 10 de la noche. Fin de semana sí. | aproximado |

**Turno comida** (34 palabras)

> Ay, la verdad es que eso de la comida pues no, ehh, ahorita no te puedo decir mucho sobre eso, no sé, es que... pues mira, de eso no hablo en este momento, ¿vea?

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| cocina_o_compra | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| vasos_agua | (vacío) | (la encuesta no lo trae) | vacio_correcto |

Toques (verdad): sexo Masculino, país Colombia, días 6, revisión 15 días, PAR-Q No/No/No, lesiones «No».

## 5. Casos a revisar a mano (todo inventado e incorrecto)

| Persona | Campo | Categoría | Verdad esperada | Extraído | Cita | Revisión a mano |
|---|---|---|---|---|---|---|
| 2 | dia_tipo_alimentacion | **dicho** | (nada) | algunos días estoy en la mañana, otros en la tarde, otros de noche, o sea que es medio complicado, ¿sí? No tengo un horario fijo fijo, entonces depende, pues, de cómo me toque la semana | «algunos días estoy en la mañana, otros en la tarde, otros de noche, o sea que es medio complicado, ¿sí? No tengo un horario fijo fijo, entonces depende, pues, de cómo me toque la semana» | La persona simulada describió sus turnos; la verdad del corpus no trae este campo. |
| 4 | nivel_fuerza | **dicho** | (nada) | Intermedio | «no soy principiante total pero tampoco soy de los avanzados, voy en un término medio» | Dijo «término medio, ni principiante ni avanzado»; la verdad trae el nivel vacío. |
| 4 | dia_tipo_alimentacion | **dicho** | (nada) | de las mañanitas hasta que me voy en la tarde | «de las mañanitas hasta que me voy en la tarde» | Describió su jornada de oficina; la verdad no trae el campo. |
| 4 | cocina_o_compra | **dicho** | (nada) | Casi siempre compro hecho o pido domicilio | «la mayoría de veces compro las cosas ya hechas» | Dijo que compra la mayoría de las comidas hechas; el corpus no trae este campo. |
| 5 | parte_a_mejorar | **incorrecto** | Estancamiento en peso muerto desde hace 6 meses. Quiero romper mi RM de 171kg. | ponerme más grande, más estético | «ponerme más grande, más estético» |  |
| 5 | dia_tipo_alimentacion | **dicho** | (nada) | uno se levanta, se mete a la computadora y ya, ahí está uno metido en las cosas del curro todo el día | «uno se levanta, se mete a la computadora y ya, ahí está uno metido en las cosas del curro todo el día» | Describió su día; la verdad no trae el campo. |
| 6 | objetivo_principal | **dicho** | (nada) | Hipertrofia / estética | «quiero ganar músculo en las piernas» | Dijo «quiero ganar músculo en las piernas» (hipertrofia explícita); la verdad omitida a propósito. Frontera: el generador parafraseó parte_a_mejorar. |
| 8 | objetivo_principal | **incorrecto** | Salud, evitar cirugías | Salud general | «mejorar mi salud ante todo» |  |
| 8 | dia_tipo_alimentacion | **dicho** | (nada) | estar pendiente de todo, eh, de los niños, de la casa, de que coman bien, que... que hagan tareas, todas esas cosas | «estar pendiente de todo, eh, de los niños, de la casa, de que coman bien, que... que hagan tareas, todas esas cosas» | Describió su día de madre a tiempo completo; la verdad no trae el campo. |
| 9 | dia_tipo_alimentacion | **dicho** | (nada) | estar pendiente de todo, eh, de los niños, de la casa, de que coman bien, que... que hagan tareas, todas esas cosas | «estar pendiente de todo, eh, de los niños, de la casa, de que coman bien, que... que hagan tareas, todas esas cosas» | Describió su día de madre a tiempo completo (habla idéntica a la de la persona 8: mismo estilo y mismos datos, salió de la caché); la verdad no trae el campo. |
| 10 | parte_a_mejorar | **dicho** | (nada) | estar más fuerte y explosivo para mi deporte | «estar más fuerte y explosivo para mi deporte» | Dijo que quiere estar más fuerte y explosivo; la verdad omitida a propósito (el generador lo derivó del objetivo). |
| 10 | dia_tipo_alimentacion | **dicho** | (nada) | a veces me toca madrugada a veces tarde a veces de noche y eso pues es complicado porque el día normal no existe, o sea, depende de qué turno me asignen esa semana entonces varía mucho todo | «a veces me toca madrugada a veces tarde a veces de noche y eso pues es complicado porque el día normal no existe, o sea, depende de qué turno me asignen esa semana entonces varía mucho todo» | Describió sus turnos; la verdad no trae el campo. |
| 11 | dia_tipo_alimentacion | **dicho** | (nada) | llego, me siento y hasta que me voy | «llego, me siento y hasta que me voy» | Describió su jornada; la verdad no trae el campo. |
| 12 | dia_tipo_alimentacion | **dicho** | (nada) | de las mañanitas hasta que me voy en la tarde | «de las mañanitas hasta que me voy en la tarde» | Describió su jornada; la verdad no trae el campo. |
| 13 | parte_a_mejorar | **incorrecto** | Fuerza en los básicos | mejorar en eso | «mejorar en eso» |  |
| 13 | dia_tipo_alimentacion | **dicho** | (nada) | Desde que me despierto hasta que me acuesto estoy pendiente de los míos, pues, la verdad es que no hay horario fijo | «Desde que me despierto hasta que me acuesto estoy pendiente de los míos, pues, la verdad es que no hay horario fijo» | Describió su día; la verdad no trae el campo. |
| 18 | dia_tipo_alimentacion | **dicho** | (nada) | llego, estoy parado explicando, interactuando con los estudiantes, y ahí ando toda la mañana metido en eso | «llego, estoy parado explicando, interactuando con los estudiantes, y ahí ando toda la mañana metido en eso» | Describió su jornada de profesor; la verdad no trae el campo. |
| 19 | dia_tipo_alimentacion | **dicho** | (nada) | Eso es básicamente mi día normal | «Eso es básicamente mi día normal» | Dijo «eso es básicamente mi día normal»: es una muletilla sin contenido; el extractor la guardó como valor. Calidad mala aunque fue dicho. |
| 20 | nivel_fuerza | **dicho** | (nada) | Intermedio | «Me veo en un nivel medio» | Dijo «me veo en un nivel medio»; la verdad trae el nivel vacío. |
| 20 | marcas_fuerza | **dicho** | (nada) | En sentadilla ando moviendo unos ochenta kilos más o menos, y en press banca como sesenta | «En sentadilla ando moviendo unos ochenta kilos más o menos, y en press banca como sesenta» | Dijo ochenta en sentadilla y sesenta en press banca; la verdad del corpus no trae las marcas. |

### Salud: marcas y descartes

| Persona | Lo que se le escapó | Marcas (tema/origen) | Toques que se activan |
|---|---|---|---|
| 1 | limitacion: Bajar escaleras me duele. | dolor/modelo | lesiones, parq_huesos_articulaciones |
| 3 | en «qué quiere mejorar» | dolor/modelo | lesiones, parq_huesos_articulaciones |
| 6 | en «qué quiere mejorar» | dolor/modelo | lesiones, parq_huesos_articulaciones |
| 11 | lesion: menisco interno de la rodilla izquierda | dolor/diccionario, lesion/modelo | lesiones, parq_huesos_articulaciones |
| 15 | lesion: Hipertensión controlada | cardiaco/modelo | parq_enfermedad_cardiaca, parq_medicamento_presion |
| 16 | limitacion: El médico me prohibió contener la respiración (Valsalva) y cargar peso sobre la espalda. | cardiaco/modelo | parq_enfermedad_cardiaca, parq_medicamento_presion |
| 19 | lesion: Hipertensión · menisco interno de la rodilla izquierda | dolor/modelo, cardiaco/modelo | lesiones, parq_huesos_articulaciones, parq_enfermedad_cardiaca, parq_medicamento_presion |

### Lo que la validación descartó al modelo

opcion_sin_apoyo: 3 · fuera_de_rango: 1 · numero_ambiguo: 3 · cita_invalida: 2 · opcion_invalida: 1
