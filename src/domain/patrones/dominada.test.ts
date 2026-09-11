import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID, patronDeCategoria } from './catalogo'
import { esqueletoEnFase } from './escena'
import { puntoDeHueso } from './esqueleto'
import { modeloDePalanca } from '../biomecanica/palancas'
import { implementosDeEscena } from '../../features/entrenar/escena/implementos'

/**
 * LA DOMINADA A SECAS, 2026-09-06 de noche.
 *
 * La categoría DOMINADA se traducía por alias a TRACCIÓN VERTICAL, que es un jalón SENTADO,
 * así que una dominada heredaba esa postura: la barra fija salía bien y el sujeto no —sentado
 * en el aire, y desde que los `raizInicio` bajaron al suelo, plantado en el suelo agarrado a
 * una barra sobre la cabeza—. La otra sesión lo midió y lo dijo: lo que faltaba era una ficha
 * con el cuerpo COLGANDO, no una pieza.
 *
 * Lo que se clava: que DOMINADA ya no sea un alias del jalón; que por nombre la dominada se
 * separe del jalón dentro de TRACCIÓN VERTICAL, y la asistida de la dominada; que cuelgue de
 * los dedos con las piernas estiradas; y que su escena siga siendo la barra fija, sin mueble.
 */
const patron = PATRON_POR_ID.dominada
const alturaDeLaBarra = patron.alturaApoyo ?? 0

describe('la dominada tiene ficha propia', () => {
  it('DOMINADA ya no es un alias del jalón, y el nombre reparte entre las tres fichas', () => {
    expect(patronDeCategoria('DOMINADA')?.id).toBe('dominada')
    expect(patronDeCategoria('DOMINADA', 'Dominadas asistidas')?.id).toBe('dominada_asistida')
    expect(patronDeCategoria('TRACCIÓN VERTICAL', 'Dominadas')?.id).toBe('dominada')
    expect(patronDeCategoria('TRACCIÓN VERTICAL', 'Pull-up con lastre')?.id).toBe('dominada')
    expect(patronDeCategoria('TRACCIÓN VERTICAL', 'Chin-up')?.id).toBe('dominada')
    expect(patronDeCategoria('TRACCIÓN VERTICAL', 'Dominadas asistidas en máquina')?.id).toBe('dominada_asistida')
    expect(patronDeCategoria('TRACCIÓN VERTICAL', 'Jalón al pecho en polea')?.id).toBe('traccion_vertical')
  })

  it('su mecánica es la de siempre: manos fijas al mundo, línea desde el centro de masas', () => {
    const modelo = modeloDePalanca('DOMINADA')
    expect(modelo?.cadena).toBe('cerrada')
    expect(modelo?.linea.origen).toBe('centro-de-masas')
  })

  it('cuelga de los dedos a la altura de la barra, con las piernas estiradas, en las tres fases', () => {
    for (const fase of [0, 0.5, 1]) {
      const esq = esqueletoEnFase(patron, fase)
      for (const h of ['manoD', 'manoI']) {
        const yDedos = Math.max(...[0, 0.5, 1].map((t) => puntoDeHueso(esq, h, t)[1]))
        expect(Math.abs(yDedos - alturaDeLaBarra), `fase ${fase}: ${h}`).toBeLessThan(0.02)
      }
      // Piernas estiradas: el tobillo cae DEBAJO de la rodilla, no detrás.
      const rodilla = puntoDeHueso(esq, 'tibiaD', 0)
      const tobillo = puntoDeHueso(esq, 'tibiaD', 1)
      expect(rodilla[1] - tobillo[1], `fase ${fase}: la tibia no cuelga`).toBeGreaterThan(0.3)
      expect(Math.abs(rodilla[2] - tobillo[2]), `fase ${fase}: la tibia se va hacia atrás`).toBeLessThan(0.16)
      // Y los pies no tocan el suelo: está colgado, no de pie.
      const pie = puntoDeHueso(esq, 'pieD', 1)
      expect(pie[1], `fase ${fase}: el pie toca el suelo`).toBeGreaterThan(0.1)
    }
  })

  it('el cuerpo sube: la pelvis en el bloqueo está más alta que colgado', () => {
    const abajo = puntoDeHueso(esqueletoEnFase(patron, 0), 'pelvis', 0)[1]
    const arriba = puntoDeHueso(esqueletoEnFase(patron, 1), 'pelvis', 0)[1]
    expect(arriba - abajo).toBeGreaterThan(0.25)
  })

  it('su escena es la barra fija de siempre, sin mueble, se llegue por donde se llegue', () => {
    for (const [categoria, nombre] of [
      ['DOMINADA', ''],
      ['DOMINADA', 'Dominadas'],
      ['TRACCIÓN VERTICAL', 'Pull-up con lastre'],
    ]) {
      const e = implementosDeEscena(categoria, nombre)
      expect(e.piezas.map((p) => p.pieza), `${categoria} · ${nombre}`).toEqual(['barra-fija'])
    }
  })
})
