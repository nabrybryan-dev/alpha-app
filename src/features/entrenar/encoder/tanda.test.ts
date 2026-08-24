import { describe, expect, it } from 'vitest'
import { aCsv, criteriosDeLaTanda, mediana, pvDeReferencia, type Medicion } from './tanda'

function serie(p: Partial<Medicion> = {}): Medicion {
  return {
    fecha: '2026-08-21T10:00:00Z',
    modo: 'serie',
    ejercicio: 'sentadilla',
    cargaKg: 60,
    repsReales: 5,
    repsDetectadas: 5,
    vPrimera: 1,
    vUltima: 0.7,
    pvPct: 30,
    fpsReal: 58,
    unidad: 'm/s',
    calidad: 'buena',
    motivos: '',
    nota: '',
    ...p,
  }
}

const criterio = (filas: Medicion[], etiqueta: string) =>
  criteriosDeLaTanda(filas).find((c) => c.etiqueta.startsWith(etiqueta))!

describe('pvDeReferencia', () => {
  it('usa la misma formula que el nucleo: (v1 - vultima) / v1', () => {
    expect(pvDeReferencia(1, 0.75)).toBe(25)
  })

  it('sin la segunda velocidad no hay %PV de referencia, y no se inventa', () => {
    expect(pvDeReferencia(1, undefined)).toBeUndefined()
    expect(pvDeReferencia(undefined, 0.75)).toBeUndefined()
  })

  it('una velocidad de cero no da 100 %: da nada', () => {
    // Con v1 = 0 el cociente es infinito. Devolver 100 seria un numero creible
    // salido de una division por cero.
    expect(pvDeReferencia(0, 0.5)).toBeUndefined()
  })
})

describe('mediana', () => {
  it('con un puñado impar, el de en medio', () => {
    expect(mediana([30, 10, 20])).toBe(20)
  })

  it('con par, el promedio de los dos centrales', () => {
    expect(mediana([10, 20, 30, 40])).toBe(25)
  })

  it('resiste el teléfono que suena a mitad de teclear', () => {
    // La media de esto es 30,6 y se saldria del umbral; la mediana es 14.
    expect(mediana([12, 13, 14, 15, 99])).toBe(14)
    expect(mediana([])).toBeUndefined()
  })
})

describe('criterio del %PV', () => {
  it('promedia el VALOR ABSOLUTO: una tanda dispersa pero centrada NO aprueba', () => {
    // +9 y -9 se cancelarian con signo y darian 0,0 (verde). En absoluto son 9.
    const filas = [
      serie({ pvPct: 30, pvRefPct: 21 }),
      serie({ pvPct: 20, pvRefPct: 29 }),
    ]
    const c = criterio(filas, 'Error de %PV')
    expect(c.valor).toBe('9.0')
    expect(c.cumple).toBe(false)
  })

  it('enseña el peor caso al lado, que es lo que la media esconde', () => {
    const filas = [
      serie({ pvPct: 30, pvRefPct: 27 }),
      serie({ pvPct: 20, pvRefPct: 25 }),
    ]
    const c = criterio(filas, 'Error de %PV')
    expect(c.valor).toBe('4.0')
    expect(c.cumple).toBe(true)
    expect(c.detalle).toContain('peor 5.0')
  })

  it('sin la segunda referencia se queda sin contestar, no en verde', () => {
    const c = criterio([serie({ vRef: 1 })], 'Error de %PV')
    expect(c.valor).toBeUndefined()
    expect(c.cumple).toBeUndefined()
    expect(c.detalle).toContain('DOS velocidades')
  })
})

