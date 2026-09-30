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
  capacidades: new Set<string>(['ver_administracion', 'revisar_creadores']),
}

vi.mock('../../../data/consola/adminTablero', () => ({
  adminTablero: () => (estado.pendiente ? new Promise(() => {}) : Promise.resolve(estado.lectura)),
}))
vi.mock('../consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, tiene: (c: string) => estado.capacidades.has(c), usuarioId: 'u' }),
}))
vi.mock('../../../app/SessionProvider', () => ({
  useSesionOpcional: () => ({ usuario: { id: 'u', nombre: 'X', rol: estado.rol, avatarIniciales: 'X' } }),
}))
vi.mock('../../plan/EntradaMiPlan', () => ({ EntradaMiPlan: () => null }))

const { default: AdministracionPage } = await import('./AdministracionPage')

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

beforeEach(() => {
  estado.lectura = { ok: true, datos: ultimoCortePorSeccion([cruda('finanzas', 'amarillo'), cruda('plan', 'verde', {}, false)]) }
  estado.pendiente = false
  estado.telefono = false
  estado.rol = 'nutricionista'
  estado.capacidades = new Set(['ver_administracion', 'revisar_creadores'])
  window.localStorage.clear()
  window.matchMedia = ((q: string) => ({ matches: estado.telefono && q.includes('767'), media: q, addEventListener() {}, removeEventListener() {} })) as never
})

