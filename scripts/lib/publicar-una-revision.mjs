/**
 * SUBIR Y ESCRIBIR UNA REVISIÓN. Una sola, de una sola persona, y sin aprobarla.
 *
 * Esto era el cuerpo de `publicar-video.mjs` y se sacó aquí cuando apareció el
 * segundo que necesitaba publicar: el puente que recorre a las veintitrés
 * (`revision-semanal.mjs`). Tenerlo dos veces habría permitido que discreparan
 * —que uno admita un formato que el otro rechaza, o que uno escriba el tipo y el
 * otro lo deje al `default 'video'` de la tabla, que no falla: MIENTE—, y esa
 * clase de desacuerdo no da error, da un archivo que el móvil no abre o una
 * revisión de voz marcada como vídeo.
 *
 * Sigue sin aprobar nada, y sigue sin poder: aquí no hay ninguna forma de
 * escribir la firma. Lo que hace que una revisión salga es la bandeja.
 */
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

import {
  contentTypeDelMedio,
  decidirPublicacion,
  filaDelVideo,
} from '../../src/domain/video/publicacion.ts'

export const BUCKET = 'medios-app'

/** Por qué no se publica, dicho como se lo diría alguien a otro. */
export const PORQUE = {
  'sin-usuario': 'no se ha dicho de quién es el vídeo',
  'semana-no-es-lunes': 'la semana tiene que ser un LUNES en formato AAAA-MM-DD',
  'archivo-vacio': 'el archivo está vacío',
  'archivo-enorme': 'el archivo pasa del tope: algo salió mal al renderizar',
  'extension-no-admitida': 'eso no es un audio ni un vídeo que el móvil vaya a reproducir',
  'sin-guion': 'falta el guion, y sin él el vídeo no se puede auditar después',
  'ya-aprobado':
    'ese vídeo YA ESTÁ APROBADO. Sobrescribirlo emitiría otro distinto bajo una firma que ' +
    'ya se dio. Si de verdad hay que cambiarlo, vuelve a pedir la firma o usa --forzar.',
}

/**
 * Publica el archivo de una persona para una semana.
 *
 * @param {object} p
 * @param {import('@supabase/supabase-js').SupabaseClient|null} p.supabase `null` solo en ensayo.
 * @param {string} p.usuarioId
 * @param {string} p.semana El lunes, en AAAA-MM-DD.
 * @param {string} p.archivo Ruta del audio o vídeo ya renderizado.
 * @param {string} p.guion Lo que dice, palabra por palabra. Obligatorio.
 * @param {boolean} [p.forzar] Sobrescribir aunque ya esté aprobado.
 * @param {boolean} [p.ensayo] No tocar nada: decir qué haría.
 * @returns {Promise<{publicado: boolean, ensayo?: boolean, path?: string, reemplaza?: boolean,
 *                    motivo?: string, tamanoBytes?: number}>}
 */
export async function publicarUnaRevision({
  supabase,
  usuarioId,
  semana,
  archivo,
  guion,
  forzar = false,
  ensayo = false,
}) {
  const ruta = resolve(process.cwd(), archivo)
  const { size } = await stat(ruta)
  const extension = extname(ruta).replace('.', '').toLowerCase()
  const texto = (guion ?? '').trim()

  // Qué hay ya de esa persona y esa semana. En ensayo no se pregunta: se supone que no hay,
  // y quien lo lea tiene que saber que «publicaría» NO significa «la semana estaba libre».
  let yaHay
  if (!ensayo) {
    const { data, error } = await supabase
      .from('videos_semanales')
      .select('path, aprobado_en')
      .eq('usuario_id', usuarioId)
      .eq('semana', semana)
      .maybeSingle()
    // Un error aquí NO puede leerse como «no hay nada»: si la consulta falla y seguimos,
    // podríamos pisar una revisión aprobada creyendo que la semana estaba libre.
    if (error && error.code !== 'PGRST116') {
      throw new Error(`no pude comprobar si ya había vídeo esa semana: ${error.message}`)
    }
    if (data) yaHay = { path: data.path, aprobadoEn: data.aprobado_en ?? null }
  }

  const encargo = { usuarioId, semana, tamanoBytes: size, extension, guion: texto }
  const decision = decidirPublicacion(encargo, yaHay, forzar)

  if (!decision.publica) {
    return { publicado: false, motivo: decision.motivo, tamanoBytes: size }
  }

  if (ensayo) {
    return { publicado: false, ensayo: true, path: decision.path, tamanoBytes: size }
  }

  const cuerpo = await readFile(ruta)
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(decision.path, cuerpo, { contentType: contentTypeDelMedio(extension), upsert: true })
  if (errorSubida) throw new Error(`no pude subir el archivo: ${errorSubida.message}`)

  const { error: errorFila } = await supabase.from('videos_semanales').upsert(
    {
      ...filaDelVideo(encargo, decision),
      // La hora la pone AQUI y no el modulo de decision, que es puro y no mira el reloj.
      // Hace falta ponerla a mano porque el `default now()` de la tabla solo corre al
      // INSERTAR: en un reemplazo, sin esto, `publicado_en` seguiria diciendo cuando se
      // publico el primero mientras el archivo ya es otro.
      publicado_en: new Date().toISOString(),
    },
    { onConflict: 'usuario_id,semana' },
  )
  if (errorFila) throw new Error(`subí el archivo pero no pude escribir la fila: ${errorFila.message}`)

  return { publicado: true, path: decision.path, reemplaza: decision.reemplaza, tamanoBytes: size }
}
