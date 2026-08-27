import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EjercicioCompletado, type ExCompletado } from './EjercicioCompletado'

/**
 * El corte entre ejercicios no tenía tests, y lo que protege es serio: sin él el
 * asesorado seguía registrando series del ejercicio equivocado, porque al
 * terminar uno no hay descanso pautado que marque la frontera.
 *
 * Estos tests fijan las dos cosas que se pueden romper retocando estilos sin
 * darse cuenta: **que el corte siga siendo un corte** —a pantalla completa, con
 * su velo y su llamada a la acción— y **el tiempo que tarda en aparecer**.
 */

const EX: ExCompletado = {
  nombre: 'Sentadilla con barra',
  series: 4,
  siguienteId: 'e2',
  siguienteNombre: 'Peso muerto rumano',
}

describe('el corte entre ejercicios', () => {
  it('dice qué se terminó y qué viene, que es su trabajo', () => {
    render(<EjercicioCompletado ex={EX} onSeguir={vi.fn()} />)
    expect(screen.getByText(/Sentadilla con barra/)).toBeInTheDocument()
    expect(screen.getByText(/4 series registradas/)).toBeInTheDocument()
    expect(screen.getByText('Peso muerto rumano')).toBeInTheDocument()
  })

  it('sigue siendo un diálogo a pantalla completa', () => {
    // Es a pantalla completa a propósito. Si alguien lo convierte en un aviso
    // pequeño, vuelve el fallo que este componente existe para evitar.
    render(<EjercicioCompletado ex={EX} onSeguir={vi.fn()} />)
    const dialogo = screen.getByRole('dialog', { name: 'Ejercicio completado' })
    expect(dialogo.className).toContain('fixed')
    expect(dialogo.className).toContain('inset-0')
  })

  it('el velo FUNDE, no aparece de golpe', () => {
    // La capa oscura llegaba antes que su contenido: el velo se pintaba de
    // inmediato mientras el panel tardaba casi medio segundo en entrar. Su
    // hermano de esta misma pantalla, el test post, ya fundía el suyo.
    render(<EjercicioCompletado ex={EX} onSeguir={vi.fn()} />)
    expect(screen.getByRole('dialog').className).toContain('scrim-entra')
  })

  it('el panel entra en 360 ms y no en 480: la profundidad se paga quitando', () => {
    // `corte-entra` dura `--dur-panel` (360). La clase genérica `entrada` que
    // había antes dura 480, por encima de lo que un corte debería ocupar: esto
    // interrumpe, no premia — llega, se entiende y se aparta.
    render(<EjercicioCompletado ex={EX} onSeguir={vi.fn()} />)
    const panel = screen.getByRole('dialog').firstElementChild as HTMLElement
    expect(panel.className).toContain('corte-entra')
    expect(panel.className).not.toContain('entrada')
  })

  it('el botón lleva a lo siguiente', async () => {
    const seguir = vi.fn()
    const usuario = userEvent.setup()
    render(<EjercicioCompletado ex={EX} onSeguir={seguir} />)
    await usuario.click(screen.getByRole('button', { name: 'Siguiente ejercicio' }))
    expect(seguir).toHaveBeenCalledOnce()
  })

  it('y cuando no hay siguiente, lo dice de otra forma', () => {
    render(<EjercicioCompletado ex={{ ...EX, siguienteId: undefined, siguienteNombre: undefined }} onSeguir={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument()
    expect(screen.queryByText(/A continuación/)).toBeNull()
  })
})