describe('AdministracionPage', () => {
  it('dice que carga mientras espera', () => {
    estado.pendiente = true
    montar()
    expect(screen.getByText(/Cargando el área administrativa/)).toBeInTheDocument()
  })

  it('un fallo de lectura se dice y se puede reintentar; no se pinta como vacío', async () => {
    estado.lectura = { ok: false, error: 'desvios: RLS' }
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('desvios: RLS')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText(/Todavía no hay ningún corte/)).toBeNull()
  })

  it('pinta las siete secciones en el orden de la espec; las que no tienen corte dicen FALTA', async () => {
    montar()
    const tarjetas = await screen.findAllByRole('region')
    expect(tarjetas.map((t) => t.getAttribute('aria-label'))).toEqual([
      'Finanzas', 'Plan estratégico', 'Lo que proponen los agentes', 'Desvíos', 'Influencers (bola de nieve)', 'Mercadeo', 'Plataforma Alpha y estudio',
    ])
    expect(within(tarjetas[2]).getByText(/^FALTA: las propuestas de los agentes/)).toBeInTheDocument()
    expect(within(tarjetas[2]).getByText('Falta')).toBeInTheDocument()
  })

  it('una cifra vacía dice FALTA y no 0', async () => {
    montar()
    const plan = (await screen.findAllByRole('region'))[1]
    expect(within(plan).getByText('FALTA')).toBeInTheDocument()
    expect(within(plan).queryByText('0')).toBeNull()
  })

  it('capa 2 al tocar la tarjeta y capa 3 al tocar una fila (fuente y qué hacer)', async () => {
    const u = userEvent.setup()
    montar()
    const fin = (await screen.findAllByRole('region'))[0]
    expect(within(fin).queryByText('Caja del mes')).toBeNull()
    await u.click(within(fin).getByRole('button', { name: /Frase de finanzas/ }))
    expect(within(fin).getByText('Caja del mes')).toBeInTheDocument()
    expect(within(fin).getByRole('list', { name: 'Barras' })).toBeInTheDocument()
    await u.click(within(fin).getByRole('button', { name: /Techo de 3 M/ }))
    expect(within(fin).getByText('Decidir el techo')).toBeInTheDocument()
    expect(within(fin).getByText(/finanzas\.json · corte 2026-09-28 · huella abc123/)).toBeInTheDocument()
    expect(within(fin).getByText(/FALTA: esta cifra no está cargada\. Le toca a Bryan\./)).toBeInTheDocument()
  })

  it('en teléfono solo hay una sección abierta a la vez; en pantalla ancha, varias', async () => {
    const u = userEvent.setup()
    estado.telefono = true
    montar()
    const [fin, plan] = await screen.findAllByRole('region')
    await u.click(within(fin).getByRole('button', { name: /Frase de finanzas/ }))
    await u.click(within(plan).getByRole('button', { name: /Frase de plan/ }))
    expect(within(fin).getByRole('button', { name: /Frase de finanzas/ })).toHaveAttribute('aria-expanded', 'false')
    expect(within(plan).getByRole('button', { name: /Frase de plan/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('en pantalla ancha se pueden abrir varias', async () => {
    const u = userEvent.setup()
    montar()
    const [fin, plan] = await screen.findAllByRole('region')
    await u.click(within(fin).getByRole('button', { name: /Frase de finanzas/ }))
    await u.click(within(plan).getByRole('button', { name: /Frase de plan/ }))
    expect(within(fin).getByRole('button', { name: /Frase de finanzas/ })).toHaveAttribute('aria-expanded', 'true')
    expect(within(plan).getByRole('button', { name: /Frase de plan/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('recuerda la sección abierta en localStorage y la restaura', async () => {
    const u = userEvent.setup()
    const primera = montar()
    const fin = (await screen.findAllByRole('region'))[0]
    await u.click(within(fin).getByRole('button', { name: /Frase de finanzas/ }))
    expect(JSON.parse(window.localStorage.getItem('alpha.admin.abiertas') ?? '[]')).toEqual(['finanzas'])
    primera.unmount()
    montar()
    const de_nuevo = (await screen.findAllByRole('region'))[0]
    expect(within(de_nuevo).getByRole('button', { name: /Frase de finanzas/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('funciona aunque localStorage lance', async () => {
    const u = userEvent.setup()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    montar()
    const fin = (await screen.findAllByRole('region'))[0]
    await u.click(within(fin).getByRole('button', { name: /Frase de finanzas/ }))
    expect(within(fin).getByText('Caja del mes')).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('el filtro «requiere acción» deja las secciones no verdes y, dentro, las filas no verdes', async () => {
    const u = userEvent.setup()
    montar()
    await screen.findAllByRole('region')
    await u.click(screen.getByRole('button', { name: /Requiere acción · 6/ }))
    // finanzas (una fila con que_hacer) y las cinco sin corte quedan; plan (verde, sin que_hacer) sale.
    expect(screen.queryByRole('region', { name: 'Plan estratégico' })).toBeNull()
    const fin = screen.getByRole('region', { name: 'Finanzas' })
    await u.click(within(fin).getByRole('button', { name: /Frase de finanzas/ }))
    expect(within(fin).queryByText('Caja del mes')).toBeNull() // sin que_hacer: no pide acción
    expect(within(fin).getByText('Techo de 3 M')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Todo' }))
    expect(screen.getByRole('region', { name: 'Plan estratégico' })).toBeInTheDocument()
  })

  it('una sección con datos inválidos lo dice y no se pinta a medias', async () => {
    const u = userEvent.setup()
    estado.lectura = { ok: true, datos: ultimoCortePorSeccion([cruda('finanzas', 'morado')]) }
    montar()
    const fin = (await screen.findAllByRole('region'))[0]
    await u.click(within(fin).getByRole('button', { name: /no se pudieron leer/ }))
    expect(within(fin).getByRole('alert')).toHaveTextContent(/semáforo de la tarjeta desconocido/)
  })

  it('influencers y mercadeo enlazan a Creadores (con revisar_creadores); plataforma al buzón de comentarios', async () => {
    const u = userEvent.setup()
    montar()
    const regiones = await screen.findAllByRole('region')
    await u.click(within(regiones[4]).getByRole('button', { name: /FALTA/ }))
    expect(within(regiones[4]).getByRole('link', { name: /tablero de creadores/ })).toHaveAttribute('href', '/coach/creadores')
    await u.click(within(regiones[5]).getByRole('button', { name: /FALTA/ }))
    expect(within(regiones[5]).getByRole('link', { name: /buzón de mercadeo/ })).toHaveAttribute('href', '/coach/creadores')
    await u.click(within(regiones[6]).getByRole('button', { name: /FALTA/ }))
    expect(within(regiones[6]).getByRole('link', { name: /buzón de comentarios/ })).toHaveAttribute('href', '/mi-entreno')
  })

  it('sin revisar_creadores no ofrece el enlace a Creadores (llevaría a una puerta cerrada)', async () => {
    const u = userEvent.setup()
    estado.capacidades = new Set(['ver_administracion'])
    montar()
    const regiones = await screen.findAllByRole('region')
    await u.click(within(regiones[4]).getByRole('button', { name: /FALTA/ }))
    expect(within(regiones[4]).queryByRole('link')).toBeNull()
  })

  it('sin ningún corte cargado lo dice arriba', async () => {
    estado.lectura = { ok: true, datos: ultimoCortePorSeccion([]) }
    montar()
    await waitFor(() => expect(screen.getByText('Todavía no hay ningún corte cargado.')).toBeInTheDocument())
  })
})
