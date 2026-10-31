import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultadoGuion } from '../../data/consola/guionesLlamada'
import EJEMPLO from '../../domain/consolaCoach/guion-llamada-v1.fixture.json'
import { leerGuion } from '../../domain/consolaCoach/guionDeVenta'

const carga = { resultado: { ok: true, lectura: null } as ResultadoGuion, llamadas: [] as string[] }

vi.mock('../../data/consola/guionesLlamada', () => ({
  guionDe: (usuarioId: string) => {
    carga.llamadas.push(usuarioId)
    return Promise.resolve(carga.resultado)
  },
}))

const { GuionDeVenta } = await import('./GuionDeVenta')

// El fixture copia la forma de guion-llamada-v1 con datos inventados.
function guardado(guion: Record<string, unknown>, extra: Record<string, unknown> = {}): ResultadoGuion {
  const l = leerGuion(guion)
  if (!l.ok) throw new Error('fixture ilegible')
  return {
    ok: true,
    lectura: {
      tipo: 'guion',
      guardado: {
        id: 'g1',
        personId: 'p1',
        usuarioId: 'u1',
        creadoEn: '2026-10-30T15:00:00Z',
        diaPreferido: '2026-11-05',
        franjaPreferida: 'en la tarde',
        horaPreferida: '15:00',
        guion: l.guion,
        ...extra,
      },
    },
  }
}

beforeEach(() => {
  carga.resultado = { ok: true, lectura: null }
  carga.llamadas = []
})

describe('GuionDeVenta', () => {
  it('sin guion no pinta nada', async () => {
    const { container } = render(<GuionDeVenta usuarioId="u1" />)
    await waitFor(() => expect(carga.llamadas).toEqual(['u1']))
    expect(container).toBeEmptyDOMElement()
  })

  it('un guion sin ninguna sección tampoco se pinta', async () => {
    carga.resultado = guardado({ version: 'guion-llamada-v1', persona: { nombre: 'Persona Ficticia' } })
    const { container } = render(<GuionDeVenta usuarioId="u1" />)
    await waitFor(() => expect(carga.llamadas).toHaveLength(1))
    expect(container).toBeEmptyDOMElement()
  })

  it('pinta persona, contacto, preferencia (hora de Colombia) y todas las secciones', async () => {
    carga.resultado = guardado(EJEMPLO)
    render(<GuionDeVenta usuarioId="u1" />)
    const tarjeta = await screen.findByRole('region', { name: 'Guion de la llamada' })
    expect(tarjeta).toHaveTextContent('Persona Ficticia · 30-34 · Bajar grasa')
    expect(tarjeta).toHaveTextContent('+57 300 000 0000')
    expect(tarjeta).toHaveTextContent('persona.ficticia@ejemplo.test')
    expect(tarjeta).toHaveTextContent('jue 5 nov 2026 · en la tarde · 15:00')
    expect(tarjeta).toHaveTextContent('hora de Colombia')
    expect(tarjeta).toHaveTextContent('Llegó: Evaluando la inversión')
    for (const titulo of ['Apertura', 'Lo que le pesa', 'Qué mostrarle', 'Objeciones probables', 'Cierre', 'Avisos', 'Recomendaciones de PRAXIS']) {
      expect(screen.getByRole('region', { name: titulo })).toBeInTheDocument()
    }
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('«Qué mostrarle» lleva título, dato y cómo decirlo; las objeciones, objeción → respuesta', async () => {
    carga.resultado = guardado(EJEMPLO)
    render(<GuionDeVenta usuarioId="u1" />)
    const mostrar = await screen.findByRole('region', { name: 'Qué mostrarle' })
    expect(mostrar).toHaveTextContent('Su gasto diario')
    expect(mostrar).toHaveTextContent('1.700 kcal al día (estimado)')
    expect(mostrar).toHaveTextContent('Mira tu gasto diario')
    const objeciones = screen.getByRole('region', { name: 'Objeciones probables' })
    expect(objeciones).toHaveTextContent('«No tengo tiempo»')
    expect(objeciones).toHaveTextContent('Por eso el plan parte de los días que sí tienes')
    expect(screen.getByRole('region', { name: 'Lo que le pesa' })).toHaveTextContent('(con sus palabras)')
  })

  it('la alerta solo dice «requiere aval médico» y «menor de edad», sin inventar detalle', async () => {
    carga.resultado = guardado({ ...EJEMPLO, alerta_salud: { hay: true, requiere_aval: true, menor_de_edad: true } })
    render(<GuionDeVenta usuarioId="u1" />)
    const nota = await screen.findByRole('note')
    expect(nota).toHaveTextContent('Alerta de salud')
    expect(nota).toHaveTextContent('Requiere aval médico · Menor de edad')
    expect(nota.textContent).toBe('Alerta de saludRequiere aval médico · Menor de edad')
  })

  it('se pliega y despliega; preferencia y alerta quedan a la vista', async () => {
    carga.resultado = guardado({ ...EJEMPLO, alerta_salud: { hay: true, requiere_aval: true, menor_de_edad: false } })
    render(<GuionDeVenta usuarioId="u1" />)
    const boton = await screen.findByRole('button', { name: 'Plegar el guion' })
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(boton)
    expect(screen.getByRole('button', { name: 'Ver el guion' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Apertura' })).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Requiere aval médico')
    expect(screen.getByText('jue 5 nov 2026 · en la tarde · 15:00')).toBeInTheDocument()
  })

  it('sin preferencia en columnas usa cómo se le confirmó; sin nada, lo dice', async () => {
    carga.resultado = guardado(EJEMPLO, { diaPreferido: null, franjaPreferida: null, horaPreferida: null })
    const { unmount } = render(<GuionDeVenta usuarioId="u1" />)
    expect(await screen.findByText('el jueves 5 de noviembre a las 3:00 p. m.')).toBeInTheDocument()
    unmount()
    carga.resultado = guardado({ ...EJEMPLO, reserva: undefined }, { diaPreferido: null, franjaPreferida: null, horaPreferida: null })
    render(<GuionDeVenta usuarioId="u2" />)
    expect(await screen.findByText('no dijo cuándo')).toBeInTheDocument()
  })

  it('un guion de versión desconocida se avisa, no se adivina', async () => {
    carga.resultado = { ok: true, lectura: { tipo: 'ilegible', ilegible: { version: 'guion-llamada-v2' } } }
    render(<GuionDeVenta usuarioId="u1" />)
    expect(await screen.findByRole('status')).toHaveTextContent('guion-llamada-v2')
    expect(screen.queryByRole('region', { name: 'Guion de la llamada' })).not.toBeInTheDocument()
  })

  it('un fallo de carga se dice y se puede reintentar', async () => {
    carga.resultado = { ok: false, error: 'No se pudo cargar el guion de la llamada.' }
    render(<GuionDeVenta usuarioId="u1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el guion')
    carga.resultado = guardado(EJEMPLO)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('region', { name: 'Guion de la llamada' })).toBeInTheDocument()
    expect(carga.llamadas).toHaveLength(2)
  })
})
