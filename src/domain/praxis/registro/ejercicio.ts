/**
 * Emparejar el ejercicio que dijo la persona con uno de la sesión de hoy.
 *
 * Es el punto más frágil del registro: en producción «sentadilla» coincide con
 * dos o más ejercicios en 10 de los 16 microciclos activos. El orden de
 * decisión es el de DISENO §3.1 y el CÓDIGO manda: la `ref_sugerida` del modelo
 * es solo una pista y nunca desempata sola.
 *
 * Todo es léxico y determinista: alias curados (`banco` → PRESS BANCA), prefijos
 * (`sentadilla` ⊂ SENTADILLA TRASERA) y una tolerancia de una letra para los
 * errores de la voz transcrita (`presa banca`).
 */
import { normalizarTexto } from './numeros.ts'
import type { Confianza, ContextoRegistro, EjercicioCtx, Pregunta, SesionCtx } from './tipos.ts'

const STOP = new Set([
  'de', 'del', 'con', 'en', 'la', 'el', 'los', 'las', 'al', 'a', 'un', 'una', 'uno',
  'mi', 'que', 'me', 'pusiste', 'pusieron', 'hice', 'puse', 'y', 'o', 'por', 'para', 'mis', 'pero', 'como',
])

/** Palabras que dicen «músculo» o «tipo de ejercicio» pero no forman parte de un nombre. */
const GENERICAS = new Set([
  'biceps', 'ejercicio', 'ejercicios', 'rutina',
  // La banda de una dominada asistida describe la carga, no el ejercicio.
  'banda', 'roja', 'rojo', 'azul', 'verde', 'negra', 'negro', 'amarilla', 'amarillo', 'morada', 'morado', 'naranja',
])

/** Equipo o variante: si la persona la dice y la rutina no la trae, hay que preguntar. */
export const VARIANTES = new Set([
  'mancuerna', 'mancuernas', 'barra', 'polea', 'maquina', 'smith', 'kettlebell', 'pesa', 'discos',
])

/**
 * Apodos del gimnasio → palabra del nombre oficial. Curados a mano: si mañana
 * hay otro apodo frecuente, se añade aquí y con su test.
 */
const ALIAS: Record<string, string[]> = {
  banco: ['banca'],
  gemelos: ['talones'],
  gemelo: ['talones'],
  pantorrillas: ['talones'],
  pantorrilla: ['talones'],
  soleo: ['talones'],
  isquios: ['femoral'],
  isquio: ['femoral'],
  isquiotibiales: ['femoral'],
  isquiotibial: ['femoral'],
  gluteos: ['gluteo'],
  dominada: ['dominadas'],
  flexion: ['flexiones'],
  fondo: ['fondos'],
  lateral: ['laterales'],
}

export function tokensDeNombre(texto: string): string[] {
  return normalizarTexto(texto)
    .split(' ')
    .filter((t) => t && !STOP.has(t))
}

function distancia(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[m][n]
}

type Coincidencia = 'exacta' | 'aproximada' | null

function coincideToken(t: string, nombre: string[]): Coincidencia {
  if (nombre.includes(t)) return 'exacta'
  if (t.length >= 4 && nombre.some((w) => w.startsWith(t) || (w.length >= 4 && t.startsWith(w) && t.length - w.length <= 2))) {
    return 'exacta'
  }
  if (t.length >= 5 && nombre.some((w) => w.length >= 4 && distancia(t, w) <= 1)) return 'aproximada'
  return null
}

export interface Encaje {
  ejercicio: EjercicioCtx
  /** Todas las palabras de la cita están en el nombre. */
  completo: boolean
  /** Alguna coincidió solo por cercanía (voz transcrita). */
  aproximado: boolean
  /** Alguna se resolvió por alias curado. */
  porAlias: boolean
  /** Cuántas palabras de la cita NO están en el nombre. */
  faltan: string[]
  /** Cuántas sí. */
  aciertos: number
}

