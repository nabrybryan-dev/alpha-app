import type { DatosDia } from './datos'
import { clamp } from './movimiento'

/**
 * La voz de Praxis: speechSynthesis solo tras un toque; tolera que no haya ninguna.
 * Entre las voces del aparato, primero una femenina en español (por lista de nombres) y, si
 * no hay ninguna, la primera local en español; dentro de cada grupo, primero las «mejoradas»
 * o «premium», que suenan mucho menos robóticas que las básicas.
 *
 * Ritmo (Bryan, 2-oct: «va muy lenta, se siente robótica»): las voces del aparato en
 * español ya son lentas a velocidad 1, así que va a 1,08 y no a ,95. Y no lee todo de un
 * solo aliento: parte el texto en frases, y una frase larga en su coma, para que cada
 * pausa caiga donde cambia la idea; la pregunta final va un poco más pausada y un tono más
 * arriba, para que se oiga que es la pregunta.
 *
 * ES LA VOZ DEL PROTOTIPO. La de verdad (Kokoro, elegida en la escucha a ciegas) no está desplegada.
 */
const NOMBRES_F = ['sabina', 'helena', 'elena', 'laura', 'paulina', 'monica', 'mónica', 'marisol', 'angelica', 'angélica', 'paloma', 'esperanza', 'soledad', 'jimena', 'lucia', 'lucía', 'luciana', 'carmen', 'paola', 'isabela', 'salome', 'salomé', 'dalia', 'elvira', 'camila', 'francisca', 'ximena', 'valentina', 'catalina', 'sofia', 'sofía', 'mia', 'mía', 'dora', 'female', 'mujer', 'femenin']
const MEJORADA = /premium|enhanced|mejorad|neural|natural/i
const RITMO = 1.08
const RITMO_PREGUNTA = 1.0
const TONO_PREGUNTA = 1.06
const PALABRAS_SIN_CORTE = 14

interface Trozo { texto: string; desde: number; pregunta: boolean }

/** Frases, y una frase larga en su primera coma después de la mitad; con su posición en el texto. */
function partir(texto: string): Trozo[] {
  const trozos: Trozo[] = []
  const frases = texto.match(/[^.!?…]+[.!?…]*\s*/g) || [texto]
  let pos = 0
  for (const crudo of frases) {
    const desde = texto.indexOf(crudo, pos)
    pos = desde + crudo.length
    const f = crudo.trim()
    if (!f) continue
    const inicio = desde + crudo.indexOf(f)
    const palabras = f.split(/\s+/).length
    const coma = palabras > PALABRAS_SIN_CORTE ? f.indexOf(', ', Math.floor(f.length / 2)) : -1
    const pregunta = f.endsWith('?')
    if (coma > 0) {
      trozos.push({ texto: f.slice(0, coma + 1), desde: inicio, pregunta: false })
      trozos.push({ texto: f.slice(coma + 2), desde: inicio + coma + 2, pregunta })
    } else trozos.push({ texto: f, desde: inicio, pregunta })
  }
  return trozos.length ? trozos : [{ texto, desde: 0, pregunta: texto.trim().endsWith('?') }]
}

let turno = 0

