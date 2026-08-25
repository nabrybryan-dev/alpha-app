import { describe, expect, it } from 'vitest'
import {
  aCsv,
  comparablesPorHora,
  criteriosDeLaTanda,
  franjaDe,
  gravedadAprobada,
  mediana,
  pvDeReferencia,
  type Medicion,
} from './tanda'

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

describe('gravedadAprobada', () => {
  const caida = (errorPct?: number): Medicion =>
    serie({ modo: 'gravedad', errorPct, calidad: 'buena', repsDetectadas: 0 })

  it('sin ninguna caida no hay nada que respalde la escala', () => {
    expect(gravedadAprobada([serie()])).toBe(false)
  })

  it('una caida que no aprueba no cuenta', () => {
    expect(gravedadAprobada([caida(6.4)])).toBe(false)
  })

  it('una caida dentro del 2 % valida el montaje', () => {
    expect(gravedadAprobada([serie(), caida(1.3)])).toBe(true)
  })

  it('una caida sin error medido no vale como aprobada', () => {
    // Un `undefined` es «no se midio», y darlo por bueno apagaria el aviso del
    // disco con nada detras — que es peor que no tener aviso.
    expect(gravedadAprobada([caida(undefined)])).toBe(false)
  })

  it('el 2 % es el mismo umbral que el criterio de la tanda', () => {
    // Dos numeros distintos para la misma pregunta acabarian diciendo cosas
    // distintas: el criterio en verde y el aviso encendido, o al reves.
    const filas = [caida(1.9)]
    expect(gravedadAprobada(filas)).toBe(true)
    expect(criterio(filas, 'Prueba de gravedad').cumple).toBe(true)
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

describe('la hora del dia', () => {
  // La fuerza sube de la manana a la tarde por mecanismos del propio musculo
  // (Douglas 2021). El motor dispara una decision cuando la velocidad cae mas de
  // un 5-6 % entre semanas, y la hora mueve del orden del 10 %: cambiar de franja
  // puede fabricar esa caida o tapar una real.

  it('coloca cada toma en la franja del metaanalisis', () => {
    expect(franjaDe('2026-08-25T08:30:00')).toBe('manana')
    expect(franjaDe('2026-08-25T18:00:00')).toBe('tarde')
    expect(franjaDe('2026-08-25T13:00:00')).toBe('intermedia')
  })

  it('los bordes son los publicados, no una particion del dia', () => {
    // 7-10 y 16-20. Las 10:00 y las 20:00 ya estan fuera.
    expect(franjaDe('2026-08-25T07:00:00')).toBe('manana')
    expect(franjaDe('2026-08-25T10:00:00')).toBe('intermedia')
    expect(franjaDe('2026-08-25T16:00:00')).toBe('tarde')
    expect(franjaDe('2026-08-25T20:00:00')).toBe('intermedia')
  })

  it('una fecha que no se puede leer no se inventa una franja', () => {
    expect(franjaDe('no es una fecha')).toBeUndefined()
  })

  it('manana contra tarde NO son comparables, y lo dice', () => {
    const r = comparablesPorHora('2026-08-25T08:00:00', '2026-09-01T18:00:00')
    expect(r.comparables).toBe(false)
    expect(r.horasDeDiferencia).toBe(10)
    expect(r.aviso).toContain('mañana')
  })

  it('una semana de diferencia A LA MISMA HORA es perfectamente comparable', () => {
    // Lo que importa es la hora del dia, no el tiempo transcurrido. Este es el
    // caso normal del PANEL: el mismo ejercicio, siete dias despues.
    const r = comparablesPorHora('2026-08-25T18:00:00', '2026-09-01T18:00:00')
    expect(r.comparables).toBe(true)
    expect(r.horasDeDiferencia).toBe(0)
    expect(r.aviso).toBeUndefined()
  })

  it('la distancia horaria da la vuelta por medianoche', () => {
    // 23:00 y 01:00 estan a dos horas, no a veintidos.
    expect(comparablesPorHora('2026-08-25T23:00:00', '2026-08-26T01:00:00').horasDeDiferencia).toBe(2)
  })

  it('mucha diferencia dentro de la zona intermedia avisa pero NO invalida', () => {
    // No hay evidencia de que 11:00 y 15:00 se comporten distinto: se dice, y ya.
    const r = comparablesPorHora('2026-08-25T11:00:00', '2026-08-26T15:00:00')
    expect(r.comparables).toBe(true)
    expect(r.aviso).toContain('misma hora')
  })

  it('sin fecha utilizable no bloquea la comparacion', () => {
    // Callarse aqui seria peor: la tanda historica puede traer fechas raras y
    // no se puede dejar de comparar por eso.
    expect(comparablesPorHora('vacio', '2026-08-25T18:00:00').comparables).toBe(true)
  })
})
