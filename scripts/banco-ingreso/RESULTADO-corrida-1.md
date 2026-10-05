# Simulacro del ingreso por voz

Generado por `scripts/banco-ingreso/banco.mts` el 2026-10-02 · prompt `ingreso-prompt-2026-10-02.1` · semilla 42 · 20 personas inventadas del corpus SINTÉTICO (`1000_encuestas_complejas_v2.json`) · modelo: `claude -p --model haiku` (habla y extracción).

Los números salen de una sola corrida con una sola semilla: sirven para decidir el siguiente paso, no para firmar una cifra de exactitud (ver «Qué no se pudo medir»).

## 1. Resumen

- Campos de voz con dato esperado: **175** (de 300 posibles; 125 sin dato porque la persona no lo dijo a propósito o la encuesta no lo trae).
- Exacto **65 %** · aproximado **11 %** · vacío **19 %** · incorrecto **6 %**.
- **INVENTADOS: 32** de 125 oportunidades (campo sin dato donde el extractor puso un valor). NO ES CERO: ver la sección 5.
- **Campos de salud rellenados por voz: 0** (el extractor no tiene campos de salud; el modelo intentó llenar uno 0 veces y se descartó). Texto libre con salud dentro del formulario: **0**.
- Personas a las que se les escapó algo de salud al hablar (trampa en el turno 3 o ya dentro de «qué quiere mejorar»): **8**; con la salud MARCADA para preguntarla con toque: **7** de 8.
- Tiempo por persona (media / mediana): **voz 161 s / 160 s** (con las correcciones de la revisión; 146 s sin ellas) frente a **escribir 52 s / 48 s**.
- Coste de esta corrida: 100 llamadas de habla + 100 de extracción = 200 llamadas a Haiku, 0.370 USD según `claude -p` (174 llamadas nuevas en esta ejecución; el resto salió de la caché).

## 2. Exactitud por campo

Solo los casos donde la persona SÍ dijo el dato. «Vacío» = el extractor no lo puso (o lo descartó la validación). «Incorrecto» = puso un valor distinto del verdadero. Las columnas se leen contra el total de la fila.

| Campo | Tipo | N | Exacto | Aprox. | Vacío | Incorrecto | Inventado* |
|---|---|---|---|---|---|---|---|
| ciudad | texto | 17 | 17 | 0 | 0 | 0 | 1/3 |
| edad | numero | 15 | 15 | 0 | 0 | 0 | 1/5 |
| altura_cm | numero | 12 | 12 | 0 | 0 | 0 | 0/8 |
| peso_actual_kg | numero | 16 | 5 | 3 | 6 | 2 | 0/4 |
| objetivo_principal | opcion | 17 | 17 | 0 | 0 | 0 | 3/3 |
| parte_a_mejorar | texto | 19 | 4 | 10 | 0 | 5 | 1/1 |
| peso_objetivo_kg | numero | 17 | 1 | 1 | 14 | 1 | 0/3 |
| tiempo_entrenando | opcion | 17 | 17 | 0 | 0 | 0 | 0/3 |
| nivel_fuerza | opcion | 15 | 3 | 0 | 11 | 1 | 1/5 |
| marcas_fuerza | texto | 4 | 0 | 3 | 0 | 1 | 3/16 |
| nivel_autopercibido | opcion | 4 | 4 | 0 | 0 | 0 | 14/16 |
| tipo_trabajo | opcion | 18 | 18 | 0 | 0 | 0 | 0/2 |
| dia_tipo_alimentacion | texto | 2 | 0 | 1 | 1 | 0 | 7/18 |
| cocina_o_compra | opcion | 0 | 0 | 0 | 0 | 0 | 1/20 |
| vasos_agua | texto | 2 | 0 | 1 | 1 | 0 | 0/18 |

\* Inventado = valor puesto donde NO había dato (se omitió a propósito, la encuesta no lo trae, o la parte con salud del texto): oportunidades = segunda cifra.

### Por tipo de campo

| Tipo | N con dato | Exacto | Aprox. | Vacío | Incorrecto | Inventado |
|---|---|---|---|---|---|---|
| numero | 60 | 55 % | 7 % | 33 % | 5 % | 1/20 |
| opcion | 71 | 83 % | 0 % | 15 % | 1 % | 19/49 |
| texto | 44 | 48 % | 34 % | 5 % | 14 % | 12/56 |

