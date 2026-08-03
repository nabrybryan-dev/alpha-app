import type { RutaAsesorado } from '../../domain/rutaEntrenamiento'
import type { RutaRepo } from '../repos'
import { escalaPara, nivelDe, siguienteNivelDe } from './contenidoRuta'

/**
 * Acceso a la ruta del asesorado: en qué peldaño está y cómo se le pinta la
 * escala.
 *
 * Antes esto devolvía siempre el peldaño 03, para cualquiera. El `usuarioId`
 * llegaba y se ignoraba, así que todos veían "NIVEL 03 · RENDIMIENTO" el día que
 * entraban y dos años después.
 *
 * Ahora el peldaño se lee de fuera —hoy del perfil, mañana de su propia tabla— y
 * este archivo solo lo traduce a lo que la pantalla necesita.
 */
export function crearRutaRepo(peldanoDe: (usuarioId: string) => number): RutaRepo {
  return {
    byUsuario: (usuarioId: string): RutaAsesorado => {
      const peldano = peldanoDe(usuarioId)
      return {
        usuarioId,
        nivelActual: nivelDe(peldano),
        siguienteNivel: siguienteNivelDe(peldano),
        bloque: {
          nombre: 'Acumulación',
          detalle: 'Volumen en ascenso hacia la descarga',
          semana: 3,
          semanasTotales: 4,
        },
        escala: escalaPara(peldano),
      }
    },
  }
}
