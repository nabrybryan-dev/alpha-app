import { TXT, type DatosDia } from './datos'
import { num } from './movimiento'
import { fmtNum, minNoche, sesion } from './texto'

/** firmaDelDia: función pura. Misma entrada, misma onda. El peso nunca entra. */
export function hash01(s: string): number {
  let x = 2166136261
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) }
  return (x >>> 0) / 4294967295
}

export interface Firma { pts: number[]; vacia: boolean; dolorX: number | null; ambar: boolean; cero?: boolean }

export function firmaDelDia(datos: DatosDia | null | undefined, usuarioId: string, fecha: string, n = 160): Firma {
  const d: DatosDia = datos || {}
  const fase = hash01(usuarioId + fecha) * Math.PI * 2 // la semilla solo mueve la fase
  const k = d.estres === 'MUCHO' ? 1.45 : d.estres === 'REGULAR' ? 1.2 : 1
  const faseNoche = d.horaAcostarse ? (minNoche(d.horaAcostarse) / 360) * Math.PI * 2 : 0
  const pts: number[] = new Array(n).fill(0)
  let hay = false
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1)
    let y = 0
    if (d.horasSueno != null || d.calidadSueno) { // SUEÑO: la fundamental
      const crestas = d.horasSueno != null ? 1 + (9 - Math.min(d.horasSueno, 9)) / 9 : 1.5
      const f = crestas * k, ph = faseNoche + fase * 0.15
      let s
      if (d.calidadSueno === 'MALA') s = Math.sin(2 * Math.PI * f * x + ph + 0.35 * Math.sin(2 * Math.PI * 7 * x + fase))
      else { s = Math.sin(2 * Math.PI * f * x + ph); if (d.calidadSueno === 'REGULAR') s += 0.25 * Math.sin(4 * Math.PI * f * x + ph) }
      y += s; hay = true
    }
    if (d.hambreEscala != null) { // COMIDA: el segundo armónico
      const r = (d.hambreEscala + 1) * k
      const irr = d.alimentacion === 'MALA' ? 0.5 : d.alimentacion === 'REGULAR' ? 0.2 : 0
      y += 0.28 * Math.sin(2 * Math.PI * r * x + irr * Math.sin(2 * Math.PI * 3 * x + fase) + fase); hay = true
    } else if (d.alimentacion) { y += 0.12 * Math.sin(2 * Math.PI * 6 * k * x + fase); hay = true }
    if (d.entreno && d.entreno !== 'Descansé') { // CUERPO: el golpe a un tercio
      const nit = d.rendimiento === 'BUENA' ? 0.018 : d.rendimiento === 'REGULAR' ? 0.03 : 0.045
      const g = Math.exp(-((x - 1 / 3) ** 2) / (2 * nit * nit))
      y += 0.9 * g * Math.cos(2 * Math.PI * 14 * k * (x - 1 / 3)); hay = true
    }
    if (d.pasos != null && x > 0.5) { // rizos finos, mitad derecha
      const dens = 4 + (Math.min(d.pasos, 20000) / 20000) * 22
      y += 0.09 * Math.sin(2 * Math.PI * dens * k * x * 2 + fase) * Math.sin(Math.PI * (x - 0.5) * 2); hay = true
    }
    if (d.estres === 'MUCHO' || d.estres === 'REGULAR') { // MENTE: grano fino
      const gr = d.estres === 'MUCHO' ? 0.07 : 0.035
      y += gr * Math.sin(2 * Math.PI * 43 * x + fase * 3) * Math.sin(2 * Math.PI * 17 * x); hay = true
    } else if (d.estres === 'POCO') hay = true
    let env = 1 // ENERGÍA: cambia la forma, no el tamaño
    if (d.motivacion === 'MUCHO') env *= 0.55 + 0.45 * x; else if (d.motivacion === 'POCO') env *= 1 - 0.45 * x
    if (d.cansancio === 'MUCHO' && x > 0.66) env *= Math.exp(-(x - 0.66) * 5)
    else if (d.cansancio === 'REGULAR' && x > 0.75) env *= Math.exp(-(x - 0.75) * 3)
    if (d.motivacion || d.cansancio) hay = true
    if (d.entreno === 'Descansé' && x < 0.1) env *= (x / 0.1) * 0.2
    if (d.dolor != null && d.dolor > 0) { // el nudo
      const g = Math.exp(-((x - 0.58) ** 2) / (2 * 0.035 * 0.035))
      y = y * (1 - (0.5 * g * d.dolor) / 10) - g * (0.25 + (0.9 * d.dolor) / 10); hay = true
    }
    pts[i] = y * env * Math.sin(Math.PI * x) ** 2 // envolvente de Hann
  }
  let m = 0
  for (const v of pts) m = Math.max(m, Math.abs(v))
  if (!hay || m < 1e-6) return { pts: pts.map(() => 0), vacia: true, dolorX: null, ambar: false }
  return { pts: pts.map((v) => v / m), vacia: false, dolorX: num(d.dolor) > 0 ? 0.58 : null, ambar: num(d.dolor) >= 4, cero: d.dolor === 0 }
}

/** La firma enrollada en un anillo: empieza y termina arriba (la envolvente de Hann la cierra en cero). */
export function anilloPath(pts: number[], cx: number, cy: number, R: number, amp: number): string {
  let dd = ''
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const th = -Math.PI / 2 + (i / (n - 1)) * Math.PI * 2 * 0.999, r = R + pts[i] * amp
    dd += (i ? 'L' : 'M') + (cx + r * Math.cos(th)).toFixed(1) + ' ' + (cy + r * Math.sin(th)).toFixed(1)
  }
  return dd + 'Z'
}
export function puntoAnillo(pts: number[], u: number, cx: number, cy: number, R: number, amp: number): [number, number] {
  const i = Math.min(pts.length - 1, Math.round(u * (pts.length - 1))), th = -Math.PI / 2 + u * Math.PI * 2, r = R + pts[i] * amp
  return [cx + r * Math.cos(th), cy + r * Math.sin(th)]
}

export function resumenFirma(d: DatosDia | null | undefined, dia: string): string {
  if (!d) return 'Sin registro el ' + dia + '.'
  const p: string[] = []
  if (d.horasSueno != null || d.calidadSueno) p.push('sueño ' + [d.horasSueno != null ? fmtNum(d.horasSueno) + ' h' : null, d.calidadSueno ? TXT.sue[d.calidadSueno] : null].filter(Boolean).join(', '))
  if (d.cansancio) p.push(TXT.can[d.cansancio])
  if (d.entreno) p.push('entreno ' + sesion(d.entreno) + (d.rendimiento ? ', ' + rendimientoDicho(d) : ''))
  if (d.motivacion) p.push(TXT.gan[d.motivacion])
  if (d.dolor != null) p.push(d.dolor === 0 ? 'nada duele' : 'dolor ' + d.dolor + (d.dolorDonde ? ' en ' + d.dolorDonde : ''))
  if (d.hambreEscala != null) p.push('hambre ' + d.hambreEscala)
  if (d.alimentacion) p.push(TXT.com[d.alimentacion])
  if (d.estres) p.push(TXT.est[d.estres])
  return 'Firma del ' + dia + ': ' + p.join('; ') + '.'
}
/** «me fue bien», o «me sentí bien» si ese día descansó. */
export function rendimientoDicho(d: DatosDia): string {
  const t = TXT.ren[d.rendimiento as string]
  return d.entreno === 'Descansé' ? 'me sentí ' + t.replace('me fue ', '') : t
}
