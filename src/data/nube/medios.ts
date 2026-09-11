import { modoNube, supabase } from '../supabase'

/** El cajón privado de la migración 0061. */
const BUCKET = 'medios-app'
/** La firma vive una hora; se reutiliza cincuenta minutos para no rozar el borde. */
const SEGUNDOS_FIRMA = 3600
const VIDA_CACHE_MS = 50 * 60 * 1000

export interface MedioPublicado {
  url: string
  grabadoEl?: string
}

let cache: { valor: MedioPublicado | null; expira: number } | undefined
let enVuelo: Promise<MedioPublicado | null> | undefined

/**
 * El vídeo que hay publicado en un hueco de la app, ya firmado.
 *
 * Dos pasos, y el orden importa: primero se mira **qué** hay publicado
 * (`medios_app`) y solo después se firma ese archivo. Al revés —firmar una ruta
 * que la app se sepa de memoria— el vídeo seguiría abriéndose después de
 * despublicarlo.
 *
 * Devuelve `null` ante cualquier problema y **nunca lanza**: si el vídeo no se
 * puede traer, la pantalla dice que llega el domingo y la conversación de
 * debajo sigue funcionando. Un vídeo no puede tumbar el chat.
 */
export async function medioPublicado(clave: string): Promise<MedioPublicado | null> {
  if (!modoNube) return null

  const ahora = Date.now()
  if (cache && cache.expira > ahora) return cache.valor
  if (enVuelo) return enVuelo

  const peticion = (async () => {
    try {
      const { data: fila } = await supabase()
        .from('medios_app')
        .select('path, grabado_el')
        .eq('clave', clave)
        .maybeSingle()

      const path = typeof fila?.path === 'string' ? fila.path : undefined
      if (!path) return null

      const { data } = await supabase().storage.from(BUCKET).createSignedUrl(path, SEGUNDOS_FIRMA)
      const url = data?.signedUrl
      if (!url) return null

      const grabadoEl = typeof fila?.grabado_el === 'string' ? fila.grabado_el : undefined
      return { url, grabadoEl }
    } catch {
      return null
    }
  })()
    .then((valor) => {
      // Solo se guarda lo que salió bien: cachear un fallo dejaría la cabecera
      // vacía cincuenta minutos por un corte de red de un segundo.
      if (valor) cache = { valor, expira: Date.now() + VIDA_CACHE_MS }
      return valor
    })
    .finally(() => {
      enVuelo = undefined
    })

  enVuelo = peticion
  return peticion
}

/**
 * El vídeo de ESTA semana de quien tenga la sesión abierta, ya firmado.
 *
 * **Se pide por id a propósito, aunque la política ya filtre.** Fiarlo todo a
 * la política tenía un fallo que no se ve hasta que pasa: el COACH puede leer
 * las filas de todo el mundo —lo necesita para revisarlas antes de firmarlas—,
 * así que esta consulta, sin el filtro, le habría devuelto el vídeo más
 * reciente de CUALQUIER persona. Y el coach también entrena y abre esta misma
 * pantalla; la nutricionista del equipo, igual.
 *
 * Así que la política decide qué PUEDE ver y esta línea decide qué PIDE. Las
 * dos, no una.
 *
 * Lo que no se ve aquí y lo cierra la 0068: una fila sin firmar no la devuelve
 * la política, así que un vídeo existe y no sale hasta que alguien lo aprueba.
 */
export async function miVideoDeLaSemana(): Promise<MedioPublicado | null> {
  if (!modoNube) return null
  try {
    const { data: sesion } = await supabase().auth.getUser()
    const yo = sesion?.user?.id
    if (!yo) return null

    const { data: fila } = await supabase()
      .from('videos_semanales')
      .select('path, semana')
      .eq('usuario_id', yo)
      .order('semana', { ascending: false })
      .limit(1)
      .maybeSingle()

    const path = typeof fila?.path === 'string' ? fila.path : undefined
    if (!path) return null

    const { data } = await supabase().storage.from(BUCKET).createSignedUrl(path, SEGUNDOS_FIRMA)
    const url = data?.signedUrl
    if (!url) return null
    return { url, grabadoEl: typeof fila?.semana === 'string' ? fila.semana : undefined }
  } catch {
    return null
  }
}

/** Para las pruebas y para el cierre de sesión: la firma no debe sobrevivir. */
export function olvidarMediosFirmados(): void {
  cache = undefined
  enVuelo = undefined
}
