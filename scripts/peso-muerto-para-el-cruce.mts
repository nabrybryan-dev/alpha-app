/**
 * Vuelca los momentos del peso muerto con término inercial para dos movimientos de ángulos conocidos (senos con derivadas analíticas), para cruzarlos con
 * la dinámica del banco virtual del laboratorio (`calculo/banco/fisica.py`, solo lectura):
 *
 *     npx vite-node scripts/peso-muerto-para-el-cruce.mts > cruce-peso-muerto-app.json
 *     py -I scripts/cruce-peso-muerto-con-banco.py cruce-peso-muerto-app.json <ruta de lab-banco>
 */
import { POSE_DE_PARTIDA_ILUSTRATIVA, momentosDePesoMuertoEnElTiempo } from '../src/domain/sujeto/pesoMuerto'

const dt = 0.002
const N = 501
const base = POSE_DE_PARTIDA_ILUSTRATIVA
const casos: Record<string, { A: number[]; fase: number[]; hz: number }> = {
  A_quieto: { A: [0, 0, 0, 0], fase: [0, 0, 0, 0], hz: 1 },
  B_peso_muerto_completo: { A: [0.1, 0.5, 0.45, 0.15], fase: [0, 0.3, -0.2, 0.7], hz: 0.5 },
}
const salida: Record<string, unknown> = {}
for (const [nombre, c] of Object.entries(casos)) {
  const om = 2 * Math.PI * c.hz
  const b = [base.tibia, base.muslo, base.tronco, base.cabeza]
  const th = (k: number, t: number) => b[k]! + c.A[k]! * Math.sin(om * t + c.fase[k]!)
  const instantes = Array.from({ length: N }, (_, i) => {
    const t = i * dt
    return { t, pose: { tibia: th(0, t), muslo: th(1, t), tronco: th(2, t), cabeza: th(3, t), brazo: base.brazo, pieZ: base.pieZ } }
  })
  const r = momentosDePesoMuertoEnElTiempo({ sexo: 'h', talla: 1.78, masa: 82, cargaKg: 100, instantes, fuenteDeAngulos: 'sintetico:cruce-con-el-banco' })
  const cif = (x: { valor: number | null; banda: { inf: number; sup: number } | null }) => ({ valor: x.valor, inf: x.banda?.inf, sup: x.banda?.sup })
  const marcos = [60, 125, 190, 380].map((k) => {
    const m = r.marcos[k]!
    const t = k * dt
    return {
      k,
      theta: [0, 1, 2, 3].map((j) => th(j, t)),
      omega: [0, 1, 2, 3].map((j) => c.A[j]! * om * Math.cos(om * t + c.fase[j]!)),
      alfa: [0, 1, 2, 3].map((j) => -c.A[j]! * om * om * Math.sin(om * t + c.fase[j]!)),
      tobillo: { inercial: cif(m.tobillo.inercial), total: cif(m.tobillo.total) },
      rodilla: { inercial: cif(m.rodilla.inercial), total: cif(m.rodilla.total) },
      cadera: { inercial: cif(m.cadera.inercial), total: cif(m.cadera.total) },
    }
  })
  salida[nombre] = { sexo: 'h', talla: 1.78, masa: 82, carga: 100, brazo: base.brazo, marcos }
}
console.log(JSON.stringify(salida, null, 1))
