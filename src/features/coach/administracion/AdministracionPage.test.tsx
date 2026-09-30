import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ultimoCortePorSeccion, type FilaAdminTablero, type SeccionLeida } from '../../../domain/adminTablero'

const estado = {
  lectura: { ok: true, datos: [] as SeccionLeida[] } as { ok: true; datos: SeccionLeida[] } | { ok: false; error: string },
  pendiente: false,
  telefono: false,
  rol: 'nutricionista',
  capacidades: new Set<string>(['ver_administracion', 'organizar_plan', 'decisiones_compartidas']),
  lecturas: 0,
}

vi.mock('../../../data/consola/adminTablero', () => ({
  adminTablero: () => {
    estado.lecturas += 1
    return estado.pendiente ? new Promise(() => {}) : Promise.resolve(estado.lectura)
  },
}))
vi.mock('../consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, tiene: (c: string) => estado.capacidades.has(c), usuarioId: 'u' }),
}))
vi.mock('../../../app/SessionProvider', () => ({
  useSesionOpcional: () => ({ usuario: { id: 'u', nombre: 'X', rol: estado.rol, avatarIniciales: 'X' } }),
}))
vi.mock('../../plan/MiPlanPage', () => ({ default: () => <p>Contenido de Mi plan</p> }))
vi.mock('../../equipo/DecisionesCompartidas', () => ({
  DecisionesCompartidas: () => <section aria-label="Decisiones compartidas">Registro de decisiones</section>,
}))

const { default: AdministracionPage } = await import('./AdministracionPage')

const PENDIENTE = 'Pendiente de activar (migración 0102)'
const fuente = { archivo: 'finanzas.json', corte: '2026-09-28', huella: 'abc123' }
const cruda = (seccion: string, semaforo: string, extra: Partial<FilaAdminTablero> = {}, accion = true): FilaAdminTablero => ({
  id: seccion,
  seccion,
  corte: '2026-09-28',
  fuente: 'finanzas.json',
  huella: 'h1',
  datos: {
    tarjeta: { titulo: seccion, semaforo, frase: `Frase de ${seccion}`, cifra: seccion === 'plan' ? '' : '3,2 M', cifra_etiqueta: 'caja' },
    filas: [
      { id: 'a', titulo: 'Caja del mes', cifra: '3,2 M', semaforo: 'verde', dueno: 'agente:finanzas', detalle: 'lo que hay', que_hacer: '', fuente },
      { id: 'b', titulo: 'Techo de 3 M', cifra: '', semaforo: 'rojo', dueno: 'bryan', detalle: '', que_hacer: accion ? 'Decidir el techo' : '', fuente },
    ],
    grafico: { tipo: 'barras', series: [{ etiqueta: 'Fijos', valor: 10 }, { etiqueta: 'IA', valor: 5 }] },
  },
  ...extra,
})

function montar() {
  return render(
    <MemoryRouter>
      <AdministracionPage />
    </MemoryRouter>,
  )
}
const nombres = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))

beforeEach(() => {
  estado.lectura = { ok: true, datos: ultimoCortePorSeccion([cruda('finanzas', 'amarillo'), cruda('plan', 'verde', {}, false)]) }
  estado.pendiente = false
  estado.telefono = false
  estado.rol = 'nutricionista'
  estado.capacidades = new Set(['ver_administracion', 'organizar_plan', 'decisiones_compartidas'])
  estado.lecturas = 0
  window.localStorage.clear()
  window.matchMedia = ((q: string) => ({ matches: estado.telefono && q.includes('767'), media: q, addEventListener() {}, removeEventListener() {} })) as never
})

