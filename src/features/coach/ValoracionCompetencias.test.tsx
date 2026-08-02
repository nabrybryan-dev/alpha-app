import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/dbInstance'
import { valoracionesACompetencias } from '../../domain/rutaEntrenamiento'
import { ValoracionCompetencias } from './ValoracionCompetencias'

const ASESORADO = 'u-valentina'

function perfil() {
  return db.perfiles.byUsuario(ASESORADO)
}

describe('ValoracionCompetencias', () => {
  beforeEach(() => localStorage.clear())

  it('no guarda sin la nota: el número solo pinta una barra', async () => {
    const usuario = userEvent.setup()
    render(<ValoracionCompetencias usuarioId={ASESORADO} valoraciones={undefined} />)

    const boton = screen.getByRole('button', { name: 'Guardar' })
    expect(boton).toBeDisabled()

    await usuario.type(screen.getByRole('textbox'), 'Sentadilla ya sale sin pensar el patrón.')
    expect(boton).toBeEnabled()
  })

  it('guarda la valoración en el perfil del asesorado', async () => {
    const usuario = userEvent.setup()
    render(<ValoracionCompetencias usuarioId={ASESORADO} valoraciones={undefined} />)

    await usuario.type(screen.getByRole('textbox'), 'Bisagra en fase autónoma, empuje aún asociativa.')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    const valoraciones = perfil()?.valoraciones ?? []
    expect(valoraciones).toHaveLength(1)
    expect(valoraciones[0].id).toBe('tecnica')
    expect(valoraciones[0].nota).toMatch(/fase autónoma/)
    expect(valoraciones[0].fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('reemplaza la nota anterior en vez de acumular', async () => {
    const usuario = userEvent.setup()
    db.perfiles.guardarValoracion(ASESORADO, {
      id: 'tecnica',
      pct: 40,
      nota: 'Vieja',
      fecha: '2026-01-01',
    })

    render(
      <ValoracionCompetencias usuarioId={ASESORADO} valoraciones={perfil()?.valoraciones} />,
    )
    const campo = screen.getByRole('textbox')
    await usuario.clear(campo)
    await usuario.type(campo, 'Nueva valoración tras revisar el video de esta semana.')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    const valoraciones = perfil()?.valoraciones ?? []
    expect(valoraciones).toHaveLength(1)
    expect(valoraciones[0].nota).toMatch(/Nueva valoración/)
  })

  it('lo que guarda el coach es lo que la Ruta le enseña al asesorado', async () => {
    const usuario = userEvent.setup()
    render(<ValoracionCompetencias usuarioId={ASESORADO} valoraciones={undefined} />)
    await usuario.type(screen.getByRole('textbox'), 'Controla el excéntrico en los cuatro patrones.')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    const competencias = valoracionesACompetencias(perfil()?.valoraciones)
    expect(competencias).toHaveLength(1)
    expect(competencias[0].nombre).toBe('Técnica y patrones')
    expect(competencias[0].nota).toMatch(/excéntrico/)
  })
})
