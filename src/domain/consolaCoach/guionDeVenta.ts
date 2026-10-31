/**
 * El guion de la llamada de venta que arma el agente de la landing (tabla `guiones_llamada`, 0151),
 * leído de forma TOLERANTE.
 *
 * El contrato es `guion-llamada-v1` (alpha-praxis-chat: landing/src/lib/praxis/guion-llamada.ts).
 * Lo escribe otro repo y va a cambiar antes que esta pantalla, así que aquí:
 *   · las claves desconocidas se ignoran;
 *   · un campo con forma equivocada cuenta como ausente (no tumba al resto);
 *   · los textos se recortan y los vacíos desaparecen;
 *   · una `version` que no es la v1 NO se pinta a ciegas: se dice (el esquema pide rechazarla).
 *
 * La alerta de salud del esquema es solo sí/no (`hay`, `requiere_aval`, `menor_de_edad`): el
 * detalle de salud nunca viaja en el guion, y esta capa no inventa uno. Lo que la tarjeta puede
 * decir sale de aquí: «Requiere aval médico» y/o «Menor de edad».
 *
 * Módulo puro: sin red, sin React. La forma la valida de verdad la Edge Function `guion-llamada`
 * al recibirlo; esto es la segunda línea, para filas viejas o escritas a mano.
 */

const VERSION_GUION = 'guion-llamada-v1'

export interface DolorDelGuion {
  texto: string
  /** Con las palabras de la persona (`palabras`) o sacado de sus respuestas (`formulario`). */
  conSusPalabras: boolean
}

export interface PuntoAMostrar {
  tema: string | null
  titulo: string
  /** El número de la persona, si aplica («1.696 kcal al día (estimado)»). */
  dato: string | null
  comoDecirlo: string | null
}

export interface ObjecionProbable {
  tipo: string | null
  objecion: string
  respuesta: string
}

export interface PersonaDelGuion {
  nombre: string | null
  email: string | null
  whatsapp: string | null
  edadTramo: string | null
  objetivo: string | null
  /** Cómo llegó: «Evaluando la inversión»… */
  decision: string | null
}

export interface ReservaDelGuion {
  /** YYYY-MM-DD, hora de Colombia. */
  fecha: string | null
  /** HH:MM si la persona dijo una hora. */
  hora: string | null
  /** Cómo se le confirmó a la persona («el jueves 5 de noviembre a las 3:00 p. m.»). */
  enClaro: string | null
}

/** Lo único que se puede decir de salud: dos marcas, sin detalle. */
export interface AlertaDelGuion {
  requiereAval: boolean
  menorDeEdad: boolean
}

export interface GuionDeVenta {
  persona: PersonaDelGuion
  alerta: AlertaDelGuion
  apertura: string | null
  dolores: DolorDelGuion[]
  queMostrar: PuntoAMostrar[]
  objeciones: ObjecionProbable[]
  cierre: string | null
  avisos: string[]
  recomendaciones: string[]
  reserva: ReservaDelGuion
  /** `modelo` (redactado con el modelo) o `reglas`. */
  origen: string | null
  generadoEn: string | null
}

export type LecturaGuion =
  | { ok: true; guion: GuionDeVenta }
  | { ok: false; motivo: 'no_es_objeto' }
  | { ok: false; motivo: 'version_desconocida'; version: string }

type Objeto = Record<string, unknown>

function esObjeto(v: unknown): v is Objeto {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const limpio = v.trim()
  return limpio === '' ? null : limpio
}

function textos(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(texto).filter((t): t is string => t !== null)
}

/** Cada elemento que sea un objeto pasa por `leer`; lo que devuelva `null` se descarta. */
function lista<T>(v: unknown, leer: (o: Objeto) => T | null): T[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((o) => {
    const leido = esObjeto(o) ? leer(o) : null
    return leido === null ? [] : [leido]
  })
}

