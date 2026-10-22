/**
 * LA FIRMA AUTOMÁTICA DEL PUENTE (decisión de Bryan, 21-oct: «Solos, sin freno»).
 *
 * Los mensajes semanales con su voz clonada salen sin que él los apruebe. Esto es la mitad del
 * puente que decide A QUIÉN se firma; la otra mitad, QUÉ se puede firmar, vive en la base
 * (`firmar_revisiones_automaticas`, migración `XXXX_aprobacion_automatica_revisiones.sql`): solo
 * el proceso de servicio, nunca una firma ya hecha, nada con corrección pedida, y el interruptor
 * `detener`. Las dos puertas son distintas a propósito: ésta confía en el agente, aquélla no.
 *
 * REGLAS DE ESTE LADO:
 *   · solo se firma lo que el agente de mensajes marcó «publicar». Si el agente no respondió y
 *     salió la plantilla, o lo mandó a la bandeja, o lo omitió, NO se firma: se publica sin firma
 *     (queda en la bandeja del coach) o no se publica;
 *   · la fila que está en la base tiene que decir lo mismo que el manifiesto: el audio y la letra
 *     que se firman son los que se revisaron;
 *   · la bandera está APAGADA por defecto.
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'

const MOTIVOS = {
  bandeja_humana: 'el agente lo mandó a la bandeja del coach',
  omitir: 'el agente lo omitió',
  sin_respuesta: 'sin respuesta del agente (salió la plantilla)',
}

const normal = (t) => String(t ?? '').trim()

/**
 * @param {{manifiesto: {encargos: object[]}, filas: {usuario_id: string, guion: string, version: number, aprobado_en: string|null}[]}} p
 * @returns {{usuarios: string[], revisiones: {usuario_id: string, version: number, guion_sha256: string}[], noFirmadas: {usuarioId: string, motivo: string}[]}}
 *
 * H4 (revisión 06): lo que se firma es LA VERSIÓN Y EL GUION QUE SE COMPROBÓ aquí. Cada revisión lleva la
 * versión de la fila y la huella (sha256) de su guion TAL COMO ESTÁ en la base; la RPC firma solo si en
 * ese instante la fila sigue siendo esa. Si otra corrida republica entre la lectura y la firma, no se firma.
 */
export function elegirParaFirmar({ manifiesto, filas }) {
  const porUsuario = new Map(filas.map((f) => [f.usuario_id, f]))
  const usuarios = []
  const revisiones = []
  const noFirmadas = []
  const vistos = new Set()
  for (const encargo of manifiesto.encargos) {
    if (encargo.omitido) continue
    const id = encargo.usuarioId
    if (vistos.has(id)) continue
    vistos.add(id)
    const estado = encargo.mensaje?.estado
    if (estado !== 'publicar') {
      noFirmadas.push({ usuarioId: id, motivo: MOTIVOS[estado] ?? MOTIVOS.sin_respuesta })
      continue
    }
    const fila = porUsuario.get(id)
    if (!fila) {
      noFirmadas.push({ usuarioId: id, motivo: 'no hay fila publicada en la base' })
    } else if (fila.aprobado_en) {
      noFirmadas.push({ usuarioId: id, motivo: 'ya estaba firmada' })
    } else if (normal(fila.guion) !== normal(encargo.guion)) {
      noFirmadas.push({ usuarioId: id, motivo: 'el guion de la base no es el del manifiesto' })
    } else if (!Number.isInteger(fila.version)) {
      noFirmadas.push({ usuarioId: id, motivo: 'la fila no trae su versión: no hay a qué versión atar la firma' })
    } else {
      usuarios.push(id)
      revisiones.push({ usuario_id: id, version: fila.version, guion_sha256: huellaDelGuion(fila.guion) })
    }
  }
  return { usuarios, revisiones, noFirmadas }
}

/** La huella del guion byte a byte, como lo guarda la base (la RPC calcula la misma sobre ideos_semanales.guion). */
export function huellaDelGuion(guion) {
  return createHash('sha256').update(String(guion ?? ''), 'utf8').digest('hex')
}

/**
 * Llama a la RPC. Un error de la base NO se lee como «cero firmadas»: sin esto una función que no
 * existe (la migración sin aplicar) pasaría por una tanda tranquila.
 */
export async function firmarRevisionesAutomaticas(supabase, { semana, revisiones }) {
  if (revisiones.length === 0) return { firmadas: 0, pedidas: 0 }
  for (const r of revisiones) {
    if (!r.usuario_id || !Number.isInteger(r.version) || !/^[0-9a-f]{64}$/.test(String(r.guion_sha256 ?? ''))) {
      throw new Error(`una revisión sin versión o sin huella del guion no se puede firmar (${r.usuario_id ?? 'sin id'})`)
    }
  }
  const { data, error } = await supabase.rpc('firmar_revisiones_automaticas', {
    p_semana: semana,
    p_revisiones: revisiones,
  })
  if (error) throw new Error(`no pude firmar las revisiones: ${error.message}`)
  if (typeof data !== 'number') throw new Error('la base no contestó cuántas firmó (se esperaba un número)')
  return { firmadas: data, pedidas: revisiones.length }
}

/**
 * ¿Está encendida la firma automática? APAGADA por defecto. Se enciende con `--firma-automatica`
 * (esa corrida) o dejando el archivo `%USERPROFILE%\.alpha\firma-automatica.activa` (persistente:
 * las tareas programadas no llevan parámetros). Un valor raro en el argumento no la enciende.
 */
export function banderaDeFirmaEncendida({ argumento, archivo } = {}) {
  if (argumento === true) return true
  return Boolean(archivo) && existsSync(archivo)
}