/** Evalúa la cita contra un ejercicio. */
export function encajar(cita: string, ej: EjercicioCtx): Encaje {
  const nombre = tokensDeNombre(ej.nombre)
  const crudos = tokensDeNombre(cita).filter((t) => !GENERICAS.has(t))
  let aproximado = false
  let porAlias = false
  let aciertos = 0
  const faltan: string[] = []
  for (const crudo of crudos) {
    const alternativas = ALIAS[crudo] ?? [crudo]
    const usoAlias = crudo in ALIAS
    let ok: Coincidencia = null
    for (const alt of alternativas) {
      const c = coincideToken(alt, nombre)
      if (c === 'exacta') { ok = 'exacta'; break }
      if (c === 'aproximada') ok = 'aproximada'
    }
    if (ok) {
      aciertos += 1
      if (ok === 'aproximada') aproximado = true
      else if (usoAlias) porAlias = true
    } else {
      faltan.push(crudo)
    }
  }
  return { ejercicio: ej, completo: crudos.length > 0 && faltan.length === 0, aproximado, porAlias, faltan, aciertos }
}

export type ViaEjercicio = 'nombre' | 'alias' | 'aproximado' | 'pantalla' | 'descarte' | 'anterior'

export type ResultadoEjercicio =
  | { tipo: 'ok'; ejercicio: EjercicioCtx; via: ViaEjercicio; confianza: Confianza }
  | { tipo: 'otra_sesion'; ejercicio: EjercicioCtx; sesion: SesionCtx; hoy: SesionCtx | null }
  | { tipo: 'pregunta'; motivo: 'ambiguo' | 'sin_nombre' | 'variante' | 'ninguno'; pregunta: Pregunta }

function completo(ej: EjercicioCtx): boolean {
  return ej.series.length >= ej.sets
}

function todosLosEjercicios(ctx: ContextoRegistro): EjercicioCtx[] {
  return ctx.sesiones.flatMap((s) => s.ejercicios)
}

/** Nombre para mostrar: «SENTADILLA TRASERA». */
export function nombreCorto(ej: EjercicioCtx): string {
  return ej.nombre
}

const NOTA_A_BRYAN: string[] = ['Sí, nota para Bryan', 'No, olvídalo']

/**
 * Sin nombre de ejercicio. Si hay uno abierto en pantalla se usa; si no, UNA
 * pregunta con las dos opciones razonables (la siguiente serie del último tocado
 * y el siguiente ejercicio sin series). Nunca se adivina.
 */
function sinNombre(ctx: ContextoRegistro, modoAnterior: boolean): ResultadoEjercicio {
  const todos = todosLosEjercicios(ctx)
  const porId = (id: string | null | undefined) => todos.find((e) => e.id === id) ?? null
  if (modoAnterior) {
    const previo = porId(ctx.ultimoTocado?.ejercicioId) ?? porId(ctx.pantalla.ejercicioId)
    if (previo) return { tipo: 'ok', ejercicio: previo, via: 'anterior', confianza: 'alta' }
  } else {
    const abierto = porId(ctx.pantalla.ejercicioId)
    if (abierto) return { tipo: 'ok', ejercicio: abierto, via: 'pantalla', confianza: 'media' }
  }
  const hoy = ctx.sesiones.find((s) => s.id === ctx.sesionHoyId) ?? ctx.sesiones[0]
  const lista = hoy?.ejercicios ?? []
  const tocado = porId(ctx.ultimoTocado?.ejercicioId) ?? [...lista].reverse().find((e) => e.series.length > 0) ?? null
  const siguiente = lista.find((e) => e.series.length === 0 && e.id !== tocado?.id) ?? null
  const opciones: string[] = []
  const etiqueta = (e: EjercicioCtx) => `${e.nombre}, serie ${e.series.length + 1}`
  if (tocado && !completo(tocado)) opciones.push(etiqueta(tocado))
  if (siguiente) opciones.push(etiqueta(siguiente))
  if (opciones.length < 2) {
    for (const e of lista) {
      if (opciones.length >= 2) break
      const et = etiqueta(e)
      if (!completo(e) && !opciones.includes(et)) opciones.push(et)
    }
  }
  return {
    tipo: 'pregunta',
    motivo: 'sin_nombre',
    pregunta: {
      texto: `¿En cuál ejercicio fue? (${opciones.length ? opciones.join(' o ') : 'dime el nombre'})`,
      opciones,
      campo_bloqueante: 'ejercicio',
    },
  }
}

