# Simulacro del ingreso por voz

Generado por `scripts/banco-ingreso/banco.mts` el 2026-10-02 · prompt `ingreso-prompt-2026-10-02.3` · semilla 7 · 20 personas inventadas del corpus SINTÉTICO (`1000_encuestas_complejas_v2.json`) · modelo: `claude -p --model haiku` (habla y extracción).

Los números salen de una sola corrida con una sola semilla: sirven para decidir el siguiente paso, no para firmar una cifra de exactitud (ver «Qué no se pudo medir»).

## 1. Resumen

- Campos de voz con dato esperado: **166** (de 280 posibles; 114 sin dato porque la persona no lo dijo a propósito o la encuesta no lo trae).
- Exacto **80 %** · aproximado **15 %** · vacío **5 %** · incorrecto **1 %**.
- **INVENTADOS: 0** de 114 oportunidades (campo sin dato donde el extractor puso un valor que la persona no dijo). Cero, como se exige. Aparte, 20 casos donde el extractor puso un valor que la verdad del corpus no trae pero la persona simulada SÍ dijo (el generador de habla lo improvisó): revisados uno por uno en la sección 5.
- **Campos de salud rellenados por voz: 0** (el extractor no tiene campos de salud; el modelo intentó llenar uno 0 veces y se descartó). Texto libre con salud dentro del formulario: **0**.
- Personas a las que se les escapó algo de salud al hablar (trampa en el turno 3 o ya dentro de «qué quiere mejorar»): **8**; con la salud MARCADA para preguntarla con toque: **8** de 8.
- Tiempo por persona (media / mediana): **voz 153 s / 158 s** (con las correcciones de la revisión; 149 s sin ellas) frente a **escribir 52 s / 49 s**.
- Coste de esta corrida: 100 llamadas de habla + 100 de extracción = 200 llamadas a Haiku, 0.381 USD según `claude -p` (0 llamadas nuevas en esta ejecución; el resto salió de la caché).

## 2. Exactitud por campo

Solo los casos donde la persona SÍ dijo el dato. «Vacío» = el extractor no lo puso (o lo descartó la validación). «Incorrecto» = puso un valor distinto del verdadero. Las columnas se leen contra el total de la fila.

| Campo | Tipo | N | Exacto | Aprox. | Vacío | Incorrecto | Inventado* |
|---|---|---|---|---|---|---|---|
| ciudad | texto | 17 | 16 | 1 | 0 | 0 | 0/3 |
| edad | numero | 12 | 12 | 0 | 0 | 0 | 0/8 (+2 dicho) |
| altura_cm | numero | 15 | 15 | 0 | 0 | 0 | 0/5 |
| peso_actual_kg | numero | 14 | 8 | 6 | 0 | 0 | 0/6 |
| objetivo_principal | opcion | 18 | 16 | 0 | 2 | 0 | 0/2 |
| parte_a_mejorar | texto | 14 | 3 | 10 | 0 | 1 | 0/6 (+6 dicho) |
| peso_objetivo_kg | numero | 17 | 12 | 3 | 2 | 0 | 0/3 |
| tiempo_entrenando | opcion | 18 | 17 | 0 | 1 | 0 | 0/2 |
| nivel_fuerza | opcion | 16 | 16 | 0 | 0 | 0 | 0/4 (+1 dicho) |
| marcas_fuerza | texto | 2 | 0 | 2 | 0 | 0 | 0/18 (+1 dicho) |
| tipo_trabajo | opcion | 17 | 17 | 0 | 0 | 0 | 0/3 |
| dia_tipo_alimentacion | texto | 2 | 0 | 1 | 1 | 0 | 0/18 (+10 dicho) |
| cocina_o_compra | opcion | 0 | 0 | 0 | 0 | 0 | 0/20 |
| vasos_agua | texto | 4 | 0 | 2 | 2 | 0 | 0/16 |

\* Inventado = valor puesto donde NO había dato (se omitió a propósito, la encuesta no lo trae, o la parte con salud del texto): oportunidades = segunda cifra.

### Por tipo de campo

