/**
 * Vuelca los momentos con término inercial de tres movimientos de ángulos conocidos, para cruzarlos con el banco virtual
 * del laboratorio (`calculo/banco/fisica.py`). Los ángulos son senos con derivadas analíticas, así que el banco recibe
 * ω y α exactas y esta app recibe solo las muestras (diferencias finitas):
 *
 *     npx vite-node scripts/inercial-para-el-cruce.mts > cruce-app.json
 *     py -I scripts/cruce-inercial-con-banco.py cruce-app.json <ruta de lab-banco>
 */
import { momentosDeSentadillaEnElTiempo } from '../src/domain/sujeto/inercial'

const w = 2 * Math.PI
const dt = 0.002
const N = 501
const base = { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2 }
// amplitud (rad) y fase de cada segmento, por caso
const casos: Record<string, { A: number[]; fase: number[]; hz: number }> = {
  A_quieto: { A: [0, 0, 0, 0], fase: [0, 0, 0, 0], hz: 1 },
  B_solo_tronco: { A: [0, 0, 0.3, 0], fase: [0, 0, 0, 0], hz: 1 },
  C_sentadilla_completa: { A: [0.12, 0.35, 0.2, 0.1], fase: [0, 0.4, -0.3, 0.9], hz: 0.5 },
}
const entradas: Record<string, unknown> = {}
for (const [nombre, c] of Object.entries(casos)) {
  const om = 2 * Math.PI * c.hz
  const th = (k: number, t: number) => [base.tibia, base.muslo, base.tronco, base.cabeza][k] + c.A[k] * Math.sin(om * t + c.fase[k])
  const instantes = Array.from({ length: N }, (_, i) => {
    const t = i * dt
    return { t, pose: { tibia: th(0, t), muslo: th(1, t), tronco: th(2, t), cabeza: th(3, t), barraT: 0.1, pieZ: 0.05 } }
  })
  const r = momentosDeSentadillaEnElTiempo({ sexo: 'h', talla: 1.78, masa: 82, cargaKg: 100, instantes, fuenteDeAngulos: 'sintetico:cruce-con-el-banco' })
  const marcos = [60, 125, 190, 380].map((k) => {
    const m = r.marcos[k]
    const t = k * dt
    const cif = (c: { valor: number | null; banda: { inf: number; sup: number } | null }) => ({ valor: c.valor, inf: c.banda?.inf, sup: c.banda?.sup })
    return {
      k, t,
      theta: [0, 1, 2, 3].map((j) => th(j, t)),
      omega: [0, 1, 2, 3].map((j) => c.A[j] * om * Math.cos(om * t + c.fase[j])),
      alfa: [0, 1, 2, 3].map((j) => -c.A[j] * om * om * Math.sin(om * t + c.fase[j])),
      tobillo: { inercial: cif(m.tobillo.inercial), total: cif(m.tobillo.total) },
      rodilla: { inercial: cif(m.rodilla.inercial), total: cif(m.rodilla.total) },
      cadera: { inercial: cif(m.cadera.inercial), total: cif(m.cadera.total) },
    }
  })
  entradas[nombre] = { sexo: 'h', talla: 1.78, masa: 82, carga: 100, barraT: 0.1, marcos }
}
console.log(JSON.stringify(entradas, null, 1))
