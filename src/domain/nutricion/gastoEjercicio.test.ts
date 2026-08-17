import { describe, expect, it } from 'vitest'
import {
  FACTOR_KCAL,
  MET_PESAS,
  MINUTOS_SUELO,
  entrenoEseDia,
  entrenosEnVentana,
  gastoEjercicioDiario,
  kcalDeSesion,
  minutosTipicos,
  type DiaDeEntreno,
} from './gastoEjercicio'

const entreno = (fecha: string, minutos: number | null = 60): DiaDeEntreno => ({ fecha, minutos })

describe('kcalDeSesion', () => {
  it('aplica la fórmula de la calculadora del equipo', () => {
    // 0,0175 × 60 kg × 3,5 MET × 60 min = 220,5
    expect(kcalDeSesion(60, 60)).toBe(221)
  })

  it('escala con el peso: mover más cuerpo cuesta más', () => {
    expect(kcalDeSesion(90, 60)).toBeGreaterThan(kcalDeSesion(60, 60) ?? 0)
  })

  it('admite otro MET para lo que no son pesas', () => {
    expect(kcalDeSesion(60, 60, 3)).toBe(189)
  })

  it('las constantes son las de la fuente, no números redondeados a ojo', () => {
    expect(FACTOR_KCAL).toBe(0.0175)
    expect(MET_PESAS).toBe(3.5)
  })

  describe('cuando el dato no da', () => {
    // Sin peso no hay fórmula. Devolver un número aquí sería inventarlo, y el
    // mismo criterio que en `grasaPct`: un cero se lee como "no gastó nada".
    it('sin peso devuelve null, no cero', () => {
      expect(kcalDeSesion(null, 60)).toBeNull()
    })

    it('con minutos no finitos devuelve null', () => {
      expect(kcalDeSesion(60, Number.NaN)).toBeNull()
    })

    it('con minutos negativos devuelve null: no existe entrenar en negativo', () => {
      expect(kcalDeSesion(60, -30)).toBeNull()
    })
  })
})

describe('minutosTipicos', () => {
  it('devuelve la mediana de lo que sí se registró', () => {
    expect(minutosTipicos([50, 60, 90])).toBe(60)
  })

  // La media la arrastra una sesión de tres horas que alguien dejó el cronómetro
  // corriendo; la mediana no.
  it('la mediana aguanta un valor disparatado que la media no', () => {
    expect(minutosTipicos([55, 60, 65, 300])).toBe(62.5)
  })

  it('ignora lo que no es un número', () => {
    expect(minutosTipicos([60, Number.NaN, 0, -5])).toBe(60)
  })

  it('sin ninguna duración registrada devuelve null', () => {
    expect(minutosTipicos([])).toBeNull()
  })
})

describe('entrenoEseDia', () => {
  it('lo escrito en el check-in cuenta como entreno', () => {
    expect(entrenoEseDia({ entreno: 'Pierna A' })).toBe(true)
  })

  it('«descanso» no, escrito como se escriba', () => {
    expect(entrenoEseDia({ entreno: 'DESCANSO' })).toBe(false)
    expect(entrenoEseDia({ entreno: ' descanso ' })).toBe(false)
  })

  it('sin respuesta, o en blanco, no cuenta', () => {
    expect(entrenoEseDia({})).toBe(false)
    expect(entrenoEseDia({ entreno: '   ' })).toBe(false)
  })
})

describe('entrenosEnVentana', () => {
  const checkins = [
    { fecha: '2026-08-01', entreno: 'Pecho' },
    { fecha: '2026-07-31', entreno: 'descanso' },
    { fecha: '2026-07-30', entreno: 'Pierna' },
  ]

  it('se queda con los días que se entrenó', () => {
    const dias = entrenosEnVentana(checkins, '2026-08-02', 7)
    expect(dias.map((d) => d.fecha)).toEqual(['2026-08-01', '2026-07-30'])
  })

  // Mismo motivo que en `ventanaEnergetica`: el día en curso está a medias, y la
  // ingesta con la que se compara tampoco lo cuenta.
  it('hoy no entra', () => {
    const dias = entrenosEnVentana([...checkins, { fecha: '2026-08-02', entreno: 'Espalda' }], '2026-08-02', 7)
    expect(dias.some((d) => d.fecha === '2026-08-02')).toBe(false)
  })

  it('ninguno trae minutos: el check-in no los pregunta', () => {
    expect(entrenosEnVentana(checkins, '2026-08-02', 7).every((d) => d.minutos === null)).toBe(true)
  })

  it('no devuelve más días que los de la ventana', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => ({
      fecha: `2026-07-${String(28 - i).padStart(2, '0')}`,
      entreno: 'Full body',
    }))
    expect(entrenosEnVentana(muchos, '2026-08-02', 7)).toHaveLength(7)
  })
})

