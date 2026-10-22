import { describe, expect, it } from 'vitest'
import { verificarCifras, type Cifra } from './contrato'
import { GRAVEDAD } from './convenciones'
import { DE_LEVA_CERV } from './deleva'
import { geometriaSagital, momentosEstaticos, type PoseSagital } from './dinamica'
import { idsDeRadio, momentoDeInercia, rangoDeRadio, valoresDeRadios } from './inercia'
import { VALORES_REGISTRADOS } from './registro'
import {
  derivadaSegunda,
  momentoNetoSobre,
  momentosDeSentadillaEnElTiempo,
  type EntradaDeSerie,
  type InstanteDePose,
} from './inercial'
import { construirSujeto } from './sujeto'

/**
 * ARNÉS DEL TÉRMINO INERCIAL. La verdad sale de casos que se resuelven a mano con las fórmulas del movimiento circular,
 * sin llamar al código que se prueba para las aceleraciones:
 *   (a) aceleración cero → los 151 / 188 / 497 N·m del documento de la API (hombre 1,78 m, 82 kg, 100 kg);
 *   (b) caída libre → 0;
 *   (c) el tronco girando con la cadera fija: θ(t) = θ0 + A·sen(ωt), aceleraciones analíticas.
 */

const hombre = { sexo: 'h' as const, talla: 1.78, masa: 82 }
const paralelo: PoseSagital = { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2, barraT: 0.1, pieZ: 0.05 }
const FUENTE = 'sintetico:prueba'

const serie = (poses: PoseSagital[], dt: number, extra: Partial<EntradaDeSerie> = {}): EntradaDeSerie => ({
  ...hombre,
  cargaKg: 100,
  fuenteDeAngulos: FUENTE,
  instantes: poses.map((pose, i): InstanteDePose => ({ t: i * dt, pose })),
  ...extra,
})
const todas = (m: ReturnType<typeof momentosDeSentadillaEnElTiempo>['marcos'][number]): Cifra[] =>
  (['tobillo', 'rodilla', 'cadera'] as const).flatMap((a) => [m[a].traslacional, m[a].rotacional, m[a].inercial, m[a].total])

describe('(a) aceleración cero reproduce el cálculo estático', () => {
  const r = momentosDeSentadillaEnElTiempo(serie([paralelo, paralelo, paralelo, paralelo, paralelo], 0.1))
  const m = r.marcos[2]
  it('el término inercial es 0 y el total vale 151 / 188 / 497 N·m', () => {
    expect(r.motivo).toBeNull()
    for (const a of ['tobillo', 'rodilla', 'cadera'] as const) {
      expect(Math.abs(m[a].traslacional.valor!)).toBeLessThan(1e-9)
      expect(Math.abs(m[a].rotacional.valor!)).toBeLessThan(1e-9)
      expect(Math.abs(m[a].inercial.valor!)).toBeLessThan(1e-9)
    }
    expect(Math.round(m.tobillo.total.valor!)).toBe(151)
    expect(Math.round(m.rodilla.total.valor!)).toBe(188)
    expect(Math.round(m.cadera.total.valor!)).toBe(497)
  })
  it('coincide con momentosEstaticos al detalle', () => {
    const e = momentosEstaticos(geometriaSagital(construirSujeto(hombre)!, 100, paralelo))
    expect(m.tobillo.total.valor!).toBeCloseTo(e.tobillo, 8)
    expect(m.rodilla.total.valor!).toBeCloseTo(e.rodilla, 8)
    expect(m.cadera.total.valor!).toBeCloseTo(e.cadera, 8)
  })
  it('las cifras cumplen el contrato y son estimadas con banda', () => {
    expect(verificarCifras(todas(m))).toEqual([])
    for (const c of todas(m)) expect(c.estado).toBe('estimado')
  })
})

