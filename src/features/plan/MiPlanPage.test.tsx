import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemPlan } from '../../domain/planOrganizador'
import { isoLocal, lunesDe, sumarDias } from '../../domain/planOrganizador'

/**
 * «Mi plan» y el banner. La sesión, las capacidades y la capa de datos se sustituyen en su punto
 * de entrada: aquí se prueba lo que la persona ve y lo que se manda, no la red.
 */
const estado = {
  rol: 'coach' as 'coach' | 'nutricionista' | 'asesorado',
  capacidad: true,
  lectura: { ok: true, datos: [] } as { ok: true; datos: ItemPlan[] } | { ok: false; error: string },
  empezar: vi.fn(),
  terminar: vi.fn(),
  mover: vi.fn(),
  crear: vi.fn(),
  lecturas: 0,
}

vi.mock('../../app/SessionProvider', () => ({
  useSesionOpcional: () => ({ usuario: { id: 'u-1', nombre: 'Prueba', rol: estado.rol, avatarIniciales: 'PP' } }),
}))
vi.mock('../coach/consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, tiene: (c: string) => c !== 'puesto_de_coach' && estado.capacidad, usuarioId: 'u-1' }),
}))
vi.mock('../../data/consola/planItems', async (original) => {
  const real = await original<typeof import('../../data/consola/planItems')>()
  return {
    ...real,
    planItems: () => {
      estado.lecturas += 1
      return Promise.resolve(estado.lectura)
    },
    empezarTarea: (...a: unknown[]) => estado.empezar(...a),
    terminarTarea: (...a: unknown[]) => estado.terminar(...a),
    moverTarea: (...a: unknown[]) => estado.mover(...a),
    crearTarea: (...a: unknown[]) => estado.crear(...a),
  }
})

const { default: MiPlanPage } = await import('./MiPlanPage')
const { BannerPlanHoy } = await import('./BannerPlanHoy')

const HOY = isoLocal(new Date())
const LUNES = lunesDe(HOY)
let n = 0
function item(o: Partial<ItemPlan>): ItemPlan {
  n += 1
  return {
    id: `i${n}`,
    nivel: 'tarea',
    padreId: 'h-b',
    titulo: `Item ${n}`,
    primerPaso: 'abrir el tablero',
    dueno: 'bryan',
    palanca: 'A',
    fecha: HOY,
    estimadoMin: 30,
    prioridad: 'pequena',
    estado: 'pendiente',
    iniciadaEn: null,
    hechaEn: null,
    vecesMovida: 0,
    origen: null,
    actualizadoEn: new Date().toISOString(),
    ...o,
  }
}
const objetivoB = item({ id: 'o-b', nivel: 'objetivo', padreId: null, titulo: 'Objetivo de Bryan', fecha: sumarDias(HOY, 60), estimadoMin: null, prioridad: null })
const hitoB = item({ id: 'h-b', nivel: 'hito', padreId: 'o-b', titulo: 'Hito de Bryan', fecha: LUNES, estimadoMin: null, prioridad: null })
const objetivoM = item({ id: 'o-m', nivel: 'objetivo', padreId: null, titulo: 'Objetivo de Manuela', dueno: 'manuela', fecha: sumarDias(HOY, 60), estimadoMin: null, prioridad: null })
const hitoM = item({ id: 'h-m', nivel: 'hito', padreId: 'o-m', titulo: 'Hito de Manuela', dueno: 'manuela', fecha: LUNES, estimadoMin: null, prioridad: null })

const principal = item({ id: 'p1', titulo: 'Filtrar etapa2', primerPaso: 'abrir el tablero y filtrar etapa2', prioridad: 'principal', estimadoMin: 40 })
const pequena1 = item({ id: 'p2', titulo: 'Responder a un creador', prioridad: 'pequena' })
const pequena2 = item({ id: 'p3', titulo: 'Revisar caja', prioridad: 'pequena' })

function montar(ruta = '/mi-plan') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/" element={<p>portada</p>} />
        <Route path="/mi-plan" element={<MiPlanPage />} />
        <Route path="/coach/mi-plan" element={<MiPlanPage />} />
        <Route path="/otra" element={<BannerPlanHoy />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  estado.rol = 'coach'
  estado.capacidad = true
  estado.lectura = { ok: true, datos: [objetivoB, hitoB, principal, pequena1, pequena2] }
  estado.empezar = vi.fn().mockResolvedValue({ ok: true, id: 'p1' })
  estado.terminar = vi.fn().mockResolvedValue({ ok: true, id: 'p1' })
  estado.mover = vi.fn().mockResolvedValue({ ok: true, id: 'p1' })
  estado.crear = vi.fn().mockResolvedValue({ ok: true, id: 'nuevo' })
  estado.lecturas = 0
  window.sessionStorage.clear()
})

