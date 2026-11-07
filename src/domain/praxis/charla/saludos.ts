/**
 * Saludos por situación y sin repetirse por persona (diseño de la capa conversacional, 6-nov-2026, secciones 3.1 a 3.3).
 *
 * Lógica PURA: sin React, sin I/O, sin estado global. El historial de lo ya dicho a CADA persona llega como
 * argumento y el que llama lo guarda (esta pieza no persiste nada entre días). El azar también llega como argumento.
 *
 * Dos voces (decisión de Bryan, 6-nov): `equipo` habla en tercera persona, técnica, sin «tú» ni «usted»;
 * `asesorado` habla de tú. Praxis NO dice que es una IA aquí: solo lo dice si le preguntan (eso vive en charla.ts).
 * No promete nada clínico. Los ejemplos son inventados; el repertorio real lo aprueban Bryan o Manuela por muestra.
 *
 * Casos reales de la landing (6-nov): #9 se responde el saludo primero (`ordenarRespuesta`); #2 un aviso se dice
 * una sola vez por charla (`debeDecirAviso`); #4 hay aperturas ligeras con humor amable, nunca en día malo ni de
 * madrugada; #8 ningún conector es una fórmula de redirección («volviendo a…»).
 */

export type Voz = 'equipo' | 'asesorado'

export type Situacion =
  | 'primera_vez' | 'vuelve_tras_dias' | 'despues_de_entrenar' | 'dia_malo' | 'madrugada_o_noche' | 'retoma_mismo_dia'

export const SITUACIONES: readonly Situacion[] = [
  'primera_vez', 'vuelve_tras_dias', 'despues_de_entrenar', 'dia_malo', 'madrugada_o_noche', 'retoma_mismo_dia',
]

export type FamiliaDeConector = 'retomar' | 'cambiar' | 'causa' | 'cerrar'
export const FAMILIAS: readonly FamiliaDeConector[] = ['retomar', 'cambiar', 'causa', 'cerrar']

/** Ventanas de no repetición (R1 y R2 del diseño; los números se calibran). */
export const VENTANA_APERTURA = 5
export const VENTANA_COLA = 3
export const VENTANA_CONECTOR = 8
/** R4: el nombre se usa a lo sumo una vez cada 3 respuestas. */
export const VENTANA_NOMBRE = 3
/** Días sin actividad desde los que se considera que la persona «vuelve» (umbral por calibrar). */
export const DIAS_PARA_VOLVER = 4
/** Minutos tras cerrar la sesión en que aún es «después de entrenar». */
export const MINUTOS_DESPUES_DE_ENTRENAR = 180

/* ——— Situación del día ——— */
export interface DatosDeSituacion {
  /** Hora local, 0 a 23. */
  hora: number
  primerDia: boolean
  /** Días desde la última actividad; `null` si no se sabe. */
  diasDesdeLaUltima: number | null
  /** Minutos desde que cerró la sesión de hoy; `null` si no hubo. */
  minutosDesdeSesion: number | null
  /** Ánimo bajo declarado hoy (en la charla o en el check-in). */
  diaMalo: boolean
  /** Ya hubo charla con la persona hoy. */
  yaHabloHoy: boolean
}

/**
 * Prioridad: día malo > primera vez > madrugada o noche > vuelve tras días > después de entrenar > retoma el mismo día.
 * `null`: ninguna aplica (la rutina sigue por el libreto de siempre). La seguridad va ANTES de todo y no pasa por aquí.
 */
export function situacionDelDia(d: DatosDeSituacion): Situacion | null {
  if (d.diaMalo) return 'dia_malo'
  if (d.primerDia) return 'primera_vez'
  if (d.hora < 5 || d.hora >= 22) return 'madrugada_o_noche'
  if (d.diasDesdeLaUltima !== null && d.diasDesdeLaUltima >= DIAS_PARA_VOLVER) return 'vuelve_tras_dias'
  if (d.minutosDesdeSesion !== null && d.minutosDesdeSesion >= 0 && d.minutosDesdeSesion < MINUTOS_DESPUES_DE_ENTRENAR) return 'despues_de_entrenar'
  if (d.yaHabloHoy) return 'retoma_mismo_dia'
  return null
}