describe('(b) el núcleo: caída libre y derivada', () => {
  it('en caída libre (a_y = −g, sin giro) el momento es 0 en cualquier posición', () => {
    const cuerpos = [
      { kg: 7, z: 0.3, y: 1.1, az: 0, ay: -GRAVEDAD },
      { kg: 40, z: -0.2, y: 0.7, az: 0, ay: -GRAVEDAD, inercia: 3, alfa: 0 },
    ]
    expect(Math.abs(momentoNetoSobre(cuerpos, { z: 0.05, y: 0.4 }))).toBeLessThan(1e-9)
  })
  it('una masa de 2 kg a 0,5 m delante de J sin aceleración pesa 2·g·0,5 N·m', () => {
    expect(momentoNetoSobre([{ kg: 2, z: 0.5, y: 1, az: 0, ay: 0 }], { z: 0, y: 0 })).toBeCloseTo(2 * GRAVEDAD * 0.5, 12)
  })
  it('una masa de 3 kg, 0,4 m delante, acelerando 5 m/s² hacia arriba suma 3·0,4·5 al peso', () => {
    const inercial = momentoNetoSobre([{ kg: 3, z: 0.4, y: 0, az: 0, ay: 5 }], { z: 0, y: 0 }, 0)
    expect(inercial).toBeCloseTo(3 * 0.4 * 5, 12)
  })
  it('la derivada segunda es exacta para una parábola en una rejilla no uniforme', () => {
    const f = (t: number) => 4 * t * t - 3 * t + 2 // f'' = 8
    expect(derivadaSegunda(0, f(0), 0.1, f(0.1), 0.35, f(0.35))).toBeCloseTo(8, 9)
  })
})

describe('(c) el tronco gira con la cadera fija: aceleraciones analíticas', () => {
  const A = 0.3
  const w = 2 * Math.PI
  const dt = 0.002
  const N = 501
  const th = (t: number) => paralelo.tronco + A * Math.sin(w * t)
  const poses = Array.from({ length: N }, (_, k) => ({ ...paralelo, tronco: th(k * dt) }))
  const r = momentosDeSentadillaEnElTiempo(serie(poses, dt))
  const s = construirSujeto(hombre)!
  const escala = hombre.talla / 1.741
  const Lk = DE_LEVA_CERV.h.tronco.largo * escala
  const Lc = DE_LEVA_CERV.h.cabeza.largo * escala
  const masaTronco = DE_LEVA_CERV.h.tronco.masa * hombre.masa
  const masaCabeza = DE_LEVA_CERV.h.cabeza.masa * hombre.masa
  const masaBrazos = 2 * (s.segmentos.brazo.masaKg + s.segmentos.antebrazo.masaKg + s.segmentos.mano.masaKg)
  const g0 = geometriaSagital(s, 100, paralelo)

  /** Inercial de la cadera / rodilla / tobillo, a mano. */
  const aMano = (k: number, J: { z: number; y: number }, signo: number) => {
    const t = k * dt
    const q = th(t)
    const qpp = -A * w * w * Math.sin(w * t)
    const qp = A * w * Math.cos(w * t)
    const u = { z: Math.sin(q), y: Math.cos(q) }
    const uc = { z: Math.sin(paralelo.cabeza), y: Math.cos(paralelo.cabeza) }
    const H = g0.cadera
    // masa, distancia que gira alrededor de la cadera, desplazamiento fijo respecto de ese punto que gira
    const lista = [
      { kg: masaTronco, d: (1 - DE_LEVA_CERV.h.tronco.cm) * Lk, c: { z: 0, y: 0 } },
      { kg: masaCabeza, d: Lk, c: { z: (1 - DE_LEVA_CERV.h.cabeza.cm) * Lc * uc.z, y: (1 - DE_LEVA_CERV.h.cabeza.cm) * Lc * uc.y } },
      { kg: masaBrazos + 100, d: (1 - paralelo.barraT) * Lk, c: { z: 0, y: 0 } },
    ]
    let suma = 0
    for (const m of lista) {
      const rz = H.z + m.d * u.z + m.c.z - J.z
      const ry = H.y + m.d * u.y + m.c.y - J.y
      const az = m.d * (qpp * Math.cos(q) - qp * qp * Math.sin(q))
      const ay = m.d * (-qpp * Math.sin(q) - qp * qp * Math.cos(q))
      suma += m.kg * (rz * ay - ry * az)
    }
    return signo * suma
  }
  const rotacionalAMano = (k: number, signo: number, radio: number) => {
    const qpp = -A * w * w * Math.sin(w * k * dt)
    return signo * momentoDeInercia(radio, masaTronco, Lk) * -qpp // la cabeza no gira: su α es 0
  }

  it.each([60, 125, 190, 380])('en el cuadro %i el término traslacional de cadera, rodilla y tobillo es el de la fórmula del péndulo', (k) => {
    const m = r.marcos[k]
    expect(m.cadera.traslacional.valor!).toBeCloseTo(aMano(k, g0.cadera, 1), 1)
    expect(m.rodilla.traslacional.valor!).toBeCloseTo(aMano(k, g0.rodilla, -1), 1)
    expect(m.tobillo.traslacional.valor!).toBeCloseTo(aMano(k, g0.tobillo, 1), 1)
    expect(Math.abs(aMano(k, g0.cadera, 1))).toBeGreaterThan(5) // el caso no es trivial: hay aceleración de verdad
  })
  it('el término rotacional de cadera es I·α con el radio entre los dos valores leídos, y su banda los abarca', () => {
    const rg = rangoDeRadio('h', 'tronco')
    for (const k of [60, 125, 380]) {
      const lo = Math.min(rotacionalAMano(k, 1, rg.min), rotacionalAMano(k, 1, rg.max))
      const hi = Math.max(rotacionalAMano(k, 1, rg.min), rotacionalAMano(k, 1, rg.max))
      const c = r.marcos[k].cadera.rotacional
      expect(c.banda!.inf).toBeCloseTo(lo, 1)
      expect(c.banda!.sup).toBeCloseTo(hi, 1)
      expect(c.valor!).toBeCloseTo((lo + hi) / 2, 1)
    }
  })
  it('la cadera suma lo traslacional y lo rotacional: el inercial está dentro de su banda', () => {
    const c = r.marcos[125].cadera
    expect(c.inercial.valor!).toBeCloseTo(c.traslacional.valor! + c.rotacional.valor!, 9)
    expect(c.total.banda!.inf).toBeLessThanOrEqual(c.total.valor!)
    expect(c.total.banda!.sup).toBeGreaterThanOrEqual(c.total.valor!)
  })
})

