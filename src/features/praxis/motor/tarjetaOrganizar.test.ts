import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PIEZAS_DE_HOY, PIEZAS_DE_OTRAS_PANTALLAS } from '../../../app/catalogoDePiezas'
import { tarjetaDeOrganizacion, type ResultadoDeAplicar } from '../../../app/tarjetaDeOrganizacion'
import type { PerfilAcceso } from '../../../app/rutas'
import { VENTANA_DESHACER_MS } from '../../../domain/praxis/organizacion/textosTarjeta'
import type { ConexionPraxis } from './conexion'

/**
 * La tarjeta de organizar en la pantalla, con la cabecera y la voz simuladas: lo que importa es QUÉ se llama y QUÉ se dice.
 * `montar` guarda la función que pinta; la prueba la llama para obtener los botones y los toca.
 */
const pantalla = vi.hoisted(() => ({ pintar: null as null | (() => (Node | null | false)[] | Node), dichos: [] as string[] }))
vi.mock('./cabecera', () => ({
  montar: (fn: typeof pantalla.pintar) => { pantalla.pintar = fn },
  refrescar: () => {},
  limpiarControles: () => { pantalla.pintar = null },
  enfocarControles: () => {},
}))
vi.mock('./frase', () => ({ decirCorto: (t: string) => { pantalla.dichos.push(t) } }))
vi.mock('./entorno', () => ({ trato: () => 'tu' }))
vi.mock('./sesion', () => ({ S: { tok: 1, quieta: false, get montar() { return pantalla.pintar } }, emitir: vi.fn() }))

const { mostrarPasoDeOrganizar } = await import('./tarjetaOrganizar')

const perfil: PerfilAcceso = { rol: 'asesorado', capacidades: new Set() }
const estado = () => ({ ocultas: new Set<string>(), hayCambiosParaDeshacer: false })
const libre = [...PIEZAS_DE_HOY, ...PIEZAS_DE_OTRAS_PANTALLAS].find((p) => p.nivel === 'libre' && p.tipo === 'tarjeta' && !p.id.endsWith('medidas'))!

function botones(): HTMLButtonElement[] {
  if (!pantalla.pintar) return []
  const nodos = ([] as (Node | null | false)[]).concat(pantalla.pintar()).filter((n): n is HTMLElement => n instanceof HTMLElement)
  return nodos.flatMap((n) => Array.from(n.querySelectorAll('button')))
}
const boton = (k: string) => botones().find((b) => b.getAttribute('data-k') === k)
const esperarMicro = () => new Promise((r) => setTimeout(r, 0))

function conexion(o: Partial<NonNullable<ConexionPraxis['organizar']>> = {}) {
  const navegar = vi.fn()
  const c = { organizar: { perfil, estado, consultar: async () => null, navegar, ...o } } as unknown as ConexionPraxis
  return { c, navegar }
}

async function abrirOcultar(c: ConexionPraxis) {
  const dijo = vi.fn(async () => {})
  await mostrarPasoDeOrganizar({ c, tok: 1, pensando: () => {}, dijo }, tarjetaDeOrganizacion({ tipo: 'propone', accion: 'ocultar', pieza: libre }, { trato: 'tu', perfil, estado: estado() }))
  return dijo
}

beforeEach(() => { pantalla.pintar = null; pantalla.dichos = [] })
afterEach(() => { vi.useRealTimers() })