| Tipo | N con dato | Exacto | Aprox. | Vacío | Incorrecto | Inventado |
|---|---|---|---|---|---|---|
| numero | 58 | 81 % | 16 % | 3 % | 0 % | 0/22 (+2 dicho) |
| opcion | 69 | 96 % | 0 % | 4 % | 0 % | 0/31 (+1 dicho) |
| texto | 39 | 49 % | 41 % | 8 % | 3 % | 0/61 (+17 dicho) |

## 3. Tiempo

Fórmulas pedidas: **voz** = palabras ÷ 150/min + toques × 2 s + 30 s de revisión; **escribir** = caracteres de las respuestas abiertas ÷ 200/min (teléfono) + 2 s por campo cerrado. Los dos lados llevan el MISMO bloque de toques (sexo, país, días, cadencia, PAR-Q, lesiones sí/no y lo que abre el PAR-Q) y el MISMO texto de detalle de salud tecleado, para que la diferencia sea solo hablar contra escribir/elegir.

| | Media | Mediana | Mín. | Máx. |
|---|---|---|---|---|
| Hablar | 93 s | 95 s | 42 s | 132 s |
| Toques (voz y escrito) | 17 s | 16 s | 16 s | 22 s |
| Revisión | 30 s | 30 s | 30 s | 30 s |
| Detalles de salud tecleados (ambos) | 9 s | 0 s | 0 s | 41 s |
| **VOZ**, fórmula pedida | 149 s | 153 s | 88 s | 225 s |
| Correcciones en la revisión (campos vacíos, incorrectos o inventados) | 4 s | 0 s | 0 s | 29 s |
| **VOZ** con correcciones | 153 s | 158 s | 92 s | 225 s |
| **ESCRIBIR** todo | 52 s | 49 s | 31 s | 99 s |
| (sensibilidad, no es dato) ESCRIBIR si lo abierto fuera 3 veces más largo | 88 s | 71 s | 45 s | 198 s |

Turnos en los que la persona simulada no tenía nada que decir: 19 de 100, con 34 palabras de relleno en promedio (esas palabras SÍ cuentan en el tiempo de voz).

Palabras habladas por persona: 234 (media). Caracteres abiertos verdaderos por persona: 60 (media). Latencia del modelo en la extracción (CLI de `claude -p`, arranque incluido, **no** va en las cuentas de arriba): 1.3 s por turno × 5 turnos.

## 4. Tres ejemplos completos (habla → extraído → verdad)

### Ejemplo 1 — persona 1 (estilo: algo nervioso: frases a medias, se corrige a mitad de frase; no dijo: tipo_trabajo)

**Turno sobre_ti** (43 palabras)

> Ah, pues mira, yo soy de Bucaramanga, eh... tengo... bueno, la verdad es que prefiero no mencionar eso ahora, ¿vea? Y de estatura, pues uno sesenta y cinco, más o menos, o sea, como metro y... y sesenta y cinco centímetros, ahí está.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| ciudad | Bucaramanga («Bucaramanga») | Bucaramanga | exacto |
| edad | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| altura_cm | 165 («uno sesenta y cinco») | 165 | exacto |
| peso_actual_kg | (vacío) | (la encuesta no lo trae) | vacio_correcto |

**Turno objetivo** (75 palabras)

> Pues mira, eh, yo quiero hacer como una cosa de... de cambiar mi composición corporal, ¿vea? O sea, ganar músculo pero también perder grasa, eso. Y pues lo que más me gustaría es, eh, trabajar el pecho y los hombros, que esos son los que... bueno, los que quiero que se noten más, ¿me entiende? Y de peso pues quisiera llegar a como sesenta y uno punto ocho kilos, ahí ando mirando que sea posible.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| objetivo_principal | (vacío) | Recomposición corporal | vacio |
| parte_a_mejorar | trabajar el pecho y los hombros («trabajar el pecho y los hombros») | Pecho y hombros | aproximado |
| peso_objetivo_kg | 61.8 («sesenta y uno punto ocho kilos») | 61.8 | exacto |

Descartado por la validación: objetivo_principal (opcion_sin_apoyo: «Recomposición corporal ← «cambiar mi composición corporal»»).

**Turno historia_entreno** (32 palabras)