/* ——— Repertorio. `{n}` es «, Nombre» (o nada). La voz del equipo no usa nombre. ——— */
interface Repertorio { aperturas: readonly string[]; colas: readonly string[] }

export const REPERTORIO: Record<Voz, Record<Situacion, Repertorio>> = {
  asesorado: {
    primera_vez: {
      aperturas: [
        'Hola{n}. Qué gusto empezar contigo.',
        'Qué bueno tenerte por aquí{n}.',
        'Hola{n}. Soy Praxis, voy a acompañarte con el entrenamiento y la comida.',
        'Mucho gusto{n}. Empecemos sin afán.',
        'Buenas{n}. Esta es nuestra primera charla.',
        'Hola{n}. Arrancamos hoy, y está bien ir despacio.',
        'Llegaste{n}, y qué bien. Nada de afán por acá.',
        'Un gusto saludarte{n}.',
        'Hola{n}. Hoy solo nos conocemos.',
        'Comenzamos con calma{n}.',
      ],
      colas: [
        'Cuéntame cómo llegas hoy, sin prisa.',
        '¿Qué te gustaría trabajar primero?',
        '¿Cómo te sientes con el entrenamiento por ahora?',
        'Si quieres, me cuentas cómo es una semana tuya.',
        '¿Por dónde prefieres empezar?',
      ],
    },
    vuelve_tras_dias: {
      aperturas: [
        'Qué bueno verte por aquí otra vez{n}.',
        'Pasaron unos días{n}. Aquí seguimos.',
        'Hola de nuevo{n}.',
        'Qué gusto que vuelvas{n}.',
        'Volviste{n}, y eso suma.',
        'De vuelta por acá{n}, qué bien.',
        'Buenas{n}. Qué bien tenerte de vuelta.',
        'Qué alegría verte de nuevo{n}.',
        'Te dejamos la puerta abierta{n}, y volviste.',
        'Aquí retomamos cuando quieras{n}.',
      ],
      colas: [
        '¿Cómo estuvieron estos días?',
        '¿Cómo has estado desde la última vez?',
        '¿Qué tal te fue en la pausa?',
        'Cuéntame cómo vienes, sin presión.',
        '¿Retomamos donde quedamos o empezamos de nuevo?',
      ],
    },
    despues_de_entrenar: {
      aperturas: [
        'Terminaste hace un rato{n}.',
        'Buen trabajo con la sesión de hoy{n}.',
        'Ya cerraste la sesión de hoy{n}.',
        'Entrenaste hoy{n}. Eso cuenta.',
        'Qué bien, ya pasaste por el entrenamiento{n}.',
        'Hola{n}. Acabas de entrenar, ¿cierto?',
        'Sesión hecha{n}. Ahora toca recuperar.',
        'Descansa un poco{n}, ya entrenaste.',
        'Qué sesión la de hoy{n}.',
        'Cerraste el entrenamiento{n}. Bien ahí.',
      ],
      colas: [
        '¿Cómo te sentiste en la sesión?',
        '¿Qué tal quedó el cuerpo después de entrenar?',
        '¿Cómo te fue con las cargas de hoy?',
        '¿Algo que quieras contar de la sesión?',
        'Cuéntame cómo la sentiste.',
      ],
    },
    dia_malo: {
      aperturas: [
        'Suena a un día pesado{n}.',
        'Qué día tan largo parece{n}.',
        'Aquí estoy{n}, sin afán.',
        'Hoy no hay que rendir nada{n}.',
        'Te leo{n}. Vamos suave.',
        'Parece que hoy costó{n}.',
        'Uno de esos días{n}, ¿no?',
        'No hace falta explicar nada{n}.',
        'Un día cuesta arriba{n}.',
        'Respira un momento{n}.',
      ],
      colas: [
        'Cuéntame lo que quieras, sin tarea.',
        'No hay nada que completar ahora.',
        'Aquí te escucho, a tu ritmo.',
        'Lo que quieras decir, dímelo; lo que no, lo dejamos.',
        'Si prefieres, hablamos de otra cosa o no hablamos de nada.',
      ],
    },
    madrugada_o_noche: {
      aperturas: [
        'Hora rara para escribir{n}.',
        'Madrugando o trasnochando{n}, ¿no?',
        'Tarde por allá{n}.',
        'Buenas{n}, a deshoras.',
        'Qué hora tan particular{n}.',
        'Hola{n}. A esta hora todo se siente más callado.',
        'Noche larga{n}.',
        'Desvelo o madrugón{n}, ¿cuál es?',
        'Las horas raras tienen su encanto{n}.',
        'Por aquí hay luz a toda hora{n}.',
      ],
      colas: [
        '¿Todo bien por allá?',
        '¿Qué te desvela a esta hora?',
        'Si quieres lo dejamos corto y seguimos mañana.',
        '¿Necesitas algo puntual o solo compañía un rato?',
        '¿Cómo va la noche?',
      ],
    },
    retoma_mismo_dia: {
      aperturas: [
        'Aquí de nuevo{n}.',
        'Otra vez por acá{n}.',
        'Sigamos{n}, entonces.',
        'Qué bueno que sigues por acá{n}.',
        'Hola otra vez{n}.',
        'Retomamos{n}.',
        'De vuelta en la charla{n}.',
        'Ya volviste{n}.',
        'Seguimos donde íbamos{n}.',
        'Un momento después, aquí estamos{n}.',
      ],
      colas: [
        '¿En qué íbamos?',
        '¿Qué se te quedó pendiente?',
        'Dime, ¿qué más hay?',
        '¿Seguimos con lo de hace un rato?',
        'Cuéntame qué pasó desde entonces.',
      ],
    },
  },
  equipo: {
    primera_vez: {
      aperturas: [
        'Primer contacto con esta persona; se parte de lo que consta en la ficha.',
        'Se inicia el seguimiento. No hay historial previo de charla.',
        'Es la primera conversación registrada con esta persona.',
        'Se abre la charla sin datos previos; se avanza con calma.',
        'Inicio de la relación con el seguimiento; el ritmo lo marca la propia persona.',
        'Sin antecedentes de charla en el sistema; se escucha primero.',
        'Arranca el acompañamiento. Se evita pedir datos en frío.',
        'Primera charla de la persona con el sistema.',
        'Se parte de cero en la conversación; la ficha orienta.',
        'Alta reciente en la charla; sin tema impuesto.',
      ],
      colas: [
        'Se pregunta cómo desea empezar, sin formulario.',
        'Queda abierta la puerta para que cuente lo que quiera.',
        'Se ofrece el espacio para hablar de entreno o comida, a su ritmo.',
        'Se deja la primera pregunta abierta y suave.',
        'No se piden datos: primero se escucha.',
      ],
    },
    vuelve_tras_dias: {
      aperturas: [
        'Retoma tras varios días sin actividad registrada.',
        'La persona regresa después de una pausa.',
        'Vuelve a la charla luego de unos días.',
        'Hay un intervalo de varios días desde el último contacto.',
        'Reaparece tras unos días de pausa; se retoma sin reproches.',
        'Se reanuda el contacto después de unos días.',
        'Regreso al seguimiento; la pausa no se señala como falta.',
        'Pausa de varios días antes de este mensaje.',
        'Retorno al seguimiento tras días sin registros.',
        'Han pasado unos días desde la última charla.',
      ],
      colas: [
        'Se pregunta cómo estuvieron esos días.',
        'Se consulta cómo viene desde el último registro.',
        'Se deja que cuente la pausa con sus palabras.',
        'Se ofrece retomar donde quedó o partir de nuevo.',
        'Se pregunta por la semana, sin presión.',
      ],
    },
    despues_de_entrenar: {
      aperturas: [
        'La sesión de hoy ya está cerrada.',
        'Contacto poco después de terminar el entrenamiento.',
        'Hay una sesión recién terminada.',
        'Se escribe tras el entrenamiento de hoy.',
        'Cierre reciente de sesión; interesa la sensación más que el dato.',
        'Terminó hace poco de entrenar.',
        'Entrenamiento de hoy concluido; la app ya tiene lo registrado.',
        'Mensaje posterior a la sesión de hoy.',
        'Acaba de cerrarse el entrenamiento del día.',
        'Sesión finalizada hace poco; se pregunta por lo vivido.',
      ],
      colas: [
        'Se pregunta por la sensación en la sesión.',
        'Se consulta cómo quedó el cuerpo después de entrenar.',
        'Se pregunta por las cargas de hoy, sin repetir lo ya registrado.',
        'Queda abierto el espacio para comentar la sesión.',
        'Se pide que la describa con sus palabras.',
      ],
    },
    dia_malo: {
      aperturas: [
        'La persona describe un día pesado.',
        'Se detecta ánimo bajo hoy; sin tareas ni preguntas de formulario.',
        'Día difícil según lo dicho; se escucha primero.',
        'Hoy no es día de exigir; se recoge lo que la persona quiera contar.',
        'Ánimo bajo declarado; se conserva el tono suave.',
        'Se reconoce el cansancio expresado y no se agrega carga.',
        'Jornada complicada según lo dicho; no hay nada que completar ahora.',
        'Se percibe un día cuesta arriba en lo dicho.',
        'Prima la escucha sobre cualquier tarea.',
        'Sin exigencias hoy; la persona marca el ritmo.',
      ],
      colas: [
        'Se deja que cuente lo que quiera, sin tarea.',
        'No hay nada que completar en este momento.',
        'Se acompaña a su ritmo.',
        'Lo que decida decir se recoge; lo demás se deja.',
        'Se ofrece hablar de otra cosa o no hablar.',
      ],
    },
    madrugada_o_noche: {
      aperturas: [
        'Contacto a una hora poco habitual.',
        'Escribe de madrugada o muy tarde; el horario no se juzga.',
        'Hora avanzada de la noche; se mantiene el tono tranquilo.',
        'Charla fuera del horario usual; se atiende sin comentarios sobre la hora.',
        'Es tarde; se cuida que la conversación sea breve.',
        'Noche cerrada; lo importante se deja para mañana si hace falta.',
        'En horas de descanso se atiende la charla.',
        'Mensaje fuera de horario habitual.',
        'Se atiende de noche sin juzgar el horario.',
        'Hora tardía; se prioriza lo breve y lo tranquilo.',
      ],
      colas: [
        'Se pregunta si todo está bien.',
        'Se consulta si hay algo puntual.',
        'Se ofrece dejarlo corto y seguir mañana.',
        'Se pregunta cómo va la noche.',
        'Se deja abierto, sin insistir.',
      ],
    },
    retoma_mismo_dia: {
      aperturas: [
        'La persona vuelve a escribir hoy.',
        'Segundo contacto del día.',
        'Retoma la charla de hace un rato.',
        'Se continúa la charla de hoy sin empezar de cero.',
        'Regresa en el mismo día.',
        'Nuevo mensaje tras una pausa corta.',
        'Sigue la conversación de hoy donde quedó.',
        'Continúa la conversación iniciada hoy.',
        'Reaparece en la misma jornada.',
        'Otro mensaje de la persona en el día.',
      ],
      colas: [
        'Se pregunta en qué se había quedado.',
        'Se consulta qué quedó pendiente.',
        'Se pregunta qué ocurrió desde entonces.',
        'Se ofrece seguir con lo anterior.',
        'Queda abierto para lo que falte.',
      ],
    },
  },
}

