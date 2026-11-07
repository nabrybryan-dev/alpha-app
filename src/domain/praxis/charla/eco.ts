/**
 * Eco: la apertura responde a lo que la persona ACABA de decir (cata de Bryan, 7-nov-2026).
 *
 * En la cata, los 4 «no» fallaron en el saludo: el repertorio por situación no leía el mensaje. Ante «me fue
 * increíble» preguntaba «¿qué tal quedó el cuerpo?»; ante «mal día, estoy agotada» decía «no hay nada que
 * completar»; ante «uy qué semana» preguntaba por «la pausa»; ante el partido de anoche respondía «¿qué más hay?».
 * Bryan pidió: reflejar la alegría o el cansancio con las palabras de la persona, ser empática sin ser incisiva,
 * alguna frase o dicho que conecte, preguntar con dos conceptos para precisar («¿cómo te sientes de cansancio,
 * estuvo intenso?») y, si cuenta algo ajeno al entrenamiento, acompañarlo y recordar con suavidad el papel.
 *
 * Lógica PURA: sin React, sin I/O. Solo voz del asesorado (la del equipo habla en tercera persona de un cliente y no
 * hace eco). No es clínica: el riesgo (dolor, lesión) se decide ANTES y no pasa por aquí. Los textos son de prueba;
 * el repertorio final lo aprueban Bryan o Manuela por muestra.
 */
import { elegirSinRepetir, huellaDe, VENTANA_APERTURA, VENTANA_COLA, VENTANA_NOMBRE, type HistorialPersona, type Tratamiento } from './saludos'

export type Tono = 'cansado' | 'semana_dura' | 'contento' | 'tema_ajeno'
export type TemaAjeno = 'futbol' | 'serie' | 'otro'

export interface LecturaDeTono {
  tono: Tono
  /** contento: la palabra de la persona («increíble», «genial»), para devolvérsela. */
  palabra?: string
  /** cansado: mencionó que durmió poco. */
  sueno?: boolean
  /** cansado: llega muy mal («agotada», «no puedo más»): sin dicho ni frase (POLITICA-FRASES §3). */
  fuerte?: boolean
  /** tema_ajeno: de qué habla. */
  tema?: TemaAjeno
  /** tema_ajeno/futbol: mencionó un gol. */
  gol?: boolean
}

const sinTildes = (t: string): string => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const CANSADO = /\bmal dia\b|\bagotad[oa]s?\b|\bcansad[oa]s?\b|\bsin ganas\b|\bno me dieron ganas\b|\bsin energia\b|\bsin pila\b|\bmuert[oa] del cansancio\b|\bdia (horrible|terrible|pesado|malo)\b|\btodo (me )?salio (al reves|mal)\b|\bfundid[oa]\b/
const FUERTE = /\bagotad[oa]s?\b|\bmuert[oa] del cansancio\b|\bno puedo mas\b|\bdia (horrible|terrible)\b|\bfundid[oa]\b|\btodo (me )?salio (al reves|mal)\b|\bpesim[oa]\b/
const SUENO = /\bdormi (poco|poquisimo|mal|fatal)\b|\bno dormi\b|\bcasi no duermo\b|\btrasnoch/
const SEMANA = /\b(uy|uf|ay|ufff*|uyy*)?,? ?que semana\b|\bsemana (pesada|larga|dura|de locos|terrible|complicada)\b|\bno paro\b|\bando a mil\b/
const CONTENTO = /\b(increible|genial|muy bien|super bien|brutal|bacan[oa]?|espectacular|buenisim[oa]|excelente|de maravilla|feliz|contentisim[oa]|content[oa])\b/
const FUTBOL = /\b(partido|gol|golazo|futbol|clasico|la seleccion|el equipo gano)\b/
const SERIE = /\b(serie|pelicula|novela|temporada|capitulo)\b/

/** Palabras de alegría tal como se le devuelven (con su tilde). */
const PALABRA: Record<string, string> = { increible: 'increíble', buenisimo: 'buenísimo', buenisima: 'buenísimo', 'super bien': 'súper bien' }

/**
 * Lee el tono del mensaje. Orden: el cansancio va primero (si dice «me fue increíble pero estoy muerta», se cuida el
 * cansancio); luego la semana dura, la alegría y por último el tema ajeno. `null`: nada que reflejar.
 */