## 3. Tiempo

Fórmulas pedidas: **voz** = palabras ÷ 150/min + toques × 2 s + 30 s de revisión; **escribir** = caracteres de las respuestas abiertas ÷ 200/min (teléfono) + 2 s por campo cerrado. Los dos lados llevan el MISMO bloque de toques (sexo, país, días, cadencia, PAR-Q, lesiones sí/no y lo que abre el PAR-Q) y el MISMO texto de detalle de salud tecleado, para que la diferencia sea solo hablar contra escribir/elegir.

| | Media | Mediana | Mín. | Máx. |
|---|---|---|---|---|
| Hablar | 93 s | 92 s | 56 s | 146 s |
| Toques (voz y escrito) | 17 s | 16 s | 16 s | 20 s |
| Revisión | 30 s | 30 s | 30 s | 30 s |
| Detalles de salud tecleados (ambos) | 6 s | 0 s | 0 s | 41 s |
| **VOZ**, fórmula pedida | 146 s | 146 s | 102 s | 200 s |
| Correcciones en la revisión (campos vacíos, incorrectos o inventados) | 15 s | 10 s | 5 s | 45 s |
| **VOZ** con correcciones | 161 s | 160 s | 109 s | 207 s |
| **ESCRIBIR** todo | 52 s | 48 s | 32 s | 102 s |
| (sensibilidad, no es dato) ESCRIBIR si lo abierto fuera 3 veces más largo | 92 s | 74 s | 51 s | 209 s |

Palabras habladas por persona: 232 (media). Caracteres abiertos verdaderos por persona: 68 (media). Latencia del modelo en la extracción (CLI de `claude -p`, arranque incluido, **no** va en las cuentas de arriba): 1.3 s por turno × 5 turnos.

## 4. Tres ejemplos completos (habla → extraído → verdad)

### Ejemplo 1 — persona 2 (estilo: algo nervioso: frases a medias, se corrige a mitad de frase; no dijo: tipo_trabajo)

**Turno sobre_ti** (30 palabras)

> Ah bueno, pues mira, yo soy de Cartagena, eh... vivo allá, pues sí. Y mido, mmm, uno cincuenta y siete centímetros, o sea más o menos así de alta, ¿vea?

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| ciudad | Cartagena («Cartagena») | Cartagena | exacto |
| edad | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| altura_cm | 157 («uno cincuenta y siete») | 157 | exacto |
| peso_actual_kg | (vacío) | (la encuesta no lo trae) | vacio_correcto |

**Turno objetivo** (65 palabras)

> Pues mira, eh, lo que quiero es mejorar mi salud en general, ¿vea? Llevo ya como un año, o sea, sin lograr avanzar en el press banca, eso es lo que me tiene, como diciéndolo así... me tiene estancada en eso. Y bueno, el peso que me gustaría alcanzar sería, eh, los cuarenta y dos punto nueve kilos, más o menos por ahí ando mirando.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| objetivo_principal | Salud general («mejorar mi salud en general») | Salud general | exacto |
| parte_a_mejorar | el press banca («el press banca») | Llevo un año sin subir el press banca. | incorrecto |
| peso_objetivo_kg | (vacío) | 42.9 | vacio |

Descartado por la validación: peso_objetivo_kg (numero_ambiguo: «cuarenta y dos punto nueve kilos»).

**Turno historia_entreno** (60 palabras)

> Mmm, bueno, pues miro que llevo entre dos y tres años entrenando, o sea, ya bastante tiempo, eh. Me considero avanzado, la verdad, o sea, mi nivel es avanzado porque, pues, los pesos que manejo son... bueno, en sentadilla ando por los ciento veintiséis kilos, y en el press, en el banco, manejo sesenta y cinco. Así que sí, avanzado.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tiempo_entrenando | 2 a 3 años («llevo entre dos y tres años entrenando») | 2 a 3 años | exacto |
| nivel_fuerza | Avanzado («los pesos que manejo son... bueno, en sentadilla ando por los ciento veintiséis kilos, y en el press, en el banco, manejo sesenta y cinco») | Avanzado | exacto |
| marcas_fuerza | en sentadilla ando por los ciento veintiséis kilos, y en el press, en el banco, manejo sesenta y cinco («en sentadilla ando por los ciento veintiséis kilos, y en el press, en el banco, manejo sesenta y cinco») | 126kg Sentadilla, 65kg Press Banca | incorrecto |
| nivel_autopercibido | Avanzado («Me considero avanzado») | Avanzado | exacto |