export function emparejarEjercicio(
  cita: string | null,
  ctx: ContextoRegistro,
  opts: { modoAnterior?: boolean } = {},
): ResultadoEjercicio {
  const modoAnterior = opts.modoAnterior ?? false
  if (!cita || tokensDeNombre(cita).filter((t) => !GENERICAS.has(t)).length === 0) return sinNombre(ctx, modoAnterior)

  const hoy = ctx.sesiones.find((s) => s.id === ctx.sesionHoyId) ?? null
  const pool: EjercicioCtx[] = hoy ? hoy.ejercicios : todosLosEjercicios(ctx)
  const encajes = pool.map((e) => encajar(cita, e))
  const completos = encajes.filter((e) => e.completo)

  const ok = (e: Encaje, via: ViaEjercicio, confianza: Confianza): ResultadoEjercicio => ({
    tipo: 'ok',
    ejercicio: e.ejercicio,
    via,
    confianza,
  })

  // 2. Una sola coincidencia en la sesión de hoy.
  if (completos.length === 1) {
    const e = completos[0]
    if (e.aproximado) return ok(e, 'aproximado', 'media')
    return ok(e, e.porAlias ? 'alias' : 'nombre', 'alta')
  }

  // 3. Varias: quitar las completas, luego la pantalla, si no, preguntar.
  if (completos.length > 1) {
    const pendientes = completos.filter((e) => !completo(e.ejercicio))
    if (pendientes.length === 1) return ok(pendientes[0], 'descarte', 'media')
    const abierto = completos.find((e) => e.ejercicio.id === ctx.pantalla.ejercicioId)
    if (abierto) return ok(abierto, 'pantalla', 'media')
    const opciones = (pendientes.length ? pendientes : completos).map((e) => e.ejercicio.nombre).slice(0, 3)
    return {
      tipo: 'pregunta',
      motivo: 'ambiguo',
      pregunta: {
        texto: `¿Cuál fue: ${opciones.join(' o ')}?`,
        opciones,
        campo_bloqueante: 'ejercicio',
      },
    }
  }

  // 4. Ninguna hoy, pero sí en otra sesión del microciclo activo.
  if (hoy) {
    for (const s of ctx.sesiones) {
      if (s.id === hoy.id) continue
      const otros = s.ejercicios.map((e) => encajar(cita, e)).filter((e) => e.completo)
      if (otros.length === 1) return { tipo: 'otra_sesion', ejercicio: otros[0].ejercicio, sesion: s, hoy }
    }
  }

  // Variante: la base existe en la rutina pero la persona dijo otra cosa
  // («remo con mancuerna» y la rutina trae remo con barra).
  const parciales = encajes.filter((e) => e.aciertos > 0 && e.faltan.length > 0)
  if (parciales.length > 0) {
    const variante = parciales[0].faltan.join(' ')
    const base = parciales.map((e) => e.ejercicio.nombre)
    const lista = base.length === 1 ? base[0] : base.slice(0, 2).join(' o ')
    return {
      tipo: 'pregunta',
      motivo: 'variante',
      pregunta: {
        texto: `Tu rutina trae ${lista}, no ${variante}. ¿Lo dejo como nota para Bryan o lo anoto en ${base[0]}?`,
        opciones: ['Nota para Bryan (no entra a las series)', `Anotarlo en ${base[0]}`],
        campo_bloqueante: 'ejercicio',
      },
    }
  }

  // 5. No existe. La app no crea ejercicios.
  return {
    tipo: 'pregunta',
    motivo: 'ninguno',
    pregunta: {
      texto: `No veo ${cita} en tu rutina de hoy. ¿Se lo dejo a Bryan como nota?`,
      opciones: NOTA_A_BRYAN,
      campo_bloqueante: 'ejercicio',
    },
  }
}
