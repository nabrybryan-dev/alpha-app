import { describe, expect, it } from 'vitest'
import { verificarCifras } from './contrato'
import {
  angulosDeLaPose,
  dominioDeSilder,
  fuentesDeSilder,
  momentosDeSilder,
  momentosPasivosDeLaPose,
  SILDER_MEDIA,
  type ParametrosDeSilder,
  type AngulosArticulares,
} from './pasivo'
import { VALORES_REGISTRADOS } from './registro'

const rad = (g: number) => (g * Math.PI) / 180
const ang = (cadera: number, rodilla: number, tobillo: number): AngulosArticulares => ({
  cadera: rad(cadera),
  rodilla: rad(rodilla),
  tobillo: rad(tobillo),
})

// Parámetros de JUEGO para respuestas que se resuelven a mano: todo 1 y desfase 0.
const UNOS: ParametrosDeSilder = {
  RF: { bp: 1, bd: 1, a: 0 },
  HAM: { bp: 1, bd: 1, a: 0 },
  GAS: { bp: 1, bd: 1, a: 0 },
  HF: { bp: 1, a: 0 },
  HE: { bp: 1, a: 0 },
  KF: { bp: 1, a: 0 },
  KE: { bp: 1, a: 0 },
  PF: { bp: 1, a: 0 },
}

describe('las ecuaciones A.5 a A.7 con respuesta escrita a mano', () => {
  it('con todo a 1 y los ángulos en 0 cada término vale 1 N·m (el artículo: «reduce a 1 Nm»)', () => {
    // Mh = rf + hf − ham − he = 1 + 1 − 1 − 1 = 0
    // Mk = −rf − ke + ham + kf + gas = −1 − 1 + 1 + 1 + 1 = 1
    // Ma = −gas − pf = −2
    const m = momentosDeSilder(UNOS, { cadera: 0, rodilla: 0, tobillo: 0 })
    expect(m.cadera).toBeCloseTo(0, 12)
    expect(m.rodilla).toBeCloseTo(1, 12)
    expect(m.tobillo).toBeCloseTo(-2, 12)
  })

  it('con la cadera a 1 rad: los exponenciales de e y 1/e, resueltos a mano', () => {
    // rf = hf = e^-1 = 0.367879; ham = he = e^1 = 2.718282; ke = kf = gas = pf = 1.
    // Mh = 2·0.367879 − 2·2.718282 = −4.700805
    // Mk = −0.367879 − 1 + 2.718282 + 1 + 1 = 3.350403
    // Ma = −2
    const m = momentosDeSilder(UNOS, { cadera: 1, rodilla: 0, tobillo: 0 })
    expect(m.cadera).toBeCloseTo(-4.700805, 5)
    expect(m.rodilla).toBeCloseTo(3.350403, 5)
    expect(m.tobillo).toBeCloseTo(-2, 12)
  })

  it('el cociente de ganancias acopla las dos articulaciones del bi-articular', () => {
    // RF con bp = 2, bd = 1 (cociente 0,5), cadera 0 y rodilla 2 rad: exponente de rf = −2·(0 − 0,5·2 − 0) = 2.
    // rf = e^2 = 7.389056; Mh suma rf y Mk resta 0,5·rf. Con el resto de términos en 1 o e^0.
    const par: ParametrosDeSilder = { ...UNOS, RF: { bp: 2, bd: 1, a: 0 } }
    const base = momentosDeSilder(UNOS, { cadera: 0, rodilla: 2, tobillo: 0 })
    const con = momentosDeSilder(par, { cadera: 0, rodilla: 2, tobillo: 0 })
    const rfUnos = Math.exp(-1 * (0 - 1 * 2 - 0)) // e^2
    const rfCon = Math.exp(2)
    expect(rfCon).toBeCloseTo(7.389056, 5)
    expect(con.cadera - base.cadera).toBeCloseTo(rfCon - rfUnos, 10) // ambos valen e^2: diferencia 0
    expect(con.rodilla - base.rodilla).toBeCloseTo(-0.5 * rfCon + 1 * rfUnos, 10)
    expect(con.rodilla - base.rodilla).toBeCloseTo(-0.5 * 7.389056 + 7.389056, 5)
  })
})

describe('el gemelo bi-articular con cociente distinto de 1', () => {
  it('GAS con β de rodilla 2 y de tobillo 1 (cociente 0,5), rodilla y tobillo a 1 rad, a mano', () => {
    // gas = e^{2·(1 − 0,5·1 − 0)} = e = 2,718282; pf = e^{1·(1 − 0)} = e = 2,718282
    // Ma = −0,5·gas − pf = −1,359141 − 2,718282 = −4,077423
    // Con la cadera en 0 y el resto en 1: rf = e^{1} (cociente 1), ke = e, ham = kf = e^{-1}
    // Mk = −rf − ke + ham + kf + gas = −e − e + 2·e^{-1} + e = −e + 2·e^{-1} = −1,982523
    const par: ParametrosDeSilder = { ...UNOS, GAS: { bp: 2, bd: 1, a: 0 } }
    const m = momentosDeSilder(par, { cadera: 0, rodilla: 1, tobillo: 1 })
    expect(m.tobillo).toBeCloseTo(-4.077423, 5)
    expect(m.rodilla).toBeCloseTo(-1.982523, 5)
  })
})

