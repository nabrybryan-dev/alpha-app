import { describe, expect, it } from 'vitest'
import { verificarCifras } from './contrato'
import { GRAVEDAD } from './convenciones'
import { derivadaSegunda, momentosEnElTiempo } from './inercial'
import { VARIANTE_PESO_MUERTO } from './pesoMuerto'
import { VALORES_REGISTRADOS } from './registro'
import { construirSujeto } from './sujeto'
import { resolverEscenario, type EntradaDeZancada, type PoseDeZancada } from './zancada'
import {
  FRACCION_TRASERA_BULGARA,
  IDS_DE_LA_REGLA_BULGARA,
  VARIANTES_DE_ZANCADA,
  cuerposQuietos,
  evaluarBulgara,
  fraccionTraseraDe,
  momentosDeBulgara,
  momentosDeBulgaraEnElTiempo,
  momentosDeZancadaPorVariante,
  type InstanteDeBulgara,
} from './zancadaBulgara'

/**
 * Sentadilla búlgara: la trasera lleva 0,30 BW (banda 0,26-0,35), la delantera el resto del F_total. Verdad: (a) la regla escrita en
 * REPARTO-ZANCADA.md §4; (b) las cuentas de fuerzas y de momentos a mano; (c) el equilibrio del cuerpo; (d) la suma de las caderas contra el oráculo
 * independiente `momentosEnElTiempo`; (e) las variantes que el documento declara `no_afirmable`.
 */

const e = { sexo: 'h' as const, talla: 1.741, masa: 73 }
const s = construirSujeto(e)!
const g = GRAVEDAD

// pie trasero sobre un cajón de ~40 cm: el tobillo trasero a ~0,45 m del suelo; el paso es largo para que la rodilla trasera tenga solución
const pose: PoseDeZancada = {
  tibiaDelantera: 0.25,
  musloDelantero: -0.75,
  tronco: 0.2,
  cabeza: 0.1,
  brazo: 0,
  pasoM: 0.85,
  alturaTobilloTraseroM: 0.45,
  pieZ: 0.06,
  copTraseroM: 0.14,
}
const entrada = (p: Partial<PoseDeZancada> = {}, extra: Partial<EntradaDeZancada> = {}): EntradaDeZancada => ({ ...e, cargaKg: 32, pose: { ...pose, ...p }, ...extra })

describe('(a) la regla escrita en el documento', () => {
  it('0,30 BW con banda [0,25; 0,35], estimado, adimensional y con sus tres fuentes registradas (decisión 36)', () => {
    const c = fraccionTraseraDe('bulgara')
    expect(c.valor).toBe(0.3)
    expect(c.banda!.inf).toBe(0.25)
    expect(c.banda!.sup).toBe(0.35)
    expect(c.estado).toBe('estimado')
    expect(c.unidad).toBe('1')
    expect(verificarCifras([c])).toEqual([])
    expect(c.fuente).toEqual(['helme20.bulgara.trasera.bw', 'arakawa25.bulgara.trasera.bw_inf', 'arakawa25.bulgara.trasera.bw_sup'])
    for (const f of c.fuente) expect(Object.keys(VALORES_REGISTRADOS)).toContain(f)
  })
  it('el registro de constantes vigiladas lleva los tres valores del documento', () => {
    expect(VALORES_REGISTRADOS['helme20.bulgara.trasera.bw']).toBe(0.3)
    expect(VALORES_REGISTRADOS['arakawa25.bulgara.trasera.bw_inf']).toBe(0.25)
    expect(VALORES_REGISTRADOS['arakawa25.bulgara.trasera.bw_sup']).toBe(0.35)
    expect(IDS_DE_LA_REGLA_BULGARA).toHaveLength(3)
    expect(FRACCION_TRASERA_BULGARA).toEqual({ central: 0.3, inf: 0.25, sup: 0.35 })
  })
  it('la banda se rotula como promedio de varones jóvenes entrenados (decisión 36 de Bryan), no como intervalo de confianza', () => {
    const c = fraccionTraseraDe('bulgara')
    expect(c.banda!.nivel).toContain('promedio de varones jóvenes entrenados (Helme 2020, Arakawa 2025)')
    expect(c.banda!.nivel).not.toContain('0,26')
    expect(c.banda!.nivel).toContain('0,25')
  })
})

