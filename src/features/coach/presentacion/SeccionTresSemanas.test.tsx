import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { PlanEstrategico } from '../../../data/consola/planesEstrategicos'
import type { BloqueCardio, EjercicioPrescrito, Microciclo, Sesion } from '../../../domain/types'
import type { EstadoDato } from '../consola/datoConsola'
import { SeccionTresSemanas } from './SeccionTresSemanas'

let n = 0

function ejercicio(nombre: string, hechas: number, parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  n += 1
  return {
    id: `e-${n}`,
    categoria: 'X',
    nombre,
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets: 3,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    cargaKg: 60,
    series: Array.from({ length: hechas }, (_, i) => ({ orden: i + 1, cargaKg: 60, reps: 10 - i })),
    ...parcial,
  }
}

function sesion(nombre: string, ejercicios: EjercicioPrescrito[], extra: Partial<Sesion> = {}): Sesion {
  n += 1
  return { id: `s-${n}`, nombre, orden: n, ejercicios, ...extra }
}

function micro(numero: number, fechaInicio: string, estado: Microciclo['estado'], sesiones: Sesion[]): Microciclo {
  return { id: `m-${numero}`, usuarioId: 'u', numero, cadenciaDias: 7, estado, fechaInicio, sesiones }
}

const TROTE: BloqueCardio = { id: 'b1', titulo: 'Trote suave', indicaciones: '', duracionMin: 20, hechoEn: '2026-10-07T10:00:00Z' }
const BICI: BloqueCardio = { id: 'b2', titulo: 'Bici estática', indicaciones: '', duracionMin: 15 }

function historial(estadoSiguiente: Microciclo['estado'] = 'activo'): Microciclo[] {
  return [
    micro(1, '2026-09-28', 'cerrado', [sesion('SESION DE LA PASADA', [ejercicio('Peso muerto', 3)])]),
    micro(2, '2026-10-05', 'cerrado', [
      sesion('FULL A', [ejercicio('Prensa', 3), ejercicio('Remo', 0, { cargaKg: 25, unidadCarga: 'por mano' })], { dia: 'LUNES' }),
      sesion('CARDIO', [], { bloquesCardio: [TROTE, BICI] }),
    ]),
    micro(3, '2026-10-12', estadoSiguiente, [sesion('SESION DE LA QUE VIENE', [ejercicio('Press banca', 0)])]),
  ]
}

function plan(contenido: unknown): PlanEstrategico {
  return { id: 'p', usuarioId: 'u', version: 1, vigente: true, contenido, hash: 'h', creadoEn: '2026-09-20T12:00:00Z' }
}

const PLAN_CON_FILA_2: EstadoDato<PlanEstrategico | null> = {
  estado: 'listo',
  valor: plan({
    cabecera: ['Micro', 'Foco'],
    filas: { '2': { columnas: { Micro: 'M2', Foco: 'subir **carga** en prensa' }, condiciones: {} } },
  }),
}

const HOY = '2026-10-09'

function pintar(h: Microciclo[] = historial(), p: EstadoDato<PlanEstrategico | null> = PLAN_CON_FILA_2) {
  return render(<SeccionTresSemanas historial={h} hoy={HOY} plan={p} />)
}

const boton = (nombre: string) => screen.getByRole('button', { name: nombre })

