import { afterEach, describe, expect, it, vi } from 'vitest'
import { conTransicionDeVista } from './transicionDeVista'

/**
 * Lo que se protege aquí no es la animación: es que la pantalla CAMBIE.
 *
 * Una transición de vista es una mejora. Si el navegador no la trae, si lanza, o
 * si alguien la usa mal, lo que no puede pasar nunca es que el cambio se quede a
 * medias — en la app esto envuelve el cierre de sesión, y quedarse ahí dejaría al
 * asesorado mirando un test post que ya guardó.
 */

const original = document.startViewTransition

afterEach(() => {
  if (original) document.startViewTransition = original
  else delete (document as { startViewTransition?: unknown }).startViewTransition
})

describe('el cambio de pantalla como una escena', () => {
  it('sin soporte del navegador, cambia igual', () => {
    // jsdom no la implementa, así que este es el camino que corre en los tests
    // y en cualquier navegador que aún no la traiga.
    delete (document as { startViewTransition?: unknown }).startViewTransition
    const cambiar = vi.fn()
    conTransicionDeVista(cambiar)
    expect(cambiar).toHaveBeenCalledOnce()
  })

  it('con soporte, el cambio ocurre DENTRO de la transición', () => {
    // Y no antes ni después: el navegador toma la foto del estado nuevo dentro
    // de esa devolución de llamada. Fuera de ella, la foto sale con la pantalla
    // vieja y no se transiciona nada — se paga el coste sin el efecto.
    const orden: string[] = []
    const cambiar = vi.fn(() => orden.push('cambio'))
    document.startViewTransition = vi.fn((cb: () => void) => {
      orden.push('empieza')
      cb()
      orden.push('termina')
      return { finished: Promise.resolve() } as never
    }) as never

    conTransicionDeVista(cambiar)

    expect(orden).toEqual(['empieza', 'cambio', 'termina'])
  })

  it('se llama atada a `document`, no suelta', () => {
    // Leerla suelta y llamarla después la desvincula de su dueño. Aquí el doble
    // hace lo mismo que el navegador de verdad en ese caso: lanzar. Si algún día
    // alguien quita el `.bind`, este test se pone rojo en vez de dejar un fallo
    // que solo aparece en un navegador concreto.
    document.startViewTransition = function (this: unknown, cb: () => void) {
      if (this !== document) throw new TypeError('Illegal invocation')
      cb()
      return { finished: Promise.resolve() } as never
    } as never

    const cambiar = vi.fn()
    expect(() => conTransicionDeVista(cambiar)).not.toThrow()
    expect(cambiar).toHaveBeenCalledOnce()
  })
})
