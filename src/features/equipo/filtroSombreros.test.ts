import { describe, expect, it, vi } from 'vitest'
import {
  filtroActual,
  ponerFiltro,
  reiniciarFiltroParaPruebas,
  suscribirAlFiltro,
} from './filtroSombreros'

/**
 * El filtro de sombreros es UNO SOLO y viaja entre el Hoy del equipo, la Bandeja, Equipo y
 * Empresa (maqueta 7). Vive fuera de React para que cambiar de pantalla no lo reinicie; este
 * test es el contrato de ese viaje.
 */

describe('el filtro de sombreros que viaja entre pantallas', () => {
  it('arranca en «todo»: nadie empieza escondiendo trabajo', () => {
    reiniciarFiltroParaPruebas()
    expect(filtroActual()).toBe('todo')
  })

  it('guarda el sombrero elegido', () => {
    ponerFiltro('nutricion')
    expect(filtroActual()).toBe('nutricion')
  })

  it('avisa a quien esté escuchando, y dejar de escuchar funciona', () => {
    const oyente = vi.fn()
    const dejar = suscribirAlFiltro(oyente)
    ponerFiltro('entreno')
    expect(oyente).toHaveBeenCalledTimes(1)
    dejar()
    ponerFiltro('administracion')
    expect(oyente).toHaveBeenCalledTimes(1)
  })

  it('elegir el mismo filtro no avisa de un cambio que no hubo', () => {
    ponerFiltro('entreno')
    const oyente = vi.fn()
    suscribirAlFiltro(oyente)
    ponerFiltro('entreno')
    expect(oyente).not.toHaveBeenCalled()
  })
})