describe('β por radián: la prueba de orden de magnitud', () => {
  it('cadera al despegue de la marcha (−10° de cadera, 35° de rodilla): 34 N·m de flexor pasivo', () => {
    // A mano, con los parámetros medios: rf = e^{3.1·0.975} = 20.5; hf = e^{5.1·0.5148} = 13.8;
    // ham = e^{−6.0} = 0.0025; he = e^{−1.30} = 0.27. Mh = 20.5 + 13.8 − 0.0025 − 0.27 = 34.0.
    const m = momentosDeSilder(SILDER_MEDIA, ang(-10, 35, 0))
    expect(m.cadera).toBeGreaterThan(33)
    expect(m.cadera).toBeLessThan(35)
  })
  it('con cadera −5° y rodilla 30° sale ~22 N·m: del orden de los «~20 Nm» que publica el artículo', () => {
    const m = momentosDeSilder(SILDER_MEDIA, ang(-5, 30, 0))
    expect(m.cadera).toBeGreaterThan(15)
    expect(m.cadera).toBeLessThan(30)
  })
  it('si β fuera por grado (ángulos en grados) los exponentes se desbocan: por eso NO se puede leer así', () => {
    const enGrados = momentosDeSilder(SILDER_MEDIA, { cadera: -10, rodilla: 35, tobillo: 0 })
    expect(Math.abs(enGrados.cadera)).toBeGreaterThan(1e6)
  })
})

describe('los ángulos articulares salen de la pose', () => {
  it('de pie, todo 0', () => {
    expect(angulosDeLaPose({ tibia: 0, muslo: 0, tronco: 0 })).toEqual({ cadera: 0, rodilla: 0, tobillo: 0 })
  })
  it('la sentadilla de ejemplo: cadera 2,2 rad (126°), rodilla 1,9 rad, tobillo 0,45 rad', () => {
    // cadera = tronco − muslo = 0,75 + 1,45; rodilla = tibia − muslo = 0,45 + 1,45; tobillo = tibia.
    const a = angulosDeLaPose({ tibia: 0.45, muslo: -1.45, tronco: 0.75 })
    expect(a.cadera).toBeCloseTo(2.2, 12)
    expect(a.rodilla).toBeCloseTo(1.9, 12)
    expect(a.tobillo).toBeCloseTo(0.45, 12)
  })
})

describe('el dominio de la Tabla 2, por término', () => {
  it.each([
    ['dentro de todo', ang(80, 74, 17), { cadera: true, rodilla: true, tobillo: true }],
    ['cadera en el borde con rodilla ≤ 25°', ang(100, 25, 0), { cadera: true, rodilla: true, tobillo: true }],
    ['cadera 90° con rodilla 30°: nunca se ensayó', ang(90, 30, 0), { cadera: false, rodilla: false, tobillo: true }],
    ['cadera 90° con rodilla 20°: el ensayo 15', ang(90, 20, 0), { cadera: true, rodilla: true, tobillo: true }],
    ['cadera 101°', ang(101, 10, 0), { cadera: false, rodilla: false, tobillo: true }],
    ['cadera −16°', ang(-16, 10, 0), { cadera: false, rodilla: false, tobillo: true }],
    ['rodilla 136°', ang(0, 136, 0), { cadera: false, rodilla: false, tobillo: false }],
    ['rodilla −1°', ang(0, -1, 0), { cadera: false, rodilla: false, tobillo: false }],
    ['tobillo 21°: solo cadera ve el modelo', ang(40, 40, 21), { cadera: true, rodilla: false, tobillo: false }],
    ['tobillo −21°', ang(40, 40, -21), { cadera: true, rodilla: false, tobillo: false }],
    ['la sentadilla de ejemplo (cadera 126°)', angulosDeLaPose({ tibia: 0.45, muslo: -1.45, tronco: 0.75 }), { cadera: false, rodilla: false, tobillo: false }],
    ['NaN', { cadera: NaN, rodilla: 0, tobillo: 0 }, { cadera: false, rodilla: false, tobillo: false }],
  ])('%s', (_, a, esperado) => {
    expect(dominioDeSilder(a)).toEqual(esperado)
  })
})

