// «Deshacer» de Praxis (paso D3, DISENO-DESHACER-REAL-20261104) y el guardado por el libro (migración 0162).
//
//  - La orden «deshaz lo último» NUNCA ejecuta: lee el libro de la persona (`praxis_registros_aplicados`, con su
//    JWT, RLS) y devuelve una propuesta (confirmar, preguntar o nada que deshacer). La tarjeta de confirmación
//    lleva una firma (HMAC) y vence a los 2 minutos.
//  - `POST /deshacer` con la tarjeta y `confirmado: true` revalida firma, dueño y vigencia y llama a la RPC
//    `praxis_deshacer`, que vuelve a comprobar dueño, día de Bogotá y que lo guardado siga igual.
//  - `guardar` usa `praxis_aplicar_series` / `praxis_aplicar_adherencia` (que llenan el libro) SOLO con
//    `PRAXIS_LIBRO=1`. Apagado, todo funciona como antes.
// Ni la frase ni la persona van al registro de la consola. Todo con el JWT de la persona, nunca service_role.
import { interpretarPedidoDeshacer } from '../../../src/domain/praxis/deshacer/pedido.ts'
import { proponerDeshacer, tarjetaDe, textoConfirmacion, BOTON_NO, BOTON_SI, type PropuestaDeshacer } from '../../../src/domain/praxis/deshacer/proponer.ts'
import { ZONA_BOGOTA, type RegistroLibro, type TipoRegistroLibro } from '../../../src/domain/praxis/deshacer/tipos.ts'
import { json } from './http.ts'
import { decisionEnSombra } from './sombra.ts'

export interface EntornoLibro {
  /** '1' enciende el libro: guardar usa las RPC que lo llenan y «deshaz …» se atiende. Apagado por defecto. */
  PRAXIS_LIBRO?: string
  /** Clave con la que se firma la tarjeta de confirmación. Sin ella, deshacer no se enciende. */
  PRAXIS_SECRETO_DESHACER?: string
}
interface Deps { entorno: EntornoLibro & { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }; fetch: typeof fetch; ahora: () => Date }
interface SesionLibro { usuarioId: string; token: string; rol?: string; puesto?: boolean }

const MAX_MENSAJE = 120
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const libroEncendido = (d: Deps) => d.entorno.PRAXIS_LIBRO === '1'
const mensajeValido = (m: unknown): m is string => typeof m === 'string' && m.trim().length >= 1 && m.trim().length <= MAX_MENSAJE

// ——— Guardar por el libro ———

