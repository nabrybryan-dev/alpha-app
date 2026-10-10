import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Supabase falso para `planes_estrategicos`, mismo patrón de
 * `AgentesTab.test.tsx` / `ConsultasPage.test.tsx`: se mockea en la capa más
 * baja para probar el camino real de `planVigente`.
 */
interface Resultado {
  data: unknown | null
  error: { message: string } | null
}

const nube = {
  activo: true,
  fila: null as Record<string, unknown> | null,
}

function cliente() {
  return {
    from: (tabla: string) => {
      if (tabla !== 'planes_estrategicos') throw new Error(`tabla inesperada: ${tabla}`)
      const b = {
        select: () => b,
        eq: () => b,
        maybeSingle: (): Promise<Resultado> => Promise.resolve({ data: nube.fila, error: null }),
      }
      return b
    },
  }
}

vi.mock('../../../../data/supabase', () => ({
  get modoNube() {
    return nube.activo
  },
  supabase: () => cliente(),
}))

/**
 * Quién mira la pestaña. `null` = sin `SessionProvider` por encima, que es como corren las
 * pruebas de plan de abajo (y como degrada `useSesionOpcional`). Las de «quién ve qué» lo
 * cambian: la pestaña decide con el ROL de la sesión y con las capacidades de la persona.
 */
interface SesionFalsa {
  usuario: { id: string; nombre: string; rol: string }
  esNube: boolean
}

const quien = {
  sesion: null as SesionFalsa | null,
  capacidades: [] as string[],
  cargandoCapacidades: false,
}

vi.mock('../../../../app/SessionProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../app/SessionProvider')>()),
  useSesionOpcional: () => quien.sesion,
}))

vi.mock('../useCapacidades', () => ({
  useCapacidades: () => ({
    cargando: quien.cargandoCapacidades,
    usuarioId: quien.sesion?.usuario.id ?? null,
    tiene: (capacidad: string) => quien.capacidades.includes(capacidad),
  }),
}))

// Las notas de llamada tienen su propia prueba: aquí solo importa SI la tarjeta se pinta.
vi.mock('../../../../data/consola/notasLlamada', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../data/consola/notasLlamada')>()),
  notasLlamadaDe: () => Promise.resolve({ ok: true, notas: [] }),
}))

// Import DINÁMICO y después del mock a propósito (igual que ConsultasPage.test.tsx):
// un `import` estático se iza por encima de `const nube`, y `dbInstance` lee
// `modoNube` al cargarse — con un `import` normal revienta "Cannot access 'nube'
// before initialization". El dinámico corre en el orden textual real.
const { db } = await import('../../../../data/dbInstance')
const { FichaAsesoradoTab } = await import('./FichaAsesoradoTab')

