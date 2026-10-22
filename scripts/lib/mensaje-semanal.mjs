/**
 * EL PASO 1.6: el agente LOCAL de mensajes escribe el guion de cada persona.
 *
 * Va entre los guiones de la plantilla (paso 1) y la voz (paso 2). Reemplaza al antiguo paso 1.5
 * («revisión larga»), que mandaba la ficha de la tasa de cada persona a un modelo externo para que
 * redactara 2-3 minutos. DECISIÓN DE BRYAN, 22-oct: «Todo en el PC». El agente
 * (`cerebro-alpha-agentes/agentes/mensaje_semanal.py`) es Python local, sin modelo y sin red: lee el
 * plan vigente de la persona, las cifras que ya calculó la app y las banderas, y devuelve un texto
 * de 20-40 s con cada cifra atada a su fuente. Si el agente no está o no responde, queda la
 * plantilla de `guion.ts` y NO se firma nada automáticamente (ver `firma-automatica.mjs`).
 *
 * Esta pieza solo traspasa datos de un contrato al otro. El criterio del mensaje es del agente.
 */

const ESTADOS = new Set(['publicar', 'bandeja_humana', 'omitir'])

const primerNombre = (nombre) => String(nombre ?? '').trim().split(/\s+/)[0] || 'atleta'

