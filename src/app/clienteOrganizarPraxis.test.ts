import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../domain/types'
import { consultarLecturaDeOrganizacion, decidirConGramaticaYModelo, type ConsultaAlModelo } from './clienteOrganizarPraxis'
import type { EstadoDeOrganizacion } from './organizacionPraxis'
import type { PerfilAcceso } from './rutas'

const ASESORADO: PerfilAcceso = { rol: 'asesorado' as Rol, capacidades: new Set() }
const SIN_NADA: EstadoDeOrganizacion = { ocultas: new Set(), hayCambiosParaDeshacer: false }
const URL = 'https://ejemplo.invalido/functions/v1'

const respuesta = (estado: number, cuerpo: unknown): Response =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } })

const conFetch = (f: typeof fetch) => ({ token: 'tok', urlFunciones: URL, fetch: f, perfil: ASESORADO })

afterEach(() => vi.useRealTimers())

describe('consultarLecturaDeOrganizacion', () => {
  it('manda POST con Bearer y {frase}, y devuelve la lectura válida', async () => {
    const f = vi.fn(async () => respuesta(200, { lectura: { verbo: 'ocultar', pieza: 'nutricion.recetas' } }))
    const r = await consultarLecturaDeOrganizacion('ya no quiero ver las recetas', conFetch(f as unknown as typeof fetch))
    expect(r).toEqual({ verbo: 'ocultar', pieza: 'nutricion.recetas' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${URL}/praxis-organizar`)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string)).toEqual({ frase: 'ya no quiero ver las recetas' })
  })

  it('no llama con frases de salud ni de riesgo', async () => {
    const f = vi.fn()
    const o = conFetch(f as unknown as typeof fetch)
    expect(await consultarLecturaDeOrganizacion('oculta lo de la rodilla que me duele', o)).toBeNull()
    expect(await consultarLecturaDeOrganizacion('ya no quiero vivir esconde todo', o)).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('sin token no llama', async () => {
    const f = vi.fn()
    expect(await consultarLecturaDeOrganizacion('quita las recetas', { ...conFetch(f as unknown as typeof fetch), token: '' })).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it.each([401, 429, 502, 503, 500])('un %i devuelve null sin lanzar', async (estado) => {
    const f = vi.fn(async () => respuesta(estado, { error: 'x' }))
    await expect(consultarLecturaDeOrganizacion('quita las recetas', conFetch(f as unknown as typeof fetch))).resolves.toBeNull()
  })

  it('un fetch que lanza devuelve null', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('sin red')
    })
    await expect(consultarLecturaDeOrganizacion('quita las recetas', conFetch(f as unknown as typeof fetch))).resolves.toBeNull()
  })

  it('salidas raras dan null: no JSON, sin lectura, verbo fuera del menú', async () => {
    const malos: Response[] = [
      new Response('no es json', { status: 200 }),
      respuesta(200, {}),
      respuesta(200, { lectura: null }),
      respuesta(200, { lectura: 'ocultar' }),
      respuesta(200, { lectura: { verbo: 'borrar_todo', pieza: 'nutricion.recetas' } }),
    ]
    for (const m of malos) {
      const f = vi.fn(async () => m)
      expect(await consultarLecturaDeOrganizacion('quita las recetas', conFetch(f as unknown as typeof fetch))).toBeNull()
    }
  })

  it('una pieza inventada da null', async () => {
    const f = vi.fn(async () => respuesta(200, { lectura: { verbo: 'ocultar', pieza: 'pieza.inventada' } }))
    expect(await consultarLecturaDeOrganizacion('quita las recetas', conFetch(f as unknown as typeof fetch))).toBeNull()
  })

  it('un verbo con pieza y la pieza en null da null', async () => {
    const f = vi.fn(async () => respuesta(200, { lectura: { verbo: 'traer', pieza: null } }))
    expect(await consultarLecturaDeOrganizacion('llévame al agua', conFetch(f as unknown as typeof fetch))).toBeNull()
  })

  it('un verbo sin pieza se acepta', async () => {
    const f = vi.fn(async () => respuesta(200, { lectura: { verbo: 'restablecer', pieza: 'lo que sea' } }))
    expect(await consultarLecturaDeOrganizacion('todo como venía', conFetch(f as unknown as typeof fetch))).toEqual({ verbo: 'restablecer', pieza: null })
  })

  it('tiempo máximo de 3 s: devuelve null y aborta aunque el fetch no responda', async () => {
    vi.useFakeTimers()
    let senal: AbortSignal | undefined
    const f = vi.fn((_u: unknown, init?: RequestInit) => {
      senal = init?.signal ?? undefined
      return new Promise<Response>(() => {})
    })
    const p = consultarLecturaDeOrganizacion('quita las recetas', conFetch(f as unknown as typeof fetch))
    await vi.advanceTimersByTimeAsync(2999)
    expect(senal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await expect(p).resolves.toBeNull()
    expect(senal?.aborted).toBe(true)
  })
})

describe('decidirConGramaticaYModelo', () => {
  it('si la gramática ya entendió, no consulta al modelo', async () => {
    const consultar = vi.fn<ConsultaAlModelo>(async () => ({ verbo: 'restablecer', pieza: null }))
    const d = await decidirConGramaticaYModelo('restablece todo', ASESORADO, SIN_NADA, consultar)
    expect(d.tipo).toBe('propone_restablecer')
    expect(consultar).not.toHaveBeenCalled()
  })

  it('con una frase de salud no consulta', async () => {
    const consultar = vi.fn<ConsultaAlModelo>(async () => ({ verbo: 'restablecer', pieza: null }))
    await decidirConGramaticaYModelo('me duele la rodilla y no sé qué hacer', ASESORADO, SIN_NADA, consultar)
    expect(consultar).not.toHaveBeenCalled()
  })

  it('si la gramática no entiende, consulta y aplica los candados; traer lleva confirmar', async () => {
    const consultar = vi.fn<ConsultaAlModelo>(async () => ({ verbo: 'traer', pieza: 'nutricion.agua' }))
    const d = await decidirConGramaticaYModelo('zzz qwerty plim plam', ASESORADO, SIN_NADA, consultar)
    expect(consultar).toHaveBeenCalledTimes(1)
    expect(d).toMatchObject({ tipo: 'traer', confirmar: true })
  })

  it('el modelo no salta los candados: ocultar una pieza fija se rechaza', async () => {
    const consultar: ConsultaAlModelo = async () => ({ verbo: 'ocultar', pieza: 'semana.chat' })
    const d = await decidirConGramaticaYModelo('zzz qwerty plim plam', ASESORADO, SIN_NADA, consultar)
    expect(d).toMatchObject({ tipo: 'rechaza', motivo: 'fija' })
  })

  it('si el modelo devuelve null o lanza, queda la decisión de la gramática', async () => {
    const sola = await decidirConGramaticaYModelo('zzz qwerty plim plam', ASESORADO, SIN_NADA, async () => null)
    expect(sola).toEqual({ tipo: 'no_es_organizacion' })
    const lanza = await decidirConGramaticaYModelo('zzz qwerty plim plam', ASESORADO, SIN_NADA, async () => {
      throw new Error('x')
    })
    expect(lanza).toEqual({ tipo: 'no_es_organizacion' })
  })
})