> Mmm, pues mira, yo llevo... o sea, menos de medio año entrenando, ¿vea?, apenas estoy empezando en esto, eh, es que... la verdad es que todavía no, no tengo mucha experiencia ahí.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tiempo_entrenando | Menos de 6 meses («menos de medio año entrenando») | Menos de 6 meses | exacto |
| nivel_fuerza | Principiante («apenas estoy empezando en esto») | (la encuesta no lo trae) | dicho |
| marcas_fuerza | (vacío) | (la encuesta no lo trae) | vacio_correcto |

**Turno trabajo_horarios** (52 palabras)

> Ah, pues mira, trabajo de sol a sol, ¿vea? O sea, me... me toca currando todo el día, prácticamente, entonces pues ahí no me quedan muchas horas libres durante la semana. La verdad es que solo puedo venir al gim... al gimnasio los sábados y domingos, eh? Esos son mis días, pues.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tipo_trabajo | (vacío) | (no lo dijo) | vacio_correcto |
| dia_tipo_alimentacion | (vacío) | Trabajo de sol a sol, solo puedo ir al gimnasio los sábados y domingos. | vacio |

Descartado por la validación: dia_tipo_alimentacion (cita_invalida: «trabajo de sol a sol, me toca currando todo el día, prácticamente, entonces pues ahí no me quedan muchas horas libres durante la semana. La verdad es que solo puedo venir al gim... al gimnasio los sábados y domingos»).

**Turno comida** (31 palabras)

> Ah bueno, pues mira, yo... o sea, lo del agua, eh, tomo como dos o tres litros al día, digamos. La verdad eso sí lo hago, procuro tomar bastante agua, vea.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| cocina_o_compra | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| vasos_agua | tomo como dos o tres litros al día («tomo como dos o tres litros al día») | 2 o 3 | aproximado |

Toques (verdad): sexo Femenino, país Colombia, días 5, revisión 8 días, PAR-Q No/No/No, lesiones «No».

### Ejemplo 2 — persona 5 (estilo: hablador: se va por las ramas pero dice todo lo que le piden; no dijo: parte_a_mejorar, peso_objetivo_kg)

**Turno sobre_ti** (70 palabras)

> Ay, pues mira, eh, yo soy de Pereira, nacido y criado allá, la verdad. Tengo cincuenta años ya, o sea que no soy un chamaco pero tampoco estoy tan viejo, vea. Mido uno setenta y cinco, más o menos ahí ando de estatura, y ahorita peso como sesenta y cinco kilos y medio, o sesenta y seis digamos, pues ha estado variando un poquito pero ahí ando en eso, eh.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| ciudad | Pereira («Pereira») | Pereira | exacto |
| edad | 50 («cincuenta años») | 50 | exacto |
| altura_cm | 175 («uno setenta y cinco») | 175 | exacto |
| peso_actual_kg | 65.5 («sesenta y cinco kilos y medio») | 65.8 | aproximado |

**Turno objetivo** (49 palabras)

> Ay, pues mira, lo que yo quiero es ganar músculo, o sea, hipertrofia ¿vea?, quiero verme bien físicamente, que se note el trabajo en el cuerpo, eh, la estética pues, que la ropa me quede diferente y todo eso, ¿me entiende? Eso es lo que busco acá en Alpha.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| objetivo_principal | Hipertrofia / estética («ganar músculo, o sea, hipertrofia») | Hipertrofia / estética | exacto |
| parte_a_mejorar | verme bien físicamente, que se note el trabajo en el cuerpo («verme bien físicamente, que se note el trabajo en el cuerpo») | (no lo dijo) | dicho |
| peso_objetivo_kg | (vacío) | (no lo dijo) | vacio_correcto |

**Turno historia_entreno** (98 palabras) — se le escapa algo de salud

> Ay sí, pues mira, llevo más o menos como año y medio entrenando, eh, la verdad es que he estado bastante constante en eso. Me considero avanzado, o sea, ya tengo un nivel pretty bueno, he progresado un montón. Y bueno, los pesos pues, mmm, no sé si especifiques en sentadilla o press banca pero ahí voy. El tema es que tuve un rollo con el manguito rotador del hombro derecho hace un tiempo, entonces en press banca ando un poquito cuidado, pero pues voy levantando peso poco a poco. En sentadilla sí le meto más, la verdad.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tiempo_entrenando | (vacío) | 1 a 2 años | vacio |
| nivel_fuerza | Avanzado («Me considero avanzado») | Avanzado | exacto |
| marcas_fuerza | (vacío) | (la encuesta no lo trae) | vacio_correcto |