describe('AdministracionPage · orden de Bryan', () => {
  it('va de arriba abajo: hoy y calendario, finanzas y operación, objetivos, agentes y, al final, decisiones', async () => {
    montar()
    await screen.findByRole('group', { name: 'Filtro' })
    expect(nombres()).toEqual([
      'Hoy y calendario',
      'Finanzas',
      'Plataforma Alpha y estudio',
      'Plan estratégico',
      'Desvíos',
      'Lo que proponen los agentes',
      'Decisiones de Bryan y Manuela',
    ])
  })

  it('todo viene plegado: una frase por tarjeta y el detalle al tocarla', async () => {
    const u = userEvent.setup()
    montar()
    await screen.findByRole('group', { name: 'Filtro' })
    expect(screen.queryByText('Contenido de Mi plan')).toBeNull()
    expect(screen.queryByText('Registro de decisiones')).toBeNull()
    const hoy = screen.getByRole('region', { name: 'Hoy y calendario' })
    await u.click(within(hoy).getByRole('button', { name: /Hoy y calendario/ }))
    expect(within(hoy).getByText('Contenido de Mi plan')).toBeInTheDocument()
    // Sin fechas no se inventan plazos: lo dice con etiquetas explícitas.
    expect(within(hoy).getByText(/Largo plazo: sin horizonte cargado/)).toBeInTheDocument()
    const dec = screen.getByRole('region', { name: 'Decisiones de Bryan y Manuela' })
    await u.click(within(dec).getByRole('button', { name: /Decisiones de Bryan y Manuela/ }))
    expect(within(dec).getByText('Registro de decisiones')).toBeInTheDocument()
  })

  it('las decisiones son lo último de la pantalla', async () => {
    const { container } = montar()
    await screen.findByRole('group', { name: 'Filtro' })
    const dec = screen.getByRole('region', { name: 'Decisiones de Bryan y Manuela' })
    expect(container.firstElementChild?.lastElementChild).toBe(dec)
  })

  it('con solo organizar_plan: hay Mi plan y no hay decisiones; con solo decisiones: al revés', async () => {
    estado.capacidades = new Set(['organizar_plan'])
    const a = montar()
    await screen.findByRole('region', { name: 'Hoy y calendario' })
    expect(screen.queryByRole('region', { name: 'Decisiones de Bryan y Manuela' })).toBeNull()
    a.unmount()
    estado.capacidades = new Set(['decisiones_compartidas'])
    montar()
    await screen.findByRole('region', { name: 'Decisiones de Bryan y Manuela' })
    expect(screen.queryByRole('region', { name: 'Hoy y calendario' })).toBeNull()
  })
})

