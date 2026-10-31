import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespuestaDelRegistrador } from '../../../../domain/praxis/conversacion'

const sesion = vi.hoisted(() => ({ rol: 'asesorado' as string | undefined, puesto: false, cargando: false }))
vi.mock('../../../../app/SessionProvider', () => ({
  useSesionOpcional: () => (sesion.rol ? { usuario: { id: 'u', rol: sesion.rol } } : null),
}))
vi.mock('../../../coach/consola/usePuestoCoach', () => ({
  usePuestoCoach: () => ({ esCoach: sesion.puesto, cargando: sesion.cargando, tiene: () => sesion.puesto }),
}))

const { DudasDePraxis, PuertaDeDudas } = await import('./DudasDePraxis')

const conFicha = {
  ok: true,
  mensajeId: 'm',
  fichas: ['a'],
  propuesta: { accion: 'nada', motivo: 'consulta', registros: [], descartado: [], notas_coach: [], citas_invalidas: [] },
  tarjeta: { tipo: 'informativa', mensaje: 'Una vez no obliga a bajar peso.', lineas: [], avisos: [], descartado: [], botones: [], requiereConfirmarSesion: false, guardable: false, titulo: '' },
} as unknown as RespuestaDelRegistrador

function escribir(frase: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: frase } })
  fireEvent.click(screen.getByRole('button', { name: 'Preguntar' }))
}

beforeEach(() => {
  localStorage.clear()
  Object.assign(sesion, { rol: 'asesorado', puesto: false, cargando: false })
})

describe('la puerta de las dudas', () => {
  it('un asesorado no ve el campo', () => {
    render(<PuertaDeDudas />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('mientras no se sabe el puesto, no se abre', () => {
    Object.assign(sesion, { puesto: true, cargando: true })
    render(<PuertaDeDudas />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('sin sesión no se abre', () => {
    sesion.rol = undefined
    render(<PuertaDeDudas />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it.each([
    ['coach', false],
    ['nutricionista', false],
    ['asesorado', true],
  ])('%s con puesto=%s sí lo ve', (rol, puesto) => {
    Object.assign(sesion, { rol, puesto })
    render(<PuertaDeDudas />)
    expect(screen.getByRole('textbox')).toBeTruthy()
  })
})

describe('una duda escrita', () => {
  it('muestra la respuesta de la ficha', async () => {
    const preguntar = vi.fn(async () => conFicha)
    render(<DudasDePraxis preguntar={preguntar} />)
    escribir('¿tengo que bajar peso si no llegué al rango?')
    expect(await screen.findByText('Una vez no obliga a bajar peso.')).toBeTruthy()
    expect(preguntar).toHaveBeenCalledWith('¿tengo que bajar peso si no llegué al rango?')
  })

  it('una señal de riesgo no sale del teléfono, enseña las líneas y cierra hasta mañana', () => {
    const preguntar = vi.fn(async () => conFicha)
    const { unmount } = render(<DudasDePraxis preguntar={preguntar} />)
    escribir('¿qué hago si me quiero morir?')
    expect(preguntar).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Llamar al 123' }).getAttribute('href')).toBe('tel:123')
    expect(screen.queryByRole('textbox')).toBeNull()
    unmount()
    render(<DudasDePraxis preguntar={preguntar} />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('lo clínico no sale del teléfono', () => {
    const preguntar = vi.fn(async () => conFicha)
    render(<DudasDePraxis preguntar={preguntar} />)
    escribir('me duele la rodilla en la sentadilla')
    expect(preguntar).not.toHaveBeenCalled()
    expect(screen.getByText(/Eso es de salud/)).toBeTruthy()
  })

  it('«prefiero no decir» cuenta como riesgo', () => {
    render(<DudasDePraxis preguntar={vi.fn(async () => conFicha)} />)
    escribir('ya no puedo más con todo')
    fireEvent.click(screen.getByRole('button', { name: 'Prefiero no decir' }))
    expect(screen.getByRole('link', { name: 'Llamar al 123' })).toBeTruthy()
  })

  it('si la llamada revienta lo dice y deja preguntar otra vez', async () => {
    render(<DudasDePraxis preguntar={vi.fn(async () => { throw new Error('caída') })} />)
    escribir('¿para qué sirve el RIR?')
    expect(await screen.findByText(/No pude preguntar/)).toBeTruthy()
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(false))
  })
})