/** Trato de la persona. La voz del equipo no lo usa (tercera persona). */
export type Tratamiento = 'tu' | 'usted'

/** La voz del asesorado tratada de «usted»: mismas situaciones y mismas reglas, 10 aperturas y 5 colas por situación. */
export const REPERTORIO_USTED: Record<Situacion, Repertorio> = {
  primera_vez: {
    aperturas: [
      'Hola{n}. Qué gusto empezar con usted.',
      'Qué bueno contar con usted por aquí{n}.',
      'Hola{n}. Soy Praxis, voy a acompañarle con el entrenamiento y la comida.',
      'Mucho gusto{n}. Empecemos sin afán.',
      'Buenas{n}. Esta es nuestra primera charla.',
      'Hola{n}. Arrancamos hoy, y está bien ir despacio.',
      'Llegó{n}, y qué bien. Nada de afán por acá.',
      'Un gusto saludarle{n}.',
      'Hola{n}. Hoy apenas nos conocemos.',
      'Comenzamos con calma{n}.',
    ],
    colas: [
      'Cuénteme cómo llega hoy, sin prisa.',
      '¿Qué le gustaría trabajar primero?',
      '¿Cómo se siente con el entrenamiento por ahora?',
      'Si quiere, me cuenta cómo es una semana suya.',
      '¿Por dónde prefiere empezar?',
    ],
  },
  vuelve_tras_dias: {
    aperturas: [
      'Qué bueno volver a verle por aquí{n}.',
      'Pasaron unos días{n}. Aquí seguimos.',
      'Hola de nuevo{n}.',
      'Qué gusto que vuelva{n}.',
      'Volvió{n}, y eso suma.',
      'De vuelta por acá{n}, qué bien.',
      'Buenas{n}. Qué bien tenerle de vuelta.',
      'Qué alegría verle de nuevo{n}.',
      'Le dejamos la puerta abierta{n}, y volvió.',
      'Aquí retomamos cuando quiera{n}.',
    ],
    colas: [
      '¿Cómo estuvieron estos días?',
      '¿Cómo ha estado desde la última vez?',
      '¿Qué tal le fue en la pausa?',
      'Cuénteme cómo viene, sin presión.',
      '¿Retomamos donde quedamos o empezamos de nuevo?',
    ],
  },
  despues_de_entrenar: {
    aperturas: [
      'Terminó hace un rato{n}.',
      'Buen trabajo con la sesión de hoy{n}.',
      'Ya cerró la sesión de hoy{n}.',
      'Entrenó hoy{n}. Eso cuenta.',
      'Qué bien, ya pasó por el entrenamiento{n}.',
      'Hola{n}. Acaba de entrenar, ¿cierto?',
      'Sesión hecha{n}. Ahora toca recuperar.',
      'Descanse un poco{n}, ya entrenó.',
      'Qué sesión la de hoy{n}.',
      'Cerró el entrenamiento{n}. Bien ahí.',
    ],
    colas: [
      '¿Cómo se sintió en la sesión?',
      '¿Qué tal quedó el cuerpo después de entrenar?',
      '¿Cómo le fue con las cargas de hoy?',
      '¿Algo que quiera contar de la sesión?',
      'Cuénteme cómo la sintió.',
    ],
  },
  dia_malo: {
    aperturas: [
      'Suena a un día pesado{n}.',
      'Qué día tan largo parece{n}.',
      'Aquí estoy{n}, sin afán.',
      'Hoy no hay que rendir nada{n}.',
      'Lo leo{n}. Vamos suave.',
      'Parece que hoy costó{n}.',
      'Uno de esos días{n}, ¿no?',
      'No hace falta explicar nada{n}.',
      'Un día cuesta arriba{n}.',
      'Respire un momento{n}.',
    ],
    colas: [
      'Cuénteme lo que quiera, sin tarea.',
      'No hay nada que completar ahora.',
      'Aquí lo escucho, a su ritmo.',
      'Lo que quiera decir, dígamelo; lo que no, lo dejamos.',
      'Si prefiere, hablamos de otra cosa o no hablamos de nada.',
    ],
  },
  madrugada_o_noche: {
    aperturas: [
      'Hora rara para escribir{n}.',
      'Madrugando o trasnochando{n}, ¿no?',
      'Tarde por allá{n}.',
      'Buenas{n}, a deshoras.',
      'Qué hora tan particular{n}.',
      'Hola{n}. A esta hora todo se siente más callado.',
      'Noche larga{n}.',
      'Desvelo o madrugón{n}, ¿cuál es?',
      'Las horas raras tienen su encanto{n}.',
      'Por aquí hay luz a toda hora{n}.',
    ],
    colas: [
      '¿Todo bien por allá?',
      '¿Qué lo desvela a esta hora?',
      'Si quiere lo dejamos corto y seguimos mañana.',
      '¿Necesita algo puntual o solo compañía un rato?',
      '¿Cómo va la noche?',
    ],
  },
  retoma_mismo_dia: {
    aperturas: [
      'Aquí de nuevo{n}.',
      'Otra vez por acá{n}.',
      'Sigamos{n}, entonces.',
      'Qué bueno que sigue por acá{n}.',
      'Hola otra vez{n}.',
      'Retomamos{n}.',
      'De vuelta en la charla{n}.',
      'Ya volvió{n}.',
      'Seguimos donde íbamos{n}.',
      'Un momento después, aquí estamos{n}.',
    ],
    colas: [
      '¿En qué íbamos?',
      '¿Qué se le quedó pendiente?',
      'Dígame, ¿qué más hay?',
      '¿Seguimos con lo de hace un rato?',
      'Cuénteme qué pasó desde entonces.',
    ],
  },
}