describe('AdministracionPage · tablero de la migración 0102', () => {
  it('sin ver_administracion NO lee la tabla y todas las secciones dicen «Pendiente de activar»', async () => {
    estado.capacidades = new Set(['organizar_plan', 'decisiones_compartidas'])
    montar()
    const fin = await screen.findByRole('region', { name: 'Finanzas' })
    expect(within(fin).getByText(PENDIENTE)).toBeInTheDocument()
    for (const n of ['Plataforma Alpha y estudio', 'Plan estratégico', 'Desvíos', 'Lo que proponen los agentes']) {
      expect(within(screen.getByRole('region', { name: n })).getByText(PENDIENTE)).toBeInTheDocument()
    }
    expect(estado.lecturas).toBe(0)
    // Nunca un cero ni un verde.
    expect(within(fin).queryByText('0')).toBeNull()
    expect(within(fin).queryByText('Bien')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Filtro' })).toBeNull()
  })

  it('con permiso pero sin la tabla (error de consulta) también dice «Pendiente», no un fallo ni un verde', async () => {
    estado.lectura = { ok: false, error: "finanzas: Could not find the table 'public.admin_tablero' in the schema cache" }
    montar()
    const fin = await screen.findByRole('region', { name: 'Finanzas' })
    expect(await within(fin).findByText(PENDIENTE)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('un error de lectura distinto (red, permiso) se ve como fallo con Reintentar y no como «sin datos»', async () => {
    estado.lectura = { ok: false, error: 'desvios: RLS' }
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('desvios: RLS')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText(/Todavía no hay ningún corte/)).toBeNull()
    expect(screen.queryByText(PENDIENTE)).toBeNull()
  })

  it('mientras carga lo dice', () => {
    estado.pendiente = true
    montar()
    expect(screen.getByText(/Cargando el área administrativa/)).toBeInTheDocument()
  })

  it('las secciones sin corte dicen FALTA; una cifra vacía dice FALTA y no 0', async () => {
    montar()
    const agentes = await screen.findByRole('region', { name: 'Lo que proponen los agentes' })
    expect(within(agentes).getByText(/^FALTA: las propuestas de los agentes/)).toBeInTheDocument()
    const plan = screen.getByRole('region', { name: 'Plan estratégico' })
    expect(within(plan).getByText('FALTA')).toBeInTheDocument()
    expect(within(plan).queryByText('0')).toBeNull()
  })

  it('capa 2 al tocar la tarjeta y capa 3 al tocar una fila (fuente y qué hacer)', async () => {
    const u = userEvent.setup()
    montar()
    const fin = await screen.findByRole('region', { name: 'Finanzas' })
    expect(within(fin).queryByText('Caja del mes')).toBeNull()
    await u.click(within(fin).getByRole('button', { name: /Frase de finanzas/ }))
    expect(within(fin).getByText('Caja del mes')).toBeInTheDocument()
    expect(within(fin).getByRole('list', { name: 'Barras' })).toBeInTheDocument()
    await u.click(within(fin).getByRole('button', { name: /Techo de 3 M/ }))
    expect(within(fin).getByText('Decidir el techo')).toBeInTheDocument()
    expect(within(fin).getByText(/finanzas\.json · corte 2026-09-28 · huella abc123/)).toBeInTheDocument()
  })

  it('en teléfono solo hay una sección abierta a la vez; en pantalla ancha, varias', async () => {
    const u = userEvent.setup()
    estado.telefono = true
    const a = montar()
    const fin = await screen.findByRole('region', { name: 'Finanzas' })
    const plan = screen.getByRole('region', { name: 'Plan estratégico' })
    await u.click(within(fin).getByRole('button', { name: /Frase de finanzas/ }))
    await u.click(within(plan).getByRole('button', { name: /Frase de plan/ }))
    expect(within(fin).getByRole('button', { name: /Frase de finanzas/ })).toHaveAttribute('aria-expanded', 'false')
    expect(within(plan).getByRole('button', { name: /Frase de plan/ })).toHaveAttribute('aria-expanded', 'true')
    a.unmount()
    estado.telefono = false
    window.localStorage.clear()
    montar()
    const fin2 = await screen.findByRole('region', { name: 'Finanzas' })
    const plan2 = screen.getByRole('region', { name: 'Plan estratégico' })
    await u.click(within(fin2).getByRole('button', { name: /Frase de finanzas/ }))
    await u.click(within(plan2).getByRole('button', { name: /Frase de plan/ }))
    expect(within(fin2).getByRole('button', { name: /Frase de finanzas/ })).toHaveAttribute('aria-expanded', 'true')
    expect(within(plan2).getByRole('button', { name: /Frase de plan/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('recuerda la sección abierta y funciona aunque localStorage lance', async () => {
    const u = userEvent.setup()
    const primera = montar()
    const fin = await screen.findByRole('region', { name: 'Finanzas' })
    await u.click(within(fin).getByRole('button', { name: /Frase de finanzas/ }))
    expect(JSON.parse(window.localStorage.getItem('alpha.admin.abiertas') ?? '[]')).toEqual(['finanzas'])
    primera.unmount()
    montar()
    const otra = await screen.findByRole('region', { name: 'Finanzas' })
    expect(within(otra).getByRole('button', { name: /Frase de finanzas/ })).toHaveAttribute('aria-expanded', 'true')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    await u.click(within(otra).getByRole('button', { name: /Frase de finanzas/ }))
    expect(within(otra).getByRole('button', { name: /Frase de finanzas/ })).toHaveAttribute('aria-expanded', 'false')
    vi.restoreAllMocks()
  })

  it('el filtro «requiere acción» deja las secciones que piden acción', async () => {
    const u = userEvent.setup()
    montar()
    await screen.findByRole('region', { name: 'Finanzas' })
    await u.click(screen.getByRole('button', { name: /Requiere acción · 4/ }))
    expect(screen.queryByRole('region', { name: 'Plan estratégico' })).toBeNull()
    await u.click(screen.getByRole('button', { name: 'Todo' }))
    expect(screen.getByRole('region', { name: 'Plan estratégico' })).toBeInTheDocument()
  })

  it('una sección con datos inválidos lo dice y no se pinta a medias', async () => {
    const u = userEvent.setup()
    estado.lectura = { ok: true, datos: ultimoCortePorSeccion([cruda('finanzas', 'morado')]) }
    montar()
    const fin = await screen.findByRole('region', { name: 'Finanzas' })
    await u.click(within(fin).getByRole('button', { name: /no se pudieron leer/ }))
    expect(within(fin).getByRole('alert')).toHaveTextContent(/semáforo de la tarjeta desconocido/)
  })

  it('sin ningún corte cargado lo dice arriba', async () => {
    estado.lectura = { ok: true, datos: ultimoCortePorSeccion([]) }
    montar()
    await waitFor(() => expect(screen.getByText('Todavía no hay ningún corte cargado.')).toBeInTheDocument())
  })

  it('plataforma enlaza al buzón de comentarios', async () => {
    const u = userEvent.setup()
    montar()
    const p = await screen.findByRole('region', { name: 'Plataforma Alpha y estudio' })
    await u.click(within(p).getByRole('button', { name: /FALTA/ }))
    expect(within(p).getByRole('link', { name: /buzón de comentarios/ })).toHaveAttribute('href', '/mi-entreno')
  })
})