describe('(e) lo que el documento declara no_afirmable', () => {
  it.each([
    ['sentadilla_dividida_plana', /un solo estudio abierto/],
    ['zancada_con_paso', /ningún estudio abierto/],
  ] as const)('%s: ni reparto ni momentos, con el motivo', (variante, motivo) => {
    const f = fraccionTraseraDe(variante)
    expect(f.estado).toBe('no_afirmable')
    expect(f.valor).toBeNull()
    expect(f.motivo).toMatch(motivo)
    const r = momentosDeZancadaPorVariante(variante, entrada())
    for (const c of [...Object.values(r.delantera), ...Object.values(r.trasera), r.repartoDelantera, r.cpDelantero, r.inercial]) {
      expect(c.estado).toBe('no_afirmable')
      expect(c.valor).toBeNull()
      expect(c.motivo).toMatch(motivo)
    }
    expect(verificarCifras([r.delantera.cadera, r.repartoDelantera])).toEqual([])
  })
  it('las tres variantes están y solo la búlgara da número', () => {
    expect([...VARIANTES_DE_ZANCADA]).toEqual(['bulgara', 'sentadilla_dividida_plana', 'zancada_con_paso'])
    expect(momentosDeZancadaPorVariante('bulgara', entrada()).delantera.cadera.valor).not.toBeNull()
  })
})

