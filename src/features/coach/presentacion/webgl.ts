import { useCallback, useState } from 'react'
import { useMovimientoReducido } from '../../../components/ui/movimientoReducido'
import { elegirRespaldo, type ModoDeEscena } from '../../../domain/escena3d'

/**
 * ¿Hay WebGL? Se pregunta una sola vez: crear un contexto cuesta y los navegadores limitan
 * cuántos puede haber vivos, así que el de la prueba se suelta enseguida.
 *
 * En jsdom (las pruebas) `WebGLRenderingContext` no existe y se responde que no sin llamar a
 * `getContext`, que allí solo escribe un aviso en la consola.
 */
let hayWebGLGuardado: boolean | undefined

export function hayWebGL(): boolean {
  if (hayWebGLGuardado !== undefined) return hayWebGLGuardado
  try {
    if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) {
      hayWebGLGuardado = false
      return false
    }
    const lienzo = document.createElement('canvas')
    const gl = lienzo.getContext('webgl2') ?? lienzo.getContext('webgl')
    hayWebGLGuardado = gl !== null
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    hayWebGLGuardado = false
  }
  return hayWebGLGuardado
}

/**
 * Si WebGL falló una vez en esta sesión (el contexto no se pudo crear, se perdió, la escena
 * lanzó un error), no se vuelve a intentar hasta recargar: el respaldo SVG se queda.
 */
let falloEnLaSesion = false

/** Qué escena toca enseñar y cómo avisar de que la 3D falló. */
export function useModoDeEscena(): { modo: ModoDeEscena; avisarFallo: () => void } {
  const reducido = useMovimientoReducido()
  const [fallo, setFallo] = useState(falloEnLaSesion)
  const avisarFallo = useCallback(() => {
    falloEnLaSesion = true
    setFallo(true)
  }, [])
  return { modo: elegirRespaldo({ webgl: hayWebGL(), movimientoReducido: reducido, fallo }), avisarFallo }
}