describe('el momento pasivo con contrato', () => {
  const dentro = { tibia: 0.3, muslo: -1.0, tronco: 0.4 } // cadera 80°, rodilla 74°, tobillo 17°
  const ejemplo = { tibia: 0.45, muslo: -1.45, tronco: 0.75 }

  it('la sentadilla de ejemplo está fuera del dominio: tres no_afirmable con el motivo, nunca un número', () => {
    const r = momentosPasivosDeLaPose(ejemplo)
    for (const c of [r.cadera, r.rodilla, r.tobillo]) {
      expect(c.valor).toBeNull()
      expect(c.estado).toBe('no_afirmable')
      expect(c.motivo).toMatch(/fuera del dominio ensayado por Silder 2007/)
    }
    expect(r.cadera.motivo).toContain('cadera 126°')
    expect(verificarCifras([r.cadera, r.rodilla, r.tobillo])).toEqual([])
  })

  it('una pose dentro del dominio da tres estimados válidos, con el signo de dinamica.ts (extensor positivo)', () => {
    const r = momentosPasivosDeLaPose(dentro)
    expect(verificarCifras([r.cadera, r.rodilla, r.tobillo])).toEqual([])
    for (const c of [r.cadera, r.rodilla, r.tobillo]) {
      expect(c.estado).toBe('estimado')
      expect(c.unidad).toBe('N·m')
      expect(c.banda!.inf).toBeLessThanOrEqual(c.valor as number)
      expect(c.banda!.sup).toBeGreaterThanOrEqual(c.valor as number)
    }
    // A mano (cadera 1,4 rad, rodilla 1,3 rad): rf = 0,58; hf = 0,0045; ham = 0,51; he = 6,34.
    // Mh de Silder = 0,58 + 0,0045 − 0,51 − 6,34 = −6,27 (extensor); con el signo cambiado y las dos piernas: +12,5.
    expect(Math.abs((r.cadera.valor as number) - 12.5)).toBeLessThan(0.3)
  })

  it('es exactamente −2 × el modelo de Silder con los parámetros medios', () => {
    const r = momentosPasivosDeLaPose(dentro)
    const m = momentosDeSilder(SILDER_MEDIA, angulosDeLaPose(dentro))
    expect(r.cadera.valor).toBeCloseTo(-2 * m.cadera, 10)
    expect(r.rodilla.valor).toBeCloseTo(-2 * m.rodilla, 10)
    expect(r.tobillo.valor).toBeCloseTo(-2 * m.tobillo, 10)
  })

  it('la banda es la dispersión entre sujetos y es ENORME: más ancha que el propio valor (hallazgo, no adorno)', () => {
    const r = momentosPasivosDeLaPose(dentro)
    expect((r.cadera.banda!.sup - r.cadera.banda!.inf) > Math.abs(r.cadera.valor as number)).toBe(true)
    expect(r.cadera.banda!.nivel).toMatch(/población ensayada/)
  })

  it('misma semilla, mismo resultado; otra semilla, otra banda', () => {
    expect(momentosPasivosDeLaPose(dentro)).toEqual(momentosPasivosDeLaPose(dentro))
    const otra = momentosPasivosDeLaPose(dentro, { semilla: 7 })
    expect(otra.cadera.banda).not.toEqual(momentosPasivosDeLaPose(dentro).cadera.banda)
    expect(otra.cadera.valor).toBe(momentosPasivosDeLaPose(dentro).cadera.valor)
  })

  it.each([
    ['sin pose', undefined],
    ['pose nula', null],
    ['ángulo NaN', { tibia: NaN, muslo: -1, tronco: 0.4 }],
  ])('%s: tres no_afirmable, ninguna con valor', (_, pose) => {
    const r = momentosPasivosDeLaPose(pose as never)
    for (const c of [r.cadera, r.rodilla, r.tobillo]) {
      expect(c.valor).toBeNull()
      expect(c.estado).toBe('no_afirmable')
    }
  })

  it('cero muestras es un error, no un NaN', () => {
    expect(() => momentosPasivosDeLaPose(dentro, { muestras: 0 })).toThrow(RangeError)
  })

  it('cada fuente que cita existe en el registro de constantes vigiladas', () => {
    const r = momentosPasivosDeLaPose(dentro)
    for (const c of [r.cadera, r.rodilla, r.tobillo]) {
      for (const f of c.fuente) expect(Object.keys(VALORES_REGISTRADOS)).toContain(f)
    }
    expect(Object.keys(VALORES_REGISTRADOS)).toContain('pasivo.supuesto.beta_por_radian')
  })

  it('las fuentes de cada articulación son las de sus términos y no más', () => {
    expect(fuentesDeSilder('tobillo').some((f) => f.startsWith('silder07.GAS.'))).toBe(true)
    expect(fuentesDeSilder('tobillo').some((f) => f.startsWith('silder07.RF.'))).toBe(false)
    expect(fuentesDeSilder('cadera').some((f) => f.startsWith('silder07.KE.'))).toBe(false)
    expect(fuentesDeSilder('rodilla').some((f) => f.startsWith('silder07.KE.'))).toBe(true)
  })
})