export const APERTURAS_LIGERAS_USTED: Partial<Record<Situacion, readonly string[]>> = {
  primera_vez: ['Hola{n}. Prometo no ser un sargento.'],
  vuelve_tras_dias: ['Vea quién volvió{n}. Sin reproches.', 'Los músculos no se olvidan tan rápido{n}.'],
  despues_de_entrenar: ['Hoy las pesas perdieron{n}.', 'Ya puede soltar lo pesado por hoy{n}.'],
  retoma_mismo_dia: ['Y usted otra vez{n}. Qué buena señal.', 'Dos veces en un día{n}. Ya casi somos socios.'],
}

export const CONECTORES_USTED: Record<FamiliaDeConector, readonly string[]> = {
  retomar: [
    'Lo que contó antes me hace pensar:',
    'Usted mencionó hace un rato que',
    'Retomo lo que dijo antes:',
    'Sobre eso que comentaba hace un momento,',
  ],
  cambiar: [
    'Cambio de tema un segundo:',
    'Y ya que estamos, le pregunto algo distinto:',
    'Si le parece, pasamos a otra cosa:',
    'Aprovecho para preguntarle otra cosa:',
  ],
  causa: [
    'Con eso que cuenta,',
    'Si ese es el panorama,',
    'Dado lo que me dice,',
    'Teniendo en cuenta su semana,',
  ],
  cerrar: [
    'Listo con eso, seguimos con lo otro.',
    'Eso queda claro por ahora.',
    'Con eso ya tengo el panorama; sigamos.',
    'Bien, dejemos eso ahí.',
  ],
}

