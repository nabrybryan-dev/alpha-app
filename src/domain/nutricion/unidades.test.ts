import { describe, expect, it } from 'vitest'
import { ACEITE, SAL, gramosDeAceite, gramosDeSal, opciones } from './unidades'

// Bryan descartó la escala poco/normal/bastante: son los dos alimentos más
// densos que existen -8,8 kcal/g y 388 mg de sodio/g- y un adjetivo arrastra
// demasiado error. El asesorado responde en cucharadas y pizcas, y eso se
// convierte aquí.

describe('aceite', () => {
  it('una cucharada son catorce gramos', () => {
    expect(gramosDeAceite('1 cda')).toBe(14.0)
  })

  it('media cucharada es la mitad', () => {
    expect(gramosDeAceite('1/2 cda')).toBe(7.0)
  })

  it('cucharada y media', () => {
    expect(gramosDeAceite('1 1/2 cda')).toBe(21.0)
  })

  it('dos cucharadas', () => {
    expect(gramosDeAceite('2 cda')).toBe(28.0)
  })

  it('tres cucharadas', () => {
    expect(gramosDeAceite('3 cda')).toBe(42.0)
  })

  it('están las cinco opciones del spec', () => {
    expect(new Set(Object.keys(ACEITE))).toEqual(
      new Set(['1/2 cda', '1 cda', '1 1/2 cda', '2 cda', '3 cda']),
    )
  })

  it('las opciones van de menor a mayor', () => {
    const valores = opciones('aceite').map((o) => ACEITE[o])
    expect(valores).toEqual([...valores].sort((a, b) => a - b))
  })

  it('una unidad desconocida no se inventa', () => {
    expect(gramosDeAceite('un chorrito')).toBeNull()
  })

  it('no haber usado aceite es cero, no nulo', () => {
    // Decir "no le puse aceite" es una afirmación, no un hueco.
    expect(gramosDeAceite('nada')).toBe(0.0)
  })
})

describe('sal', () => {
  it('una pizca', () => {
    expect(gramosDeSal('1 pizca')).toBe(0.4)
  })

  it('media cucharadita', () => {
    expect(gramosDeSal('1/2 cdta')).toBe(3.0)
  })

  it('una cucharadita rasa', () => {
    expect(gramosDeSal('1 cdta')).toBe(6.0)
  })

  it('el cubito de caldo está entre las opciones', () => {
    // Bryan los usa, y un cubito son 829 mg de sodio.
    expect('1 cubito' in SAL).toBe(true)
    expect(gramosDeSal('1 cubito')).toBe(4.0)
  })

  it('no haber usado sal es cero', () => {
    expect(gramosDeSal('nada')).toBe(0.0)
  })
})

describe('opciones', () => {
  it('las opciones de sal van de menor a mayor', () => {
    // opciones("aceite") ya se probaba; opciones("sal") nunca se llamaba.
    const valores = opciones('sal').map((o) => SAL[o])
    expect(valores).toEqual([...valores].sort((a, b) => a - b))
  })

  it('un "cual" inválido revienta en vez de reinterpretarse', () => {
    // Antes: "Aceite" (mayúscula) o "aceite " (espacio de más) no coincidían
    // con el literal "aceite" del ternario y caían al else, devolviendo las
    // opciones de SAL en silencio. Ahora tiene que reventar donde está el
    // error, no más adelante.
    expect(() => opciones('Aceite')).toThrow()
    expect(() => opciones('aceite ')).toThrow()
  })
})

describe('normalización de entrada', () => {
  it('no responder da nulo, no revienta', () => {
    // null ("el asesorado no contestó esta pregunta") es un hueco, no una
    // respuesta inválida: no debe reventar ni confundirse con "nada".
    expect(gramosDeAceite(null)).toBeNull()
  })

  it('las mayúsculas no rompen la búsqueda', () => {
    expect(gramosDeAceite('1 CDA')).toBe(14.0)
  })

  it('los espacios sobrantes no rompen la búsqueda', () => {
    expect(gramosDeAceite('  1 cda  ')).toBe(14.0)
  })
})

describe('orden de magnitud', () => {
  it('una cucharada de aceite ronda las 124 kcal', () => {
    // 884 kcal/100 g x 14 g. Si esto cambia, algo se rompió.
    expect((gramosDeAceite('1 cda')! * 884) / 100).toBeCloseTo(124, 0)
  })

  it('una cucharadita de sal pasa el límite diario de sodio', () => {
    // 38.758 mg/100 g x 6 g = 2.325 mg, y el límite son 2.000-2.300.
    expect((gramosDeSal('1 cdta')! * 38758) / 100).toBeGreaterThan(2000)
  })
})
