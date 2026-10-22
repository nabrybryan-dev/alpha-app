import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { armarPropuestaDeCarga, armarVoyAEscribirte } from '../../../domain/praxis/propuestaCoach'
import type { PropuestaGuardada } from '../../../data/praxis/propuestasCoach'
import { PropuestasPraxis } from './PropuestasPraxis'

/**
 * La bandeja del coach para el canal «proponer al coach» (diseño del 21-oct-2026, decisiones de Bryan):
 *   - el coach ve las dos secciones; la nutricionista SOLO «Pendientes de escribir»;
 *   - la regla del RIR sigue «sin firmar» y se dice; el recálculo marca «no coincide»;
 *   - pasadas 12 h la fila sale «vencida»; aplicar solo se ofrece sobre lo decidido y sin aplicar;
 *   - ningún campo de texto libre: el rechazo es por botones.
 */
const AHORA = new Date('2026-10-21T20:00:00.000Z')
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000).toISOString()

const meta = (id: string, creadoEn: string, extra: Partial<PropuestaGuardada> = {}) => ({
  id, usuarioId: 'u-1', creadoEn, venceEn: creadoEn, estado: 'pendiente' as const, decididoPor: null, decididoEn: null,
  cargaDecididaKg: null, motivoRechazo: null, aplicadaEn: null, ...extra,
})

function carga(id = 'c-1', extra: Record<string, unknown> = {}): PropuestaGuardada {
  const r = armarPropuestaDeCarga({ series: [{ orden: 1, cargaKg: 100, reps: 8, rir: 1 }], cansancio: 'algo', motivo: 'cansancio', ejercicioId: 'press-banca', microcicloId: 'mc-1' })
  if (r.tipo !== 'fila') throw new Error('fila')
  return { ...r.fila, ...meta(id, hace(1)), ...extra } as PropuestaGuardada
}
function contacto(id = 'v-1', horas = 1, extra: Record<string, unknown> = {}): PropuestaGuardada {
  const r = armarVoyAEscribirte({ origenContacto: 'ficha', fichaId: 'vida-sin-ganas', tema: 'animo' })
  if (!r.ok) throw new Error('fila')
  return { ...r.fila, ...meta(id, hace(horas)), ...extra } as PropuestaGuardada
}

function pintar(rol: 'coach' | 'nutricionista', propuestas: PropuestaGuardada[], extra: Partial<React.ComponentProps<typeof PropuestasPraxis>> = {}) {
  const props = {
    rol, propuestas, ahora: AHORA, nombreDe: () => 'Persona de prueba',
    onDecidir: vi.fn().mockResolvedValue({ ok: true }), onAplicar: vi.fn().mockResolvedValue({ ok: true }), ...extra,
  }
  render(<PropuestasPraxis {...props} />)
  return props
}