**Turno trabajo_horarios** (35 palabras)

> Ay, pues, mmm... la verdad es que, eh, no sé si... o sea, eso es como algo que prefiero no... no contar ahorita, ¿vea? Es que no tengo mucho para decir de eso, la verdad.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tipo_trabajo | (vacío) | (no lo dijo) | vacio_correcto |
| dia_tipo_alimentacion | (vacío) | (la encuesta no lo trae) | vacio_correcto |

**Turno comida** (33 palabras)

> Ay, pues mira, eh... la verdad yo no... no sé exactamente cuánta agua tomo al día, o sea, tomo agua pero no estoy midiendo ni nada, ¿vea? Ni idea, eh, así de honesto.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| cocina_o_compra | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| vasos_agua | (vacío) | ni idea | vacio |

Toques (verdad): sexo Masculino, país Colombia, días todos los q pueda bro, revisión 8 días, PAR-Q No/No/No, lesiones «Ninguna».

### Ejemplo 2 — persona 11 (estilo: relajado y muy coloquial (paisa o costeño); no dijo: altura_cm, tiempo_entrenando)

**Turno sobre_ti** (30 palabras)

> Ah pues mira, eh, soy de Lima, ¿vea?, tengo cuarenta años ya y bueno, la verdad ahorita ando pesando como ochenta y seis kilos, más o menos. Ahí estoy, pues.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| ciudad | Lima («Lima») | Lima | exacto |
| edad | 40 («cuarenta años») | 40 | exacto |
| altura_cm | (vacío) | (no lo dijo) | vacio_correcto |
| peso_actual_kg | 86 («ochenta y seis kilos») | 86.3 | aproximado |

**Turno objetivo** (50 palabras)

> Pues mira, la verdad yo quiero trabajar en ganar músculo, ¿vea?, o sea ponerme más grande en la espalda y mejorar la postura que la tengo ahí media caída. Y bueno, el peso que me gustaría alcanzar sería como los noventa y cinco punto ocho kilos, ahí está mi meta.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| objetivo_principal | Hipertrofia / estética («quiero trabajar en ganar músculo») | Hipertrofia / estética | exacto |
| parte_a_mejorar | ponerme más grande en la espalda y mejorar la postura («ponerme más grande en la espalda y mejorar la postura») | Espalda y postura | aproximado |
| peso_objetivo_kg | (vacío) | 95.8 | vacio |

Descartado por la validación: peso_objetivo_kg (numero_ambiguo: «noventa y cinco punto ocho kilos»).

**Turno historia_entreno** (56 palabras) — se le escapa algo de salud

> Ey, pues mira, eh... llevo bastante tiempo ya en esto, la verdad me siento avanzado en el tema, o sea, los pesos que manejo son los que son, ¿vea? Pero ahí, con la vaina del menisco de la rodilla izquierda, pues hay que tener cuidado con ciertas cosas, entonces eso influye un poquito en cómo entreno.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tiempo_entrenando | (vacío) | (no lo dijo) | vacio_correcto |
| nivel_fuerza | (vacío) | Avanzado | vacio |
| marcas_fuerza | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| nivel_autopercibido | Avanzado («me siento avanzado en el tema») | (la encuesta no lo trae) | inventado |

Salud marcada → toques: lesion («la vaina del menisco de la rodilla izquierda», modelo) → **lesiones, parq_huesos_articulaciones**. Ningún campo de salud rellenado.

**Turno trabajo_horarios** (72 palabras)

> Ah pues mira, yo trabajo en una oficina, eh, sentado todo el día prácticamente, como nueve horas o así. La verdad es que uno queda ahí metido en el escritorio, pues, entre computador y reuniones y eso. Un día normal mío es eso: llego, me siento y de ahí no me levanto casi, ¿vea? Por eso digo que necesito venir acá al gym, eh, para despertarme un poco la cintura y eso.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tipo_trabajo | oficina sentado 9 h («trabajo en una oficina, eh, sentado todo el día prácticamente, como nueve horas o así») | oficina sentado 9 h | exacto |
| dia_tipo_alimentacion | llego, me siento y de ahí no me levanto casi («llego, me siento y de ahí no me levanto casi») | (la encuesta no lo trae) | inventado |

**Turno comida** (39 palabras)

