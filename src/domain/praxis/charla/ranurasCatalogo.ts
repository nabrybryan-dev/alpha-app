/**
 * Catálogo ÚNICO de ranuras de la charla de Praxis (pieza «escuchar y anotar»; diseño 6-nov-2026, sección 4).
 *
 * Una ranura es un dato NO clínico que la persona puede soltar hablando. Cada una dice:
 *  - de qué formas se puede decir (`formas`: expresiones sobre texto PLEGADO, sin tildes ni mayúsculas, del mismo
 *    largo que el original, para que la cita salga LITERAL de lo que la persona dijo);
 *  - qué valor sale de esa forma (lo calcula el código desde la cita, no un modelo);
 *  - cómo se le pregunta SIN sonar a cuestionario (varias formas abiertas, nunca un texto fijo);
 *  - cómo se le repite lo entendido (espejo) en el resumen final.
 *
 * Lo clínico (dolor, lesión, medicación, embarazo, diagnóstico...) NO tiene ranura aquí: va aparte, al coach.
 *
 * PURO: sin React, sin red, sin base.
 */
import { minutosDeCita, valorDeCita, horaDeCita } from '../registro/numeros.ts'

export const IDS_RANURA = [
  'objetivo', 'tiempo_entrenando', 'nivel', 'tiempo_disponible', 'dias_semana', 'horario_entreno',
  'sueno_horas', 'hora_acostarse', 'estres', 'trabajo', 'comida', 'comida_entreno', 'actividad_diaria',
] as const
export type IdRanura = (typeof IDS_RANURA)[number]

export type ValorRanura = string | number

export interface FormaDeDecir {
  /** Sobre texto plegado (ver `plegar`). Sin bandera `g`: la usa una copia. */
  re: RegExp
  /** Valor desde lo que casó; `null` = la forma casó pero no dice nada utilizable (se descarta). */
  valor: (m: RegExpMatchArray, frase: string) => ValorRanura | null
}

export interface DefRanura {
  id: IdRanura
  etiqueta: string
  /** Opciones cerradas (si las tiene); un valor fuera de ellas se descarta. */
  opciones?: readonly string[]
  /** Rango plausible si es número. */
  rango?: readonly [number, number]
  /** Si alguna de estas está llena, esta ya no hace falta (p. ej. horas de sueño sustituye la hora de acostarse). */
  sustituidaPor?: readonly IdRanura[]
  formas: readonly FormaDeDecir[]
  /** Preguntas ABIERTAS, dichas de formas distintas. Empiezan en minúscula: pueden ir tras un enlace. Mínimo 3. */
  preguntas: readonly string[]
  /** Cómo se repite lo entendido, en tú («entrenas por la mañana»). */
  espejo: (v: ValorRanura) => string
  /** Lo mismo en tercera persona, para el equipo. */
  espejoEquipo: (v: ValorRanura) => string
  /** Cómo se escribe el valor en una lista. */
  texto: (v: ValorRanura) => string
}

/** Minúsculas y sin tildes, CARÁCTER A CARÁCTER (mismo largo que el original: los índices sirven para citar). */
export function plegar(s: string): string {
  let o = ''
  for (const c of s) {
    const d = c.normalize('NFD')[0] ?? c
    o += d.toLowerCase().length === 1 ? d.toLowerCase() : c
  }
  return o
}

const NUM = '(?:\\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)'
const SEMANA = '(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)'


const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

function horaDelDia(h: number): string {
  if (h >= 4 && h < 6) return 'madrugada'
  if (h >= 6 && h < 12) return 'manana'
  if (h >= 12 && h < 19) return 'tarde'
  if (h >= 19 && h < 24) return 'noche'
  return 'madrugada'
}

const ES_DEL_TRABAJO = /\b(salgo|saliendo|despues del trabajo|despues de la oficina|al salir)\b/