describe('FichaAsesoradoTab · Plan estratégico', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    nube.activo = true
    nube.fila = null
  })

  it('sin plan vigente, lo dice en vez de mostrar una tarjeta vacía', async () => {
    const usuarioId = db.usuarios.entrenan()[0].id
    nube.fila = null
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)
    await waitFor(() => expect(screen.getByText('Sin plan estratégico vigente todavía.')).toBeInTheDocument())
  })

  it('pinta el plan vigente: objetivo, métrica, horizonte y reglas reales de la forma de planes_estrategicos', async () => {
    const usuarioId = db.usuarios.entrenan()[0].id
    nube.fila = {
      id: 'plan-1',
      usuario_id: usuarioId,
      version: 3,
      vigente: true,
      contenido: {
        slug: 'alguien',
        objetivo_largo_plazo: 'recomposición con cintura y glúteo como métrica',
        metrica_principal: 'perímetro de glúteo y cintura',
        horizonte: '2026-08-19 → 2026-10-13 (7 microciclos de 8 días)',
        reglas: [{ numero: 2, nombre: 'Freno por readiness', texto: 'sueño <6 h → no sube volumen' }],
        reglas_derogadas: [],
        cabecera: [],
        filas: {},
      },
      hash: 'hash-v3',
      creado_en: '2026-09-20T12:00:00Z',
    }
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)
    await waitFor(() =>
      expect(screen.getByText('recomposición con cintura y glúteo como métrica')).toBeInTheDocument(),
    )
    expect(screen.getByText(/perímetro de glúteo y cintura/)).toBeInTheDocument()
    expect(screen.getByText(/2026-08-19/)).toBeInTheDocument()
    expect(screen.getByText('sueño <6 h → no sube volumen')).toBeInTheDocument()
    expect(screen.getByText('Plan estratégico · versión 3')).toBeInTheDocument()
  })

  it('pinta la tabla del plan con la fila del microciclo en curso resaltada', async () => {
    const usuarioId = db.usuarios.entrenan()[0].id
    const activo = db.microciclos.byUsuario(usuarioId).find((m) => m.estado === 'activo')
    expect(activo).toBeDefined()
    const n = activo!.numero
    nube.fila = {
      id: 'plan-3',
      usuario_id: usuarioId,
      version: 2,
      vigente: true,
      contenido: {
        objetivo_largo_plazo: 'objetivo de prueba',
        cabecera: ['Micro', 'Series'],
        filas: {
          [String(n)]: { columnas: { Micro: `M${n}`, Series: '**~60**' }, condiciones: {} },
          [String(n + 1)]: { columnas: { Micro: `M${n + 1}`, Series: '~64' }, condiciones: {} },
        },
      },
      hash: 'hash-v2',
      creado_en: '2026-09-20T12:00:00Z',
    }
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)
    const celda = await screen.findByText('~60')
    // El Markdown del plan no se ve, y la fila del microciclo en curso es la marcada.
    expect(celda.closest('tr')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('~64').closest('tr')).not.toHaveAttribute('aria-current')
    expect(screen.getByText(`Resaltada la fila del microciclo en curso (M${n}).`)).toBeInTheDocument()
  })

  it('cada sección sin dato dice qué falta y cómo se consigue, en vez de quedar vacía', async () => {
    const usuarioId = db.usuarios.entrenan()[0].id
    vi.spyOn(db.perfiles, 'byUsuario').mockReturnValue(undefined)
    vi.spyOn(db.bienestar, 'byUsuario').mockReturnValue([])
    vi.spyOn(db.perfilNutricion, 'byUsuario').mockReturnValue(undefined)
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)
    expect(screen.getByText('Esta persona no tiene ficha (perfiles)')).toBeInTheDocument()
    expect(screen.getByText('Sin ningún peso registrado')).toBeInTheDocument()
    expect(screen.getByText(/Llega con el check-in diario/)).toBeInTheDocument()
    expect(screen.getByText('Sin ningún perímetro')).toBeInTheDocument()
    expect(screen.getByText('Sin formulario de nutrición')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Sin plan estratégico vigente todavía.')).toBeInTheDocument())
  })

  it('con un contenido sin ninguno de los campos esperados, muestra el JSON crudo en vez de inventar campos', async () => {
    const usuarioId = db.usuarios.entrenan()[0].id
    nube.fila = {
      id: 'plan-2',
      usuario_id: usuarioId,
      version: 1,
      vigente: true,
      contenido: { forma_no_prevista: 'algo distinto' },
      hash: 'hash-v1',
      creado_en: '2026-09-20T12:00:00Z',
    }
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)
    await waitFor(() => expect(screen.getByText('Plan estratégico · versión 1')).toBeInTheDocument())
    expect(screen.getByText(/forma_no_prevista/)).toBeInTheDocument()
  })
})

/** Quién entra y qué ve: la pestaña la abre Manuela (rol `nutricionista`, por la capacidad
 *  `leer_entrenamiento`) igual que el coach, y el interruptor de vista simple SOLO es del puesto
 *  de coach — la base rechaza la escritura de la ficha a cualquier otro, y la cola la
 *  reintentaría 8 veces y la descartaría en silencio. */
