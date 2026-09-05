import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { RotuloEnTrazo } from './RotuloEnTrazo'
import { cuerpoDelRotulo, lineasDelRotulo } from './rotuloDelMuro'

/**
 * EL RÓTULO DEL MURO, PROBADO.
 *
 * Dos cosas que solo se ven en la pantalla y sí se pueden comprobar aquí: que el nombre se
 * parte donde tiene que partirse, y que el cuerpo de letra se ACOTA —que es lo que impide
 * que «Peso muerto rumano a una pierna» se salga del cuadro y que «Remo» se coma el muro—.
 *
 * Lo que NO prueba esto: cómo se ve. Eso lo dice `testigo/cuadros-en-pantalla.mjs`, que
 * mide píxeles en un Chrome de verdad. Un rótulo con el cuerpo correcto puede seguir
 * cayendo encima del marcador.
 */

describe('lineasDelRotulo', () => {
  it('una palabra, una línea', () => {
    expect(lineasDelRotulo('Sentadilla')).toEqual(['SENTADILLA'])
  })

  it('dos palabras, una en cada línea', () => {
    expect(lineasDelRotulo('Peso muerto')).toEqual(['PESO', 'MUERTO'])
  })

  it('de tres en adelante: el gesto arriba y el matiz abajo', () => {
    // Así se nombra en una pizarra de gimnasio: la primera línea es el ejercicio y la
    // segunda el detalle.
    expect(lineasDelRotulo('Press de banca con barra')).toEqual(['PRESS DE', 'BANCA CON BARRA'])
    expect(lineasDelRotulo('Peso muerto rumano')).toEqual(['PESO MUERTO', 'RUMANO'])
  })

  it('aguanta espacios de más y un nombre vacío', () => {
    expect(lineasDelRotulo('  Remo   con  barra ')).toEqual(['REMO CON', 'BARRA'])
    expect(lineasDelRotulo('   ')).toEqual([])
  })
})

describe('cuerpoDelRotulo', () => {
  it('cuanto más larga es la línea, más pequeña la letra', () => {
    const corto = cuerpoDelRotulo(['REMO'])
    const largo = cuerpoDelRotulo(['SENTADILLA BÚLGARA'])
    expect(largo).toBeLessThan(corto)
  })

  it('no baja del suelo de legibilidad ni pasa del techo del muro', () => {
    // El nombre más largo imaginable no puede dejar la letra en una mancha…
    expect(cuerpoDelRotulo(['ELEVACIONES LATERALES CON MANCUERNA SENTADO'])).toBeGreaterThanOrEqual(1.37)
    // …ni el más corto comerse el cuadro entero.
    expect(cuerpoDelRotulo(['A'])).toBeLessThanOrEqual(3.77)
  })

  it('dos líneas no pueden ocupar el doble: el rótulo tiene un alto', () => {
    // «PESO MUERTO» son dos palabras CORTAS, así que por ancho le tocaría 2,68 em y en
    // dos líneas se saldría del cuadro del muro —que promete 0,85 m y de ahí sale a qué
    // altura cuelga—. El cálculo seguiría diciendo que cabe: el tope declarado solo lo
    // mide el testigo, y solo con el ejercicio que tenga delante ese día.
    // Por ancho le tocarían 2,68 em; el presupuesto de alto lo baja a 1,95.
    expect(cuerpoDelRotulo(['PESO', 'MUERTO'])).toBeCloseTo(1.95, 2)
    // Y el alto total del rótulo no pasa del presupuesto, tenga las líneas que tenga.
    for (const lineas of [['A'], ['PESO', 'MUERTO'], ['PRESS DE', 'BANCA CON BARRA']]) {
      expect(cuerpoDelRotulo(lineas) * lineas.length).toBeLessThanOrEqual(3.9)
    }
  })

  it('manda la línea MÁS LARGA, no la primera ni el total', () => {
    // Partido en dos, lo que decide es la que más ocupa: con la primera mandando,
    // «PRESS DE / BANCA CON BARRA» saldría al cuerpo de «PRESS DE» y la de abajo se saldría.
    expect(cuerpoDelRotulo(['PRESS DE', 'BANCA CON BARRA'])).toBe(cuerpoDelRotulo(['BANCA CON BARRA']))
  })
})

describe('RotuloEnTrazo', () => {
  it('el nombre entero viaja en una etiqueta, no deletreado', () => {
    // Cada letra va en su propio nodo para poder levantarse sola. Sin `aria-label`, un
    // lector de pantalla leería «pe-e-ese-o» en vez de «Peso muerto».
    const { container } = render(<RotuloEnTrazo nombre="Peso muerto" />)
    const rotulo = container.querySelector('[aria-label]')
    expect(rotulo?.getAttribute('aria-label')).toBe('Peso muerto')
  })

  it('cada letra lleva sus dos ecos, que son el canto del rótulo', () => {
    const { container } = render(<RotuloEnTrazo nombre="Remo" />)
    const letras = container.querySelectorAll('.muro-trazo-letra')
    expect(letras).toHaveLength(4)
    for (const letra of Array.from(letras)) {
      expect(letra.querySelectorAll('.muro-trazo-eco')).toHaveLength(2)
    }
  })

  it('los ecos van DENTRO de la letra que se anima, no al lado', () => {
    // La animación de entrada acaba en `transform: none` con `fill-mode: both`. Si el eco
    // fuera hermano y llevara su propio `translateZ`, seguiría vivo; si compartiera nodo
    // con la animación, ésta se lo borraría al terminar y el canto desaparecería sin que
    // nada se pusiera en rojo.
    const { container } = render(<RotuloEnTrazo nombre="Remo" />)
    for (const eco of Array.from(container.querySelectorAll('.muro-trazo-eco'))) {
      expect(eco.parentElement?.className).toContain('muro-trazo-letra')
    }
  })

  it('el retardo corre por todo el rótulo y no se reinicia en cada línea', () => {
    const { container } = render(<RotuloEnTrazo nombre="Peso muerto" />)
    const retardos = Array.from(container.querySelectorAll('.muro-trazo-letra')).map((n) =>
      Number((n as HTMLElement).style.animationDelay.replace('ms', '')),
    )
    // 'PESO' (4) + 'MUERTO' (6) = 10 letras, cada una 26 ms detrás de la anterior.
    expect(retardos).toHaveLength(10)
    expect(retardos[0]).toBe(0)
    expect(retardos[9]).toBe(9 * 26)
    // Estrictamente creciente: si se reiniciara por línea, la quinta volvería a 0.
    expect([...retardos].sort((a, b) => a - b)).toEqual(retardos)
  })
})