> Ay, la verdad pues, eh... no sé, eso ahí como que no... no me acuerdo bien de esos datos, vea. O sea, eso de la comida y el agua y eso, pues ahí ando medio perdido en este momento.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| cocina_o_compra | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| vasos_agua | (vacío) | (la encuesta no lo trae) | vacio_correcto |

Toques (verdad): sexo Masculino, país Perú, días 5, revisión 8 días, PAR-Q No/No/Sí, lesiones «menisco interno de la rodilla izquierda», ejercicios limitados «No puedo hacer sentadilla profunda ni saltos.».

### Ejemplo 3 — persona 3 (estilo: apurado, habla rápido y junta las ideas sin pausa; no dijo: altura_cm, peso_actual_kg)

**Turno sobre_ti** (31 palabras)

> Ay pues mira, soy de Cartagena, tengo treinta y uno, ehh y la verdad los otros datos no los tengo claros ahorita, ¿me entiendes? pero bueno, de Cartagena sí, eso seguro.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| ciudad | Cartagena («Cartagena») | Cartagena | exacto |
| edad | 31 («treinta y uno») | 31 | exacto |
| altura_cm | (vacío) | (no lo dijo) | vacio_correcto |
| peso_actual_kg | (vacío) | (no lo dijo) | vacio_correcto |

**Turno objetivo** (53 palabras)

> Ah sí, mira, yo vengo es por rendimiento y fuerza máxima, ¿vea?, quiero hipertrofia en piernas pero es que me pincha la rodilla derecha cuando bajo escaleras o hago desplantes y es una vaina que me jode, pero bueno, quiero llegar a como cuarenta y ocho punto ocho kilos, ahí está el tema.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| objetivo_principal | Rendimiento y Fuerza Máxima («rendimiento y fuerza máxima») | Rendimiento y Fuerza Máxima | exacto |
| parte_a_mejorar | hipertrofia en piernas («hipertrofia en piernas») | Quiero hipertrofia en piernas [la parte con salud va por toque] | aproximado |
| peso_objetivo_kg | (vacío) | 48.8 | vacio |

Salud marcada → toques: dolor («me pincha la rodilla derecha cuando bajo escaleras o hago desplantes», modelo) → **lesiones, parq_huesos_articulaciones**. Ningún campo de salud rellenado.

Descartado por la validación: peso_objetivo_kg (numero_ambiguo: «cuarenta y ocho punto ocho kilos»).

**Turno historia_entreno** (48 palabras)

> Ay pues mira, llevo como un año, año y medio entrenando, ehh, o sea más o menos entre uno y dos años ahí, la verdad, y me considero intermedio, vea, o sea que ya tengo nivel pero tampoco soy un crack todavía, pues, ahí voy en ese proceso.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tiempo_entrenando | 1 a 2 años («llevo como un año, año y medio entrenando») | 1 a 2 años | exacto |
| nivel_fuerza | (vacío) | Intermedio | vacio |
| marcas_fuerza | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| nivel_autopercibido | Intermedio («me considero intermedio») | (la encuesta no lo trae) | inventado |

**Turno trabajo_horarios** (49 palabras)

> Ay pues mira, trabajo en obra cargando peso todo el día, eh, entre semana es imposible la verdad, llego a las diez de la noche muerto, o sea no me alcanza pa' nada, pero los fines de semana sí tengo tiempo y ahí sí vengo al gym sin problema.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| tipo_trabajo | obra, cargando peso («trabajo en obra cargando peso todo el día») | obra, cargando peso | exacto |
| dia_tipo_alimentacion | (vacío) | Entre semana imposible, llego a las 10 de la noche. Fin de semana sí. | vacio |

Descartado por la validación: dia_tipo_alimentacion (cita_invalida: «entre semana es imposible la verdad, llego a las diez de la noche muerto, pero los fines de semana sí tengo tiempo»).

**Turno comida** (28 palabras)

> Ey, la verdad no... pues ahí no sé qué decirte, como no tengo claridad en eso ahorita, eh... mejor pregúntame otro día cuando esté más pendiente de eso.

| Campo | Extraído (cita) | Verdad | Resultado |
|---|---|---|---|
| cocina_o_compra | (vacío) | (la encuesta no lo trae) | vacio_correcto |
| vasos_agua | (vacío) | (la encuesta no lo trae) | vacio_correcto |