describe('quién ve qué', () => {
  it('el coach ve «Cargas» y «Pendientes de escribir»', () => {
    pintar('coach', [carga(), contacto()])
    expect(screen.getByRole('region', { name: 'Cargas propuestas' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Pendientes de escribir' })).toBeTruthy()
  })

  it('la nutricionista no ve la sección de cargas ni aunque le lleguen filas de carga', () => {
    pintar('nutricionista', [carga(), contacto()])
    expect(screen.queryByRole('region', { name: 'Cargas propuestas' })).toBeNull()
    expect(screen.queryByText(/press-banca/i)).toBeNull()
    expect(screen.getByRole('region', { name: 'Pendientes de escribir' })).toBeTruthy()
  })

  it('sin nada pendiente dice una línea', () => {
    pintar('coach', [])
    expect(screen.getByText('Sin propuestas de Praxis')).toBeTruthy()
  })
})

describe('cargas', () => {
  it('muestra última serie, propuesta y la etiqueta «regla sin firmar»', () => {
    pintar('coach', [carga()])
    const seccion = screen.getByRole('region', { name: 'Cargas propuestas' })
    expect(within(seccion).getByText(/100 kg × 8 @RIR 1/)).toBeTruthy()
    expect(within(seccion).getByText(/95 kg/)).toBeTruthy()
    expect(within(seccion).getByText(/regla sin firmar/i)).toBeTruthy()
  })

  it('«no coincide con el cálculo» aparece si el número guardado difiere del recálculo', () => {
    pintar('coach', [carga('c-1', { cargaPropuestaKg: 80 })])
    expect(screen.getByText(/no coincide con el cálculo/i)).toBeTruthy()
  })

  it('si coincide, no aparece el aviso', () => {
    pintar('coach', [carga()])
    expect(screen.queryByText(/no coincide con el cálculo/i)).toBeNull()
  })

  it('una carga sin número dice la razón y no ofrece «Aceptar»', () => {
    pintar('coach', [carga('c-1', { cargaPropuestaKg: null, razonSinCalculo: 'no_baja', unRmKg: null })])
    expect(screen.getByText(/sin cálculo/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /aceptar/i })).toBeNull()
  })

  it('Aceptar llama a onDecidir con la acción aceptar', async () => {
    const p = pintar('coach', [carga()])
    await userEvent.click(screen.getByRole('button', { name: /aceptar/i }))
    expect(p.onDecidir).toHaveBeenCalledWith('c-1', { accion: 'aceptar' })
  })

  it('Ajustar manda los kilos escritos', async () => {
    const p = pintar('coach', [carga()])
    await userEvent.type(screen.getByLabelText(/kilos a aplicar/i), '92.5')
    await userEvent.click(screen.getByRole('button', { name: /ajustar/i }))
    expect(p.onDecidir).toHaveBeenCalledWith('c-1', { accion: 'ajustar', cargaKg: 92.5 })
  })

  it('Rechazar se hace con botones de motivo cerrados', async () => {
    const p = pintar('coach', [carga()])
    await userEvent.click(screen.getByRole('button', { name: /^rechazar$/i }))
    await userEvent.click(screen.getByRole('button', { name: /lo hablo con la persona/i }))
    expect(p.onDecidir).toHaveBeenCalledWith('c-1', { accion: 'rechazar', motivo: 'lo_hablo_con_la_persona' })
  })

  it('no hay ningún campo de texto libre en toda la bandeja', async () => {
    pintar('coach', [carga(), contacto()])
    await userEvent.click(screen.getByRole('button', { name: /^rechazar$/i }))
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
    const entradas = Array.from(document.querySelectorAll("input"))
    for (const i of entradas) expect(i.type).toBe('number')
  })
})

describe('aplicar al plan', () => {
  it('una decidida sin aplicar ofrece «Aplicar al plan» y avisa que no está aplicada', async () => {
    const p = pintar('coach', [carga('c-1', { estado: 'aceptada', cargaDecididaKg: 95, decididoEn: hace(0.5) })])
    expect(screen.getByText(/decidida, sin aplicar/i)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /aplicar al plan/i }))
    expect(p.onAplicar).toHaveBeenCalledWith('c-1')
  })

  it('si aplicar falla, lo dice y no finge', async () => {
    pintar('coach', [carga('c-1', { estado: 'aceptada', cargaDecididaKg: 95, decididoEn: hace(0.5) })], { onAplicar: vi.fn().mockResolvedValue({ ok: false, motivo: 'no_confirmo_plan' }) })
    await userEvent.click(screen.getByRole('button', { name: /aplicar al plan/i }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(/^aplicada$/i)).toBeNull()
  })

  it('una ya aplicada no ofrece el botón y dice «Aplicada»', () => {
    pintar('coach', [carga('c-1', { estado: 'aceptada', cargaDecididaKg: 95, decididoEn: hace(2), aplicadaEn: hace(1) })])
    expect(screen.queryByRole('button', { name: /aplicar al plan/i })).toBeNull()
    expect(screen.getByText(/^aplicada$/i)).toBeTruthy()
  })
})

describe('si la acción rechaza la promesa', () => {
  it('muestra un mensaje y los botones vuelven a estar habilitados (carga)', async () => {
    pintar('coach', [carga()], { onDecidir: vi.fn().mockRejectedValue(new Error('red')) })
    await userEvent.click(screen.getByRole('button', { name: /aceptar/i }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect((screen.getByRole('button', { name: /aceptar/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('muestra un mensaje y el botón vuelve a estar habilitado (pendiente de escribir)', async () => {
    pintar('coach', [contacto()], { onDecidir: vi.fn().mockRejectedValue(new Error('red')) })
    await userEvent.click(screen.getByRole('button', { name: /ya le escribí/i }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect((screen.getByRole('button', { name: /ya le escribí/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('lo mismo al aplicar al plan', async () => {
    pintar('coach', [carga('c-1', { estado: 'aceptada', cargaDecididaKg: 95, decididoEn: hace(0.5) })], { onAplicar: vi.fn().mockRejectedValue(new Error('red')) })
    await userEvent.click(screen.getByRole('button', { name: /aplicar al plan/i }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect((screen.getByRole('button', { name: /aplicar al plan/i }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('pendientes de escribir', () => {
  it('muestra el tema por su nombre y «Ya le escribí» atiende', async () => {
    const p = pintar('nutricionista', [contacto()])
    expect(screen.getByText('Ánimo')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /ya le escribí/i }))
    expect(p.onDecidir).toHaveBeenCalledWith('v-1', { accion: 'atender' })
  })

  it('a las 12 h exactas la fila sale vencida (>=)', () => {
    pintar('coach', [contacto('v-1', 12)])
    expect(screen.getByText(/vencida/i)).toBeTruthy()
  })

  it('a las 11 h no está vencida', () => {
    pintar('coach', [contacto('v-1', 11)])
    expect(screen.queryByText(/vencida/i)).toBeNull()
  })

  it('una vencida lleva el rojo suave', () => {
    pintar('coach', [contacto('v-1', 13)])
    expect(screen.getByTestId('fila-v-1').getAttribute('data-vencida')).toBe('true')
  })

  it('no pinta ninguna frase: solo tema, origen y hora', () => {
    pintar('coach', [contacto()])
    expect(screen.queryByText(/sin ganas de nada/i)).toBeNull()
  })
})