describe('SeccionTresSemanas', () => {
  it('abre en «Esta», con la cabecera, las fechas en claro y la etiqueta de la de ahora', () => {
    pintar()
    expect(boton('Esta')).toHaveAttribute('aria-pressed', 'true')
    expect(boton('La pasada')).toHaveAttribute('aria-pressed', 'false')
    expect(boton('La que viene')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: 'Semana 2' })).toBeInTheDocument()
    expect(screen.getByText('del lunes 5 al domingo 11 de octubre')).toBeInTheDocument()
    expect(screen.getByText('es la de ahora')).toBeInTheDocument()
  })

  it('los tres botones miden 44 px como mínimo', () => {
    pintar()
    for (const b of screen.getAllByRole('button')) expect(b).toHaveClass('min-h-[44px]')
  })

  it('las sesiones salen en orden como tarjetas plegables: la primera abierta y la segunda cerrada', () => {
    pintar()
    const primera = screen.getByText('FULL A').closest('details')
    const segunda = screen.getByText('CARDIO').closest('details')
    expect(primera).toHaveAttribute('open')
    expect(segunda).not.toHaveAttribute('open')
    expect(screen.getByText('lunes')).toBeInTheDocument()
    expect(primera!.compareDocumentPosition(segunda!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('un ejercicio con series anotadas dice qué se pidió y qué se hizo, y uno sin ellas dice «sin anotar»', () => {
    pintar()
    const prensa = screen.getByText('Prensa').parentElement!
    expect(within(prensa).getByText('Te pedimos')).toBeInTheDocument()
    expect(within(prensa).getByText('3 series de 8-10 repeticiones · 60 kg')).toBeInTheDocument()
    expect(within(prensa).getByText('3 series · 60 kg × 10 · 60 kg × 9 · 60 kg × 8')).toBeInTheDocument()

    const remo = screen.getByText('Remo').parentElement!
    expect(within(remo).getByText('3 series de 8-10 repeticiones · 25 kg (por mano)')).toBeInTheDocument()
    expect(within(remo).getByText('sin anotar')).toBeInTheDocument()
  })

  it('una sesión de cardio muestra sus bloques con título y minutos, y «hecho» solo en el que lo está', () => {
    pintar()
    const cardio = screen.getByText('CARDIO').closest('details')!
    const trote = within(cardio).getByText(/Trote suave/).parentElement!
    expect(trote).toHaveTextContent('Trote suave · 20 min')
    expect(within(trote).getByText('hecho')).toBeInTheDocument()
    const bici = within(cardio).getByText(/Bici estática/).parentElement!
    expect(bici).toHaveTextContent('Bici estática · 15 min')
    expect(within(bici).queryByText('hecho')).toBeNull()
    expect(within(cardio).queryByText('Hiciste')).toBeNull()
  })

  it('el pie dice sesiones con algo anotado y series anotadas contra pedidas', () => {
    pintar()
    // FULL A: 3 hechas de 3 + 0 de 3; CARDIO: un bloque hecho.
    expect(screen.getByText('Con algo anotado: 2 de 2 sesiones · 3 de 6 series pedidas')).toBeInTheDocument()
  })

  it('lo que el plan dice de la semana sale con la misma lectura del mapa, sin marcas de Markdown', () => {
    pintar()
    expect(screen.getByText('Lo que dice el plan')).toBeInTheDocument()
    expect(screen.getByText('subir carga en prensa')).toBeInTheDocument()
  })

  it('si el plan no tiene fila para esa semana, no pinta nada del plan', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(boton('La que viene'))
    expect(screen.queryByText('Lo que dice el plan')).toBeNull()
  })

  it('con el plan sin cargar o fallido la semana se ve igual, sin plan', () => {
    const { unmount } = pintar(historial(), { estado: 'cargando' })
    expect(screen.getByRole('heading', { name: 'Semana 2' })).toBeInTheDocument()
    expect(screen.queryByText('Lo que dice el plan')).toBeNull()
    unmount()
    pintar(historial(), { estado: 'fallo' })
    expect(screen.getByRole('heading', { name: 'Semana 2' })).toBeInTheDocument()
  })

  it('«La pasada» pinta su semana, sus sesiones y que ya pasó', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(boton('La pasada'))
    expect(boton('La pasada')).toHaveAttribute('aria-pressed', 'true')
    expect(boton('Esta')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: 'Semana 1' })).toBeInTheDocument()
    expect(screen.getByText('del lunes 28 de septiembre al domingo 4 de octubre')).toBeInTheDocument()
    expect(screen.getByText('ya pasó')).toBeInTheDocument()
    expect(screen.getByText('SESION DE LA PASADA')).toBeInTheDocument()
    expect(screen.getByText('Hiciste')).toBeInTheDocument()
    expect(screen.queryByText('FULL A')).toBeNull()
  })

  it('«La que viene» pinta sus sesiones y NO la columna «Hiciste» (aún no ocurre)', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(boton('La que viene'))
    expect(screen.getByRole('heading', { name: 'Semana 3' })).toBeInTheDocument()
    expect(screen.getByText('del lunes 12 al domingo 18 de octubre')).toBeInTheDocument()
    expect(screen.getByText('todavía no empieza')).toBeInTheDocument()
    expect(screen.getByText('SESION DE LA QUE VIENE')).toBeInTheDocument()
    expect(screen.getByText('Te pedimos')).toBeInTheDocument()
    expect(screen.queryByText('Hiciste')).toBeNull()
    expect(screen.queryByText('sin anotar')).toBeNull()
    expect(screen.getByText('1 sesión · 3 series pedidas')).toBeInTheDocument()
  })

  it('una semana que viene propuesta lo dice en la etiqueta', async () => {
    const user = userEvent.setup()
    pintar(historial('propuesto'))
    await user.click(boton('La que viene'))
    expect(screen.getByText('todavía no empieza · propuesta, sin aprobar')).toBeInTheDocument()
  })

  it('se puede volver de una semana a otra', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(boton('La pasada'))
    await user.click(boton('Esta'))
    expect(screen.getByRole('heading', { name: 'Semana 2' })).toBeInTheDocument()
    expect(screen.getByText('FULL A')).toBeInTheDocument()
  })

  it('sin semana siguiente cargada, el botón sigue y la sección lo dice sin inventar datos', async () => {
    const user = userEvent.setup()
    pintar(historial().slice(0, 2))
    await user.click(boton('La que viene'))
    expect(boton('La que viene')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Todavía no hay una semana siguiente cargada.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Semana/ })).toBeNull()
  })

  it('sin semana anterior cargada, ídem', async () => {
    const user = userEvent.setup()
    pintar(historial().slice(1))
    await user.click(boton('La pasada'))
    expect(screen.getByText('No hay una semana anterior cargada.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Semana/ })).toBeNull()
  })

  it('una semana sin sesiones cargadas lo dice', () => {
    pintar([micro(2, '2026-10-05', 'activo', [])])
    expect(screen.getByText('Esta semana no trae sesiones cargadas.')).toBeInTheDocument()
  })

  it('una sesión sin ejercicios ni cardio lo dice', () => {
    pintar([micro(2, '2026-10-05', 'activo', [sesion('VACIA', [])])])
    expect(screen.getByText('Esta sesión no trae ejercicios cargados.')).toBeInTheDocument()
  })
})