Toques (verdad): sexo Masculino, país Colombia, días 6, revisión 15 días, PAR-Q No/No/No, lesiones «No».

## 5. Casos a revisar a mano (todo inventado e incorrecto)

| Persona | Campo | Categoría | Verdad esperada | Extraído | Cita |
|---|---|---|---|---|---|
| 1 | objetivo_principal | **inventado** | (nada) | Salud general | «trabajar mucho la espalda, o sea, la postura principalmente» |
| 1 | nivel_autopercibido | **inventado** | (nada) | Principiante | «principiante digamos» |
| 2 | parte_a_mejorar | **incorrecto** | Llevo un año sin subir el press banca. | el press banca | «el press banca» |
| 2 | marcas_fuerza | **incorrecto** | 126kg Sentadilla, 65kg Press Banca | en sentadilla ando por los ciento veintiséis kilos, y en el press, en el banco, manejo sesenta y cinco | «en sentadilla ando por los ciento veintiséis kilos, y en el press, en el banco, manejo sesenta y cinco» |
| 3 | nivel_autopercibido | **inventado** | (nada) | Intermedio | «me considero intermedio» |
| 4 | marcas_fuerza | **inventado** | (nada) | en la sentadilla ando manejando mis cositas, y en el press banca también voy avanzando | «en la sentadilla ando manejando mis cositas, y en el press banca también voy avanzando» |
| 4 | dia_tipo_alimentacion | **inventado** | (nada) | llego, me siento, y de ahí no me paro hasta que se acaba el turno | «llego, me siento, y de ahí no me paro hasta que se acaba el turno» |
| 4 | cocina_o_compra | **inventado** | (nada) | Cocino la mitad y compro la otra mitad | «yo cocino pero también compro cosas hechas, o sea, depende del día» |
| 5 | parte_a_mejorar | **incorrecto** | Estancamiento en peso muerto desde hace 6 meses. Quiero romper mi RM de 171kg. | romper mi récord personal que tengo en ciento setenta y uno kilos | «romper mi récord personal que tengo en ciento setenta y uno kilos» |
| 6 | objetivo_principal | **inventado** | (nada) | Hipertrofia / estética | «ganar masa en las piernas» |
| 6 | parte_a_mejorar | **incorrecto** | Quiero hipertrofia en piernas | las piernas | «las piernas» |
| 6 | nivel_autopercibido | **inventado** | (nada) | Principiante | «soy principiante todavía» |
| 7 | peso_actual_kg | **incorrecto** | 56.7 | 113 | «como cincuenta y seis, cincuenta y siete kilos» |
| 7 | marcas_fuerza | **inventado** | (nada) | manejo mis pesos ahí normalmente | «manejo mis pesos ahí normalmente» |
| 7 | nivel_autopercibido | **inventado** | (nada) | Intermedio | «me veo bien de nivel» |
| 8 | parte_a_mejorar | **incorrecto** | Necesito bajar 25 kg antes de diciembre, sea como sea. | bajar como veinticinco kilos | «bajar como veinticinco kilos» |
| 8 | peso_objetivo_kg | **incorrecto** | 63.4 | 97 | «sesenta y tres, treinta y cuatro kilos» |
| 9 | nivel_autopercibido | **inventado** | (nada) | Intermedio | «yo diría que intermedio» |
| 10 | parte_a_mejorar | **inventado** | (nada) | mejorar eso para mi desempeño | «mejorar eso para mi desempeño» |
| 10 | nivel_autopercibido | **inventado** | (nada) | Avanzado | «me siento en un nivel avanzado ya con los pesos que estoy manejando» |
| 10 | dia_tipo_alimentacion | **inventado** | (nada) | a veces me toca madrugada, a veces tarde, a veces noche, entonces nunca es igual | «a veces me toca madrugada, a veces tarde, a veces noche, entonces nunca es igual» |
| 11 | nivel_autopercibido | **inventado** | (nada) | Avanzado | «me siento avanzado en el tema» |
| 11 | dia_tipo_alimentacion | **inventado** | (nada) | llego, me siento y de ahí no me levanto casi | «llego, me siento y de ahí no me levanto casi» |
| 12 | objetivo_principal | **inventado** | (nada) | Rendimiento y Fuerza Máxima | «avanzar con el press banca» |
| 12 | parte_a_mejorar | **incorrecto** | Llevo un año sin subir el press banca. | el press banca | «el press banca» |
| 12 | nivel_fuerza | **incorrecto** | Avanzado | Intermedio | «ciento diecinueve kilos, y en press banca, mmm, unos ochenta y nueve» |
| 13 | ciudad | **inventado** | (nada) | acá de Colombia | «acá de Colombia» |
| 13 | nivel_autopercibido | **inventado** | (nada) | Principiante | «yo diría que soy principiante todavía» |
| 13 | dia_tipo_alimentacion | **inventado** | (nada) | mi día es... es bien intenso la verdad. No tengo horarios fijos así como la gente que va a una oficina, pues aquí en la casa es todo el día, eh, desde que me levanto hasta que me acuesto prácticamente | «mi día es... es bien intenso la verdad. No tengo horarios fijos así como la gente que va a una oficina, pues aquí en la casa es todo el día, eh, desde que me levanto hasta que me acuesto prácticamente» |
| 14 | dia_tipo_alimentacion | **inventado** | (nada) | llego, me siento y de ahí no me levanto casi | «llego, me siento y de ahí no me levanto casi» |
| 15 | nivel_autopercibido | **inventado** | (nada) | Principiante | «soy principiante todavía» |
| 16 | edad | **inventado** | (nada) | 31 | «treinta y uno» |
| 16 | nivel_autopercibido | **inventado** | (nada) | Intermedio | «Soy de nivel intermedio» |
| 16 | dia_tipo_alimentacion | **inventado** | (nada) | Un día normal es caótico la verdad, entre los niños, la casa, todo eso. No tengo un horario fijo digamos, es más bien según lo que vaya saliendo. | «Un día normal es caótico la verdad, entre los niños, la casa, todo eso. No tengo un horario fijo digamos, es más bien según lo que vaya saliendo.» |
| 17 | nivel_autopercibido | **inventado** | (nada) | Intermedio | «Me considero intermedio en el nivel» |
| 18 | nivel_autopercibido | **inventado** | (nada) | Principiante | «soy principiante todavía» |
| 19 | peso_actual_kg | **incorrecto** | 66.8 | 74 | «sesenta y seis, ocho kilos» |
| 19 | nivel_autopercibido | **inventado** | (nada) | Principiante | «soy principiante todavía» |
| 19 | dia_tipo_alimentacion | **inventado** | (nada) | todos los días igual | «todos los días igual» |
| 20 | nivel_fuerza | **inventado** | (nada) | Intermedio | «En sentadilla ando por ahí en unos ochenta y cinco kilos, y en press banca como sesenta y cinco» |
| 20 | marcas_fuerza | **inventado** | (nada) | En sentadilla ando por ahí en unos ochenta y cinco kilos, y en press banca como sesenta y cinco | «En sentadilla ando por ahí en unos ochenta y cinco kilos, y en press banca como sesenta y cinco» |
| 20 | nivel_autopercibido | **inventado** | (nada) | Intermedio | «me considero nivel intermedio» |