Salud marcada → toques: lesion («tuve un rollo con el manguito rotador del hombro derecho hace un tiempo», modelo) → **lesiones, parq_huesos_articulaciones**. Ningún campo de salud rellenado.

Descartado por la validación: tiempo_entrenando (opcion_sin_apoyo: «1 a 2 años ← «llevo más o menos como año y medio entrenando»»).

**Turno trabajo_horarios** (67 palabras)

> Ay, pues mira, yo soy madre a tiempo completo, eh, o sea que básicamente mi día es eso, ¿vea? Desde que me despierto hasta que me acuesto estoy pendiente de los míos, pues, la verdad es que no hay horario fijo, ¿vea? Es que uno como mamá trabaja las veinticuatro horas, mmm, ahí está uno cocinando, limpiando, pendiente de todo, pues, así es mi día a día.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tipo_trabajo | madre a tiempo completo («madre a tiempo completo») | madre a tiempo completo | exacto |
| dia_tipo_alimentacion | Desde que me despierto hasta que me acuesto estoy pendiente de los míos, pues, la verdad es que no hay horario fijo («Desde que me despierto hasta que me acuesto estoy pendiente de los míos, pues, la verdad es que no hay horario fijo») | (la encuesta no lo trae) | dicho |

**Turno comida** (46 palabras)

> Ay, pues mira, la verdad es que no, eh... o sea, eso de cómo como y todo eso, no te sabría decir bien, ¿vea? No tengo datos claros de eso ahí en este momento, entonces pues... no quiero soltarte un cuento que no es, ¿me entiende?

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| cocina_o_compra | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| vasos_agua | (vacío) | (la encuesta no lo trae) | vacio_correcto |

Toques (verdad): sexo Femenino, país Colombia, días 3, revisión 8 días, PAR-Q No/No/Sí, lesiones «manguito rotador del hombro derecho», ejercicios limitados «Nada de press militar por encima de la cabeza.».

### Ejemplo 3 — persona 3 (estilo: directo y breve; no dijo: —)

**Turno sobre_ti** (14 palabras)

> Pues mira, soy de Santiago, eh, tengo cuarenta y seis punto cuatro kilos ahorita.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| ciudad | Santiago («Santiago») | Santiago | exacto |
| edad | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| altura_cm | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| peso_actual_kg | 46.4 («cuarenta y seis punto cuatro kilos») | 46.4 | exacto |

**Turno objetivo** (37 palabras)

> Mira, yo quiero mejorar mi rendimiento y la fuerza, ¿vea? Principalmente trabajar el abdomen, que es lo que me interesa. Y pues, mi meta de peso es llegar a los cuarenta y ocho kilos, más o menos.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| objetivo_principal | Rendimiento y Fuerza Máxima («mejorar mi rendimiento y la fuerza») | Rendimiento y Fuerza Máxima | exacto |
| parte_a_mejorar | trabajar el abdomen («trabajar el abdomen») | Abdomen | aproximado |
| peso_objetivo_kg | 48 («cuarenta y ocho kilos») | 47.9 | aproximado |

**Turno historia_entreno** (22 palabras)

> Pues mira, llevo más de un año entrenando, eh. Soy intermedio la verdad. De los pesos y eso no te digo ahorita.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tiempo_entrenando | Más de 1 año («llevo más de un año entrenando») | Más de 1 año | exacto |
| nivel_fuerza | Intermedio («Soy intermedio») | Intermedio | exacto |
| marcas_fuerza | (vacío) | (la encuesta no lo trae) | vacio_correcto |

**Turno trabajo_horarios** (17 palabras)

> Pues, conduzco todo el día, eh. Eso es básicamente, paso en la vía casi todo el tiempo.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tipo_trabajo | conduzco todo el día («conduzco todo el día») | conduzco todo el día | exacto |
| dia_tipo_alimentacion | (vacío) | (la encuesta no lo trae) | vacio_correcto |

**Turno comida** (14 palabras)

> Pues mira, eh, yo no tomo agua así pura, la verdad. Tomo coca cola.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| cocina_o_compra | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| vasos_agua | (vacío) | no tomo agua pura coca cola | vacio |

