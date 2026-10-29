import { Malla } from '../../../domain/patrones/malla'
import { leerTemaDelDocumento } from '../../../lib/temaDelDocumento'
import { paletaDeLaSala } from './paletaDeLaSala'
import { construirSala, type CifrasDelMuro } from './sala'
import { SALA_GIMNASIO } from '../visor/piezas'

/**
 * La sala se cachea POR SUS NÚMEROS, no a secas.
 *
 * Las paredes y la estación de grabación no cambian nunca, pero los marcadores llevan
 * cifras de siete segmentos hechas de geometría: cambiar un número es reconstruir esos
 * dígitos. Cachear por el trío evita rehacer la sala entera en cada fotograma y a la
 * vez deja que el marcador reaccione cuando la serie avanza — que es el único momento
 * en que TIENE que cambiar.
 */
let salaCache: { clave: string; malla: Malla } | null = null

export function salaDelVisor(cifras: CifrasDelMuro | undefined, azimutDeEntrada: number, deBlender: boolean): Malla {
  // El ángulo entra en la clave: si no, cambiar de ejercicio dejaría el marcador del muro
  // de enfrente colgado donde lo puso el ejercicio anterior. Y si la sala de Blender ya
  // llegó: la de cajas se deja de construir y los marcadores cambian de pared.
  // «sin» y no un hueco vacío: una sala sin marcador es una malla DISTINTA de una con él,
  // y dos claves que se parecen demasiado es como se sirve una sala vieja creyendo que es
  // la nueva.
  const marca = cifras ? `${cifras.veces}|${cifras.cuanto}|${cifras.esfuerzo ?? 'apagada'}` : 'sin'
  // El tema entra en la clave: la sala lleva los colores del tema, y cambiar `data-theme`
  // tiene que rehacerla (zona 8). Sin esto se serviría la pared del tema anterior.
  const clave = `${marca}|${azimutDeEntrada}|${deBlender ? 'blender' : 'cajas'}|${leerTemaDelDocumento()}`
  if (!salaCache || salaCache.clave !== clave) {
    const malla = new Malla()
    construirSala(malla, cifras, azimutDeEntrada, {
      paleta: paletaDeLaSala(),
      ...(deBlender ? { salaDeBlender: SALA_GIMNASIO } : {}),
    })
    salaCache = { clave, malla }
  }
  return salaCache.malla
}