describe('Hoy: 1 grande + 2 pequeñas', () => {
  it('muestra la principal con su primer paso y las dos pequeñas debajo', async () => {
    montar('/coach/mi-plan')
    const grande = await screen.findByRole('region', { name: 'Tarea principal de hoy' })
    expect(within(grande).getByText('Filtrar etapa2')).toBeTruthy()
    expect(within(grande).getByText(/abrir el tablero y filtrar etapa2/)).toBeTruthy()
    const lista = screen.getByRole('list', { name: 'Tareas pequeñas de hoy' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
  })

  it('Empezar manda la tarea y, ya en curso, aparece el temporizador y «Marcar hecha»', async () => {
    montar('/coach/mi-plan')
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar' }))
    await waitFor(() => expect(estado.empezar).toHaveBeenCalledWith('p1'))
    estado.lectura = { ok: true, datos: [objetivoB, hitoB, { ...principal, estado: 'en_curso', iniciadaEn: new Date().toISOString() }, pequena1] }
    await waitFor(() => expect(screen.getByRole('timer')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Marcar hecha' }))
    await waitFor(() => expect(estado.terminar).toHaveBeenCalledWith('p1'))
  })

  it('elige 25 o 50 min antes de empezar', async () => {
    montar('/coach/mi-plan')
    const b25 = await screen.findByRole('button', { name: '25 min' })
    const b50 = screen.getByRole('button', { name: '50 min' })
    expect(b50.getAttribute('aria-pressed')).toBe('true') // 40 min de tarea -> bloque de 50
    fireEvent.click(b25)
    expect(b25.getAttribute('aria-pressed')).toBe('true')
  })

  it('marca hecha una pequeña', async () => {
    montar('/coach/mi-plan')
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar hecha: Revisar caja' }))
    await waitFor(() => expect(estado.terminar).toHaveBeenCalledWith('p3'))
  })

  it('si la base rechaza el cambio, lo dice y no finge que se guardó', async () => {
    estado.empezar = vi.fn().mockResolvedValue({ ok: false, error: 'no se guardó: esa fila no es tuya' })
    montar('/coach/mi-plan')
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar' }))
    expect((await screen.findAllByRole('alert')).some((a) => /No se guardó/.test(a.textContent ?? ''))).toBe(true)
  })

  it('sin tareas hoy lo dice, sin inventar ninguna', async () => {
    estado.lectura = { ok: true, datos: [objetivoB, hitoB] }
    montar('/coach/mi-plan')
    expect(await screen.findByText(/Hoy no hay tareas planeadas/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Tarea principal de hoy' })).toBeNull()
  })

  it('agregar una tarea de más de 50 min se rechaza con el motivo, sin llamar a la base', async () => {
    montar('/coach/mi-plan')
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar tarea' }))
    const form = screen.getByRole('form', { name: 'Agregar tarea' })
    fireEvent.change(within(form).getByLabelText('Tarea'), { target: { value: 'Algo largo' } })
    fireEvent.change(within(form).getByLabelText(/Primer paso físico/), { target: { value: 'abrir la hoja' } })
    fireEvent.change(within(form).getByLabelText(/Minutos/), { target: { value: '90' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))
    expect((await within(form).findByRole('alert')).textContent).toMatch(/50 min/)
    expect(estado.crear).not.toHaveBeenCalled()
  })

  it('con 3 tareas hoy, una cuarta se rechaza: no cabe', async () => {
    montar('/coach/mi-plan')
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar tarea' }))
    const form = screen.getByRole('form', { name: 'Agregar tarea' })
    fireEvent.change(within(form).getByLabelText('Tarea'), { target: { value: 'Una más' } })
    fireEvent.change(within(form).getByLabelText(/Primer paso físico/), { target: { value: 'abrir la hoja' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))
    expect((await within(form).findByRole('alert')).textContent).toMatch(/3 tareas/)
    expect(estado.crear).not.toHaveBeenCalled()
  })
})

describe('estados de la lectura', () => {
  it('cargando, luego los datos', async () => {
    montar('/coach/mi-plan')
    expect(screen.getByText('Cargando tu plan…')).toBeTruthy()
    await screen.findByRole('region', { name: 'Tarea principal de hoy' })
  })

  it('un fallo se dice como fallo y se puede reintentar; nunca se pinta como «no hay plan»', async () => {
    estado.lectura = { ok: false, error: 'permission denied' }
    montar('/coach/mi-plan')
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/permission denied/)
    expect(screen.queryByText(/no hay tareas/i)).toBeNull()
    estado.lectura = { ok: true, datos: [objetivoB, hitoB, principal] }
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('region', { name: 'Tarea principal de hoy' })
  })

  it('Manuela sin el permiso lo ve dicho', async () => {
    estado.rol = 'nutricionista'
    estado.capacidad = false
    montar('/mi-plan')
    expect(await screen.findByText(/permiso de organizar el plan/)).toBeTruthy()
  })

  it('un asesorado vuelve a la portada', async () => {
    estado.rol = 'asesorado'
    montar('/mi-plan')
    expect(await screen.findByText('portada')).toBeTruthy()
  })
})

describe('Semana y 90 días', () => {
  beforeEach(() => {
    estado.lectura = {
      ok: true,
      datos: [
        objetivoB,
        hitoB,
        { ...principal, estado: 'hecha', hechaEn: new Date().toISOString(), estimadoMin: 50 },
        pequena1,
        objetivoM,
        hitoM,
        item({ id: 'm1', padreId: 'h-m', dueno: 'manuela', titulo: 'Tarea de Manuela', estimadoMin: 120, prioridad: 'principal' }),
      ],
    }
  })

  it('Semana: hito con avance, horas planeadas contra hechas e intensidad', async () => {
    montar('/coach/mi-plan')
    fireEvent.click(await screen.findByRole('tab', { name: 'Semana' }))
    expect(await screen.findByText('Hito de Bryan')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Avance de Hito de Bryan' }).getAttribute('aria-valuenow')).toBe('50')
    expect(screen.getByText(/hechas de 1,3 h planeadas/)).toBeTruthy() // 50 + 30 min
    expect(screen.getAllByText(/Intensidad Baja/).length).toBeGreaterThan(0)
  })

  it('Bryan ve la carga de Manuela en solo lectura, sin botones para editarla', async () => {
    montar('/coach/mi-plan')
    fireEvent.click(await screen.findByRole('tab', { name: 'Semana' }))
    const carga = await screen.findByRole('region', { name: 'Carga de Manuela' })
    expect(within(carga).getByText('Hito de Manuela')).toBeTruthy()
    expect(within(carga).getByText(/2 h/)).toBeTruthy()
    expect(within(carga).queryByRole('button')).toBeNull()
  })

  it('Manuela no ve la carga de Bryan', async () => {
    estado.rol = 'nutricionista'
    montar('/mi-plan')
    fireEvent.click(await screen.findByRole('tab', { name: 'Semana' }))
    await screen.findByText('Hito de Manuela')
    expect(screen.queryByRole('region', { name: 'Carga de Manuela' })).toBeNull()
    expect(screen.queryByText('Hito de Bryan')).toBeNull()
  })

  it('90 días: el objetivo con su barra, y el de Manuela aparte para Bryan', async () => {
    montar('/coach/mi-plan')
    fireEvent.click(await screen.findByRole('tab', { name: '90 días' }))
    expect(await screen.findByRole('progressbar', { name: 'Avance de Objetivo de Bryan' })).toBeTruthy()
    const ajenos = screen.getByRole('region', { name: 'Objetivos de Manuela' })
    expect(within(ajenos).getByText('Objetivo de Manuela')).toBeTruthy()
  })

  it('Semana sin hitos lo dice', async () => {
    estado.lectura = { ok: true, datos: [] }
    montar('/coach/mi-plan')
    fireEvent.click(await screen.findByRole('tab', { name: 'Semana' }))
    expect(await screen.findByText(/no tiene hitos cargados/)).toBeTruthy()
  })
})

describe('banner al abrir', () => {
  it('avisa si la principal de hoy no se empezó y se puede cerrar por hoy', async () => {
    montar('/otra')
    const banner = await screen.findByRole('status', { name: 'Tu tarea principal de hoy' })
    expect(banner.textContent).toMatch(/Filtrar etapa2/)
    fireEvent.click(within(banner).getByRole('button', { name: 'Cerrar por hoy' }))
    expect(screen.queryByRole('status', { name: 'Tu tarea principal de hoy' })).toBeNull()
  })

  it('no avisa si la principal ya se empezó, ni si la lectura falló, ni a un asesorado (que ni consulta)', async () => {
    estado.lectura = { ok: true, datos: [{ ...principal, estado: 'en_curso' }] }
    const a = montar('/otra')
    await waitFor(() => expect(estado.lecturas).toBeGreaterThan(0))
    expect(screen.queryByRole('status')).toBeNull()
    a.unmount()

    estado.lectura = { ok: false, error: 'x' }
    const b = montar('/otra')
    await waitFor(() => expect(estado.lecturas).toBeGreaterThan(1))
    expect(screen.queryByRole('status')).toBeNull()
    b.unmount()

    estado.rol = 'asesorado'
    estado.lecturas = 0
    montar('/otra')
    expect(estado.lecturas).toBe(0)
  })
})
