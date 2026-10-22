/**
 * AVISAR A BRYAN POR EL CANAL QUE YA EXISTE: `notificaciones.log`.
 *
 * Es la misma forma que `avisar_bryan` de cerebro-alpha-agentes (`agentes/cola_mensajes_vida.py`):
 * una línea JSON por aviso, `{ts, id, slug, estado: "AVISO_BRYAN", tipo, urgente, mensaje}`, en
 * `ALPHA_NOTIFICACIONES_LOG` o, por defecto, `ALPHA_ESTADO_DIR/notificaciones.log` (y ése, por
 * defecto, `F:/alpha-corridas/_estado`). Idempotente por `id`: repetir la corrida no duplica.
 *
 * NO PARA LA CADENA SI NO PUEDE ESCRIBIR: un aviso que no se pudo dejar se dice por pantalla y
 * se sigue; lo contrario sería que el aviso de un fallo fuera otro fallo.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const ESTADO_POR_DEFECTO = 'F:/alpha-corridas/_estado'

export function rutaDeNotificaciones(env = process.env) {
  if (env.ALPHA_NOTIFICACIONES_LOG) return env.ALPHA_NOTIFICACIONES_LOG
  return join(env.ALPHA_ESTADO_DIR || ESTADO_POR_DEFECTO, 'notificaciones.log')
}

/** La hora como la escribe Python (`2026-09-28T19:43:57+00:00`), para que el lector no note nada. */
function iso(ahora) {
  return ahora.toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

export function lineaDeAviso({ id, tipo, mensaje, urgente = false, slug = 'revision-semanal', ahora = new Date() }) {
  return JSON.stringify({ ts: iso(ahora), id, slug, estado: 'AVISO_BRYAN', tipo, urgente, mensaje })
}

/** `true` si escribió la línea; `false` si ya estaba o no pudo escribirla. */
export async function avisarABryan(aviso, { env = process.env, errores = console.error } = {}) {
  const ruta = rutaDeNotificaciones(env)
  try {
    let previo = ''
    try {
      previo = await readFile(ruta, 'utf8')
    } catch {
      previo = ''
    }
    for (const linea of previo.split(/\r?\n/)) {
      if (!linea.trim()) continue
      try {
        if (JSON.parse(linea).id === aviso.id) return false
      } catch {
        // una línea que no es JSON no es un aviso: se respeta y se sigue
      }
    }
    await mkdir(dirname(ruta), { recursive: true })
    const separador = previo && !previo.endsWith('\n') ? '\n' : ''
    await appendFile(ruta, `${separador}${lineaDeAviso(aviso)}\n`, 'utf8')
    return true
  } catch (e) {
    errores(`AVISO: no pude escribir el aviso a Bryan en ${ruta}: ${e.message}`)
    return false
  }
}