describe('(b) fuerzas y momentos estáticos a mano', () => {
  const esc = resolverEscenario(s, 32, pose) as Exclude<ReturnType<typeof resolverEscenario>, string>
  const masas = [...esc.superior, ...Object.values(esc.delantera.masas), ...Object.values(esc.trasera.masas)]
  const masaTotal = masas.reduce((t, m) => t + m.kg, 0)
  const zTras = esc.trasera.tobillo.z + pose.copTraseroM
  const ev = evaluarBulgara(s, esc, cuerposQuietos(esc), 0.3, zTras)!

  it('el cuerpo más la carga pesan 73 + 32 kg', () => {
    expect(masaTotal).toBeCloseTo(105, 3)
  })
  it('la trasera lleva 0,30 · 73 · g y la delantera el resto del peso total', () => {
    expect(ev.fuerzaTraseraN).toBeCloseTo(0.3 * 73 * g, 9) // 214,76 N
    expect(ev.fuerzaDelanteraN).toBeCloseTo(masaTotal * g - 0.3 * 73 * g, 6)
    expect(ev.fuerzaDelanteraN + ev.fuerzaTraseraN).toBeCloseTo(105 * g, 3)
    expect(ev.repartoDelantera).toBeCloseTo(1 - (0.3 * 73) / 105, 3) // 0,7914
  })
  it('la regla no depende de la carga: la trasera lleva lo mismo con 0 y con 60 kg', () => {
    const f = (carga: number) => {
      const x = resolverEscenario(s, carga, pose) as Exclude<ReturnType<typeof resolverEscenario>, string>
      return evaluarBulgara(s, x, cuerposQuietos(x), 0.3, zTras)!
    }
    expect(f(0).fuerzaTraseraN).toBeCloseTo(f(60).fuerzaTraseraN, 9)
    expect(f(60).fuerzaDelanteraN - f(0).fuerzaDelanteraN).toBeCloseTo(60 * g, 6)
  })
  it('equilibrio: el momento de las dos reacciones respecto del tobillo delantero es el del peso de todo el cuerpo', () => {
    const pesos = masas.reduce((t, m) => t + m.kg * g * m.z, 0)
    expect(ev.fuerzaDelanteraN * ev.zCpDelantero + ev.fuerzaTraseraN * zTras).toBeCloseTo(pesos, 6)
    expect(ev.zCpDelantero).toBeGreaterThan(-0.07) // dentro del pie
    expect(ev.zCpDelantero).toBeLessThan(s.segmentos.pie.largoM)
  })
  it('momento de tobillo de cada pierna: F·(z_CP − z_tobillo) − peso del pie · distancia', () => {
    const wPie = g * esc.delantera.masas.pie.kg
    expect(ev.delantera.tobillo).toBeCloseTo(ev.fuerzaDelanteraN * ev.zCpDelantero - wPie * pose.pieZ, 6)
    const wPieT = g * esc.trasera.masas.pie.kg
    expect(ev.trasera.tobillo).toBeCloseTo(ev.fuerzaTraseraN * pose.copTraseroM - wPieT * pose.pieZ, 6)
  })
  it('momento de rodilla: extensor positivo = −(F·(z_CP − z_rodilla) − peso del pie y de la tibia por su distancia a la rodilla)', () => {
    for (const [lado, F, zCp] of [['delantera', ev.fuerzaDelanteraN, ev.zCpDelantero], ['trasera', ev.fuerzaTraseraN, zTras]] as const) {
      const p = esc[lado]
      const w = (m: { kg: number; z: number }) => g * m.kg * (m.z - p.rodilla.z)
      const esperado = -(F * (zCp - p.rodilla.z) - w(p.masas.pie) - w(p.masas.tibia))
      expect(ev[lado].rodilla).toBeCloseTo(esperado, 6)
      const cadera = F * (zCp - p.cadera.z) - w2(p.masas.pie, p.cadera.z) - w2(p.masas.tibia, p.cadera.z) - w2(p.masas.muslo, p.cadera.z)
      expect(ev[lado].cadera).toBeCloseTo(cadera, 6)
    }
    function w2(m: { kg: number; z: number }, zj: number) {
      return g * m.kg * (m.z - zj)
    }
  })
  it('las dos caderas suman el momento de tronco, cabeza, brazos y carga respecto de la cadera', () => {
    const arriba = esc.superior.reduce((t, m) => t + g * m.kg * (m.z - esc.delantera.cadera.z), 0)
    expect(ev.delantera.cadera + ev.trasera.cadera).toBeCloseTo(arriba, 6)
    expect(Math.abs(arriba)).toBeGreaterThan(5)
  })
  it('una fracción mayor en la trasera descarga la delantera y mueve el CP delantero hacia atrás', () => {
    const alto = evaluarBulgara(s, esc, cuerposQuietos(esc), 0.35, zTras)!
    const bajo = evaluarBulgara(s, esc, cuerposQuietos(esc), 0.25, zTras)!
    expect(alto.fuerzaDelanteraN).toBeLessThan(ev.fuerzaDelanteraN)
    expect(bajo.fuerzaDelanteraN).toBeGreaterThan(ev.fuerzaDelanteraN)
    // F_tras · z_tras + F_del · z_del = constante: más trasera (z_tras < z_del) => z_del sube la cuota que le falta a la trasera
    expect(alto.zCpDelantero).toBeGreaterThan(ev.zCpDelantero)
  })
  it('si el CP delantero que exige la regla cae fuera del pie, no hay cifra', () => {
    // el pie trasero adelantado a +1 m mueve el CM fuera de lo posible para la regla
    expect(evaluarBulgara(s, esc, cuerposQuietos(esc), 0.3, 1.5)).toBeNull()
  })
})

