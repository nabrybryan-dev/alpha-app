/**
 * Puntuación por campo contra lo esperado del corpus (DISENO §6.2).
 *
 * Lo esperado de los casos CE es JSON exacto; el de los casos de nutrición
 * (N), vida (V) y difíciles (D) está escrito en notación relajada. Por eso:
 *
 *  - CE: se compara CAMPO A CAMPO (accion, sesion_id, ejercicio_id, orden,
 *    cargaKg, reps, rir incluida su ausencia, unidad) y aparte la confianza y el
 *    origen.
 *  - N/V/D: solo se puntúa la ACCIÓN (tarjeta, preguntar, clínico, nada), que es
 *    lo que la notación relajada permite leer sin inventar. El resto se
 *    reporta como «sin puntuar por campo», no como acierto.
 */
import { escanearNumeros } from '../../src/domain/praxis/registro/numeros.ts'
import type { ContextoRegistro, Propuesta, RegistroSeries } from '../../src/domain/praxis/registro/tipos.ts'

export interface Caso { id: string; area: string; contexto: string; frase: string; esperado: string }

export type AccionNorm = 'tarjeta' | 'preguntar' | 'clinico' | 'nada'

export interface CampoPuntuado {
  campo: string
  esperado: unknown
  obtenido: unknown
  ok: boolean
}

export interface ResultadoCaso {
  id: string
  area: string
  frase: string
  puntuado_por_campo: boolean
  accion_esperada: AccionNorm
  accion_obtenida: AccionNorm
  campos: CampoPuntuado[]
  confianza: { esperada: string; obtenida: string; ok: boolean }[]
  inventados: string[]
  derivada_sin_modelo: boolean
  error?: string
}

export function accionNormalizada(a: string | undefined): AccionNorm {
  if (a === 'tarjeta') return 'tarjeta'
  if (a === 'preguntar') return 'preguntar'
  if (a === 'clinico' || a === 'derivar') return 'clinico'
  return 'nada'
}