describe('FichaAsesoradoTab · notas de llamada e interruptor de vista simple', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    quien.sesion = null
    quien.capacidades = []
    quien.cargandoCapacidades = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
    nube.activo = true
    nube.fila = null
    quien.sesion = null
    quien.capacidades = []
    quien.cargandoCapacidades = false
  })

  const sesion = (rol: string): SesionFalsa => ({ usuario: { id: 'u-sesion', nombre: 'Quien mira', rol }, esNube: true })

  /** El bloque que envuelve la tarjeta (el que lleva la clase de columnas de la rejilla). */
  const bloqueDe = (texto: string) => {
    const bloque = screen.getByText(texto).closest('div[class*="xl:col-span-"]')
    expect(bloque).not.toBeNull()
    return bloque as HTMLElement
  }

  it('con rol nutricionista (Manuela) la tarjeta de notas SE pinta y el interruptor NO', async () => {
    quien.sesion = sesion('nutricionista')
    quien.capacidades = ['leer_entrenamiento']
    const usuarioId = db.usuarios.entrenan()[0].id
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)

    expect(await screen.findByText('Notas de llamada')).toBeInTheDocument()
    expect(await screen.findByText('Todavía no hay llamadas anotadas.')).toBeInTheDocument()
    expect(screen.queryByText('Vista de la app')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vista simple' })).not.toBeInTheDocument()
    // Sin el interruptor al lado, las notas ocupan las 12 columnas.
    expect(bloqueDe('Notas de llamada')).toHaveClass('xl:col-span-12')
  })

  it('con rol coach se pintan los dos, las notas a 8 columnas y el interruptor a 4', async () => {
    quien.sesion = sesion('coach')
    const usuarioId = db.usuarios.entrenan()[0].id
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)

    expect(await screen.findByText('Notas de llamada')).toBeInTheDocument()
    expect(await screen.findByText('Vista de la app')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vista simple' })).toBeInTheDocument()
    expect(bloqueDe('Notas de llamada')).toHaveClass('xl:col-span-8')
    expect(bloqueDe('Vista de la app')).toHaveClass('xl:col-span-4')
  })

  it('la cuenta personal de Bryan (asesorado con puesto_de_coach) también ve los dos', async () => {
    quien.sesion = sesion('asesorado')
    quien.capacidades = ['puesto_de_coach']
    const usuarioId = db.usuarios.entrenan()[0].id
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)

    expect(await screen.findByText('Notas de llamada')).toBeInTheDocument()
    expect(screen.getByText('Vista de la app')).toBeInTheDocument()
  })

  it('mientras se consultan las capacidades, quien es asesorado NO ve el interruptor (el resultado seguro)', async () => {
    quien.sesion = sesion('asesorado')
    quien.capacidades = ['puesto_de_coach']
    quien.cargandoCapacidades = true
    const usuarioId = db.usuarios.entrenan()[0].id
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)

    expect(await screen.findByText('Notas de llamada')).toBeInTheDocument()
    expect(screen.queryByText('Vista de la app')).not.toBeInTheDocument()
  })

  it('sin sesión (pantalla suelta) las notas se pintan y el interruptor no', async () => {
    quien.sesion = null
    const usuarioId = db.usuarios.entrenan()[0].id
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)

    expect(await screen.findByText('Notas de llamada')).toBeInTheDocument()
    expect(screen.queryByText('Vista de la app')).not.toBeInTheDocument()
  })

  it('el interruptor, para el coach, de verdad cambia la ficha', async () => {
    quien.sesion = sesion('coach')
    const usuarioId = db.usuarios.entrenan()[0].id
    const guardar = vi.spyOn(db.perfiles, 'guardarVistaSimple').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)

    await user.click(await screen.findByRole('button', { name: 'Vista simple' }))
    expect(guardar).toHaveBeenCalledWith(usuarioId, true)
  })

  it('al pasar a otro asesorado la tarjeta arranca limpia: el borrador de uno no se arrastra al otro', async () => {
    quien.sesion = sesion('nutricionista')
    quien.capacidades = ['leer_entrenamiento']
    const [primero, segundo] = db.usuarios.entrenan()
    const user = userEvent.setup()
    const vista = render(<FichaAsesoradoTab usuarioId={primero.id} />)

    await user.click(await screen.findByRole('button', { name: '+ Anotar llamada' }))
    await user.type(screen.getByLabelText('Qué se habló'), 'Esto es del primero')
    vista.rerender(<FichaAsesoradoTab usuarioId={segundo.id} />)

    expect(await screen.findByRole('button', { name: '+ Anotar llamada' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Qué se habló')).not.toBeInTheDocument()
    // Y el del primero sigue esperándolo.
    expect(window.sessionStorage.getItem(`notas-llamada:borrador:${primero.id}`)).toContain('Esto es del primero')
  })
})

/** La presentación para el asesorado: el botón de arriba abre la pantalla completa con las seis
 *  secciones, y cerrarla no deja nada colgado. */
describe('FichaAsesoradoTab · presentar al asesorado', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    nube.activo = true
    nube.fila = null
  })

  const persona = () => db.usuarios.entrenan()[0]

  it('el botón «Presentar a …» abre la presentación y Escape la cierra', async () => {
    const user = userEvent.setup()
    render(<FichaAsesoradoTab usuarioId={persona().id} />)
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: `Presentar a ${persona().nombre}` }))
    const dialogo = await screen.findByRole('dialog', { name: `Presentación de ${persona().nombre}` })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('trae las seis secciones en su orden, y el bloque reservado de velocidad y técnica no lleva cifras', async () => {
    const user = userEvent.setup()
    render(<FichaAsesoradoTab usuarioId={persona().id} />)
    await user.click(screen.getByRole('button', { name: `Presentar a ${persona().nombre}` }))
    const dialogo = await screen.findByRole('dialog')

    const titulos = within(dialogo)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(titulos).toEqual([
      'Esta semana',
      'Tu semana pasada, esta y la que viene',
      'El mapa de tu plan',
      'Lo que te pedimos y lo que hiciste',
      'Conclusiones',
      'Velocidad y técnica',
    ])

    const reservada = within(dialogo).getByRole('region', { name: 'Velocidad y técnica' })
    expect(reservada.textContent).toMatch(/Todavía no hay mediciones de velocidad ni tomas de técnica/)
    // El título y el texto reservado no traen ni un dígito (no hay datos de ejemplo).
    expect(reservada.textContent).not.toMatch(/\d/)
  })

  it('sin plan vigente, la sección del mapa lo dice y la presentación no se rompe', async () => {
    nube.fila = null
    const user = userEvent.setup()
    render(<FichaAsesoradoTab usuarioId={persona().id} />)
    await user.click(screen.getByRole('button', { name: `Presentar a ${persona().nombre}` }))
    expect(await screen.findByText(/no hay un plan de largo plazo/)).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay conclusiones escritas para mostrar.')).toBeInTheDocument()
  })

  it('con plan vigente, el mapa marca la semana de ahora y al tocar otra abre su detalle', async () => {
    const usuarioId = persona().id
    const activo = db.microciclos.byUsuario(usuarioId).find((m) => m.estado === 'activo')!
    const n = activo.numero
    nube.fila = {
      id: 'plan-p',
      usuario_id: usuarioId,
      version: 1,
      vigente: true,
      contenido: {
        objetivo_largo_plazo: 'objetivo de la presentación',
        cabecera: ['Micro', 'Series'],
        filas: {
          [String(n)]: { columnas: { Micro: `M${n}`, Series: '**~60**' }, condiciones: {} },
          [String(n + 1)]: { columnas: { Micro: `M${n + 1}`, Series: '~64' }, condiciones: {} },
        },
      },
      hash: 'h',
      creado_en: '2026-09-20T12:00:00Z',
    }
    const user = userEvent.setup()
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)
    await user.click(screen.getByRole('button', { name: `Presentar a ${persona().nombre}` }))

    const actual = await screen.findByRole('button', { name: `Semana ${n}, es esta, la de ahora` })
    expect(actual).toHaveAttribute('aria-current', 'step')
    await user.click(screen.getByRole('button', { name: `Semana ${n + 1}, viene` }))
    // La ficha de detrás también trae la tabla del plan: se mira solo dentro de la presentación.
    expect(within(screen.getByRole('dialog')).getByText('~64')).toBeInTheDocument()
  })
})