describe('el resultado estático con contrato', () => {
  it('cumple el contrato, es estimado, la banda contiene el valor y la regla ensancha la banda', () => {
    const r = momentosDeBulgara(entrada())
    const cifras = [...Object.values(r.delantera), ...Object.values(r.trasera), r.repartoDelantera, r.cpDelantero]
    expect(verificarCifras([...cifras, r.inercial])).toEqual([])
    for (const c of cifras) {
      expect(c.estado).toBe('estimado')
      expect(c.banda!.inf).toBeLessThanOrEqual(c.valor!)
      expect(c.banda!.sup).toBeGreaterThanOrEqual(c.valor!)
      for (const f of IDS_DE_LA_REGLA_BULGARA) expect(c.fuente).toContain(f)
    }
    expect(r.trasera.cadera.banda!.sup - r.trasera.cadera.banda!.inf).toBeGreaterThan(1)
    expect(r.repartoDelantera.banda!.inf).toBeLessThan(r.repartoDelantera.valor!)
    expect(r.repartoDelantera.banda!.sup).toBeGreaterThan(r.repartoDelantera.valor!)
    expect(r.inercial.estado).toBe('no_afirmable')
  })
  it('si parte de la regla [0,25; 0,35] deja el CP delantero fuera del pie, la banda lo declara: envolvente parcial (revisor 22-oct)', () => {
    // 80 kg, 1,78 m, 40 kg, tronco -0,05, paso 1,0: con 0,25 BW el CP delantero sale del pie; con 0,30 y 0,35 no
    const e2 = { sexo: 'h' as const, talla: 1.78, masa: 80 }
    const p2 = { ...pose, tronco: -0.05, pasoM: 1.0 }
    const s2 = construirSujeto(e2)!
    const esc2 = resolverEscenario(s2, 40, p2) as Exclude<ReturnType<typeof resolverEscenario>, string>
    const z2 = esc2.trasera.tobillo.z + p2.copTraseroM
    expect(evaluarBulgara(s2, esc2, cuerposQuietos(esc2), 0.25, z2)).toBeNull()
    expect(evaluarBulgara(s2, esc2, cuerposQuietos(esc2), 0.3, z2)).not.toBeNull()
    const r = momentosDeBulgara({ ...e2, cargaKg: 40, pose: p2 })
    expect(r.repartoDelantera.estado).toBe('estimado')
    expect(r.repartoDelantera.banda!.nivel).toMatch(/parcial/)
    expect(r.trasera.cadera.banda!.nivel).toMatch(/parcial/)
    const completo = momentosDeBulgara(entrada())
    expect(completo.repartoDelantera.banda!.nivel).not.toMatch(/parcial/)
    const serieQuieta = Array.from({ length: 3 }, (_, i) => ({ t: i * 0.1, pose: p2 }))
    const d = momentosDeBulgaraEnElTiempo({ ...e2, cargaKg: 40, fuenteDeAngulos: 'prueba', instantes: serieQuieta })
    expect(d.marcos[1]!.delantera.cadera.total.banda!.nivel).toMatch(/parcial/)
    expect(d.marcos[1]!.delantera.cadera.estatico.banda!.nivel).toMatch(/parcial/)
  })
  it('sin talla, con carga negativa, con paso negativo o fuera de alcance: no_afirmable', () => {
    for (const r of [
      momentosDeBulgara(entrada({}, { talla: null })),
      momentosDeBulgara(entrada({}, { cargaKg: -1 })),
      momentosDeBulgara(entrada({ pasoM: -0.1 })),
      momentosDeBulgara(entrada({ pasoM: 3 })),
      momentosDeBulgara(entrada({ tronco: Number.NaN })),
    ]) {
      expect(r.delantera.cadera.estado).toBe('no_afirmable')
      expect(r.trasera.rodilla.valor).toBeNull()
    }
    expect(momentosDeBulgara(entrada({ pasoM: 3 })).delantera.cadera.motivo).toMatch(/no alcanza/)
  })
})

// ------------------------------------------------------------------------------------------------------------------------------------------
// En el tiempo
// ------------------------------------------------------------------------------------------------------------------------------------------
const FUENTE = 'prueba:serie-sintetica'
const serie = (n: number, dt: number, f: (i: number) => Partial<PoseDeZancada>): InstanteDeBulgara[] =>
  Array.from({ length: n }, (_, i) => ({ t: i * dt, pose: { ...pose, ...f(i) } }))