/** Qué repertorio, ligeras y conectores corresponden a la voz y al trato. El equipo no distingue trato. */
function fuentes(voz: Voz, trato: Tratamiento): { rep: Record<Situacion, Repertorio>; ligeras: Partial<Record<Situacion, readonly string[]>>; conectores: Record<FamiliaDeConector, readonly string[]> } {
  if (voz === 'asesorado' && trato === 'usted') return { rep: REPERTORIO_USTED, ligeras: APERTURAS_LIGERAS_USTED, conectores: CONECTORES_USTED }
  return { rep: REPERTORIO[voz], ligeras: voz === 'asesorado' ? APERTURAS_LIGERAS : {}, conectores: CONECTORES[voz] }
}

/**
 * Aperturas LIGERAS (humor amable, caso #4 de la landing). Solo voz del asesorado y solo en situaciones de ánimo
 * neutro: nunca en día malo ni de madrugada, y jamás sobre salud. Nunca se burlan de la persona. Se suman al
 * repertorio normal cuando el que llama pide `humor`.
 */
export const APERTURAS_LIGERAS: Partial<Record<Situacion, readonly string[]>> = {
  primera_vez: ['Hola{n}. Prometo no ser un sargento.'],
  vuelve_tras_dias: ['Mira quién volvió{n}. Sin reproches.', 'Los músculos no se olvidan tan rápido{n}.'],
  despues_de_entrenar: ['Hoy las pesas perdieron{n}.', 'Ya puedes soltar lo pesado por hoy{n}.'],
  retoma_mismo_dia: ['Y tú otra vez{n}. Qué buena señal.', 'Dos veces en un día{n}. Ya casi somos socios.'],
}