Toques (verdad): sexo Femenino, país Chile, días null, revisión 15 días, PAR-Q No/No/No, lesiones «No».

## 5. Casos a revisar a mano (todo inventado e incorrecto)

| Persona | Campo | Categoría | Verdad esperada | Extraído | Cita | Revisión a mano |
|---|---|---|---|---|---|---|
| 1 | nivel_fuerza | **dicho** | (nada) | Principiante | «apenas estoy empezando en esto» | Dijo «apenas estoy empezando… no tengo mucha experiencia»; la verdad trae el nivel vacío. Frontera: habla de experiencia, el extractor lo leyó como nivel Principiante. |
| 2 | edad | **dicho** | (nada) | 32 | «treinta y dos años» | Dijo «treinta y uno, treinta y dos años» (la verdad omitida a propósito; el generador la improvisó). El extractor tomó el último; la persona se corrige a sí misma. |
| 2 | dia_tipo_alimentacion | **dicho** | (nada) | Un día normal mío es eso, madrugada, a trabajar, cargando, sudando, y así, pues | «Un día normal mío es eso, madrugada, a trabajar, cargando, sudando, y así, pues» | Describió su jornada de obra; la verdad no trae el campo. |
| 4 | parte_a_mejorar | **dicho** | (nada) | mejorar mi cuerpo, vea, ponerse más fuerte | «mejorar mi cuerpo, vea, ponerse más fuerte» | Dijo «mejorar mi cuerpo, ponerse más fuerte»; la verdad omitida a propósito, el generador lo derivó del objetivo. |
| 4 | dia_tipo_alimentacion | **dicho** | (nada) | llego, estoy parado explicando, interactuando con los estudiantes, y ahí ando toda la mañana metido en eso | «llego, estoy parado explicando, interactuando con los estudiantes, y ahí ando toda la mañana metido en eso» | Describió su jornada de profesor; la verdad no trae el campo. |
| 5 | parte_a_mejorar | **dicho** | (nada) | verme bien físicamente, que se note el trabajo en el cuerpo | «verme bien físicamente, que se note el trabajo en el cuerpo» | Dijo «verme bien físicamente, que se note el trabajo»; la verdad omitida a propósito. |
| 5 | dia_tipo_alimentacion | **dicho** | (nada) | Desde que me despierto hasta que me acuesto estoy pendiente de los míos, pues, la verdad es que no hay horario fijo | «Desde que me despierto hasta que me acuesto estoy pendiente de los míos, pues, la verdad es que no hay horario fijo» | Describió su día de madre a tiempo completo; la verdad no trae el campo. |
| 6 | dia_tipo_alimentacion | **dicho** | (nada) | los horarios son más o menos flexibles, pues depende de qué toque hacer ese día | «los horarios son más o menos flexibles, pues depende de qué toque hacer ese día» | Habla idéntica a las de las personas 8 y 11 (mismo estilo y datos, salió de la caché): describe su horario flexible de teletrabajo; la verdad no trae el campo. |
| 7 | parte_a_mejorar | **dicho** | (nada) | ganar fuerza y potencia | «ganar fuerza y potencia» | Dijo «ganar fuerza y potencia»; la verdad omitida a propósito. |
| 7 | dia_tipo_alimentacion | **dicho** | (nada) | llego y me siento, estoy frente a la pantalla, eh... escribiendo, reuniones, así, todo lo de escritorio | «llego y me siento, estoy frente a la pantalla, eh... escribiendo, reuniones, así, todo lo de escritorio» | Describió su jornada de escritorio; la verdad no trae el campo. |
| 8 | edad | **dicho** | (nada) | 32 | «treinta y dos años ya casi» | Dijo «treinta y uno, treinta y dos años ya casi»; la verdad omitida a propósito, el generador la improvisó. El extractor tomó el último. |
| 8 | parte_a_mejorar | **dicho** | (nada) | la composición corporal | «la composición corporal» | Dijo «la composición corporal»; la verdad omitida a propósito. |
| 8 | dia_tipo_alimentacion | **dicho** | (nada) | los horarios son más o menos flexibles, pues depende de qué toque hacer ese día | «los horarios son más o menos flexibles, pues depende de qué toque hacer ese día» | Habla idéntica a las de las personas 6 y 11 (caché): horario flexible de teletrabajo; la verdad no trae el campo. |
| 9 | parte_a_mejorar | **incorrecto** | Estancamiento en peso muerto desde hace 6 meses. Quiero romper mi RM de 135kg. | la estética | «la estética» |  |
| 9 | dia_tipo_alimentacion | **dicho** | (nada) | Un día normal es... es bastante cansón la verdad, ando ahí en el carro de corrida y... sí, eso, conduciendo todo el tiempo | «Un día normal es... es bastante cansón la verdad, ando ahí en el carro de corrida y... sí, eso, conduciendo todo el tiempo» | Describió su jornada de conductor; la verdad no trae el campo. |
| 11 | dia_tipo_alimentacion | **dicho** | (nada) | los horarios son más o menos flexibles, pues depende de qué toque hacer ese día | «los horarios son más o menos flexibles, pues depende de qué toque hacer ese día» | Habla idéntica a las de las personas 6 y 8 (caché); la verdad no trae el campo. |
| 13 | dia_tipo_alimentacion | **dicho** | (nada) | uno se levanta, se mete a la computadora y ya, ahí está uno metido en las cosas del curro todo el día | «uno se levanta, se mete a la computadora y ya, ahí está uno metido en las cosas del curro todo el día» | Describió su día de teletrabajo; la verdad no trae el campo. |
| 14 | dia_tipo_alimentacion | **dicho** | (nada) | Un día normal mío es bastante agotador la verdad, porque uno está ahí de pie explicando, escribiendo en el tablero, moviendo pa' todos lados, atendiendo a los estudiantes... pues uno llega cansado | «Un día normal mío es bastante agotador la verdad, porque uno está ahí de pie explicando, escribiendo en el tablero, moviendo pa' todos lados, atendiendo a los estudiantes... pues uno llega cansado» | Describió su jornada de profesor; la verdad no trae el campo. |
| 15 | parte_a_mejorar | **dicho** | (nada) | Mejorar mi cuerpo, ponerme en forma | «Mejorar mi cuerpo, ponerme en forma» | Dijo «mejorar mi cuerpo, ponerme en forma»; la verdad omitida a propósito. |
| 16 | marcas_fuerza | **dicho** | (nada) | en sentadilla manejo bastante bien, en press banca igual. Voy con pesos considerables | «en sentadilla manejo bastante bien, en press banca igual. Voy con pesos considerables» | Dijo «en sentadilla manejo bastante bien… pesos considerables»: es vago y NO contiene marcas; el extractor lo guardó aunque el prompt lo prohíbe. Valor sin contenido en el formulario. |
| 18 | parte_a_mejorar | **dicho** | (nada) | ponerme en forma de nuevo | «ponerme en forma de nuevo» | Dijo «ponerme en forma de nuevo»; la verdad omitida a propósito. |

