import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PIEZAS_DE_OTRAS_PANTALLAS } from './catalogoDePiezas'
import { decidirParaPieza } from './organizacionPraxis'

/**
 * Praxis solo puede decir «Listo, lo escondí» si la pantalla de verdad lo esconde. Esta prueba LEE los archivos de
 * cada pantalla: toda pieza que se puede esconder está envuelta en `<PiezaOrganizable id="…">` en su archivo, y
 * ninguna pieza fija o asignada por el coach lo está (no se puede esconder por error lo que cuida a la persona).
 * Las tarjetas de Hoy y las pantallas enteras se vigilan aparte (catalogoDePiezas.test.ts y BottomNav).
 */
const vacio = { ocultas: new Set<string>(), hayCambiosParaDeshacer: false }
const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8')
const envueltasEn = (texto: string) => [...texto.matchAll(/<PiezaOrganizable id="([^"]+)">/g)].map((m) => m[1]!)
/** El archivo de la pantalla, más su `organizables.tsx` al lado si existe (para archivos en el tope de líneas). */
const leerConAlLado = (ruta: string) => {
  const lado = join(dirname(ruta), 'organizables.tsx')
  try { return `${leer(ruta)}\n${leer(lado)}` } catch { return leer(ruta) }
}

const ESCONDIBLES = PIEZAS_DE_OTRAS_PANTALLAS.filter((p) => decidirParaPieza('ocultar', p, vacio).tipo === 'propone')
const FUENTES = [...new Set(PIEZAS_DE_OTRAS_PANTALLAS.map((p) => p.fuente!).filter(Boolean))]

describe('las pantallas obedecen lo que se esconde hablando', () => {
  it('toda pieza que se puede esconder está envuelta en su archivo', () => {
    expect(ESCONDIBLES.length).toBeGreaterThan(30)
    const faltan = ESCONDIBLES.filter((p) => !envueltasEn(leerConAlLado(p.fuente!)).includes(p.id)).map((p) => p.id)
    expect(faltan, 'piezas escondibles sin <PiezaOrganizable>').toEqual([])
  })

  it('nada envuelto es fijo, asignado ni inventado', () => {
    const permitidas = new Set(ESCONDIBLES.map((p) => p.id))
    const malas = FUENTES.flatMap((f) => envueltasEn(leerConAlLado(f)).filter((id) => !permitidas.has(id)).map((id) => `${f}: ${id}`))
    expect(malas).toEqual([])
  })
})
