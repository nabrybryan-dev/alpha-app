import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { seOcultanLasCifras } from './cifras'

/* La regla en sí es de una línea. Lo que cuesta es que no se olvide en la
 * siguiente pantalla, que es exactamente lo que había pasado: vivía en
 * `ResultadoSerie.tsx` con su test, y la hoja de medición y el laboratorio
 * pintaban `vPrimera` y `pvPct` sin mirar el nivel. */

describe('qué veredicto permite enseñar cifras', () => {
  it('descartada no', () => {
    // No significa «poco fiable»: significa que el número que salió es falso.
    expect(seOcultanLasCifras('descartada')).toBe(true)
  })

  it('dudosa sí, porque ahí el número existe', () => {
    // Una escala que dispersa deja el número en pie con un error mayor; se
    // enseña con su ±, no se esconde. Esconderlo sería el error contrario.
    expect(seOcultanLasCifras('dudosa')).toBe(false)
  })

  it('buena sí, obviamente', () => {
    expect(seOcultanLasCifras('buena')).toBe(false)
  })
})

describe('las tres vistas la consultan, ninguna la reimplementa', () => {
  const AQUI = join(process.cwd(), 'src/features/entrenar/encoder')
  const leer = (f: string) => readFileSync(join(AQUI, f), 'utf8')

  it('el laboratorio consulta la regla antes de pintar velocidades', () => {
    // Es un test de estructura y no de render a propósito: montar el laboratorio
    // con un resultado descartado pide una cámara que jsdom no tiene, y la
    // pregunta que importa —¿mira alguien el nivel antes de pintar?— se contesta
    // igual de bien aquí y no se cae por otra razón.
    const src = leer('EncoderPage.tsx')
    expect(src).toContain('seOcultanLasCifras')
    expect(src).toContain('vPrimera.toFixed')
  })

  it('y la hoja de medición no la necesita porque ya no pinta velocidades', () => {
    // Delega en `ResultadoSerie`, que es donde vive la regla con sus tests. Lo
    // que este test protege es que no vuelva a pintarlas por su cuenta: si
    // alguien reintroduce un `vPrimera.toFixed` ahí, tiene que consultar la
    // regla como hacen las demás.
    const src = leer('HojaMedicion.tsx')
    const pintaVelocidades = src.includes('vPrimera.toFixed') || src.includes('pvPct.toFixed')
    expect(pintaVelocidades ? src.includes('seOcultanLasCifras') : true).toBe(true)
    expect(src).toContain('ResultadoSerie')
  })

  it('y nadie compara con la cadena suelta por su cuenta', () => {
    // Si alguien escribe `nivel === 'descartada'` en una pantalla, la regla ya
    // está en dos sitios y el día que cambie solo cambiará en uno.
    for (const archivo of ['HojaMedicion.tsx', 'EncoderPage.tsx', 'ResultadoSerie.tsx']) {
      const src = leer(archivo)
      const sueltas = src.match(/nivel\s*===\s*'descartada'/g) ?? []
      expect(sueltas, `${archivo} compara el nivel a mano`).toHaveLength(0)
    }
  })
})