describe('(d) en el tiempo', () => {
  it('sin movimiento el inercial del cuerpo entero es 0 y el total de cada pierna es el estático; el inercial por pierna no se afirma (decisión 36)', () => {
    const r = momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: serie(5, 0.1, () => ({})) })
    const est = momentosDeBulgara(entrada())
    expect(r.motivo).toBeNull()
    const m = r.marcos[2]!
    for (const lado of ['delantera', 'trasera'] as const) {
      for (const a of ['tobillo', 'rodilla', 'cadera'] as const) {
        expect(m[lado][a].inercial.estado).toBe('no_afirmable')
        expect(m[lado][a].total.valor!).toBeCloseTo(est[lado][a].valor!, 9)
        expect(m[lado][a].estatico.valor!).toBeCloseTo(est[lado][a].valor!, 9)
      }
    }
    expect(Math.abs(m.horizontalNoRepartidaN!)).toBeLessThan(1e-9)
    expect(m.inercialCuerpoEntero.estado).toBe('estimado')
    expect(Math.abs(m.inercialCuerpoEntero.valor!)).toBeLessThan(1e-9)
  })

  // el tronco y la cabeza oscilan (parábola exacta para la derivada de 3 puntos) y la rodilla delantera se flexiona: aceleraciones horizontales y verticales
  const movida = serie(7, 0.2, (i) => ({ tronco: 0.2 + 0.15 * i * i * 0.04, cabeza: 0.1 + 0.05 * i * i * 0.04, musloDelantero: -0.75 - 0.1 * i * i * 0.04, tibiaDelantera: 0.25 + 0.03 * i * i * 0.04 }))

  it('la regla se aplica al F_total con aceleración: la trasera sigue en 0,30 BW y la suma de fuerzas es Σ m(g + a_y)', () => {
    const r = momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: movida })
    const k = 3
    const esc = [k - 1, k, k + 1].map((i) => resolverEscenario(s, 32, movida[i]!.pose) as Exclude<ReturnType<typeof resolverEscenario>, string>)
    const lista = (x: (typeof esc)[number]) => [...x.superior, ...Object.values(x.delantera.masas), ...Object.values(x.trasera.masas)]
    const tt = [movida[k - 1]!.t, movida[k]!.t, movida[k + 1]!.t] as const
    let suma = 0
    lista(esc[1]!).forEach((m, j) => {
      const esPie = j >= 4 && (j === 4 || j === 7) // el orden: 4 superiores, luego pie-tibia-muslo de cada pierna
      const ay = esPie ? 0 : derivadaSegunda(tt[0], lista(esc[0]!)[j]!.y, tt[1], m.y, tt[2], lista(esc[2]!)[j]!.y)
      suma += m.kg * (g + ay)
    })
    expect(Math.abs(suma - 105 * g)).toBeGreaterThan(1) // la aceleración vertical no es trivial
    expect(r.marcos[k]!.fuerzaTotalN!).toBeCloseTo(suma, 6)
    expect(r.marcos[k]!.fuerzaTraseraN!).toBeCloseTo(0.3 * 73 * g, 9)
  })

  it('las dos caderas, más el momento de la fuerza horizontal neta, suman lo que da el oráculo independiente (momentosEnElTiempo)', () => {
    const r = momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: movida })
    const oraculo = momentosEnElTiempo(
      {
        ...e,
        cargaKg: 32,
        fuenteDeAngulos: FUENTE,
        instantes: movida.map((x) => ({ t: x.t, pose: { tibia: x.pose.tibiaDelantera, muslo: x.pose.musloDelantero, tronco: x.pose.tronco, cabeza: x.pose.cabeza, brazo: x.pose.brazo, pieZ: x.pose.pieZ } })),
      },
      VARIANTE_PESO_MUERTO,
    )
    let visto = 0
    for (const k of [1, 2, 3, 4, 5]) {
      const esc = resolverEscenario(s, 32, movida[k]!.pose) as Exclude<ReturnType<typeof resolverEscenario>, string>
      const m = r.marcos[k]!
      const suma = m.delantera.cadera.total.valor! + m.trasera.cadera.total.valor!
      const esperado = oraculo.marcos[k]!.cadera.total.valor! - esc.delantera.cadera.y * m.horizontalNoRepartidaN!
      expect(suma).toBeCloseTo(esperado, 6)
      expect(Math.abs(m.horizontalNoRepartidaN!)).toBeGreaterThan(0.5) // el término horizontal cuenta
      expect(Math.abs(oraculo.marcos[k]!.cadera.inercial.valor!)).toBeGreaterThan(0.2) // y el inercial no es cero
      visto++
    }
    expect(visto).toBe(5)
  })

  it('decisión 36: el inercial por pierna es no_afirmable con su motivo; el total y el estático de cada pierna siguen estimados con contrato y banda', () => {
    const r = momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: movida })
    const m = r.marcos[3]!
    for (const lado of ['delantera', 'trasera'] as const) {
      for (const a of ['tobillo', 'rodilla', 'cadera'] as const) {
        const c = m[lado][a]
        expect(c.inercial.estado).toBe('no_afirmable')
        expect(c.inercial.valor).toBeNull()
        expect(c.inercial.motivo).toMatch(/por pierna/)
        expect(c.inercial.motivo).toMatch(/cuerpo entero/)
        expect(verificarCifras([c.estatico, c.inercial, c.total])).toEqual([])
        expect(c.total.banda!.sup - c.total.banda!.inf).toBeGreaterThan(0)
        expect(c.total.fuente).toContain(`angulos:${FUENTE}`)
        expect(c.total.fuente).toContain('deleva96.h.muslo.radio_sagital')
      }
    }
    expect(Math.abs(m.delantera.cadera.total.valor! - m.delantera.cadera.estatico.valor!)).toBeGreaterThan(0.1) // la aceleración sí mueve el total
  })

  it('decisión 36: el término inercial del cuerpo entero es Σ m·a_y (N) = fuerza vertical total − peso del cuerpo y la carga, con contrato', () => {
    const r = momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: movida })
    const m = r.marcos[3]!
    const pesoN = (73 + 32) * g
    expect(m.fuerzaTotalN! - pesoN).toBeCloseTo(m.inercialCuerpoEntero.valor!, 9)
    expect(Math.abs(m.inercialCuerpoEntero.valor!)).toBeGreaterThan(0.1) // el caso positivo: aquí el cuerpo sí acelera
    expect(m.inercialCuerpoEntero.unidad).toBe('N')
    expect(m.inercialCuerpoEntero.estado).toBe('estimado')
    expect(verificarCifras([m.inercialCuerpoEntero])).toEqual([])
    expect(m.inercialCuerpoEntero.fuente).toContain(`angulos:${FUENTE}`)
  })
  it('decisión 36: en los extremos y con datos malos el término del cuerpo entero también es no_afirmable', () => {
    const r = momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: movida })
    expect(r.marcos[0]!.inercialCuerpoEntero.estado).toBe('no_afirmable')
    expect(momentosDeBulgaraEnElTiempo({ ...e, cargaKg: -1, fuenteDeAngulos: FUENTE, instantes: movida }).marcos[2]!.inercialCuerpoEntero.estado).toBe('no_afirmable')
  })

  it('los extremos, la fuente sin declarar, los pies que se mueven y los datos malos: no_afirmable', () => {
    const r = momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: movida })
    for (const k of [0, movida.length - 1]) {
      expect(r.marcos[k]!.delantera.cadera.total.estado).toBe('no_afirmable')
      expect(r.marcos[k]!.delantera.cadera.total.motivo).toMatch(/sin vecino/)
    }
    const sinFuente = momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: '  ', instantes: movida })
    expect(sinFuente.motivo).toMatch(/fuente de los ángulos/)
    expect(sinFuente.marcos.every((m) => m.trasera.rodilla.total.valor === null)).toBe(true)
    const piesQueSeMueven = momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: serie(5, 0.1, (i) => ({ pasoM: 0.85 + 0.01 * i })) })
    expect(piesQueSeMueven.motivo).toMatch(/pies de apoyo se mueven/)
    expect(momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: serie(2, 0.1, () => ({})) }).motivo).toMatch(/al menos 3/)
    expect(momentosDeBulgaraEnElTiempo({ ...e, talla: null, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: movida }).motivo).toMatch(/talla/)
    const noCreciente = serie(4, 0.1, () => ({}))
    noCreciente[2] = { t: 0.1, pose: noCreciente[2]!.pose }
    expect(momentosDeBulgaraEnElTiempo({ ...e, cargaKg: 32, fuenteDeAngulos: FUENTE, instantes: noCreciente }).motivo).toMatch(/estrictamente crecientes/)
  })
})