/** Conectores entre temas, cuatro familias, por voz. Ninguno es una fórmula de redirección («volviendo a…», caso #8). */
export const CONECTORES: Record<Voz, Record<FamiliaDeConector, readonly string[]>> = {
  asesorado: {
    retomar: [
      'Lo que contaste antes me hace pensar:',
      'Tú mencionaste hace un rato que',
      'Retomo lo que dijiste antes:',
      'Sobre eso que comentabas hace un momento,',
    ],
    cambiar: [
      'Cambio de tema un segundo:',
      'Y ya que estamos, te pregunto algo distinto:',
      'Si te parece, pasamos a otra cosa:',
      'Aprovecho para preguntarte otra cosa:',
    ],
    causa: [
      'Con eso que cuentas,',
      'Si ese es el panorama,',
      'Dado lo que me dices,',
      'Teniendo en cuenta tu semana,',
    ],
    cerrar: [
      'Listo con eso, seguimos con lo otro.',
      'Eso queda claro por ahora.',
      'Con eso ya tengo el panorama; sigamos.',
      'Bien, dejemos eso ahí.',
    ],
  },
  equipo: {
    retomar: [
      'Se retoma lo registrado antes en la charla:',
      'Conforme a lo señalado previamente,',
      'Del punto ya mencionado se desprende que',
      'Respecto de lo que consta de la conversación anterior,',
    ],
    cambiar: [
      'Se pasa a otro tema:',
      'Corresponde ahora revisar otro punto:',
      'Se abre un punto distinto:',
      'Cambia el asunto a tratar:',
    ],
    causa: [
      'Dado lo descrito,',
      'En función de lo reportado,',
      'A partir de este panorama,',
      'Considerando la semana descrita,',
    ],
    cerrar: [
      'Queda cerrado este punto; se continúa con el siguiente.',
      'Este punto no requiere más por ahora.',
      'Se da por tratado este tema.',
      'Con esto el punto queda resumido; sigue el siguiente.',
    ],
  },
}