export const Voz = {
  activa: false, esperando: false,
  disponible(): boolean { return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined' },
  /* Solo voces del propio aparato: las «en línea» mandarían lo que cuentas a un servidor. */
  elegir(): SpeechSynthesisVoice | null {
    try {
      const vs = (window.speechSynthesis.getVoices() || []).filter((x) => x.localService)
      const norm = (l: string) => (l || '').replace('_', '-').toLowerCase()
      const es = vs.filter((x) => norm(x.lang).startsWith('es'))
      const fem = (x: SpeechSynthesisVoice) => { const n = (x.name || '').toLowerCase(); return NOMBRES_F.some((f) => n.includes(f)) }
      const orden = ['es-co', 'es-mx', 'es-us', 'es-es']
      const mejor = (xs: SpeechSynthesisVoice[]) => xs.find((x) => MEJORADA.test(x.name || '')) || xs[0]
      for (const c of orden) { const v = mejor(es.filter((x) => norm(x.lang) === c && fem(x))); if (v) return v }
      const f = mejor(es.filter(fem))
      if (f) return f
      for (const c of orden) { const v = mejor(es.filter((x) => norm(x.lang) === c)); if (v) return v }
      return mejor(es) || null
    } catch { return null }
  },
  hayVoces(): boolean { try { return (window.speechSynthesis.getVoices() || []).length > 0 } catch { return false } },
  decir(texto: string, onLimite: (e: SpeechSynthesisEvent) => void, onFin: () => void, onInicio?: () => void): boolean {
    if (!this.activa || !this.disponible()) return false
    try {
      const v = this.elegir()
      if (!v) return false
      window.speechSynthesis.cancel()
      const mio = ++turno // lo que quede en cola de un turno anterior ya no avisa a nadie
      const limpio = texto.replace(/[«»"]/g, '')
      const trozos = partir(limpio)
      let terminado = false
      const fin = () => { if (mio === turno && !terminado) { terminado = true; onFin() } }
      trozos.forEach((t, i) => {
        const u = new SpeechSynthesisUtterance(t.texto)
        u.voice = v; u.lang = v.lang
        u.rate = t.pregunta ? RITMO_PREGUNTA : RITMO
        u.pitch = t.pregunta ? TONO_PREGUNTA : 1
        // La pantalla subraya por posición en el texto entero: se le suma dónde empieza el trozo.
        u.onboundary = (e) => { if (mio === turno) onLimite({ name: e.name, charIndex: e.charIndex + t.desde } as SpeechSynthesisEvent) }
        u.onerror = fin
        if (i === trozos.length - 1) u.onend = fin
        if (i === 0 && onInicio) u.onstart = () => { if (mio === turno) onInicio() }
        window.speechSynthesis.speak(u)
      })
      return true
    } catch { return false }
  },
  callar(): void { try { if (this.disponible()) window.speechSynthesis.cancel() } catch { /* nada */ } },
}

/* ——— El eco: 2,5 s de acorde pentatónico sintetizado. Solo suena si la persona lo pide ——— */
let acEco: AudioContext | null = null
/** El audio también se duerme con la pestaña. */
export function dormirEco(oculta: boolean): void {
  try { if (acEco && acEco.state !== 'closed') { if (oculta) void acEco.suspend(); else void acEco.resume() } } catch { /* nada */ }
}
export function cerrarEco(): void { try { if (acEco && acEco.state !== 'closed') void acEco.close() } catch { /* nada */ } acEco = null }

export function sonarEco(d: DatosDia, onProgreso: (p: number) => void): boolean {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return false
  let ac: AudioContext
  try { ac = new AC(); acEco = ac } catch { return false }
  const t0 = ac.currentTime + 0.06, dur = 2.5
  const esc = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
  const hs = d.horasSueno != null ? d.horasSueno : 6.5
  const grado = clamp(Math.round(hs - 4), 0, 5) // el sueño da la nota base
  const salto = 1 + (((d.hambreEscala || 5) - 1) % 4) // el hambre, el intervalo de la segunda voz
  const f0 = 196 * Math.pow(2, esc[grado] / 12), f1 = 196 * Math.pow(2, esc[grado + salto] / 12)
  const brillo = d.motivacion === 'MUCHO' ? 0.5 : d.motivacion === 'REGULAR' ? 0.28 : 0.12 // la energía, el brillo
  const master = ac.createGain()
  master.gain.setValueAtTime(0.0001, t0); master.gain.exponentialRampToValueAtTime(0.2, t0 + 0.08)
  master.gain.setValueAtTime(0.2, t0 + dur - 0.9); master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  const trem = ac.createGain()
  trem.gain.value = 1
  if (d.estres === 'MUCHO' || d.estres === 'REGULAR') { // el estrés, un trémolo suave
    const lfo = ac.createOscillator(), lg = ac.createGain()
    lfo.frequency.value = d.estres === 'MUCHO' ? 6 : 4; lg.gain.value = d.estres === 'MUCHO' ? 0.22 : 0.12
    lfo.connect(lg); lg.connect(trem.gain); lfo.start(t0); lfo.stop(t0 + dur)
  }
  trem.connect(master); master.connect(ac.destination)
  const voz = (f: number, tipo: OscillatorType, g: number, ret: number) => { const o = ac.createOscillator(), gg = ac.createGain(); o.type = tipo; o.frequency.value = f; gg.gain.setValueAtTime(0.0001, t0 + ret); gg.gain.exponentialRampToValueAtTime(g, t0 + ret + 0.12); o.connect(gg); gg.connect(trem); o.start(t0 + ret); o.stop(t0 + dur) }
  voz(f0, 'sine', 0.6, 0); voz(f1, 'sine', 0.35, 0.25); voz(f0 * 2, 'triangle', brillo * 0.5, 0.1)
  if (d.entreno && d.entreno !== 'Descansé') { // el entreno, un golpe leve
    const o = ac.createOscillator(), g = ac.createGain(), th = t0 + dur / 3
    o.frequency.setValueAtTime(110, th); o.frequency.exponentialRampToValueAtTime(55, th + 0.25)
    g.gain.setValueAtTime(0.0001, th); g.gain.exponentialRampToValueAtTime(0.5, th + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, th + 0.3)
    o.connect(g); g.connect(master); o.start(th); o.stop(th + 0.32)
  }
  const inicio = performance.now()
  const paso = () => { const p = (performance.now() - inicio) / (dur * 1000); if (p < 1) { onProgreso(p); requestAnimationFrame(paso) } else onProgreso(-1) }
  requestAnimationFrame(paso)
  setTimeout(() => { try { void ac.close() } catch { /* nada */ } }, (dur + 0.4) * 1000)
  return true
}
