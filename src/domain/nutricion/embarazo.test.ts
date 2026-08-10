import { describe, expect, it } from 'vitest'
import {
  PALABRAS_CONTRAINDICADAS,
  condicionesDeclaradas,
  enLactancia,
  estaEmbarazada,
  seContraindica,
} from './embarazo'

const HOY = '2026-08-09'

describe('la lactancia es su propia condición', () => {
  it('quien contestó lactancia está en lactancia y no embarazada', () => {
    expect(enLactancia({ embarazo: 'lactancia' })).toBe(true)
    expect(estaEmbarazada({ embarazo: 'lactancia' }, HOY)).toBe(false)
  })

  it('NO CADUCA SOLA, y es la diferencia con el embarazo', () => {
    // Un embarazo tiene final probable; una lactancia dura lo que la madre
    // decida. Inventarle un vencimiento sería decidir por ella. Lo que la
    // refresca es la pregunta que vuelve cada quince días.
    expect(enLactancia({ embarazo: 'lactancia', fechaProbableParto: '2020-01-01' })).toBe(true)
  })

  it('las dos condiciones bajan el umbral, y solo el embarazo veta el hígado', () => {
    // Comparten pregunta porque para ella es una sola conversación. Se separan
    // aquí porque nadie le prohíbe el hígado a quien amamanta.
    expect([...condicionesDeclaradas({ embarazo: 'lactancia' }, HOY)]).toEqual(['lactancia'])
    expect([...condicionesDeclaradas({ embarazo: 'si' }, HOY)]).toEqual(['embarazo'])
  })

  it('quien no contestó no declara ninguna condición', () => {
    expect(condicionesDeclaradas({}, HOY).size).toBe(0)
    expect(condicionesDeclaradas({ embarazo: 'prefiere_no_decir' }, HOY).size).toBe(0)
  })

  it('un embarazo caducado deja de declararse', () => {
    const caducado = { embarazo: 'si', fechaProbableParto: '2026-01-01' }
    expect(condicionesDeclaradas(caducado, HOY).size).toBe(0)
  })
})

describe('estaEmbarazada', () => {
  it('quien no contestó no está embarazada', () => {
    expect(estaEmbarazada({}, HOY)).toBe(false)
  })

  it('quien contestó que no, no lo está', () => {
    expect(estaEmbarazada({ embarazo: 'no' }, HOY)).toBe(false)
  })

  it('quien contestó que sí y su fecha no ha pasado, lo está', () => {
    expect(estaEmbarazada({ embarazo: 'si', fechaProbableParto: '2026-12-01' }, HOY)).toBe(true)
  })

  it('LA MARCA CADUCA SOLA pasada la fecha probable de parto', () => {
    // Es el motivo de pedir la fecha. Una marca de embarazo encendida para
    // siempre deja de proteger y empieza a estorbar: le esconde el hígado a
    // alguien que parió hace dos años y nadie se acuerda de apagarla.
    expect(estaEmbarazada({ embarazo: 'si', fechaProbableParto: '2026-07-01' }, HOY)).toBe(false)
  })

  it('el mismo día de la fecha probable todavía cuenta', () => {
    // Parir el día exacto de la fecha probable es lo menos frecuente que hay.
    // Ante la duda se protege: el margen se gasta a favor de la asesorada.
    expect(estaEmbarazada({ embarazo: 'si', fechaProbableParto: HOY }, HOY)).toBe(true)
  })

  it('SIN FECHA, la marca vale', () => {
    // La fecha es opcional. Si contestó que sí y no la puso, se le cree: dar
    // por no embarazada a quien dijo que lo está es el error caro.
    expect(estaEmbarazada({ embarazo: 'si' }, HOY)).toBe(true)
  })

  it('una fecha ilegible no apaga la marca', () => {
    // Mismo criterio: el dato roto no puede quitar una protección.
    expect(estaEmbarazada({ embarazo: 'si', fechaProbableParto: 'cualquier cosa' }, HOY)).toBe(true)
  })

  it('la lactancia NO es embarazo', () => {
    // Comparten pregunta pero no restricción: el retinol es teratógeno para el
    // feto. En lactancia el hígado no está contraindicado.
    expect(estaEmbarazada({ embarazo: 'lactancia' }, HOY)).toBe(false)
  })

  it('quien prefiere no decirlo no se da por embarazada', () => {
    // Suponerlo sería inventarle una condición médica a alguien que
    // explícitamente no la declaró.
    expect(estaEmbarazada({ embarazo: 'prefiere_no_decir' }, HOY)).toBe(false)
  })
})

describe('seContraindica', () => {
  it('el hígado se contraindica', () => {
    expect(seContraindica('Res, hígado, crudo')).toBe(true)
  })

  it('sin tilde también', () => {
    // Los nombres del catálogo no son homogéneos y el buscador ya tolera
    // tildes; esta comprobación no puede ser más estricta que él.
    expect(seContraindica('Cerdo, higado, crudo')).toBe(true)
  })

  it('las menudencias también', () => {
    expect(seContraindica('Menudencias de pollo, crudas')).toBe(true)
  })

  it('un alimento corriente no', () => {
    expect(seContraindica('Arroz blanco enriquecido, cocido')).toBe(false)
  })

  it('NO COMPARA POR TROZOS DE PALABRA', () => {
    // La regla del repo: comparar por palabra entera. Un `includes` haría que
    // "hígado" cazara dentro de cualquier palabra que lo contuviera, y ya nos
    // costó una vez con "lengua" dentro de "Lenguado".
    expect(seContraindica('Deshigadoencebollado')).toBe(false)
  })

  it('la lista de palabras no está vacía', () => {
    // Si alguien la vacía, `seContraindica` devolvería false para todo y el
    // veto dejaría de existir sin que ningún otro test se entere.
    expect(PALABRAS_CONTRAINDICADAS.length).toBeGreaterThan(0)
  })
})