### Salud: marcas y descartes

| Persona | Lo que se le escapó | Marcas (tema/origen) | Toques que se activan |
|---|---|---|---|
| 1 | limitacion: Bajar escaleras me duele. | dolor/diccionario, dolor/modelo | lesiones, parq_huesos_articulaciones |
| 3 | en «qué quiere mejorar» | dolor/modelo | lesiones, parq_huesos_articulaciones |
| 6 | en «qué quiere mejorar» | dolor/modelo | lesiones, parq_huesos_articulaciones |
| 11 | lesion: menisco interno de la rodilla izquierda | lesion/modelo | lesiones, parq_huesos_articulaciones |
| 15 | lesion: Hipertensión controlada | cardiaco/modelo | parq_enfermedad_cardiaca, parq_medicamento_presion |
| 16 | limitacion: El médico me prohibió contener la respiración (Valsalva) y cargar peso sobre la espalda. | cardiaco/modelo | parq_enfermedad_cardiaca, parq_medicamento_presion |
| 19 | lesion: Hipertensión · menisco interno de la rodilla izquierda | lesion/modelo, cardiaco/modelo | lesiones, parq_huesos_articulaciones, parq_enfermedad_cardiaca, parq_medicamento_presion |
| 20 | lesion: Hipertensión | — NO MARCADA — |  |

### Lo que la validación descartó al modelo

numero_ambiguo: 19 · cita_invalida: 6 · fuera_de_rango: 1 · texto_clinico: 1