/* ——— Huellas e historial por persona ——— */
/** Lo que se guarda de cada respuesta ya dada a UNA persona (no el texto: solo las huellas). Más reciente al final. */
export interface HuellaDeRespuesta {
  situacion: Situacion | null
  apertura?: string
  cola?: string
  conector?: string
  /** ¿Esa respuesta usó el nombre? (R4) */
  nombre?: boolean
}
export type HistorialPersona = readonly HuellaDeRespuesta[]

/** Las dos o tres primeras palabras, sin tildes, signos, mayúsculas ni el nombre. */
export function huellaDe(texto: string, palabras = 3): string {
  return texto
    .replace('{n}', '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').slice(0, palabras).join(' ')
}

/** Agrega una respuesta al historial y lo recorta a lo que alguna ventana puede necesitar. No muta el original. */
export function registrarUso(historial: HistorialPersona, h: HuellaDeRespuesta, tope = 20): HistorialPersona {
  return [...historial, h].slice(-tope)
}

type Azar = () => number

/**
 * Elige una opción cuya huella no esté en `recientes`. Si todas están (no pasa con los repertorios de aquí,
 * que superan la ventana), usa la que se dijo hace más tiempo. `azar` devuelve [0, 1).
 */
function elegirSinRepetir(opciones: readonly string[], recientes: readonly string[], azar: Azar): string {
  const libres = opciones.filter((o) => !recientes.includes(huellaDe(o)))
  if (libres.length > 0) return libres[Math.min(libres.length - 1, Math.floor(azar() * libres.length))]
  const ultimaVez = (o: string): number => recientes.lastIndexOf(huellaDe(o))
  return [...opciones].sort((a, b) => ultimaVez(a) - ultimaVez(b))[0]
}

const ultimas = (h: HistorialPersona, n: number, campo: 'apertura' | 'cola' | 'conector'): string[] =>
  h.slice(-n).map((x) => x[campo]).filter((x): x is string => typeof x === 'string')

export interface SaludoElegido {
  /** El texto ya con el nombre puesto (o sin él). */
  apertura: string
  cola: string
  /** Lo que el que llama agrega al historial de esta persona (con `registrarUso`). */
  huella: HuellaDeRespuesta
}