export const CATALOGO: readonly DefRanura[] = [
  {
    id: 'objetivo',
    etiqueta: 'Qué buscas',
    opciones: ['salud', 'rendimiento', 'estetica'],
    formas: [
      { re: /\b(me quede bien la ropa|quedar bien (la ropa|en la ropa)|verme mejor|verme bien|marcar(me)?|definir|tonificar|hipertrofia|masa muscular|ganar musculo|gluteos?|abdomen|estetic\w+)\b/, valor: () => 'estetica' },
      { re: /\b(rendimiento|competir|competencia|torneo|maraton|media maraton|mejorar mi marca|marca personal|fuerza maxima|ser mas fuerte|mas rapido|mi deporte)\b/, valor: () => 'rendimiento' },
      { re: /\b(por salud|mi salud|estar sano|sentirme bien|mas energia|bienestar|cuidarme|envejecer bien)\b/, valor: () => 'salud' },
    ],
    preguntas: [
      'qué te gustaría lograr con todo esto, o qué te imaginas distinto de aquí a unos meses',
      'si todo sale bien, ¿cómo te ves o cómo te sientes más adelante',
      'qué es lo que más te mueve a entrenar ahora',
    ],
    espejo: (v) => ({ salud: 'lo tuyo va por la salud y sentirte bien', rendimiento: 'lo tuyo va por el rendimiento', estetica: 'lo tuyo va por cómo te ves' }[v as string] ?? 'tu meta'),
    espejoEquipo: (v) => `objetivo: ${({ salud: 'salud', rendimiento: 'rendimiento', estetica: 'estética' } as Record<string, string>)[v as string] ?? v}`,
    texto: (v) => ({ salud: 'salud', rendimiento: 'rendimiento', estetica: 'estética' } as Record<string, string>)[v as string] ?? String(v),
  },
  {
    id: 'tiempo_entrenando',
    etiqueta: 'Cuánto llevas entrenando',
    opciones: ['nunca', 'menos_6_meses', '6m_a_1a', '1_a_3_anos', 'mas_3_anos', 'varios_anos'],
    formas: [
      { re: /\b(nunca he entrenado|nunca he hecho ejercicio|no he entrenado nunca)\b/, valor: () => 'nunca' },
      { re: /\btoda la vida\b/, valor: () => 'mas_3_anos' },
      {
        re: new RegExp(`\\b(?:llevo|hace|entreno desde hace|entrenando desde hace|llevo entrenando)\\s+(?:como |unos |unas |casi )?(${NUM})\\s+(mes|meses|ano|anos)\\b`),
        valor: (m) => {
          const n = valorDeCita(m[1])
          if (n === null) return null
          const meses = m[2].startsWith('mes') ? n : n * 12
          return meses < 6 ? 'menos_6_meses' : meses < 12 ? '6m_a_1a' : meses <= 36 ? '1_a_3_anos' : 'mas_3_anos'
        },
      },
      { re: /\b(llevo anos|hace anos que entreno|llevo mucho tiempo entrenando|entreno hace anos)\b/, valor: () => 'varios_anos' },
    ],
    preguntas: [
      'cómo ha sido tu historia con el entrenamiento, ¿hace cuánto le metes',
      'cuéntame un poco de tu camino entrenando, ¿hace cuánto empezaste',
      'esto de entrenar, ¿es algo de siempre o algo más reciente para ti',
    ],
    espejo: (v) => ({ nunca: 'apenas vas a empezar', menos_6_meses: 'llevas menos de seis meses', '6m_a_1a': 'llevas entre seis meses y un año', '1_a_3_anos': 'llevas entre uno y tres años', mas_3_anos: 'llevas más de tres años', varios_anos: 'llevas años entrenando' }[v as string] ?? ''),
    espejoEquipo: (v) => `tiempo entrenando: ${String(v).replace(/_/g, ' ')}`,
    texto: (v) => ({ nunca: 'nunca ha entrenado', menos_6_meses: 'menos de 6 meses', '6m_a_1a': '6 meses a 1 año', '1_a_3_anos': '1 a 3 años', mas_3_anos: 'más de 3 años', varios_anos: 'varios años' }[v as string] ?? String(v)),
  },
  {
    id: 'nivel',
    etiqueta: 'Cómo te ves en nivel',
    opciones: ['principiante', 'intermedio', 'avanzado'],
    // Solo la etiqueta que la persona se pone. «Llevo años» NO llena el nivel (diseño 4.4).
    formas: [
      { re: /\b(?:soy|me siento|me considero|nivel)\s+(?:un |una )?(principiante|novato|novata|intermedi[oa]|avanzad[oa])\b/, valor: (m) => (m[1].startsWith('principiante') || m[1].startsWith('novat') ? 'principiante' : m[1].startsWith('inter') ? 'intermedio' : 'avanzado') },
    ],
    preguntas: [
      'qué tanto peso manejas hoy en un ejercicio que te guste, como la sentadilla',
      'si te toca describir tu forma de entrenar, ¿qué movimientos dominas y cuáles te cuestan',
      'cómo sientes tu fuerza hoy comparada con cuando empezaste',
    ],
    espejo: (v) => `te sientes ${v}`,
    espejoEquipo: (v) => `nivel autopercibido: ${v}`,
    texto: (v) => String(v),
  },
  {
    id: 'tiempo_disponible',
    etiqueta: 'Tiempo por sesión',
    rango: [10, 240],
    formas: [
      {
        re: new RegExp(`\\b(?:tengo|dispongo de|cuento con|solo tengo|apenas tengo|sesiones? de|entrenos? de|entreno de)\\s+(?:como |unos |unas |casi |mas o menos )?((?:${NUM}\\s*(?:min\\w*|horas?)(?:\\s+y\\s+media)?)|media hora|hora y media)`),
        valor: (m, frase) => {
          const previo = /\b(sesiones? de|entrenos? de|entreno de)\b/.test(m[0])
          const contexto = /\b(para (entrenar|el gym|el gimnasio|ir)|por (sesion|dia|entreno)|al dia|libres?|de entreno|de gimnasio|cada (dia|sesion))\b/.test(frase.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 40))
          if (!previo && !contexto) return null
          const min = minutosDeCita(m[1])
          return min !== null && min >= 10 && min <= 240 ? min : null
        },
      },
    ],
    preguntas: [
      'los días que entrenas, ¿cuánto rato real te queda para eso',
      'qué tan largas pueden ser tus sesiones sin que se te complique el resto del día',
      'cuando vas a entrenar, ¿de cuánto tiempo dispones, más o menos',
    ],
    espejo: (v) => `tienes unos ${v} minutos por sesión`,
    espejoEquipo: (v) => `tiempo por sesión: ${v} min`,
    texto: (v) => `${v} min`,
  },
  {
    id: 'dias_semana',
    etiqueta: 'Días por semana',
    rango: [1, 7],
    formas: [
      {
        re: new RegExp(`\\b(${NUM})\\s+(?:dias?|veces)\\s+(?:a la|por|en la|cada|x)\\s+semana\\b`),
        valor: (m) => { const n = valorDeCita(m[1]); return n !== null && n >= 1 && n <= 7 ? n : null },
      },
      { re: /\btodos los dias\b/, valor: () => 7 },
      { re: /\bde lunes a viernes\b/, valor: () => 5 },
      {
        re: new RegExp(`\\b(${SEMANA}(?:\\s*(?:,|y|e)\\s*${SEMANA})+)`),
        valor: (m, frase) => {
          if (!/\b(entren\w*|voy|gym|gimnasio|puedo|ejercicio)\b/.test(frase)) return null
          const dias = new Set(DIAS_ORDEN.filter((d) => m[1].includes(d.slice(0, 5))))
          return dias.size >= 2 ? dias.size : null
        },
      },
    ],
    preguntas: [
      'en una semana normal, ¿cuántos días logras sacar para entrenar',
      'qué días de la semana te quedan más fáciles para moverte',
      'cómo se reparte tu semana, ¿cuántas veces alcanzas a ir',
    ],
    espejo: (v) => `entrenas ${v} ${v === 1 ? 'día' : 'días'} a la semana`,
    espejoEquipo: (v) => `días por semana: ${v}`,
    texto: (v) => `${v} ${v === 1 ? 'día' : 'días'}`,
  },
  {
    id: 'horario_entreno',
    etiqueta: 'Hora de entrenar',
    opciones: ['madrugada', 'manana', 'tarde', 'noche'],
    formas: [
      { re: /\b(?:entreno|entrenar|entrenando|gym|gimnasio|ejercicio)\b[^.]{0,30}?\b(?:en la|por la|a la|de)\s+(manana|tarde|noche|madrugada)\b/, valor: (m) => m[1] },
      { re: /\b(?:entreno|entrenar|voy al gym|voy al gimnasio)\b[^.]{0,20}?\b(?:a primera hora|temprano|muy temprano)\b/, valor: () => 'manana' },
      {
        re: /\b(?:entreno|entrenar|entrenando|voy al gym|voy al gimnasio|voy a entrenar|llego a entrenar|gimnasio)\b[^.]{0,40}?\b(?:a las|sobre las|como a las|casi a las)\s+(\d{1,2})(?::\d\d)?\s*(am|pm|de la manana|de la tarde|de la noche)?/,
        valor: (m, frase) => {
          let h = Number(m[1])
          if (h < 1 || h > 23) return null
          const marca = m[2] ?? ''
          if (/^(pm|de la tarde|de la noche)/.test(marca) && h < 12) h += 12
          else if (!marca && ES_DEL_TRABAJO.test(frase) && h < 12) h += 12
          else if (!marca && h >= 1 && h <= 4) h += 12
          else if (!marca && h >= 5 && h <= 11) return null // «a las 8» pelado: ni mañana ni noche, no se adivina
          return horaDelDia(h)
        },
      },
    ],
    preguntas: [
      'en qué momento del día te funciona mejor sacar ese rato',
      'a qué hora sueles terminar entrenando, más o menos',
      'tu entreno cae más bien temprano, a mediodía o ya de noche',
    ],
    espejo: (v) => `entrenas ${({ madrugada: 'de madrugada', manana: 'por la mañana', tarde: 'por la tarde', noche: 'por la noche' } as Record<string, string>)[v as string] ?? ''}`,
    espejoEquipo: (v) => `hora de entreno: ${v === 'manana' ? 'mañana' : v}`,
    texto: (v) => (v === 'manana' ? 'mañana' : String(v)),
  },
  {
    id: 'sueno_horas',
    etiqueta: 'Horas de sueño',
    rango: [2, 14],
    formas: [
      {
        re: new RegExp(`\\b(?:duermo|durmiendo|dormi|dormido)\\s+(?:como |unas |unos |casi |mas o menos )?(${NUM})\\s+horas?\\b`),
        valor: (m) => { const n = valorDeCita(m[1]); return n !== null && n >= 2 && n <= 14 ? n : null },
      },
    ],
    preguntas: [
      'y el descanso, ¿cómo te va en las noches, duermes lo que quisieras',
      'cuando te acuestas, ¿cuántas horas alcanzas a dormir más o menos',
      'cómo andas de sueño últimamente',
    ],
    espejo: (v) => `duermes unas ${v} horas`,
    espejoEquipo: (v) => `sueño: ${v} h`,
    texto: (v) => `${v} h`,
  },
  {
    id: 'hora_acostarse',
    etiqueta: 'Hora de acostarte',
    sustituidaPor: ['sueno_horas'],
    formas: [
      {
        re: /\b(?:me acuesto|me duermo|me voy a dormir|me quede\b[^.]{0,40}?|trasnocho|duermo)\s*(?:a las|hasta las|hasta la|a la|pasadas las|casi a las)\s+((?:\d{1,2}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?::\d\d)?\s*(?:am|pm|de la noche|de la manana)?)/,
        valor: (m) => horaDeCita(m[1], 'acostarse'),
      },
    ],
    preguntas: [
      'normalmente, ¿a qué hora suena la alarma',
      'a qué hora apagas la luz, más o menos',
      'tus noches, ¿se alargan o te acuestas temprano',
    ],
    espejo: (v) => `te acuestas hacia las ${v}`,
    espejoEquipo: (v) => `hora de acostarse: ${v}`,
    texto: (v) => String(v),
  },
  {
    id: 'estres',
    etiqueta: 'Estrés',
    opciones: ['bajo', 'medio', 'alto'],
    // Orden: lo suave antes que lo fuerte («un poco estresado» no es «estresado»).
    formas: [
      { re: /\b(algo de estres|un poco (de )?estresad[oa]|estres normal|medio estresad[oa]|un poco estresad[oa])\b/, valor: () => 'medio' },
      { re: /\b(no doy abasto|muy estresad[oa]|estresad[oa]|mucho estres|agobiad[oa]|desbordad[oa]|hasta el cuello|full estres)\b/, valor: () => 'alto' },
      { re: /\b(sin estres|poco estres|tranquil[oa]|relajad[oa])\b/, valor: () => 'bajo' },
    ],
    preguntas: [
      'cómo van estos días, ¿has estado con mucha carga o más tranquilo',
      'qué tan pesada se siente la semana en general',
      'y en lo demás de tu vida, ¿cómo andas de ritmo',
    ],
    espejo: (v) => ({ bajo: 'andas tranquilo en lo demás', medio: 'andas con algo de carga', alto: 'andas con mucha carga encima' }[v as string] ?? ''),
    espejoEquipo: (v) => `estrés: ${v}`,
    texto: (v) => String(v),
  },
  {
    id: 'trabajo',
    etiqueta: 'Tu trabajo',
    opciones: ['oficina', 'remoto', 'fisico', 'de_pie', 'conduce', 'turnos', 'hogar'],
    formas: [
      { re: /\b(madre a tiempo completo|ama de casa|cuido a mis hij\w+|cuido mis hij\w+)\b/, valor: () => 'hogar' },
      { re: /\b(teletrabajo|trabajo desde casa|home office|trabajo remoto)\b/, valor: () => 'remoto' },
      { re: /\b(turnos?|enfermer[oa]|turno de noche|rotativ\w+)\b/, valor: () => 'turnos' },
      { re: /\b(manejo todo el dia|conduzco|taxista|conductor)\b/, valor: () => 'conduce' },
      { re: /\b(obra|cargando peso|construccion|bodega|trabajo pesado)\b/, valor: () => 'fisico' },
      { re: /\b(de pie todo el dia|parad[oa] todo el dia|profesor|docente|mesero|mesera|vendedor|vendedora)\b/, valor: () => 'de_pie' },
      { re: /\b(oficina|escritorio|frente al computador|trabajo en computador)\b/, valor: () => 'oficina' },
    ],
    preguntas: [
      'y tu día a día, ¿en qué trabajas y cómo es ese ritmo',
      'cómo son tus jornadas, ¿pasas mucho rato sentado o en movimiento',
      'qué haces entre semana, ¿cómo se ve tu día de trabajo',
    ],
    espejo: (v) => ({ oficina: 'trabajas en oficina', remoto: 'trabajas desde casa', fisico: 'tu trabajo es físico', de_pie: 'pasas el trabajo de pie', conduce: 'pasas el día manejando', turnos: 'trabajas por turnos', hogar: 'tu día es en casa, con la familia' }[v as string] ?? ''),
    espejoEquipo: (v) => `trabajo: ${String(v).replace(/_/g, ' ')}`,
    texto: (v) => String(v).replace(/_/g, ' '),
  },
  {
    id: 'comida',
    etiqueta: 'Quién cocina',
    opciones: ['cocina', 'mixto', 'compra'],
    formas: [
      { re: /\b(cocino a veces|cocino algunos dias|la mitad cocino|mitad cocino|mitad compro)\b/, valor: () => 'mixto' },
      { re: /\b(almuerzo en (el trabajo|la oficina|la calle)|corrientazo|pido (comida|domicilio|domicilios)|compro (hecha|la comida|el almuerzo)|como en la calle|casi siempre compro)\b/, valor: () => 'compra' },
      { re: /\b(yo cocino|cocino yo|cocino casi todo|cocino todo|preparo mis comidas|cocino en casa)\b/, valor: () => 'cocina' },
    ],
    preguntas: [
      'y la comida de entre semana, ¿quién la resuelve, cocinas tú o te toca comprar',
      'cómo resuelves el almuerzo y la cena normalmente',
      'en casa, ¿es cosa tuya la cocina o comes lo que haya',
    ],
    espejo: (v) => ({ cocina: 'cocinas tú', mixto: 'cocinas una parte y compras otra', compra: 'casi siempre compras la comida hecha' }[v as string] ?? ''),
    espejoEquipo: (v) => `comida: ${v}`,
    texto: (v) => ({ cocina: 'cocina', mixto: 'mixto', compra: 'compra hecha' }[v as string] ?? String(v)),
  },
  {
    id: 'comida_entreno',
    etiqueta: 'Comida y entreno',
    opciones: ['ayunas', 'antes', 'despues'],
    formas: [
      { re: /\b(entreno en ayunas|entrenar en ayunas|en ayunas entreno)\b/, valor: () => 'ayunas' },
      { re: /\b(como antes de entrenar|desayuno antes de entrenar|ceno antes de entrenar|almuerzo antes de entrenar|antes de entrenar (como|ceno|desayuno))\b/, valor: () => 'antes' },
      { re: /\b(ceno despues de entrenar|como despues de entrenar|despues de entrenar (como|ceno|desayuno)|almuerzo despues de entrenar)\b/, valor: () => 'despues' },
    ],
    preguntas: [
      'esos días, ¿comes antes de entrenar, después, o lo haces con el estómago vacío',
      'cómo manejas la comida alrededor del entreno',
      'qué sueles comer cerca de la hora de entrenar',
    ],
    espejo: (v) => ({ ayunas: 'entrenas en ayunas', antes: 'comes antes de entrenar', despues: 'comes después de entrenar' }[v as string] ?? ''),
    espejoEquipo: (v) => `comida y entreno: ${v}`,
    texto: (v) => String(v),
  },
  {
    id: 'actividad_diaria',
    etiqueta: 'Movimiento del día',
    opciones: ['sedentaria', 'activa', 'muy_activa'],
    formas: [
      { re: /\b(todo el dia sentad[oa]|paso el dia sentad[oa]|casi no camino|sedentari[oa])\b/, valor: () => 'sedentaria' },
      { re: /\b(camino mucho|me muevo mucho|camino bastante)\b/, valor: () => 'activa' },
      { re: /\b(todo el dia en movimiento|camino todo el dia|no paro en todo el dia)\b/, valor: () => 'muy_activa' },
    ],
    preguntas: [
      'fuera del entreno, ¿cuánto te mueves en el día, caminas mucho o pasas más tiempo quieto',
      'tu día normal, ¿es de mucho trajín o más bien tranquilo en lo físico',
      'qué tanto caminas entre una cosa y otra',
    ],
    espejo: (v) => ({ sedentaria: 'pasas buena parte del día quieto', activa: 'te mueves bastante en el día', muy_activa: 'casi no paras en el día' }[v as string] ?? ''),
    espejoEquipo: (v) => `actividad diaria: ${String(v).replace(/_/g, ' ')}`,
    texto: (v) => String(v).replace(/_/g, ' '),
  },
]

export const RANURA: ReadonlyMap<IdRanura, DefRanura> = new Map(CATALOGO.map((r) => [r.id, r]))

