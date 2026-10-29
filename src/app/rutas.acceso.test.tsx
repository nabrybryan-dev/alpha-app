import { configure, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Capacidad } from '../data/consola/capacidadesStaff'
import type { Rol } from '../domain/types'
import { citasDeAvisosYScripts } from '../test/citasDeRutas'
import { RUTAS, resolverAcceso, type PerfilAcceso, type ResultadoAcceso } from './rutas'

/**
 * RED DE SEGURIDAD DEL REDISEÑO (paso 0): para cada ruta de `rutas.ts` y cada tipo de cuenta, lo que
 * hace el ROUTER REAL (layouts y pantallas con sus puertas de hoy) tiene que coincidir con lo que dice la
 * tabla: «entra», «Sin permiso» o «redirige a …». Si un paso posterior mueve una puerta, este test lo dice.
 *
 * Se sustituyen la sesión y las capacidades (como hacen `layouts.coach.test` y `CoachLayout.acceso.test`)
 * y las pantallas que NO llevan una puerta propia por un marcador. Las que sí la llevan (Mi entreno,
 * Equipo, Nutrición del equipo, Cifras, Mi plan, Praxis) se montan de verdad.
 */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })
configure({ asyncUtilTimeout: 30_000 })

const estado = { rol: 'asesorado' as Rol, capacidades: new Set<string>() }