/** Acción esperada de un caso N/V/D leyendo su notación relajada. */
export function accionEsperadaRelajada(c: Caso): AccionNorm {
  const t = c.esperado
  if (c.area === 'clinico' || /derivacion|clinico:\{derivar:true|filtro_clinico/.test(t)) return 'clinico'
  const registrosNoVacios = /"?registros"?:\s*\[\s*[{[]/.test(t) || /"?registros"?:\s*\[\s*\w/.test(t) || /(aceite_g|sal_g|destino:)/.test(t)
  const pregunta = /"?pregunta"?:\s*['"]?¿|"?pregunta"?:\s*"[^"]{4,}/.test(t)
  if (registrosNoVacios) return 'tarjeta'
  if (pregunta) return 'preguntar'
  if (/"tarjeta":false|registros"?:\s*\[\s*\]/.test(t)) return 'nada'
  return 'tarjeta'
}

const cerca = (a: unknown, b: unknown): boolean =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.051 : a === b

interface SerieEsp { orden: number; cargaKg: number; reps?: number; rir?: number; extra?: { reps: number; cargaKg: number }[] }
interface RegEsp {
  campo: string
  ejercicio_id?: string
  valor?: unknown
  unidad?: string
  confianza?: string
  origen?: string
  reemplaza?: { orden: number }
}

function seriesDe(p: Propuesta, ejId: string): RegistroSeries | undefined {
  return p.registros.find((r): r is RegistroSeries => r.campo === 'series' && r.ejercicio_id === ejId)
}

/** Puntúa un caso CE contra su JSON esperado. */
export function puntuarCE(c: Caso, p: Propuesta, derivadaSinModelo: boolean): ResultadoCaso {
  const esp = JSON.parse(c.esperado) as { accion: string; sesion_id?: string; registros?: RegEsp[]; requiere_confirmacion_de_sesion?: boolean; fecha_real?: string }
  const campos: CampoPuntuado[] = []
  const confianza: ResultadoCaso['confianza'] = []
  const accionEsp = accionNormalizada(esp.accion)
  const accionObt = accionNormalizada(p.accion === 'derivar' ? 'clinico' : p.accion)
  campos.push({ campo: 'accion', esperado: accionEsp, obtenido: accionObt, ok: accionEsp === accionObt })

  // Las acciones que no son tarjeta no traen registros que comparar (excepto lo clínico con dolor).
  if (esp.sesion_id !== undefined && (accionEsp === 'tarjeta' || accionEsp === 'preguntar')) {
    const obtenida = p.sesion_id ?? p.registros.find((r): r is RegistroSeries => r.campo === 'series')?.sesion_id
    campos.push({ campo: 'sesion_id', esperado: esp.sesion_id, obtenido: obtenida, ok: obtenida === esp.sesion_id })
  }
  if (accionEsp === 'tarjeta') {
    if (esp.requiere_confirmacion_de_sesion) {
      campos.push({ campo: 'requiere_confirmacion_de_sesion', esperado: true, obtenido: !!p.requiere_confirmacion_de_sesion, ok: !!p.requiere_confirmacion_de_sesion })
    }
    if (esp.fecha_real) campos.push({ campo: 'fecha_real', esperado: esp.fecha_real, obtenido: p.fecha_real, ok: p.fecha_real === esp.fecha_real })
    for (const r of esp.registros ?? []) {
      if (r.campo === 'series' && r.ejercicio_id) {
        const obt = seriesDe(p, r.ejercicio_id)
        campos.push({ campo: 'ejercicio_id', esperado: r.ejercicio_id, obtenido: obt?.ejercicio_id, ok: !!obt })
        const esperadas = (r.valor ?? []) as SerieEsp[]
        for (const e of esperadas) {
          const o = obt?.valor.find((s) => s.orden === e.orden)
          campos.push({ campo: 'orden', esperado: e.orden, obtenido: o?.orden, ok: !!o })
          campos.push({ campo: 'cargaKg', esperado: e.cargaKg, obtenido: o?.cargaKg, ok: !!o && cerca(o.cargaKg, e.cargaKg) })
          campos.push({ campo: 'reps', esperado: e.reps, obtenido: o?.reps, ok: !!o && o.reps === e.reps })
          campos.push({ campo: 'rir', esperado: e.rir ?? null, obtenido: o?.rir ?? null, ok: !!o && (o.rir ?? null) === (e.rir ?? null) })
          if (e.extra) {
            const ok = !!o?.extra && o.extra.length === e.extra.length && e.extra.every((x, i) => o.extra![i].reps === x.reps && cerca(o.extra![i].cargaKg, x.cargaKg))
            campos.push({ campo: 'extra', esperado: e.extra, obtenido: o?.extra, ok })
          }
        }
        if (obt && esperadas.length !== obt.valor.length) {
          campos.push({ campo: 'n_series', esperado: esperadas.length, obtenido: obt.valor.length, ok: false })
        }
        campos.push({ campo: 'unidad', esperado: r.unidad, obtenido: obt?.unidad, ok: !!obt && obt.unidad === r.unidad })
        if (r.origen) campos.push({ campo: 'origen', esperado: r.origen, obtenido: obt?.origen, ok: obt?.origen === r.origen })
        if (r.reemplaza) campos.push({ campo: 'reemplaza', esperado: r.reemplaza.orden, obtenido: obt?.reemplaza?.orden, ok: obt?.reemplaza?.orden === r.reemplaza.orden })
        if (r.confianza) confianza.push({ esperada: r.confianza, obtenida: obt?.confianza ?? 'ausente', ok: obt?.confianza === r.confianza })
      } else if (r.campo.startsWith('testPost.')) {
        const obt = p.registros.find((x) => x.campo === r.campo)
        campos.push({ campo: r.campo, esperado: r.valor, obtenido: obt && 'valor' in obt ? obt.valor : undefined, ok: !!obt && 'valor' in obt && obt.valor === r.valor })
      } else {
        // Cardio, preparación y check-in de dolor: fuera del alcance de la primera versión.
        const obt = p.registros.find((x) => x.campo === r.campo)
        campos.push({ campo: r.campo, esperado: r.valor, obtenido: obt ? 'presente' : undefined, ok: !!obt })
      }
    }
    // Nada de series de más: un ejercicio que no se esperaba es un registro inventado.
    const esperadosIds = new Set((esp.registros ?? []).map((r) => r.ejercicio_id).filter(Boolean))
    for (const r of p.registros) {
      if (r.campo === 'series' && !esperadosIds.has(r.ejercicio_id)) {
        campos.push({ campo: 'ejercicio_de_mas', esperado: null, obtenido: r.ejercicio_id, ok: false })
      }
    }
  }
  return {
    id: c.id, area: c.area, frase: c.frase, puntuado_por_campo: true,
    accion_esperada: accionEsp, accion_obtenida: accionObt, campos, confianza, inventados: [],
    derivada_sin_modelo: derivadaSinModelo,
  }
}

/** Puntúa un caso N/V/D: solo la acción. */
export function puntuarRelajado(c: Caso, p: Propuesta, derivadaSinModelo: boolean): ResultadoCaso {
  const esp = accionEsperadaRelajada(c)
  const obt = accionNormalizada(p.accion === 'derivar' ? 'clinico' : p.accion)
  return {
    id: c.id, area: c.area, frase: c.frase, puntuado_por_campo: false,
    accion_esperada: esp, accion_obtenida: obt, campos: [{ campo: 'accion', esperado: esp, obtenido: obt, ok: esp === obt }],
    confianza: [], inventados: [], derivada_sin_modelo: derivadaSinModelo,
  }
}

/**
 * Números de una propuesta que NO se pueden rastrear a la frase, al perfil, a la
 * pauta pedida, a una serie anterior o a una operación entre ellos. Debe salir
 * vacío: «cero inventados» es una puerta dura.
 */
export function numerosInventados(frase: string, ctx: ContextoRegistro, p: Propuesta): string[] {
  const enFrase = escanearNumeros(frase).map((n) => n.valor)
  const base = new Set<number>([0, ...enFrase, ...enFrase.map((n) => Math.round(n * 0.45359237 * 10) / 10)])
  for (const e of ctx.sesiones.flatMap((s) => s.ejercicios)) {
    for (const s of e.series) { base.add(s.cargaKg); if (s.reps !== undefined) base.add(s.reps) }
    for (const s of e.seriesPrescritas ?? []) { base.add(s.cargaKg); base.add(s.reps) }
    if (e.cargaKg !== undefined) base.add(e.cargaKg)
    if (e.repsDiana !== undefined) base.add(e.repsDiana)
    base.add(e.series.length + 1)
    for (let i = 1; i <= e.sets + 1; i++) base.add(i)
  }
  for (const serie of Object.values(ctx.semanaAnterior)) for (const s of serie) { base.add(s.cargaKg); if (s.reps !== undefined) base.add(s.reps) }
  const barra = ctx.perfil.pesoBarraKg
  if (barra !== null) base.add(barra)
  const derivados = new Set<number>(base)
  for (const a of base) {
    for (const b of base) {
      derivados.add(a + b)
      derivados.add(Math.abs(a - b))
      if (barra !== null) { derivados.add(barra + a * b); derivados.add(barra + 2 * a * b); derivados.add(barra + 2 * a) }
    }
    derivados.add(a * 2)
    derivados.add(a / 2)
  }
  const sospechosos: string[] = []
  const ok = (n: number) => [...derivados].some((d) => Math.abs(d - n) < 0.051)
  for (const r of p.registros) {
    if (r.campo !== 'series') continue
    for (const s of r.valor) {
      if (!ok(s.cargaKg)) sospechosos.push(`${r.ejercicio_id} serie ${s.orden}: cargaKg ${s.cargaKg}`)
      if (s.reps !== undefined && !ok(s.reps)) sospechosos.push(`${r.ejercicio_id} serie ${s.orden}: reps ${s.reps}`)
    }
  }
  return sospechosos
}
