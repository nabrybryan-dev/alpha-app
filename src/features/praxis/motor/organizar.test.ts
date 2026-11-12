import { describe, expect, it, vi } from 'vitest'
import type { EstadoDeOrganizacion } from '../../../app/organizacionPraxis'
import type { PerfilAcceso } from '../../../app/rutas'
import type { LoQuePraxisVe } from '../../../domain/praxis/plan/listaBlanca'
import { PRAXIS_ORGANIZAR_NAVEGAR_Y_SALUDO_LOCAL } from '../../../domain/praxis/rapidezLocal'
import { decidirTurnoConCharla, type ContextoDeCharla } from './charla'
import type { ConexionPraxis } from './conexion'
import { decidirOrganizarONavegar } from './organizar'

/** Frases inventadas; ninguna es de una persona real. */
const ve: LoQuePraxisVe = { activo: null, cerrados: [], perfil: null, checkins: [], adherencias: [], hidratacionHoyMl: 0, aguaHoy: null, checkinHoy: null, adherenciaSemana: null, comida: null, falta: ['plan_activo'] }
const HOY = '2026-10-01'
const ctx: ContextoDeCharla = { trato: 'tu', hora: 9, esperaAnimo: false, yaHablo: false }
const perfil: PerfilAcceso = { rol: 'asesorado', capacidades: new Set() }
const libre: EstadoDeOrganizacion = { ocultas: new Set(), hayCambiosParaDeshacer: false }

function conexionCon(consultar = vi.fn(async () => null), navegar = vi.fn()) {
  const c = { organizar: { perfil, estado: () => libre, consultar, navegar } } as unknown as ConexionPraxis
  return { c, consultar, navegar }
}

/** Riesgo y salud, con «hola», con órdenes de organizar y de ir a lo de hoy pegadas: nada de eso puede organizar, navegar ni saludar. */
const FRASES_DE_RIESGO = [
  'hola ya no quiero vivir',
  'hola, me quiero morir',
  'oculta lo de mi rodilla que me duele',
  'muéstrame lo de hoy, no aguanto más y quiero hacerme daño',
  'ábreme Nutrición, ya no quiero seguir viviendo',
  'qué tal, ya no quiero seguir aquí, quiero desaparecer',
  'oculta el agua, me duele el pecho',
  'llévame a hoy, tengo un dolor fuerte en el hombro',
  'hola, me mareo mucho al entrenar',
  'pon el agua arriba, no quiero vivir más',
]

describe('el filtro de riesgo va SIEMPRE antes (bandera encendida)', () => {
  it.each(FRASES_DE_RIESGO)('«%s» no saluda, no organiza y no navega', async (frase) => {
    const turno = decidirTurnoConCharla(frase, ve, HOY, ctx, undefined, true)
    expect(['quieta', 'cuidado', 'salud']).toContain(turno.paso)
    const { c, consultar, navegar } = conexionCon()
    expect(await decidirOrganizarONavegar(frase, 'registrar', c)).toBeNull()
    expect(consultar).not.toHaveBeenCalled()
    expect(navegar).not.toHaveBeenCalled()
  })
})

describe('saludo local', () => {
  it('encendido: «hola» y «¿cómo estás?» se contestan con el libreto local, sin modelo', () => {
    for (const frase of ['hola', '¿cómo estás?']) {
      const t = decidirTurnoConCharla(frase, ve, HOY, ctx, undefined, true)
      expect(t.paso).toBe('charla')
      expect(t.vaAlModelo).toBe(false)
    }
  })

  it('apagado: sigue yendo al modelo como hasta hoy (no cambia el comportamiento)', () => {
    for (const frase of ['hola', '¿cómo estás?']) {
      const t = decidirTurnoConCharla(frase, ve, HOY, ctx, undefined, false)
      expect(t.paso).toBe('charlaModelo')
      expect(t.vaAlModelo).toBe(true)
    }
  })

  it('la bandera real nace apagada y por omisión no cambia nada', () => {
    expect(PRAXIS_ORGANIZAR_NAVEGAR_Y_SALUDO_LOCAL).toBe(false)
    expect(decidirTurnoConCharla('hola', ve, HOY, ctx).paso).toBe('charlaModelo')
  })
})

describe('organizar y navegar', () => {
  it('sin `organizar` en la conexión (bandera apagada) no hace nada', async () => {
    const c = {} as ConexionPraxis
    expect(await decidirOrganizarONavegar('muéstrame el agua', 'registrar', c)).toBeNull()
  })

  it('una orden que la gramática entiende devuelve la decisión, sin consultar al modelo', async () => {
    const { c, consultar } = conexionCon()
    const r = await decidirOrganizarONavegar('muéstrame el agua', 'registrar', c)
    expect(r?.paso).toBe('organiza')
    expect(consultar).not.toHaveBeenCalled()
  })

  it('una frase que no es de organizar consulta al modelo solo si iba a un modelo; en el plan no', async () => {
    const a = conexionCon()
    expect(await decidirOrganizarONavegar('cuántas series me faltan', 'plan', a.c)).toBeNull()
    expect(a.consultar).not.toHaveBeenCalled()
    const b = conexionCon()
    expect(await decidirOrganizarONavegar('tomé dos vasos de agua', 'registrar', b.c)).toBeNull()
    expect(b.consultar).toHaveBeenCalledTimes(1)
  })

  it('una orden corta de ir a lo de hoy navega; un registro con «hoy» no', async () => {
    const a = conexionCon()
    const r = await decidirOrganizarONavegar('me toca', 'registrar', a.c)
    expect(r?.paso).toBe('navega')
    expect(a.navegar).toHaveBeenCalledWith('/')
    const b = conexionCon()
    expect(await decidirOrganizarONavegar('hice 3 series de sentadilla hoy', 'registrar', b.c)).toBeNull()
    expect(b.navegar).not.toHaveBeenCalled()
  })

  it('si el modelo falla, la conversación sigue su camino', async () => {
    const { c } = conexionCon(vi.fn(async () => { throw new Error('red') }))
    expect(await decidirOrganizarONavegar('tomé dos vasos de agua', 'registrar', c)).toBeNull()
  })
})