describe('con solo la tibia moviéndose, la inercia rotacional es de tobillo', () => {
  it('cadera y rodilla no tienen rotacional (muslo y tronco quietos) y el tobillo sí', () => {
    const poses = Array.from({ length: 9 }, (_, k) => ({ ...paralelo, tibia: 0.45 + 0.2 * Math.sin(k * 0.8) }))
    const m = momentosDeSentadillaEnElTiempo(serie(poses, 0.05)).marcos[4]
    expect(Math.abs(m.cadera.rotacional.valor!)).toBeLessThan(1e-9)
    expect(Math.abs(m.rodilla.rotacional.valor!)).toBeLessThan(1e-9)
    expect(Math.abs(m.tobillo.rotacional.valor!)).toBeGreaterThan(0.01)
  })
})

describe('lo que no se puede afirmar no se afirma', () => {
  const cinco = [paralelo, paralelo, paralelo, paralelo, paralelo]
  const sinValor = (r: ReturnType<typeof momentosDeSentadillaEnElTiempo>, k: number) => {
    for (const c of todas(r.marcos[k])) {
      expect(c.valor).toBeNull()
      expect(c.estado).toBe('no_afirmable')
    }
    expect(verificarCifras(todas(r.marcos[k]))).toEqual([])
  }
  it.each([
    ['sin fuente de los ángulos', { fuenteDeAngulos: undefined }],
    ['fuente en blanco', { fuenteDeAngulos: '   ' }],
    ['sin talla', { talla: null }],
    ['carga negativa', { cargaKg: -1 }],
  ])('%s: todo no_afirmable, ningún cero', (_, extra) => {
    const r = momentosDeSentadillaEnElTiempo(serie(cinco, 0.1, extra as Partial<EntradaDeSerie>))
    expect(r.motivo).not.toBeNull()
    sinValor(r, 2)
  })
  it('menos de 3 instantes, tiempos que no crecen o un ángulo NaN: no_afirmable', () => {
    sinValor(momentosDeSentadillaEnElTiempo(serie([paralelo, paralelo], 0.1)), 0)
    const repetido = serie(cinco, 0.1)
    repetido.instantes = repetido.instantes!.map((x, i) => (i === 3 ? { ...x, t: 0.2 } : x))
    sinValor(momentosDeSentadillaEnElTiempo(repetido), 2)
    sinValor(momentosDeSentadillaEnElTiempo(serie([paralelo, { ...paralelo, tronco: NaN }, paralelo, paralelo], 0.1)), 1)
  })
  it('el primer y el último cuadro no tienen aceleración: no_afirmable; los de en medio sí', () => {
    const r = momentosDeSentadillaEnElTiempo(serie(cinco, 0.1))
    sinValor(r, 0)
    sinValor(r, 4)
    expect(r.marcos[1].cadera.total.estado).toBe('estimado')
  })
  it('mujer: cada articulación cita los radios de los segmentos que mueve, y la banda rotacional tiene ancho', () => {
    const r = momentosDeSentadillaEnElTiempo(
      serie(
        Array.from({ length: 5 }, (_, k) => ({ ...paralelo, tibia: 0.45 + 0.1 * k * k })),
        0.1,
        { sexo: 'm', masa: 62 },
      ),
    )
    const m = r.marcos[2]
    expect(m.tobillo.rotacional.fuente).toEqual(expect.arrayContaining(['deleva96.m.tibia.radio_sagital', 'deleva96.m.tibia.radio_transverso']))
    expect(m.cadera.rotacional.fuente).not.toContain('deleva96.m.tibia.radio_sagital')
    expect(m.cadera.rotacional.fuente).toEqual(expect.arrayContaining(['deleva96.cerv.m.tronco.radio_sagital', 'deleva96.cerv.m.tronco.radio_transverso']))
    expect(m.tobillo.rotacional.banda!.sup - m.tobillo.rotacional.banda!.inf).toBeGreaterThan(0)
  })
  it('la fuente de los ángulos viaja en la fuente de cada cifra', () => {
    const m = momentosDeSentadillaEnElTiempo(serie(cinco, 0.1)).marcos[2]
    expect(m.cadera.total.fuente).toContain(`angulos:${FUENTE}`)
  })
})