describe('gastoEjercicioDiario', () => {
  it('reparte lo gastado entre todos los días de la ventana, no solo los de entreno', () => {
    // Tres sesiones de 221 kcal en 7 días = 663 / 7 = 94,7 → 95
    const g = gastoEjercicioDiario(
      [entreno('2026-08-01'), entreno('2026-07-31'), entreno('2026-07-30')],
      60,
      7,
    )
    expect(g?.sesiones).toBe(3)
    expect(g?.kcalDia).toBe(95)
  })

  /**
   * Es la razón de ser de todo esto. Con el gasto en cero la disponibilidad sale
   * MÁS ALTA de lo real, así que la alerta se calla justo en quien entrenó y no
   * comió. Restar el gasto la baja: ese es el sentido correcto del error.
   */
  it('descontar el entreno baja la disponibilidad, que es lo que la alerta necesita', () => {
    const g = gastoEjercicioDiario([entreno('2026-08-01'), entreno('2026-07-31')], 60, 7)
    expect(g?.kcalDia).toBeGreaterThan(0)
  })

  it('sin sesiones el gasto es cero de verdad: hay respuesta y es que no entrenó', () => {
    const g = gastoEjercicioDiario([], 60, 7)
    expect(g?.kcalDia).toBe(0)
    expect(g?.sesiones).toBe(0)
    expect(g?.estimadas).toBe(0)
  })

  describe('la sesión que no dejó duración', () => {
    // El traspaso lo deja escrito: el estimado mínimo es mejor que el cero, y el
    // cero es mejor que inventar un número alto. Y que se vea cuál es cuál.
    it('usa el suelo de minutos y la cuenta como estimada', () => {
      const g = gastoEjercicioDiario([entreno('2026-08-01', null)], 60, 7)
      expect(g?.estimadas).toBe(1)
      expect(g?.kcalDia).toBe(Math.round((kcalDeSesion(60, MINUTOS_SUELO) ?? 0) / 7))
    })

    it('el suelo es más bajo que una sesión típica: no infla el gasto', () => {
      expect(MINUTOS_SUELO).toBeLessThan(60)
    })

    it('prefiere los minutos típicos de la persona al suelo, si los hay', () => {
      const conTipicos = gastoEjercicioDiario([entreno('2026-08-01', null)], 60, 7, 90)
      const conSuelo = gastoEjercicioDiario([entreno('2026-08-01', null)], 60, 7)
      expect(conTipicos?.kcalDia).toBeGreaterThan(conSuelo?.kcalDia ?? 0)
      // Sigue siendo un estimado aunque el número venga de sus propias sesiones.
      expect(conTipicos?.estimadas).toBe(1)
    })

    it('una sesión con duración registrada no cuenta como estimada', () => {
      expect(gastoEjercicioDiario([entreno('2026-08-01', 75)], 60, 7)?.estimadas).toBe(0)
    })
  })

  describe('cuando el dato no da', () => {
    it('sin peso devuelve null: no hay fórmula sin él', () => {
      expect(gastoEjercicioDiario([entreno('2026-08-01')], null, 7)).toBeNull()
    })

    it('sin días de ventana devuelve null en vez de dividir por cero', () => {
      expect(gastoEjercicioDiario([entreno('2026-08-01')], 60, 0)).toBeNull()
    })
  })

  it('una fecha repetida cuenta una sola vez', () => {
    // Mismo criterio que `ventanaEnergetica`: si el llamante repitiera un día,
    // contarlo dos veces inflaría el gasto sin que nadie lo notara.
    const g = gastoEjercicioDiario([entreno('2026-08-01'), entreno('2026-08-01')], 60, 7)
    expect(g?.sesiones).toBe(1)
  })

  it('no gasta más días de los que tiene la ventana', () => {
    const muchos = Array.from({ length: 10 }, (_, i) =>
      entreno(`2026-08-${String(10 - i).padStart(2, '0')}`),
    )
    expect(gastoEjercicioDiario(muchos, 60, 7)?.sesiones).toBe(7)
  })
})