export function leerTono(frase: string): LecturaDeTono | null {
  const t = sinTildes(frase)
  if (CANSADO.test(t)) return { tono: 'cansado', sueno: SUENO.test(t), fuerte: FUERTE.test(t) }
  if (SEMANA.test(t)) return { tono: 'semana_dura' }
  const alegria = t.match(CONTENTO)
  if (alegria) {
    const p = alegria[1]
    return { tono: 'contento', palabra: /^(feliz|content)/.test(p) ? undefined : (PALABRA[p] ?? p) }
  }
  if (FUTBOL.test(t)) return { tono: 'tema_ajeno', tema: 'futbol', gol: /\bgol/.test(t) }
  if (SERIE.test(t)) return { tono: 'tema_ajeno', tema: 'serie' }
  return null
}

interface Juego { aperturas: readonly string[]; colas: readonly string[] }
/** `{n}` = «, Nombre» o nada. `{p}` = la palabra de alegría de la persona. */
type Textos = {
  contento: Juego & { conPalabra: readonly string[] }
  /** colasLeve: dicho o frase de siembra, solo en cansancio leve y nunca dos veces seguidas (Bryan, 7-nov: «no siempre»). */
  cansado: Juego & { conSueno: readonly string[]; colasLeve: readonly string[] }
  semana_dura: Juego
  tema_ajeno: Juego & { futbol: readonly string[]; gol: readonly string[]; serie: readonly string[] }
}

export const ECO_TU: Textos = {
  contento: {
    conPalabra: [
      'Qué alegría que te haya ido {p}{n}.',
      'Me alegra mucho saber que estuvo {p}{n}.',
      'Qué bien suena ese «{p}»{n}.',
      'Ese «{p}» lo dice todo{n}.',
      'Qué buena noticia que te haya salido {p}{n}.',
      'Da gusto leer que hoy estuvo {p}{n}.',
      'Con ese «{p}» se nota lo bien que te fue{n}.',
      'Cuando algo sale {p}, vale la pena contarlo{n}.',
      'Qué rico leer que te fue {p}{n}.',
      'Eso de que estuvo {p} da gusto leerlo{n}.',
    ],
    aperturas: [
      'Qué alegría leerte así{n}.',
      'Esa energía se nota desde aquí{n}.',
      'Qué bien se siente un día así{n}.',
      'Así da gusto empezar la charla{n}.',
    ],
    colas: [
      '¿Y cómo te sientes de cansancio, estuvo intenso?',
      '¿Quedaste con energía o más bien fundido?',
      '¿Se sintió más exigente o más llevadero que otras veces?',
      'Cuéntame qué fue lo mejor de la sesión.',
    ],
  },
  cansado: {
    conSueno: [
      'Dormiste poco y encima el día se complicó{n}; con eso cualquiera queda sin pila.',
      'Con tan poco sueño y un día así{n}, tiene sentido que no haya ganas.',
    ],
    aperturas: [
      'Uf{n}, qué jornada. Se nota que hoy pesó.',
      'Tiene sentido que te sientas así después de un día como ese{n}.',
      'Gracias por contármelo{n}; un día así pesa.',
      'Hay días en que uno anda con la pila baja{n}, y eso es un dato, no una falla.',
    ],
    colas: [
      'Hoy no te voy a pedir nada; ¿quieres desahogarte un rato?',
      'Aquí estoy para escucharte. ¿Qué fue lo más pesado?',
      'Si hoy no hay ganas, también vale. ¿Cómo te puedo acompañar?',
      'Cuéntame lo que quieras, o lo dejamos para cuando tengas más aire.',
    ],
    colasLeve: [
      'Como dicen por ahí, poco a poco se anda lejos. ¿Cómo te puedo acompañar?',
      'Como dice el dicho, más vale paso que dure y no trote que canse. ¿Qué fue lo más pesado?',
      'Lo que siembras en días así también cuenta para lo que viene. ¿Quieres contarme cómo vas?',
      'Los días que cuestan también son parte de lo que estás construyendo. ¿Cómo te sientes ahora?',
    ],
  },
  semana_dura: {
    aperturas: [
      'Uy, qué semana la tuya{n}. Con ese ritmo cualquiera llega sin aire.',
      'Se nota que la semana te tiene a mil{n}.',
      'Qué semana tan cargada{n}; bastante haces con sacar tiempo para entrenar.',
      'Con esa semana encima{n}, ya tiene mérito que estés por aquí.',
    ],
    colas: [
      '¿Cómo te estás sintiendo con todo eso encima?',
      'Cuéntame cómo vas llevando el cansancio esta semana.',
      '¿Qué es lo que más te está pesando de la semana?',
      'Como dicen por ahí, más vale paso que dure y no trote que canse. ¿Cómo vas con todo eso?',
    ],
  },
  tema_ajeno: {
    futbol: [
      'No vi el partido{n}, pero por cómo lo cuentas estuvo para alquilar balcón.',
      'Qué partido debió ser{n}; se te nota la emoción.',
    ],
    gol: [
      'Un gol al final así le saca un grito a cualquiera{n}.',
      'Esos goles sobre el final son los que más se celebran{n}.',
    ],
    serie: [
      'Si te tiene así de enganchado, debe estar muy buena{n}.',
      'Esas series que no dejan soltar el control{n}, ¡qué peligro!',
    ],
    aperturas: [
      'Qué bueno que me cuentes{n}.',
      'Me gusta que me cuentes esas cosas{n}.',
    ],
    colas: [
      'Yo estoy para lo de tu entrenamiento y tu estilo de vida, pero también para escucharte.',
      'Cuando quieras miramos lo tuyo de hoy, sin afán.',
      'Si te provoca, seguimos con eso un rato y luego vemos lo del entreno.',
    ],
  },
}

