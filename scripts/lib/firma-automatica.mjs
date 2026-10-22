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
import { existsSync } from 'node:fs'

const MOTIVOS = {
  bandeja_humana: 'el agente lo mandó a la bandeja del coach',
  omitir: 'el agente lo omitió',
  sin_respuesta: 'sin respuesta del agente (salió la plantilla)',
}

const normal = (t) => String(t ?? '').trim()

/**
 * @param {{manifiesto: {encargos: object[]}, filas: {usuario_id: string, guion: string, aprobado_en: string|null}[]}} p
 * @returns {{usuarios: string[], noFirmadas: {usuarioId: string, motivo: string}[]}}
 */
export function elegirParaFirmar({ manifiesto, filas }) {
  const porUsuario = new Map(filas.map((f) => [f.usuario_id, f]))
  const usuarios = []
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
    } else {
      usuarios.push(id)
    }
  }
  return { usuarios, noFirmadas }
}

/**
 * Llama a la RPC. Un error de la base NO se lee como «cero firmadas»: sin esto una función que no
 * existe (la migración sin aplicar) pasaría por una tanda tranquila.
 */
export async function firmarRevisionesAutomaticas(supabase, { semana, usuarios }) {
  if (usuarios.length === 0) return { firmadas: 0, pedidas: 0 }
  const { data, error } = await supabase.rpc('firmar_revisiones_automaticas', {
    p_semana: semana,
    p_usuarios: usuarios,
  })
  if (error) throw new Error(`no pude firmar las revisiones: ${error.message}`)
  if (typeof data !== 'number') throw new Error('la base no contestó cuántas firmó (se esperaba un número)')
  return { firmadas: data, pedidas: usuarios.length }
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