describe('procedencia de los radios: cada fuente que cita una cifra inercial existe en el registro', () => {
  it('las 16 constantes están registradas con sus valores y toda fuente de las cifras del tobillo, la rodilla y la cadera (los dos sexos) es una de ellas', () => {
    const radios = valoresDeRadios()
    expect(Object.keys(radios)).toHaveLength(16)
    for (const [id, v] of Object.entries(radios)) expect(VALORES_REGISTRADOS[id]).toBe(v)
    for (const sexo of ['h', 'm'] as const) {
      const poses = Array.from({ length: 5 }, (_, k) => ({ ...paralelo, tibia: 0.45 + 0.1 * k * k, tronco: 0.75 + 0.05 * k }))
      const marco = momentosDeSentadillaEnElTiempo(serie(poses, 0.1, { sexo })).marcos[2]!
      for (const a of ['tobillo', 'rodilla', 'cadera'] as const) {
        for (const c of [marco[a].traslacional, marco[a].rotacional, marco[a].inercial, marco[a].total]) {
          const sin = c.fuente.filter((f) => !f.startsWith('angulos:') && !(f in VALORES_REGISTRADOS))
          expect(sin, `${sexo} ${a} ${c.id}`).toEqual([])
        }
      }
    }
  })
  it('los ids tienen la forma del libro: CERV para tronco y cabeza, sin CERV para muslo y tibia', () => {
    expect(idsDeRadio('h', 'muslo')).toEqual(['deleva96.h.muslo.radio_sagital', 'deleva96.h.muslo.radio_transverso'])
    expect(idsDeRadio('m', 'cabeza')).toEqual(['deleva96.cerv.m.cabeza.radio_sagital', 'deleva96.cerv.m.cabeza.radio_transverso'])
  })
})

describe('los radios de giro de la Tabla 4', () => {
  it('el rango abarca los dos radios del plano (sagital y transverso) y los hombres de la tibia son los del artículo', () => {
    expect(rangoDeRadio('h', 'tibia')).toEqual({ min: 0.246, max: 0.251 })
    expect(rangoDeRadio('h', 'tronco')).toEqual({ min: 0.306, max: 0.328 })
    expect(rangoDeRadio('m', 'cabeza')).toEqual({ min: 0.271, max: 0.295 })
    expect(rangoDeRadio('m', 'tibia')).toEqual({ min: 0.263, max: 0.267 })
  })
})