export const ECO_USTED: Textos = {
  contento: {
    conPalabra: [
      'Qué alegría que le haya ido {p}{n}.',
      'Me alegra mucho saber que estuvo {p}{n}.',
      'Qué bien suena ese «{p}»{n}.',
      'Ese «{p}» lo dice todo{n}.',
      'Qué buena noticia que le haya salido {p}{n}.',
      'Da gusto leer que hoy estuvo {p}{n}.',
      'Con ese «{p}» se nota lo bien que le fue{n}.',
      'Cuando algo sale {p}, vale la pena contarlo{n}.',
      'Qué rico leer que le fue {p}{n}.',
      'Eso de que estuvo {p} da gusto leerlo{n}.',
    ],
    aperturas: [
      'Qué alegría leerle así{n}.',
      'Esa energía se nota desde aquí{n}.',
      'Qué bien se siente un día así{n}.',
      'Así da gusto empezar la charla{n}.',
    ],
    colas: [
      '¿Y cómo se siente de cansancio, estuvo intenso?',
      '¿Quedó con energía o más bien fundido?',
      '¿Se sintió más exigente o más llevadero que otras veces?',
      'Cuénteme qué fue lo mejor de la sesión.',
    ],
  },
  cansado: {
    conSueno: [
      'Durmió poco y encima el día se complicó{n}; con eso cualquiera queda sin pila.',
      'Con tan poco sueño y un día así{n}, tiene sentido que no haya ganas.',
    ],
    aperturas: [
      'Uf{n}, qué jornada. Se nota que hoy pesó.',
      'Tiene sentido que se sienta así después de un día como ese{n}.',
      'Gracias por contármelo{n}; un día así pesa.',
      'Hay días en que uno anda con la pila baja{n}, y eso es un dato, no una falla.',
    ],
    colas: [
      'Hoy no le voy a pedir nada; ¿quiere desahogarse un rato?',
      'Aquí estoy para escucharle. ¿Qué fue lo más pesado?',
      'Si hoy no hay ganas, también vale. ¿Cómo le puedo acompañar?',
      'Cuénteme lo que quiera, o lo dejamos para cuando tenga más aire.',
    ],
    colasLeve: [
      'Como dicen por ahí, poco a poco se anda lejos. ¿Cómo le puedo acompañar?',
      'Como dice el dicho, más vale paso que dure y no trote que canse. ¿Qué fue lo más pesado?',
      'Lo que siembra en días así también cuenta para lo que viene. ¿Quiere contarme cómo va?',
      'Los días que cuestan también son parte de lo que está construyendo. ¿Cómo se siente ahora?',
    ],
  },
  semana_dura: {
    aperturas: [
      'Uy, qué semana la suya{n}. Con ese ritmo cualquiera llega sin aire.',
      'Se nota que la semana lo tiene a mil{n}.',
      'Qué semana tan cargada{n}; bastante hace con sacar tiempo para entrenar.',
      'Con esa semana encima{n}, ya tiene mérito que esté por aquí.',
    ],
    colas: [
      '¿Cómo se está sintiendo con todo eso encima?',
      'Cuénteme cómo va llevando el cansancio esta semana.',
      '¿Qué es lo que más le está pesando de la semana?',
      'Como dicen por ahí, más vale paso que dure y no trote que canse. ¿Cómo va con todo eso?',
    ],
  },
  tema_ajeno: {
    futbol: [
      'No vi el partido{n}, pero por cómo lo cuenta estuvo para alquilar balcón.',
      'Qué partido debió ser{n}; se le nota la emoción.',
    ],
    gol: [
      'Un gol al final así le saca un grito a cualquiera{n}.',
      'Esos goles sobre el final son los que más se celebran{n}.',
    ],
    serie: [
      'Si lo tiene así de enganchado, debe estar muy buena{n}.',
      'Esas series que no dejan soltar el control{n}, ¡qué peligro!',
    ],
    aperturas: [
      'Qué bueno que me cuente{n}.',
      'Me gusta que me cuente esas cosas{n}.',
    ],
    colas: [
      'Yo estoy para lo de su entrenamiento y su estilo de vida, pero también para escucharle.',
      'Cuando quiera miramos lo suyo de hoy, sin afán.',
      'Si le provoca, seguimos con eso un rato y luego vemos lo del entreno.',
    ],
  },
}