describe('criterios de repeticiones', () => {
  it('el conteo neto es un suelo: perdida y fantasma en la misma serie no se cancelan', () => {
    // 5 reales, 5 detectadas, pero una perdida y una inventada. El neto cuadra.
    // Esta prueba fija que se cuentan por separado, no por diferencia total.
    const filas = [serie({ repsReales: 5, repsDetectadas: 5 })]
    expect(criterio(filas, 'Repeticiones perdidas').valor).toBe('0.0 %')
    expect(criterio(filas, 'Repeticiones fantasma').valor).toBe('0')
  })

  it('una fantasma pone el criterio en rojo, porque no hay umbral: es cero', () => {
    const filas = [serie({ repsReales: 4, repsDetectadas: 5 })]
    expect(criterio(filas, 'Repeticiones fantasma').cumple).toBe(false)
  })

  it('sin reps contadas a mano, los dos se quedan sin contestar', () => {
    const filas = [serie({ repsReales: undefined })]
    expect(criterio(filas, 'Repeticiones fantasma').valor).toBeUndefined()
    expect(criterio(filas, 'Repeticiones perdidas').valor).toBeUndefined()
  })
})

describe('criterio de la escala', () => {
  const escala = (filas: Medicion[]) => criterio(filas, 'Tomas con la escala en duda')

  it('sin ninguna toma juzgable se queda sin contestar', () => {
    // `escalaDudosa` vacio es «no lo se»: sin escala el recorrido esta en
    // pixeles y no hay metros que comparar. Contarlo como buena seria dar por
    // pasada una puerta que no se ha mirado.
    expect(escala([serie({ escalaDudosa: undefined })]).cumple).toBeUndefined()
  })

  it('una sola toma con la escala en duda tumba el criterio', () => {
    const c = escala([serie({ escalaDudosa: false }), serie({ escalaDudosa: true })])
    expect(c.valor).toBe('1')
    expect(c.cumple).toBe(false)
  })

  it('todas juzgadas y ninguna dudosa, pasa', () => {
    const c = escala([serie({ escalaDudosa: false }), serie({ escalaDudosa: false })])
    expect(c.valor).toBe('0')
    expect(c.cumple).toBe(true)
  })
})

describe('criterio de gravedad', () => {
  it('promedia el valor absoluto de las caidas, no el error con signo', () => {
    const caida = (errorPct: number): Medicion =>
      serie({ modo: 'gravedad', errorPct, aceleracion: 9.7, repsReales: undefined })
    // -3 y +3 con signo darian 0 (verde). Son 3 % y no aprueban.
    const c = criterio([caida(-3), caida(3)], 'Prueba de gravedad')
    expect(c.valor).toBe('3.00 %')
    expect(c.cumple).toBe(false)
  })

  it('las caidas no cuentan como series para el criterio de validas', () => {
    const filas = [serie(), serie({ modo: 'gravedad', calidad: 'descartada' })]
    expect(criterio(filas, 'Mediciones válidas').detalle).toBe('1 de 1')
  })
})

describe('criterio de segundos añadidos', () => {
  it('separa el coste de maquina del de teclear', () => {
    const filas = [
      serie({ sAnadidos: 14.2, sMaquina: 3.3 }),
      serie({ sAnadidos: 31.5, sMaquina: 3.1 }),
    ]
    const c = criterio(filas, 'Segundos añadidos')
    expect(c.valor).toBe('22.9 s')
    expect(c.cumple).toBe(false)
    expect(c.detalle).toContain('3.2 s de máquina')
  })
})

describe('aCsv', () => {
  it('lo que no se midio sale vacio, no «undefined»', () => {
    const csv = aCsv([serie({ cargaKg: undefined, vRef: undefined })])
    const fila = csv.split('\n')[1]
    expect(fila).not.toContain('undefined')
    expect(fila.split(',')[3]).toBe('')
  })

  it('entrecomilla las notas con coma, que si no parten la fila', () => {
    const csv = aCsv([serie({ nota: 'fantasma al soltar, luz de frente' })])
    expect(csv).toContain('"fantasma al soltar, luz de frente"')
    expect(csv.split('\n')).toHaveLength(2)
  })

  it('lleva las dos columnas nuevas de la referencia', () => {
    expect(aCsv([]).split(',')).toContain('vRefUltima')
    expect(aCsv([]).split(',')).toContain('pvRefPct')
  })
})