### Salud: marcas y descartes

| Persona | Lo que se le escapó | Marcas (tema/origen) | Toques que se activan |
|---|---|---|---|
| 2 | limitacion: Bajar escaleras me duele. | dolor/modelo | lesiones, parq_huesos_articulaciones |
| 5 | lesion: manguito rotador del hombro derecho | lesion/modelo | lesiones, parq_huesos_articulaciones |
| 9 | lesion: menisco interno de la rodilla izquierda | lesion/modelo | lesiones, parq_huesos_articulaciones |
| 12 | limitacion: Las extensiones de rodilla me disparan el dolor. | dolor/modelo | lesiones, parq_huesos_articulaciones |
| 13 | lesion: Hipertensión controlada | cardiaco/modelo | parq_enfermedad_cardiaca, parq_medicamento_presion |
| 17 | limitacion: Las extensiones de rodilla me disparan el dolor. | dolor/modelo | lesiones, parq_huesos_articulaciones |
| 18 | lesion: Hernia discal L5-S1 · menisco interno de la rodilla izquierda | lesion/modelo | lesiones, parq_huesos_articulaciones |
| 19 | lesion: tendinopatía rotuliana | lesion/modelo | lesiones, parq_huesos_articulaciones |

### Lo que la validación descartó al modelo

opcion_sin_apoyo: 7 · cita_invalida: 2 · numero_ambiguo: 2 · opcion_invalida: 1 · texto_sin_contenido: 1
