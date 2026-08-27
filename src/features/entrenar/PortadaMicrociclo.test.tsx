import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Microciclo } from '../../domain/types'
import { PortadaMicrociclo } from './PortadaMicrociclo'

/**
 * La portada no tenía tests, y el 2026-08-27 se le tocó lo más delicado que
 * tiene: **el cierre pasó a ser asíncrono**.
 *
 * Antes marcaba el microciclo como visto en el mismo instante del clic. Ahora la
 * portada se va con una animación y el marcado espera a que termine, para que no
 * desaparezca de golpe a mitad de salida.
 *
 * Eso abre un modo de fallo nuevo y silencioso: si la promesa de la animación no
 * resuelve —porque el navegador no la implementa, porque el nodo se desmonta a
 * media salida, porque `animate` lanza—, **el microciclo no queda marcado y la
 * portada vuelve a salir mañana**. Que se vea UNA vez es la razón de ser de esta
 * pieza; volver a salir la convierte en un estorbo semanal.
 *
 * De ahí que estos tests cubran el camino bueno y los dos de escape.
 */

const CLAVE = 'alpha-portada-vista'

function microciclo(id = 'm-1'): Microciclo {
  return {
    id,
    usuarioId: 'u-test',
    numero: 4,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-08-24',
    sesiones: [
      {
        id: 's1',
        nombre: 'LEG A',
        orden: 1,
        ejercicios: [
          {
            id: 'e1',
            categoria: 'SENTADILLA',
            nombre: 'Sentadilla con barra',
            cues: '',
            prescripcion: '',
            descansoMin: 3,
            sets: 3,
            rango: '(8-12)',
            repsDiana: 10,
            rirObjetivo: 2,
            series: [],
          },
        ],
      },
    ],
  }
}

describe('la portada del microciclo', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('se ve cuando el microciclo todavía no se ha abierto', () => {
    render(<PortadaMicrociclo microciclo={microciclo()} />)
    expect(screen.getByText('Empieza tu microciclo')).toBeInTheDocument()
    // El numero va partido por un <br/>, asi que se busca por el nodo entero.
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('M4')
  })

  it('NO se ve si ya quedó marcada: es su razón de ser', () => {
    localStorage.setItem(CLAVE, JSON.stringify(['m-1']))
    const { container } = render(<PortadaMicrociclo microciclo={microciclo()} />)
    expect(container.firstChild).toBeNull()
  })

  it('al cerrarla queda marcada, aunque el marcado espere a la animación', async () => {
    // Este test es el que destapó el problema. Con `.finished.then(marcar)` a
    // secas se quedaba colgado hasta agotar el tiempo: en jsdom la promesa de la
    // animación NO resuelve nunca, porque no hay línea de tiempo que la avance.
    //
    // Eso no es una rareza del entorno de pruebas — es exactamente lo que puede
    // pasar en una pestaña en segundo plano o en un navegador que no la
    // implementa. Por eso el marcado corre una carrera contra un reloj y no
    // cuelga de la animación. Pasa gracias a esa red.
    const usuario = userEvent.setup()
    render(<PortadaMicrociclo microciclo={microciclo()} />)

    await usuario.click(screen.getByRole('button', { name: /Empezar la semana/i }))

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CLAVE) ?? '[]')).toContain('m-1')
    })
  })

  it('y queda marcada IGUAL si el navegador no sabe animar', async () => {
    // El escape que de verdad importa. Sin esta salida, un navegador sin WAAPI
    // dejaría la portada saliendo cada semana para siempre — y el fallo sería
    // mudo: nada se rompe, solo reaparece algo que debía verse una vez.
    const original = Element.prototype.animate
    // @ts-expect-error se retira a propósito para simular el navegador que no la trae
    delete Element.prototype.animate
    try {
      const usuario = userEvent.setup()
      render(<PortadaMicrociclo microciclo={microciclo('m-2')} />)
      await usuario.click(screen.getByRole('button', { name: /Empezar la semana/i }))
      await waitFor(() => {
        expect(JSON.parse(localStorage.getItem(CLAVE) ?? '[]')).toContain('m-2')
      })
    } finally {
      Element.prototype.animate = original
    }
  })

  it('la llegada se declara en la clase, no en el componente', () => {
    // La entrada vive en `tokens.css` como `.portada-entra`, con su porqué al
    // lado. Si alguien la mueve a un estilo en línea, se pierde el bloque de
    // `prefers-reduced-motion` que la anula.
    const { container } = render(<PortadaMicrociclo microciclo={microciclo()} />)
    expect(container.querySelector('.portada-entra')).toBeTruthy()
  })
})
