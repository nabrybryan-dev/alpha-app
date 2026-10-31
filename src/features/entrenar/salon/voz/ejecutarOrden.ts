import type { Sesion, Microciclo } from '../../../../domain/types'
import type { IdDeRegion } from '../../sujeto/regiones'
import { guionDelDia } from '../guia/guionDelDia'
import type { EstadoDeLaGuia } from '../guia/useZonaDePraxis'
import { ordenDeZonas } from '../guia/zonasDePraxis'
import type { Orden } from './ordenesDeVoz'

/** Lo que una orden de voz puede mover: lo mismo que ya mueven los toques, y nada más. */
export interface MandosDelSalon {
  vista: 'cuerpo' | 'movimiento'
  guia: EstadoDeLaGuia
  sesion?: Sesion
  previo?: Microciclo
  ir: (destino: EstadoDeLaGuia) => void
  cambiarVista: (vista: 'cuerpo' | 'movimiento') => void
  irAlEjercicio?: (indice: number) => void
  girar?: (azimut: number) => void
  darLaVuelta: () => void
}

function pasar(m: MandosDelSalon, salto: 1 | -1): void {
  const { guia } = m
  if (guia === null || guia === 'indice') {
    if (salto === 1) m.ir({ paso: 0, zona: null })
    return
  }
  if (typeof guia === 'object') {
    const guion = guionDelDia(m.sesion, m.previo)
    const destino = guion[guia.paso + salto]
    if (destino) m.ir({ paso: guia.paso + salto, zona: destino.zona })
    else if (salto === 1) m.ir(null)
    return
  }
  const orden = ordenDeZonas(m.sesion)
  const zona: IdDeRegion = guia
  m.ir(orden[(orden.indexOf(zona) + salto + orden.length) % orden.length]!)
}

/** Abrir la guía solo se ve en la vista del cuerpo: si estaba en movimiento, primero se vuelve. */
function abrir(m: MandosDelSalon, destino: EstadoDeLaGuia): void {
  if (m.vista !== 'cuerpo') m.cambiarVista('cuerpo')
  m.ir(destino)
}

export function ejecutarOrden(orden: Orden, m: MandosDelSalon): void {
  switch (orden.tipo) {
    case 'zona': return abrir(m, orden.id)
    case 'hoy': return abrir(m, { paso: 0, zona: null })
    case 'indice': return abrir(m, 'indice')
    case 'siguiente': return pasar(m, 1)
    case 'anterior': return pasar(m, -1)
    case 'cerrar': return m.ir(null)
    case 'cuerpo': return m.cambiarVista('cuerpo')
    case 'movimiento': return m.cambiarVista('movimiento')
    case 'vuelta': return m.darLaVuelta()
    case 'cara': return m.girar?.(orden.cara === 'frente' ? 0 : 180)
    case 'ejercicio':
      m.irAlEjercicio?.(orden.indice)
      m.cambiarVista('movimiento')
      return
    case 'salud':
    case 'cual':
    case 'no_entendi':
      return
  }
}