function dolor(o: Objeto): DolorDelGuion | null {
  const t = texto(o.texto)
  return t ? { texto: t, conSusPalabras: o.fuente === 'palabras' } : null
}

function punto(o: Objeto): PuntoAMostrar | null {
  const titulo = texto(o.titulo)
  return titulo ? { tema: texto(o.tema), titulo, dato: texto(o.dato), comoDecirlo: texto(o.como_decirlo) } : null
}

/** Una objeción sin respuesta se enseña igual: saber que vendrá ya sirve. */
function objecion(o: Objeto): ObjecionProbable | null {
  const t = texto(o.objecion)
  return t ? { tipo: texto(o.tipo), objecion: t, respuesta: texto(o.respuesta) ?? '' } : null
}

function persona(v: unknown): PersonaDelGuion {
  const p = esObjeto(v) ? v : {}
  return {
    nombre: texto(p.nombre),
    email: texto(p.email),
    whatsapp: texto(p.whatsapp),
    edadTramo: texto(p.edad_tramo),
    objetivo: texto(p.objetivo),
    decision: texto(p.decision),
  }
}

/** Solo `true` cuenta: un campo ausente o mal escrito no enciende una alerta. */
function alerta(v: unknown): AlertaDelGuion {
  const a = esObjeto(v) ? v : {}
  return { requiereAval: a.requiere_aval === true, menorDeEdad: a.menor_de_edad === true }
}

function reserva(v: unknown): ReservaDelGuion {
  const r = esObjeto(v) ? v : {}
  return { fecha: texto(r.fecha), hora: texto(r.hora), enClaro: texto(r.en_claro) }
}

export function leerGuion(crudo: unknown): LecturaGuion {
  if (!esObjeto(crudo)) return { ok: false, motivo: 'no_es_objeto' }
  if (crudo.version !== VERSION_GUION) {
    return { ok: false, motivo: 'version_desconocida', version: texto(crudo.version) ?? String(crudo.version ?? 'sin versión') }
  }
  return {
    ok: true,
    guion: {
      persona: persona(crudo.persona),
      alerta: alerta(crudo.alerta_salud),
      apertura: texto(crudo.apertura),
      dolores: lista(crudo.dolores, dolor),
      queMostrar: lista(crudo.que_mostrar, punto),
      objeciones: lista(crudo.objeciones_probables, objecion),
      cierre: texto(crudo.cierre),
      avisos: textos(crudo.avisos),
      recomendaciones: textos(crudo.recomendaciones_praxis),
      reserva: reserva(crudo.reserva),
      origen: texto(crudo.origen),
      generadoEn: texto(crudo.generado_en),
    },
  }
}

/** Las marcas de salud en palabras, sin detalle: es todo lo que el guion sabe. */
export function marcasDeSalud(a: AlertaDelGuion): string[] {
  return [a.requiereAval ? 'Requiere aval médico' : null, a.menorDeEdad ? 'Menor de edad' : null].filter(
    (m): m is string => m !== null,
  )
}

/** ¿Hay algo que enseñar en la tarjeta? Un guion sin ninguna sección no se pinta. */
export function guionTieneContenido(g: GuionDeVenta): boolean {
  return Boolean(
    marcasDeSalud(g.alerta).length ||
      g.apertura ||
      g.cierre ||
      g.dolores.length ||
      g.queMostrar.length ||
      g.objeciones.length ||
      g.avisos.length ||
      g.recomendaciones.length,
  )
}

const FRANJA_EN_CLARO: Record<string, string> = {
  manana: 'en la mañana',
  mañana: 'en la mañana',
  tarde: 'en la tarde',
  noche: 'en la noche',
}

/** `tarde` → `en la tarde`. Una franja que no se reconoce se enseña tal cual. */
export function franjaEnClaro(franja: string | null): string | null {
  if (!franja) return null
  return FRANJA_EN_CLARO[franja.toLowerCase()] ?? franja
}
