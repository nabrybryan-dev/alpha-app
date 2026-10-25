import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Microciclo, PartePreparacion } from '../../domain/types'
import SemanaPage from './SemanaPage'

/**
 * LA BANDEJA DE LA SEMANA (paso 6 del rediseño).
 *
 * Lo que se conserva de Bienestar y del Hoy viejo tiene que llegar aquí, no desaparecer:
 * la revisión con voz, las notas del coach, los cuestionarios y el chat del equipo. Y las
 * notas, que en Hoy solo veía el staff, las tiene que ver el asesorado.
 */
function pintar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter>
          <SemanaPage />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

function activo(): Microciclo {
  const m = db.microciclos.byUsuario('u-valentina').find((x) => x.estado === 'activo')
  if (!m) throw new Error('el seed no trae microciclo activo')
  return m
}

function conNota(): void {
  const base = activo()
  const nota: PartePreparacion = {
    id: 'nota-semana-test',
    titulo: 'LEE ESTO: la descarga de esta semana',
    indicaciones: 'Baja un 10 % el peso y deja 3 repeticiones en reserva.',
    tipo: 'movilidad',
  }
  const propuesta: Microciclo = {
    ...base,
    id: 'm-semana-test',
    numero: base.numero + 1,
    estado: 'propuesto',
    sesiones: base.sesiones.map((s, i) =>
      i === 0 ? { ...s, preparacion: [...(s.preparacion ?? []), nota] } : s,
    ),
  }
  db.microciclos.guardarPropuesta(propuesta)
  db.microciclos.activarPropuesta(propuesta.id)
}

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

describe('Semana · la bandeja', () => {
  it('se abre con su título, su rango de fechas y la cuenta de lo hecho', async () => {
    pintar()
    expect(await screen.findByRole('heading', { level: 2, name: 'Semana' })).toBeInTheDocument()
    expect(screen.getByText(/Del \d+ al \d+ de /)).toBeInTheDocument()
    expect(screen.getByText(/hechas esta semana|Sin nada pautado esta semana/)).toBeInTheDocument()
  })

  it('conserva la revisión de la semana con sus tres números', async () => {
    pintar()
    const revision = await screen.findByRole('region', { name: 'Tu revisión de la semana' })
    expect(revision).toBeInTheDocument()
    const numeros = screen.getByLabelText('Tu semana en números')
    expect(within(numeros).getByText('Sesiones')).toBeInTheDocument()
    expect(within(numeros).getByText('Check-ins')).toBeInTheDocument()
  })

  it('las notas del coach las ve el asesorado, no solo el staff', async () => {
    conNota()
    pintar()
    expect(await screen.findByText('LEE ESTO: la descarga de esta semana')).toBeInTheDocument()
    expect(screen.getByText('Baja un 10 % el peso y deja 3 repeticiones en reserva.')).toBeInTheDocument()
  })

  it('pone delante los cuestionarios sin responder y no los ya enviados', async () => {
    pintar()
    const pendientes = await screen.findByRole('region', { name: 'Lo que te toca responder' })
    expect(within(pendientes).getByText('Chequeo de dolor articular')).toBeInTheDocument()
    expect(within(pendientes).queryByText('Adherencia y disfrute del bloque')).toBeNull()
    expect(within(pendientes).getByRole('button', { name: 'Responder' })).toBeInTheDocument()
    expect(within(pendientes).getByRole('link', { name: 'Ver todos mis cuestionarios' })).toHaveAttribute(
      'href',
      '/cuestionarios',
    )
  })

  it('deja a mano el chat del equipo con su último mensaje', async () => {
    pintar()
    const chat = await screen.findByRole('region', { name: 'Chat con tu equipo' })
    expect(within(chat).getByRole('link', { name: 'Abrir el chat' })).toHaveAttribute('href', '/chat')
  })

  it('no monta la pestaña Bienestar: su contenido vive aquí y en Progreso', async () => {
    pintar()
    await screen.findByRole('heading', { level: 2, name: 'Semana' })
    expect(screen.queryByRole('heading', { name: 'Check-in diario' })).not.toBeInTheDocument()
  })
})