describe('tarjeta de organizar en la pantalla', () => {
  it('dice la pregunta y enseña «Sí, esconder» y «No, dejarlo» sin aplicar nada', async () => {
    const aplicar = vi.fn(async (): Promise<ResultadoDeAplicar> => 'aplicado')
    const dijo = await abrirOcultar(conexion({ aplicar }).c)
    expect(dijo).toHaveBeenCalledWith(expect.stringContaining('¿Escondo «'), 1)
    expect(botones().map((b) => b.textContent)).toEqual(['Sí, esconder', 'No, dejarlo'])
    expect(aplicar).not.toHaveBeenCalled()
  })

  it('«No, dejarlo» no llama a nada y dice que no cambió nada', async () => {
    const aplicar = vi.fn(async (): Promise<ResultadoDeAplicar> => 'aplicado')
    await abrirOcultar(conexion({ aplicar }).c)
    boton('org-no')!.click()
    await esperarMicro()
    expect(aplicar).not.toHaveBeenCalled()
    expect(pantalla.dichos).toEqual(['Listo, no cambié nada.'])
  })

  it('dos toques en «Sí» mandan UN solo cambio', async () => {
    let soltar: (r: ResultadoDeAplicar) => void = () => {}
    const aplicar = vi.fn((): Promise<ResultadoDeAplicar> => new Promise<ResultadoDeAplicar>((r) => { soltar = r }))
    await abrirOcultar(conexion({ aplicar }).c)
    const si = boton('org-si')!
    si.click(); si.click()
    soltar('aplicado')
    await esperarMicro()
    expect(aplicar).toHaveBeenCalledTimes(1)
  })

  it('sin organización guardada (puerto ausente, hoy) NUNCA dice «Listo»: dice que no pudo y no cambió nada', async () => {
    await abrirOcultar(conexion().c)
    boton('org-si')!.click()
    await esperarMicro()
    expect(pantalla.dichos).toEqual(['No pude hacerlo ahora y no cambié nada.'])
    expect(boton('organizar-reintentar')).toBeDefined()
    expect(pantalla.dichos.join(' ')).not.toMatch(/Listo/)
  })

  it('aplicado: «Listo, lo escondí.» y el «Deshacer» desaparece a los 10-15 s', async () => {
    vi.useFakeTimers()
    const deshacerUltimo = vi.fn(async (): Promise<ResultadoDeAplicar> => 'aplicado')
    await abrirOcultar(conexion({ aplicar: async () => 'aplicado', deshacerUltimo }).c)
    boton('org-si')!.click()
    await vi.advanceTimersByTimeAsync(0)
    expect(pantalla.dichos).toEqual(['Listo, lo escondí.'])
    expect(boton('organizar-deshacer')?.textContent).toBe('Deshacer')
    await vi.advanceTimersByTimeAsync(VENTANA_DESHACER_MS + 10)
    expect(boton('organizar-deshacer')).toBeUndefined()
    expect(deshacerUltimo).not.toHaveBeenCalled()
  })

  it('«Deshacer» dentro de la ventana devuelve el cambio', async () => {
    const deshacerUltimo = vi.fn(async (): Promise<ResultadoDeAplicar> => 'aplicado')
    await abrirOcultar(conexion({ aplicar: async () => 'aplicado', deshacerUltimo }).c)
    boton('org-si')!.click()
    await esperarMicro()
    boton('organizar-deshacer')!.click()
    await esperarMicro()
    expect(deshacerUltimo).toHaveBeenCalledTimes(1)
    expect(pantalla.dichos).toEqual(['Listo, lo escondí.', 'Listo, lo devolví.'])
  })

  it('choque entre aparatos: no toca nada y lo dice', async () => {
    await abrirOcultar(conexion({ aplicar: async () => 'choque' }).c)
    boton('org-si')!.click()
    await esperarMicro()
    expect(pantalla.dichos[0]).toMatch(/cambió en otro aparato, así que no toqué nada/)
  })

  it('«traer» de la gramática abre la pantalla sin tarjeta', async () => {
    const { c, navegar } = conexion()
    const dijo = vi.fn(async () => {})
    await mostrarPasoDeOrganizar({ c, tok: 1, pensando: () => {}, dijo }, { tipo: 'abrir', pieza: libre })
    expect(navegar).toHaveBeenCalledWith(libre.pantalla)
    expect(pantalla.pintar).toBeNull()
  })
})