const cabeceras = (d: Deps, s: SesionLibro) => ({ apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${s.token}`, 'content-type': 'application/json' })

/** La RPC del libro. `ausente` = la función no existe (migración sin aplicar): se sigue por el camino de antes. */
async function rpcLibro(d: Deps, s: SesionLibro, nombre: string, args: Record<string, unknown>): Promise<{ ok: boolean; ausente: boolean }> {
  try {
    const r = await d.fetch(`${d.entorno.SUPABASE_URL}/rest/v1/rpc/${nombre}`, { method: 'POST', headers: cabeceras(d, s), body: JSON.stringify(args) })
    if (r.ok) return { ok: true, ausente: false }
    const codigo = ((await r.json().catch(() => null)) as { code?: unknown } | null)?.code
    return { ok: false, ausente: r.status === 404 && codigo === 'PGRST202' }
  } catch {
    return { ok: false, ausente: false }
  }
}

/** Series: con el libro encendido y un `mensaje_id` válido, por `praxis_aplicar_series`; si no, `anterior` (lo de siempre). */
export async function seriesGuardar(
  d: Deps, mensajeId: unknown, indice: number,
  v: { s: SesionLibro; microcicloId: string; ejercicioId: string; series: unknown }, anterior: () => Promise<boolean>,
): Promise<boolean> {
  if (!libroEncendido(d) || !mensajeValido(mensajeId)) return anterior()
  const r = await rpcLibro(d, v.s, 'praxis_aplicar_series', {
    p_mensaje_id: mensajeId.trim(), p_indice: indice, p_microciclo_id: v.microcicloId, p_ejercicio_id: v.ejercicioId, p_series: v.series,
  })
  return r.ausente ? anterior() : r.ok
}

/** Adherencia: igual que `seriesGuardar`, con `praxis_aplicar_adherencia`. Devuelve algo con `.ok`, como el `Response` de antes. */
export async function adherenciaGuardar(
  d: Deps, mensajeId: unknown, indice: number, v: { s: SesionLibro; fecha: string; estado: string }, anterior: () => Promise<{ ok: boolean }>,
): Promise<{ ok: boolean }> {
  if (!libroEncendido(d) || !mensajeValido(mensajeId)) return anterior()
  const r = await rpcLibro(d, v.s, 'praxis_aplicar_adherencia', { p_mensaje_id: mensajeId.trim(), p_indice: indice, p_fecha: v.fecha, p_estado: v.estado })
  return r.ausente ? anterior() : { ok: r.ok }
}

// ——— Firma de la tarjeta ———

const aHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

async function firmar(secreto: string, registroId: string, usuarioId: string, venceEn: string): Promise<string> {
  const e = new TextEncoder()
  const llave = await crypto.subtle.importKey('raw', e.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return aHex(await crypto.subtle.sign('HMAC', llave, e.encode(`deshacer|${registroId}|${usuarioId}|${venceEn}`)))
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

// ——— Leer el libro ———

const NOMBRE_ESTADO: Record<string, string> = { si: 'sí', parcial: 'parcial', no: 'no' }
const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** El tipo del libro (base) al del dominio: la base llama `agua` a lo que el dominio llama `hidratacion`. */
const TIPO_DOMINIO: Record<string, TipoRegistroLibro> = { series: 'series', adherencia: 'adherencia', agua: 'hidratacion' }

const mlDe = (x: unknown): number | null => (esObjeto(x) && typeof x.ml === 'number' && Number.isFinite(x.ml) ? x.ml : null)

/** Descripción corta, solo con cifras del libro: nada de texto libre de la persona. */
function describir(tipo: TipoRegistroLibro, despues: unknown, antes: unknown): string {
  const d = esObjeto(despues) ? despues : {}
  if (tipo === 'hidratacion') {
    // Lo que sumó ESA tarjeta (0161: antes nulo = la fila del día no existía, cuenta desde 0).
    const total = mlDe(despues)
    return total === null ? 'agua de hoy' : `+${total - (mlDe(antes) ?? 0)} ml`
  }
  if (tipo === 'adherencia') return `marcada «${NOMBRE_ESTADO[String(d.estado)] ?? 'sin dato'}»`
  const series = Array.isArray(d.series) ? d.series : []
  const ultima = series[series.length - 1]
  const n = series.length
  const base = `${n} ${n === 1 ? 'serie' : 'series'}`
  return esObjeto(ultima) && typeof ultima.cargaKg === 'number' && typeof ultima.reps === 'number' ? `${base}, última de ${ultima.cargaKg} kg × ${ultima.reps}` : base
}

async function leerLibro(d: Deps, s: SesionLibro): Promise<RegistroLibro[] | null> {
  try {
    const r = await d.fetch(
      `${d.entorno.SUPABASE_URL}/rest/v1/praxis_registros_aplicados?usuario_id=eq.${s.usuarioId}&deshecho_en=is.null&tipo=in.(series,adherencia,agua)` +
        '&select=id,usuario_id,tipo,antes,despues,creado_en,deshecho_en&order=creado_en.desc&limit=30',
      { headers: cabeceras(d, s) },
    )
    if (!r.ok) return null
    const filas = (await r.json()) as unknown
    if (!Array.isArray(filas)) return null
    return filas.flatMap((f): RegistroLibro[] => {
      if (!esObjeto(f) || typeof f.id !== 'string' || typeof f.usuario_id !== 'string' || typeof f.creado_en !== 'string') return []
      const tipo = typeof f.tipo === 'string' ? TIPO_DOMINIO[f.tipo] : undefined
      if (!tipo) return []
      return [{ id: f.id, usuarioId: f.usuario_id, tipo, descripcion: describir(tipo, f.despues, f.antes), creadoEn: f.creado_en, deshechoEn: null }]
    })
  } catch {
    return null
  }
}

// ——— Proponer (por frase) ———

async function tarjetaFirmada(d: Deps, s: SesionLibro, r: RegistroLibro) {
  const t = tarjetaDe(r, d.ahora())
  const token = await firmar(d.entorno.PRAXIS_SECRETO_DESHACER ?? '', t.registroId, s.usuarioId, t.venceEn)
  return { campo: t.campo, registro_id: t.registroId, tipo: t.tipo, descripcion: t.descripcion, vence_en: t.venceEn, token }
}

async function paraLaPantalla(d: Deps, s: SesionLibro, p: PropuestaDeshacer, libro: readonly RegistroLibro[]) {
  if (p.accion === 'confirmar_deshacer') {
    const r = libro.find((x) => x.id === p.tarjeta.registroId)
    return { accion: p.accion, texto: p.texto, botones: p.botones, tarjeta: r ? await tarjetaFirmada(d, s, r) : null }
  }
  if (p.accion === 'preguntar') return { accion: p.accion, texto: p.texto, botones: p.botones, opciones: p.opciones.map((o) => ({ registro_id: o.registroId, etiqueta: o.etiqueta })) }
  return p
}

const respuesta = (s: SesionLibro, frase: string | null, propuesta: unknown) =>
  json({ tipo: 'deshacer', propuesta, meta: { modelo: null, camino: 'deshacer', decision: frase === null ? undefined : decisionEnSombra(s, frase, false) } })

/**
 * Llamado por `proponer` DESPUÉS del filtro de riesgo. `null` = no es un «deshaz …» o el libro no está listo
 * (apagado, sin clave, tabla sin migrar): se sigue como siempre. Sin modelo, sin cupo, sin escribir.
 */
export async function deshacerPorFrase(d: Deps, s: SesionLibro, frase: string): Promise<Response | null> {
  if (!libroEncendido(d) || !d.entorno.PRAXIS_SECRETO_DESHACER) return null
  const pedido = interpretarPedidoDeshacer(frase)
  if (!pedido) return null
  const libro = await leerLibro(d, s)
  if (!libro) return null
  const p = proponerDeshacer(libro, pedido, d.ahora(), ZONA_BOGOTA, s.usuarioId)
  console.log('praxis-registro: deshacer', p.accion)
  return respuesta(s, frase, await paraLaPantalla(d, s, p, libro))
}

// ——— POST /deshacer ———

const TEXTOS = {
  deshecho: { series: 'Listo, dejé las series como estaban antes.', adherencia: 'Listo, quité la adherencia que anotaste.', agua: 'Listo, dejé el agua de hoy como estaba antes.' } as Record<string, string>,
  ya_deshecho: 'Eso ya estaba deshecho. No toqué nada más.',
  cambio_despues: 'Eso ya cambió después, así que no lo toqué.',
  vencida: 'La tarjeta venció y no quité nada. Pídemelo otra vez.',
  invalida: 'Esa tarjeta no vale. No toqué nada.',
  falta: 'Falta tu confirmación. No toqué nada.',
  ajeno: 'No encontré ese registro entre los tuyos. No toqué nada.',
  otro_dia: 'Es de otro día; para eso dime el valor correcto y lo corrijo con tu confirmación. No toqué nada.',
  base: 'No pude quitarlo ahora. No toqué nada.',
}
const rechazo = (resultado: string, texto: string, status: number) => json({ tipo: 'deshacer', resultado, texto }, status)

/** Segundo paso de «¿cuál quito?»: la persona eligió UNO y recién ahí se emite su tarjeta de confirmación. */
async function confirmarElegido(d: Deps, s: SesionLibro, registroId: string): Promise<Response> {
  const libro = await leerLibro(d, s)
  const r = libro?.find((x) => x.id === registroId && x.usuarioId === s.usuarioId)
  if (!libro || !r) return rechazo('no_encontrado', TEXTOS.ajeno, 404)
  const p = { accion: 'confirmar_deshacer' as const, texto: textoConfirmacion(r, ZONA_BOGOTA), botones: [BOTON_SI, BOTON_NO], tarjeta: await tarjetaFirmada(d, s, r) }
  return respuesta(s, null, p)
}

/** La tarjeta que llega: firma (atada a la persona de la SESIÓN), vencimiento. Devuelve el registro o la respuesta de rechazo. */
async function tarjetaValida(d: Deps, s: SesionLibro, c: Record<string, unknown>): Promise<string | Response> {
  const t = esObjeto(c.tarjeta) ? c.tarjeta : {}
  if (c.confirmado !== true) return rechazo('sin_confirmar', TEXTOS.falta, 400)
  if (typeof t.registro_id !== 'string' || !UUID.test(t.registro_id) || typeof t.vence_en !== 'string' || typeof t.token !== 'string') {
    return rechazo('tarjeta_invalida', TEXTOS.invalida, 400)
  }
  const esperada = await firmar(d.entorno.PRAXIS_SECRETO_DESHACER ?? '', t.registro_id, s.usuarioId, t.vence_en)
  if (!iguales(esperada, t.token)) return rechazo('tarjeta_invalida', TEXTOS.invalida, 403)
  if (!(d.ahora().getTime() <= Date.parse(t.vence_en))) return rechazo('vencida', TEXTOS.vencida, 410)
  return t.registro_id
}

/** Lo que contesta `praxis_deshacer` (0162; el agua, 0163), dicho en palabras. */
function contarResultado(o: { deshecho?: unknown; ya_deshecho?: unknown; motivo?: unknown; tipo?: unknown; fecha?: unknown; total_ml?: unknown } | null): Response {
  if (o?.ya_deshecho === true) return json({ tipo: 'deshacer', resultado: 'ya_deshecho', texto: TEXTOS.ya_deshecho })
  if (o?.deshecho === true) {
    // Agua (0163): el total que quedó, para que el teléfono fije el suyo. Solo si la base lo dio bien formado.
    const agua = o.tipo === 'agua' && typeof o.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.fecha)
      && Number.isInteger(o.total_ml) && (o.total_ml as number) >= 0 && (o.total_ml as number) <= 10000
      ? { agua: { fecha: o.fecha, total_ml: o.total_ml } } : {}
    return json({ tipo: 'deshacer', resultado: 'deshecho', texto: TEXTOS.deshecho[String(o.tipo)] ?? 'Listo, lo quité.', ...agua })
  }
  if (o?.motivo === 'cambio_despues') return json({ tipo: 'deshacer', resultado: 'cambio_despues', texto: TEXTOS.cambio_despues })
  return rechazo('error', TEXTOS.base, 502)
}

/** Un rechazo de la base (excepción de la RPC): sin el mensaje ni la persona en el registro de la consola. */
async function contarRechazo(r: Response): Promise<Response> {
  const e = (await r.json().catch(() => null)) as { code?: unknown; message?: unknown } | null
  const codigo = typeof e?.code === 'string' && /^[A-Za-z0-9]{3,10}$/.test(e.code) ? e.code : ''
  console.error('praxis-registro: deshacer rechazado', r.status, codigo)
  if (codigo === '42501') return rechazo('no_encontrado', TEXTOS.ajeno, 403)
  if (codigo === '22023' && typeof e?.message === 'string' && e.message.includes('otro dia')) return rechazo('otro_dia', TEXTOS.otro_dia, 409)
  return rechazo('error', TEXTOS.base, 502)
}

export async function deshacer(d: Deps, s: SesionLibro, cuerpo: unknown): Promise<Response> {
  if (!libroEncendido(d) || !d.entorno.PRAXIS_SECRETO_DESHACER) return json({ error: 'Deshacer todavía no está encendido' }, 503)
  const c = esObjeto(cuerpo) ? cuerpo : {}
  if (typeof c.elegir === 'string') return UUID.test(c.elegir) ? confirmarElegido(d, s, c.elegir) : rechazo('no_encontrado', TEXTOS.ajeno, 404)
  const registroId = await tarjetaValida(d, s, c)
  if (typeof registroId !== 'string') return registroId

  const mensajeId = mensajeValido(c.mensaje_id) ? c.mensaje_id.trim() : `deshacer-${d.ahora().getTime()}`
  let r: Response
  try {
    r = await d.fetch(`${d.entorno.SUPABASE_URL}/rest/v1/rpc/praxis_deshacer`, {
      method: 'POST', headers: cabeceras(d, s),
      body: JSON.stringify({ p_registro_id: registroId, p_mensaje_id: mensajeId, p_confirmado: true }),
    })
  } catch {
    return rechazo('error', TEXTOS.base, 502)
  }
  return r.ok ? contarResultado((await r.json().catch(() => null)) as Parameters<typeof contarResultado>[0]) : contarRechazo(r)
}