/** Las aperturas que encajan con lo leído: primero las que usan sus palabras, luego las generales del tono. */
function aperturasPara(l: LecturaDeTono, x: Textos): readonly string[] {
  switch (l.tono) {
    case 'contento': return l.palabra ? x.contento.conPalabra : x.contento.aperturas
    case 'cansado': return l.sueno ? [...x.cansado.conSueno, ...x.cansado.aperturas] : x.cansado.aperturas
    case 'semana_dura': return x.semana_dura.aperturas
    case 'tema_ajeno': {
      const t = x.tema_ajeno
      if (l.tema === 'futbol') return l.gol ? [...t.gol, ...t.futbol] : t.futbol
      if (l.tema === 'serie') return t.serie
      return t.aperturas
    }
  }
}

/** En cansancio leve se suman las colas con dicho o siembra, salvo que una de ellas haya salido en las últimas colas. */
function colasPara(l: LecturaDeTono, x: Textos, recientesC: readonly string[]): readonly string[] {
  if (l.tono !== 'cansado' || l.fuerte) return x[l.tono].colas
  const leves = x.cansado.colasLeve
  const yaSalio = leves.some((c) => recientesC.includes(huellaDe(c)))
  return yaSalio ? x.cansado.colas : [...x.cansado.colas, ...leves]
}

export interface EcoElegido {
  apertura: string
  cola: string
  huella: { situacion: null; tono: Tono; apertura: string; cola: string; nombre: boolean }
}

/** Apertura y cola que devuelven lo que la persona dijo, sin repetir lo ya dicho a esta persona. */
export function elegirEco(p: {
  lectura: LecturaDeTono
  nombre?: string | null
  historial: HistorialPersona
  azar: () => number
  trato?: Tratamiento
}): EcoElegido {
  const x = (p.trato ?? 'tu') === 'usted' ? ECO_USTED : ECO_TU
  const opciones = aperturasPara(p.lectura, x)
  const recientesA = p.historial.slice(-VENTANA_APERTURA).map((h) => h.apertura).filter((a): a is string => !!a)
  const recientesC = p.historial.slice(-VENTANA_COLA).map((h) => h.cola).filter((c): c is string => !!c)
  const cruda = elegirSinRepetir(opciones, recientesA, p.azar)
  const cola = elegirSinRepetir(colasPara(p.lectura, x, recientesC), recientesC, p.azar)
  const nombre = p.nombre?.trim() || null
  const usar = nombre !== null && !p.historial.slice(-(VENTANA_NOMBRE - 1)).some((h) => h.nombre)
  const palabra = p.lectura.palabra ?? ''
  const apertura = cruda
    .replace('{p}', palabra)
    .replace('{n}', usar ? `, ${nombre}` : '')
  return { apertura, cola, huella: { situacion: null, tono: p.lectura.tono, apertura: huellaDe(cruda), cola: huellaDe(cola), nombre: usar } }
}
