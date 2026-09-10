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

/** Para las pruebas y para el cierre de sesión: la firma no debe sobrevivir. */
export function olvidarMediosFirmados(): void {
  cache = undefined
  enVuelo = undefined
}
