import { describe, expect, it } from 'vitest'

import {
  SEMANAS_LIMPIAS,
  MINIMO_POR_SEMANA,
  puedeSalirSola,
  veredictoDeLaPuerta,
  type SemanaDeFirma,
} from './puerta'

/**
 * LO QUE ESTA PUERTA DEJA SALIR NO ES UN PÁRRAFO.
 *
 * Desde el 2026-09-10 son veintitrés vídeos por semana con la cara y la voz clonadas de
 * Bryan. Así que estas pruebas no defienden una regla de producto: defienden que **nadie
 * abra esa puerta por accidente**, y por eso las tres que más importan son las que
 * comprueban que NO se abre — con semanas vacías, con borradores sin mirar y con un
 * historial que fue bueno hace meses.
 */

/** Una semana normal: seis borradores, los seis mirados, ninguno corregido. */
const limpio = (fecha: string, borradores = MINIMO_POR_SEMANA + 1): SemanaDeFirma => ({
  fecha,
  borradores,
  aprobadosSinTocar: borradores,
  corregidos: 0,
})

const conCorreccion = (fecha: string): SemanaDeFirma => ({
  fecha,
  borradores: 6,
  aprobadosSinTocar: 5,
  corregidos: 1,
})

describe('el contrato del encargo', () => {
  it('tres semanas limpias NO abren la puerta', () => {
    const tres = [limpio('2026-08-16'), limpio('2026-08-23'), limpio('2026-08-30')]
    expect(puedeSalirSola(tres)).toBe(false)
    expect(veredictoDeLaPuerta(tres)).toEqual({
      abierta: false,
      motivo: 'faltan-semanas',
      semanasLimpias: 3,
    })
  })

  it('cuatro semanas limpias SÍ la abren', () => {
    const cuatro = [limpio('2026-08-16'), limpio('2026-08-23'), limpio('2026-08-30'), limpio('2026-09-06')]
    expect(puedeSalirSola(cuatro)).toBe(true)
    expect(veredictoDeLaPuerta(cuatro)).toEqual({ abierta: true, desde: '2026-09-06' })
  })

  it('cuatro con una corrección en medio NO la abren', () => {
    const conFallo = [limpio('2026-08-16'), conCorreccion('2026-08-23'), limpio('2026-08-30'), limpio('2026-09-06')]
    expect(puedeSalirSola(conFallo)).toBe(false)
    expect(veredictoDeLaPuerta(conFallo)).toMatchObject({ abierta: false, motivo: 'hubo-correccion' })
  })
})

describe('lo que no se puede colar por la puerta', () => {
  it('una semana SIN borradores no es una semana limpia', () => {
    // «No corrigió nada» es cierto también cuando no hubo nada que corregir. Cuatro
    // semanas vacías abrirían la puerta con cero evidencia, que es el fallo que más
    // barato sale: basta un mes flojo.
    const vacios = ['2026-08-16', '2026-08-23', '2026-08-30', '2026-09-06'].map((f) => ({
      fecha: f,
      borradores: 0,
      aprobadosSinTocar: 0,
      corregidos: 0,
    }))
    expect(puedeSalirSola(vacios)).toBe(false)
    expect(veredictoDeLaPuerta(vacios)).toMatchObject({ motivo: 'semana-floja' })
  })

  it('una semana con muy pocos borradores tampoco cuenta', () => {
    const flojo: SemanaDeFirma = {
      fecha: '2026-09-06',
      borradores: MINIMO_POR_SEMANA - 1,
      aprobadosSinTocar: MINIMO_POR_SEMANA - 1,
      corregidos: 0,
    }
    const tresBuenosYUnoFlojo = [limpio('2026-08-16'), limpio('2026-08-23'), limpio('2026-08-30'), flojo]
    expect(puedeSalirSola(tresBuenosYUnoFlojo)).toBe(false)
  })

  it('LO QUE NADIE MIRÓ NO ESTÁ APROBADO', () => {
    // Un borrador que se quedó en la bandeja sin abrir no dice que estuviera bien: dice que
    // no se supo. Contarlo como aprobación es cómo se abre esta puerta por cansancio.
    const sinMirar: SemanaDeFirma = {
      fecha: '2026-09-06',
      borradores: 23,
      aprobadosSinTocar: 17,
      corregidos: 0,
    }
    const historial = [limpio('2026-08-16'), limpio('2026-08-23'), limpio('2026-08-30'), sinMirar]
    expect(puedeSalirSola(historial)).toBe(false)
    expect(veredictoDeLaPuerta(historial)).toMatchObject({ motivo: 'quedaron-sin-mirar' })
  })

  it('sin historial, cerrada', () => {
    expect(puedeSalirSola([])).toBe(false)
    expect(veredictoDeLaPuerta([])).toMatchObject({ motivo: 'sin-historial' })
  })
})

describe('la racha que cuenta es la que llega hasta hoy', () => {
  it('cuatro limpios de hace meses no abren nada si luego corrigió', () => {
    const historial = [
      limpio('2026-05-03'), limpio('2026-05-10'), limpio('2026-05-17'), limpio('2026-05-24'),
      conCorreccion('2026-08-30'),
    ]
    expect(puedeSalirSola(historial)).toBe(false)
  })

  it('y una corrección vieja no cierra una racha nueva de cuatro', () => {
    const historial = [
      conCorreccion('2026-07-05'),
      limpio('2026-08-16'), limpio('2026-08-23'), limpio('2026-08-30'), limpio('2026-09-06'),
    ]
    expect(puedeSalirSola(historial)).toBe(true)
  })

  it('con más de cuatro seguidos dice la semana en que SE ABRIÓ, no el último', () => {
    // Seis limpios: se abrió en el cuarto (23 de agosto) y sigue abierta. Decir «09-06» la
    // rejuvenecería cada semana; decir «08-02» la abriría tres semanas antes de ganársela.
    // Con cuatro semanas justas las tres versiones dan lo mismo, así que hace falta seis.
    const seis = ['2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30', '2026-09-06'].map((f) => limpio(f))
    expect(veredictoDeLaPuerta(seis)).toEqual({ abierta: true, desde: '2026-08-23' })
  })
})

describe('las constantes son las del diseño', () => {
  it('cuatro semanas, y el suelo de una semana que informa', () => {
    expect(SEMANAS_LIMPIAS).toBe(4)
    expect(MINIMO_POR_SEMANA).toBeGreaterThan(1)
  })
})