/** Apertura y cola de una situación, en la voz dada, sin repetir lo dicho a esta persona en las últimas N respuestas. */
export function elegirSaludo(p: {
  voz: Voz
  situacion: Situacion
  nombre?: string | null
  historial: HistorialPersona
  azar: Azar
  /** Suma las aperturas ligeras (solo voz asesorado; nunca en día malo ni de madrugada). */
  humor?: boolean
  /** Solo para la voz asesorado; por omisión «tu». */
  trato?: Tratamiento
}): SaludoElegido {
  const { rep: todo, ligeras: todasLigeras } = fuentes(p.voz, p.trato ?? 'tu')
  const rep = todo[p.situacion]
  const ligeras = p.humor ? (todasLigeras[p.situacion] ?? []) : []
  const opciones = [...rep.aperturas, ...ligeras]
  // Ventana: al menos VENTANA_APERTURA; sube hasta dejar 2 libres para que 10 respuestas den >= 8 aperturas distintas (M1).
  const crudaApertura = elegirSinRepetir(opciones, ultimas(p.historial, Math.max(VENTANA_APERTURA, opciones.length - 2), 'apertura'), p.azar)
  const cruda = elegirSinRepetir(rep.colas, ultimas(p.historial, VENTANA_COLA, 'cola'), p.azar)
  const nombre = p.voz === 'asesorado' ? (p.nombre?.trim() || null) : null
  const nombreRecien = p.historial.slice(-(VENTANA_NOMBRE - 1)).some((x) => x.nombre)
  const usar = nombre !== null && !nombreRecien
  return {
    apertura: crudaApertura.replace('{n}', usar ? `, ${nombre}` : ''),
    cola: cruda,
    huella: { situacion: p.situacion, apertura: huellaDe(crudaApertura), cola: huellaDe(cruda), nombre: usar },
  }
}

export interface ConectorElegido { conector: string; familia: FamiliaDeConector; huella: string }

/**
 * Un conector entre temas, sin repetir en las últimas 8 respuestas a la misma persona. `permitir: false`
 * (la persona tiene apuro o ánimo bajo) devuelve `null`: ninguno. Un conector por respuesta como máximo.
 */
export function elegirConector(p: {
  voz: Voz
  familia?: FamiliaDeConector
  historial: HistorialPersona
  azar: Azar
  permitir?: boolean
  trato?: Tratamiento
}): ConectorElegido | null {
  if (p.permitir === false) return null
  const { conectores } = fuentes(p.voz, p.trato ?? 'tu')
  const recientes = ultimas(p.historial, VENTANA_CONECTOR, 'conector')
  // Sin familia pedida, se elige entre las familias que aún tienen un conector libre (hay 16 y la ventana es 8: siempre alguna).
  const conLibres = FAMILIAS.filter((f) => conectores[f].some((c) => !recientes.includes(huellaDe(c))))
  const candidatas = conLibres.length > 0 ? conLibres : FAMILIAS
  const familia = p.familia ?? candidatas[Math.min(candidatas.length - 1, Math.floor(p.azar() * candidatas.length))]
  const conector = elegirSinRepetir(conectores[familia], recientes, p.azar)
  return { conector, familia, huella: huellaDe(conector) }
}

/* ——— Caso #9: si la persona saluda o pregunta cómo está, ese saludo se responde PRIMERO ——— */
/** Pone la apertura delante de cualquier dato cuando la persona saludó o preguntó cómo está. Si no saludó, solo el cuerpo. */
export function ordenarRespuesta(p: { personaSaludo: boolean; apertura: string; cuerpo: string }): string {
  if (!p.personaSaludo) return p.cuerpo
  return p.cuerpo ? `${p.apertura} ${p.cuerpo}` : p.apertura
}

/* ——— Caso #2: un aviso (coach, médico) se dice UNA sola vez por charla ——— */
export type TipoDeAviso = 'aval_medico' | 'consulta_coach' | 'otro'
/** `dichos`: los avisos que ya se dieron en ESTA charla (lo guarda el que llama). */
export function debeDecirAviso(tipo: TipoDeAviso, dichos: readonly TipoDeAviso[]): boolean {
  return !dichos.includes(tipo)
}