function mas7Dias(lunes) {
  const d = new Date(`${lunes}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString().slice(0, 10)
}

/**
 * Quién tiene una orden `detener` VIGENTE para la semana de la revisión o la siguiente: por cada
 * semana manda la orden más reciente entre `detener` y `reanudar`. Es la misma regla de la
 * función SQL `firmar_revisiones_automaticas` y de la consola; se repite aquí para no gastar una
 * hora de voz en quien no va a recibir nada.
 */
export function personasDetenidas(ordenes, semana) {
  const semanas = new Set([semana, mas7Dias(semana)])
  const ultima = new Map()
  for (const o of ordenes ?? []) {
    if (o.tipo !== 'detener' && o.tipo !== 'reanudar') continue
    const usuario = o.objetivo?.usuario_id
    const inicio = String(o.objetivo?.semana_inicio ?? '').slice(0, 10)
    if (!usuario || !semanas.has(inicio)) continue
    const clave = `${usuario}|${inicio}`
    const previa = ultima.get(clave)
    if (!previa || String(o.creada_en) > String(previa.creada_en)) ultima.set(clave, o)
  }
  const detenidos = new Set()
  for (const [clave, o] of ultima) {
    if (o.tipo === 'detener') detenidos.add(clave.split('|')[0])
  }
  return detenidos
}

function numerosDelAgente(n) {
  const r = n.regularidad ?? {}
  const regularidad = { estado: r.estado, noches_con_dato: r.nochesConDato ?? 0 }
  if (typeof r.indice === 'number') regularidad.indice = r.indice
  return {
    sesiones_pautadas: n.sesionesPautadas,
    sesiones_hechas: n.sesionesHechas,
    adherencia_pct: typeof n.adherenciaPct === 'number' ? n.adherenciaPct : null,
    regularidad,
  }
}

/**
 * La entrada del agente (contrato `mensaje_semanal` v1).
 *
 * La CLAVE es el `usuario_id`, nunca el nombre (`publicacion.ts:22`; ya costó una carga): el
 * `slug` solo llega por un `roster` explícito y la tasa solo a quien tiene ficha con SU id.
 * Las banderas de salud (dolor, ánimo, alerta clínica) no se inventan: el puente todavía no las
 * calcula, y el agente trata la ausencia como «sin bandera».
 */
export function armarEntradaDelAgente({ manifiesto, fichas = [], roster = [], ordenes = [] }) {
  const slugs = new Map(roster.map((r) => [r.usuario_id, r.slug]))
  const tasas = new Map(fichas.filter((f) => f.usuario_id).map((f) => [f.usuario_id, f]))
  const detenidos = personasDetenidas(ordenes, manifiesto.semana)
  const personas = manifiesto.encargos
    .filter((e) => !e.omitido)
    .map((e) => {
      const persona = {
        usuario_id: e.usuarioId,
        nombre_pila: primerNombre(e.nombre),
        numeros: numerosDelAgente(e.numeros ?? {}),
      }
      const slug = slugs.get(e.usuarioId)
      if (slug) persona.slug = slug
      const ficha = tasas.get(e.usuarioId)
      if (ficha) {
        persona.tasa = { ejes: ficha.ejes ?? [] }
        if (ficha.microciclo_activo !== undefined) persona.tasa.microciclo_activo = ficha.microciclo_activo
      }
      if (detenidos.has(e.usuarioId)) persona.banderas = { detenido: true }
      return persona
    })
  return { version: 1, semana: manifiesto.semana, personas }
}

/**
 * Aplica la respuesta del agente al manifiesto SIN mutarlo.
 *
 * · `publicar`: el guion del agente reemplaza al de la plantilla (que se guarda una sola vez en
 *   `guionPlantilla`); es lo único que luego se firma solo.
 * · `bandeja_humana`: si el agente trae guion se usa ese; se publica SIN firma, para el coach.
 * · `omitir`: no se hace audio.
 * · cualquier otra cosa —persona que el agente no devolvió, estado desconocido—: `sin_respuesta`,
 *   se queda la plantilla y no se firma.
 */
export function aplicarSalidaDelAgente({ manifiesto, salida }) {
  const respuestas = new Map()
  const ignorados = []
  const enManifiesto = new Set(manifiesto.encargos.map((e) => e.usuarioId))
  for (const m of salida?.mensajes ?? []) {
    if (!enManifiesto.has(m.usuario_id)) ignorados.push(m.usuario_id)
    else if (!respuestas.has(m.usuario_id)) respuestas.set(m.usuario_id, m)
  }

  const resumen = { publicar: 0, bandeja_humana: 0, omitir: 0, sin_respuesta: 0 }
  const textos = []
  const avisos = []
  const encargos = manifiesto.encargos.map((e) => {
    const nuevo = JSON.parse(JSON.stringify(e))
    const m = respuestas.get(e.usuarioId)
    if (!m || !ESTADOS.has(m.estado)) {
      nuevo.mensaje = { estado: 'sin_respuesta', motivo: m ? `estado desconocido «${m.estado}»` : 'el agente no devolvió a esta persona' }
      resumen.sin_respuesta += 1
      return nuevo
    }
    resumen[m.estado] += 1
    nuevo.mensaje = {
      estado: m.estado,
      motivo: m.motivo ?? null,
      agente: salida.agente ?? null,
      entradaSha256: salida.entrada_sha256 ?? null,
      preguntas: (m.preguntas_a_persona ?? []).length,
      avisos: (m.avisos_al_coach ?? []).length,
    }
    if (m.estado === 'omitir') {
      nuevo.omitido = true
    } else if (typeof m.guion === 'string' && m.guion.trim()) {
      if (nuevo.guionPlantilla === undefined) nuevo.guionPlantilla = e.guion
      nuevo.guion = m.guion.trim()
      textos.push({ archivoGuion: e.archivoGuion, texto: nuevo.guion })
    }
    for (const a of m.avisos_al_coach ?? []) {
      avisos.push({
        id: `mensaje-semanal-${manifiesto.semana}-${e.usuarioId}-${a.tipo}`,
        tipo: `mensaje_semanal_${a.tipo}`,
        mensaje: `${e.nombre || e.usuarioId}: ${a.texto}`,
      })
    }
    return nuevo
  })

  return {
    manifiesto: {
      ...manifiesto,
      encargos,
      mensajeSemanal: {
        generado: new Date().toISOString(),
        agente: salida?.agente ?? null,
        entradaSha256: salida?.entrada_sha256 ?? null,
        ...resumen,
      },
    },
    textos,
    avisos,
    ignorados,
    resumen,
  }
}