vi.mock('./SessionProvider', async (original) => ({
  ...(await original<typeof import('./SessionProvider')>()),
  useSesion: () => ({
    usuario: { id: 'u-valentina', nombre: 'Persona', rol: estado.rol, avatarIniciales: 'PE' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
  useSesionOpcional: () => ({
    usuario: { id: 'u-valentina', nombre: 'Persona', rol: estado.rol, avatarIniciales: 'PE' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
}))
vi.mock('../features/coach/consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, tiene: (c: string) => estado.capacidades.has(c), usuarioId: 'u-valentina' }),
}))
// `EquipoPage` pregunta las capacidades por su cuenta (sin caché): se le contesta lo mismo que al hook.
vi.mock('../data/consola/capacidadesStaff', async (original) => ({
  ...(await original<typeof import('../data/consola/capacidadesStaff')>()),
  capacidadesDe: () => Promise.resolve([...estado.capacidades]),
}))
vi.mock('../components/ui/TopBar', () => ({ TopBar: ({ titulo }: { titulo: string }) => <h1>{titulo}</h1> }))
vi.mock('../features/plan/BannerPlanHoy', () => ({ BannerPlanHoy: () => null }))
vi.mock('../features/bienestar/recordatorio', () => ({ revisarRecordatorioBienestar: () => Promise.resolve() }))
vi.mock('../features/praxis/PraxisCosmos', () => ({ PraxisCosmos: () => <p>Pantalla: Praxis</p> }))

// Las pantallas sin puerta propia: un marcador. Las puertas de arriba (layouts) siguen siendo las reales.
const marcador = (nombre: string) => ({ default: () => <p>Pantalla: {nombre}</p> })
vi.mock('../features/hoy/HoyPage', () => marcador('Hoy'))
vi.mock('../features/entrenar/RutaPage', () => marcador('Entrenar'))
vi.mock('../features/entrenar/SesionPage', () => marcador('Sesión'))
vi.mock('../features/bienestar/BienestarPage', () => marcador('Bienestar'))
vi.mock('../features/semana/SemanaPage', () => marcador('Semana'))
vi.mock('../features/progreso/ProgresoPage', () => marcador('Progreso'))
vi.mock('../features/nutricion/DiarioDia', () => marcador('Diario'))
vi.mock('../features/nutricion/NutricionLayout', async () => {
  const { Outlet } = await import('react-router-dom')
  return { default: () => <Outlet /> }
})
vi.mock('../features/nutricion/MiPlan', () => marcador('Plan de nutrición'))
vi.mock('../features/nutricion/AlDiaEmbarazo', () => marcador('Al día'))
vi.mock('../features/chat/ChatPage', () => marcador('Chat'))
vi.mock('../features/cuestionarios/CuestionariosPage', () => marcador('Cuestionarios'))
vi.mock('../features/contenidos/ContenidosPage', () => marcador('Contenidos'))
vi.mock('../features/logros/LogrosPage', () => marcador('Logros'))
vi.mock('../features/marca/MarcaPage', () => marcador('Marca'))
vi.mock('../features/coach/MiDiaCoachPage', () => marcador('Mi día del coach'))
vi.mock('../features/coach/AsesoradoDetallePage', () => marcador('Asesorado'))
vi.mock('../features/coach/CoachChatPage', () => marcador('Chat del coach'))
vi.mock('../features/coach/ConsultasPage', () => marcador('Consultas'))
vi.mock('../features/coach/consola/ConsolaCoachPage', () => marcador('Consola'))
vi.mock('../features/coach/creadores/CreadoresPage', () => marcador('Creadores'))
vi.mock('../features/coach/administracion/AdministracionPage', () => marcador('Administración'))
vi.mock('../features/coach/administracion/EstrategiasPage', () => marcador('Estrategias'))
vi.mock('../features/aprobacion/RevisionesPage', () => marcador('Revisiones'))
vi.mock('../features/entrenar/encoder/EncoderPage', () => marcador('Encoder'))
vi.mock('../features/equipo/BandejaPage', () => marcador('Bandeja'))
vi.mock('../features/equipo/EmpresaPage', () => marcador('Empresa'))
// Mi entreno, Equipo, Nutrición del equipo, Cifras y Mi plan llevan la puerta DENTRO de la pantalla: se montan
// reales (seed demo) y el test mira dónde acaba la dirección.

const { AppRouter } = await import('./router')

function Sonda({ alCambiar }: { alCambiar: (ruta: string) => void }) {
  const { pathname } = useLocation()
  alCambiar(pathname)
  return null
}

/** Monta el router real en `ruta` y espera a que la dirección y la pantalla dejen de cambiar. */
async function observar(ruta: string): Promise<ResultadoAcceso & { vacia: boolean }> {
  let actual = ruta
  const r = render(
    <MemoryRouter initialEntries={[ruta]}>
      <Sonda alCambiar={(p) => (actual = p)} />
      <AppRouter />
    </MemoryRouter>,
  )
  const huella = () => `${actual}|${document.body.textContent}`
  let ultima = ''
  let estables = 0
  await waitFor(
    () => {
      const ahora = huella()
      estables = ahora === ultima ? estables + 1 : 0
      ultima = ahora
      const cargando = /Cargando…|Comprobando/.test(document.body.textContent ?? '')
      if (cargando || estables < 4) throw new Error(`sin asentar: ${actual}`)
    },
    { interval: 40 },
  )
  const sinPermiso = document.querySelector('[role="alert"]')?.textContent?.includes('Sin permiso') ?? false
  // «En blanco» = la PANTALLA no pinta nada. La cabecera (h1 del TopBar de prueba), la barra y los avisos no cuentan.
  const copia = document.body.cloneNode(true) as HTMLElement
  copia.querySelectorAll('h1, nav, header').forEach((n) => n.remove())
  const vacia = (copia.textContent ?? '').trim() === ''
  r.unmount()
  if (actual !== ruta.split('?')[0]) return { tipo: 'redirige', a: actual, vacia }
  return { tipo: sinPermiso ? 'sin_permiso' : 'entra', vacia }
}

const MANUELA: Capacidad[] = [
  'aprobar_plan_estrategico', 'aprobar_primer_plan', 'decisiones_compartidas', 'detener_publicacion',
  'firmar_creadores', 'leer_entrenamiento', 'organizar_plan', 'reportar_riesgo', 'responder_mercadeo',
  'responder_por_asesorado', 'revisar_creadores', 'ver_administracion',
]
const DE_BRYAN: Capacidad[] = ['leer_entrenamiento', 'ver_administracion', 'revisar_creadores', 'responder_mercadeo', 'organizar_plan', 'decisiones_compartidas']

const PERFILES: { nombre: string; rol: Rol; capacidades: Capacidad[] }[] = [
  { nombre: 'asesorado', rol: 'asesorado', capacidades: [] },
  { nombre: 'nutricionista (Manuela)', rol: 'nutricionista', capacidades: MANUELA },
  { nombre: 'nutricionista sin capacidades', rol: 'nutricionista', capacidades: [] },
  { nombre: 'coach', rol: 'coach', capacidades: DE_BRYAN },
  { nombre: 'coach sin capacidades', rol: 'coach', capacidades: [] },
  { nombre: 'cuenta personal de Bryan (puesto_de_coach)', rol: 'asesorado', capacidades: ['puesto_de_coach', ...DE_BRYAN] },
  { nombre: 'cuenta Alpha (solo_tablero)', rol: 'coach', capacidades: ['solo_tablero', 'leer_entrenamiento', 'ver_administracion'] },
]

afterEach(() => {
  estado.rol = 'asesorado'
  estado.capacidades = new Set()
})

describe('puertas por rol: el router real contra la tabla de rutas.ts', () => {
  const montables = RUTAS.filter((r) => r.guarda.marco !== 'publica')
  for (const perfil of PERFILES) {
    describe(perfil.nombre, () => {
      const acceso: PerfilAcceso = { rol: perfil.rol, capacidades: new Set(perfil.capacidades) }
      it.each(montables.map((r) => [r.patron, r] as const))('%s', async (_patron, ruta) => {
        estado.rol = perfil.rol
        estado.capacidades = new Set(perfil.capacidades)
        const visto = await observar(ruta.ejemplo)
        const esperado = resolverAcceso(ruta, acceso)
        const { vacia, ...resultado } = visto
        expect(resultado).toEqual(esperado)
        // Nunca en blanco, ni entrando ni redirigiendo.
        expect(vacia).toBe(false)
      })
    })
  }
})

describe('lo que prometen los avisos y los scripts llega a una pantalla', () => {
  // Quién recibe cada aviso: Manuela abre /mi-plan, Bryan (sus dos cuentas) /coach/mi-plan y /coach/revisiones.
  const RECEPTORES: Record<string, string[]> = {
    '/mi-plan': ['nutricionista (Manuela)'],
    '/coach/mi-plan': ['coach', 'cuenta personal de Bryan (puesto_de_coach)'],
    '/coach/revisiones': ['coach', 'cuenta personal de Bryan (puesto_de_coach)'],
    // El recordatorio del check-in de las 6 pm (avisos-plan): lo recibe quien hace check-in, o sea todo el que no es rol coach.
    '/bienestar': ['asesorado', 'nutricionista (Manuela)', 'cuenta personal de Bryan (puesto_de_coach)'],
  }
  const citas = [...new Map(citasDeAvisosYScripts().map((c) => [c.ruta, c])).values()]

  it.each(citas.map((c) => [c.ruta, c] as const))('%s: entra, no se queda en blanco', async (ruta) => {
    const quienes = RECEPTORES[ruta]
    expect(quienes, `¿quién recibe el aviso a ${ruta}?`).toBeDefined()
    for (const nombre of quienes) {
      const perfil = PERFILES.find((p) => p.nombre === nombre)!
      estado.rol = perfil.rol
      estado.capacidades = new Set(perfil.capacidades)
      const visto = await observar(ruta)
      expect(visto, `${nombre} en ${ruta}`).toEqual({ tipo: 'entra', vacia: false })
    }
  })

  it('toda ruta de la tabla la abre al menos un tipo de cuenta (ninguna es un callejón)', () => {
    for (const ruta of RUTAS.filter((r) => r.guarda.marco !== 'publica' && !r.guarda.redirigeA)) {
      const entran = PERFILES.filter((p) => resolverAcceso(ruta, { rol: p.rol, capacidades: new Set(p.capacidades) }).tipo === 'entra')
      expect(entran.length, ruta.patron).toBeGreaterThan(0)
    }
  })
})

describe('direcciones que no existen', () => {
  it.each(PERFILES.map((p) => [p.nombre, p] as const))('%s ve «Esta página no existe», no un blanco', async (_n, perfil) => {
    estado.rol = perfil.rol
    estado.capacidades = new Set(perfil.capacidades)
    for (const direccion of ['/esta-pagina-no-existe', '/coach/inventada', '/entrenar/algo/que/no/hay']) {
      const r = render(
        <MemoryRouter initialEntries={[direccion]}>
          <AppRouter />
        </MemoryRouter>,
      )
      expect(await screen.findByRole('heading', { name: 'Esta página no existe' }), direccion).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ir a Hoy' })).toBeInTheDocument()
      r.unmount()
    }
  })
})

describe('Praxis por puesto (decisión de Bryan, 23-oct-2026)', () => {
  const PRAXIS = ['/praxis', '/praxis/ejemplo', '/praxis/ingreso-prueba']
  it.each(PRAXIS)('%s: la cuenta personal de Bryan entra y el asesorado sigue sin entrar', async (direccion) => {
    const personal = PERFILES.find((p) => p.nombre.startsWith('cuenta personal'))!
    estado.rol = personal.rol
    estado.capacidades = new Set(personal.capacidades)
    expect(await observar(direccion)).toEqual({ tipo: 'entra', vacia: false })
    estado.rol = 'asesorado'
    estado.capacidades = new Set()
    expect(await observar(direccion)).toMatchObject({ tipo: 'redirige', a: '/' })
  })
})
