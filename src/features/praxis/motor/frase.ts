import { Cab } from './cabecera'
import { $, h } from './dom'
import { guardar, leer, reducido, tu } from './entorno'
import { DUR, esperar } from './movimiento'
import { Onda } from './onda'
import { S, vigilar, type Fuente } from './sesion'
import { ritmoLectura, silabasDe, type Ritmo } from './texto'
import { Voz } from './voz'

/**
 * Praxis habla. Un solo reloj de voz: el texto, el disco y el sonido leen el mismo. La señal
 * visual llega un poco antes que la causa: el disco toma aire 120 ms antes de la primera
 * sílaba y cada palabra se ilumina 30 ms antes de oírse.
 *
 * Con voz: el texto entero aparece en 240 ms, las palabras sin decir quedan a opacidad .55
 * (legibles) y suben a 1 en 160 ms, al reloj del audio. Sin voz (Bryan, 29-sep): lo mismo,
 * palabra a palabra, pero al ritmo de LECTURA, y el disco «habla» ese mismo reloj. Tocar la
 * frase (o «Completar la frase») la deja entera. Con movimiento reducido, la frase entera
 * desde el primer cuadro.
 */
const REVELADO: 'frase' | 'palabra' = 'palabra'

interface FraseMontada extends Ritmo { spans: HTMLSpanElement[]; tonos: number[]; lectura: Ritmo }

export function montarFrase(texto: string): FraseMontada {
  const fr = $('#frase')
  fr.textContent = ''
  const palabras = texto.split(/\s+/).filter(Boolean)
  fr.classList.toggle('larga', palabras.length > 22); $('#notaPrimera').textContent = ''; $('#notaPrimera').classList.remove('bajo')
  const spans = palabras.map((p) => h('span', { class: 'w' }, p))
  spans.forEach((s, i) => { fr.append(s); if (i < spans.length - 1) fr.append(' ') })
  $('#dicho').classList.remove('vacio')
  let t = 0
  const inicios: number[] = [], silabas: number[] = [], tonos: number[] = []
  const pregunta = /\?\s*$/.test(texto.trim())
  palabras.forEach((p, i) => {
    inicios.push(t)
    tonos.push(pregunta && i >= palabras.length - 2 ? 3 : /[,;:]$/.test(p) ? -0.5 : 0) // prosodia estimada: la pregunta sube al final
    const n = silabasDe(p)
    for (let k = 0; k < n; k++) silabas.push(t + k * 0.15)
    t += n * 0.15 + 0.06
    if (/[,;:]$/.test(p)) t += 0.22
    if (/[.?!»"]$/.test(p)) t += 0.34
  })
  return { spans, inicios, silabas, dur: t, tonos, lectura: ritmoLectura(palabras) }
}
/** Una frase que se muestra entera, sin decirla. */
export function fijarFrase(texto: string): void { montarFrase(texto).spans.forEach((s) => s.classList.add('on')) }

function pistaFrase(): string { return tu('Toca la frase para completarla.', 'Toque la frase para completarla.') }
function reentrar(el: HTMLElement): void { el.classList.remove('entra'); void el.offsetWidth; el.classList.add('entra') }

export interface OpcionesDecir { nota?: string; simularVoz?: boolean }

export async function decir(texto: string, tok: number | null, opt: OpcionesDecir = {}): Promise<void> {
  if (tok != null) vigilar(tok)
  const ayuda = $('#ayuda')
  ayuda.textContent = ''
  const mf = montarFrase(texto), { spans, tonos } = mf
  if (opt.nota) { // la primera vez: nota del canal humano encima, la pregunta en su propia línea y el cuerpo de la frase larga
    $('#notaPrimera').textContent = opt.nota; $('#frase').classList.add('larga')
    for (let i = spans.length - 1; i > 0; i--) if (/[.?!»"]$/.test(spans[i - 1].textContent || '')) { const sp = spans[i].previousSibling; if (sp && sp.nodeType === 3) (sp as Text).after(h('br')); break } // el espacio se queda (copiar y lector de pantalla)
  }
  let { inicios, silabas, dur } = mf // reloj de habla (voz o simulación); sin voz se cambia por el de lectura en cuanto se sabe
  const limpio = texto.replace(/[«»"]/g, ''), pos: number[] = []
  { let i = 0; for (const p of limpio.split(/\s+/).filter(Boolean)) { const j = limpio.indexOf(p, i); pos.push(j); i = j + p.length } }
  const red = reducido(), dicho = $('#dicho'), fr = $('#frase'), btnC = $('#btnCompletar')
  /* El revelado palabra a palabra se decide YA, con lo previsto, y ANTES del reflujo de .entra: si las palabras llegaran a calcular su estilo sin .lee,
     nacerían a 1 y bajarían a .55 con su transición (un parpadeo en cada frase). Solo se corrige si la voz resulta no estar disponible. */
  const progPrevisto = !red && (Voz.activa || !!opt.simularVoz || REVELADO === 'palabra')
  dicho.classList.toggle('lee', progPrevisto)
  if (!red) reentrar(fr) // el texto entero aparece en 240 ms
  Onda.estado('habla')
  let cortarRes: () => void = () => {}
  const cortaP = new Promise<void>((r) => { cortarRes = r })
  const s0 = S
  s0.cortar = false; s0.cortarFn = () => { s0.cortar = true; Voz.callar(); cortarRes() }
  const esp = (ms: number) => Promise.race([esperar(ms), cortaP])
  const reloj = { t0: performance.now() }
  let finVoz: (() => void) | null = null, iniciada = false, anclado = false, bloqueada = false, palabrasOn = 0, tick = 0, t1500 = 0, tTope = 0
  const anclar = () => { if (anclado) return; anclado = true; reloj.t0 = performance.now(); Onda.prosodia(silabas) } // la sílaba 0 suena aquí
  /* Cada límite de palabra que marca el TTS vuelve a anclar el reloj: si la palabra k llega en tb, la palabra k empieza en tb */
  const alLimite = (e: SpeechSynthesisEvent) => {
    Onda.pulsoPraxis()
    if (e && e.name === 'word' && typeof e.charIndex === 'number' && anclado) {
      let k = -1
      for (let i = 0; i < pos.length; i++) if (e.charIndex >= pos[i]) k = i
      if (k >= 0) { const nuevo = performance.now() - inicios[k] * 1000; Onda.desplazar((nuevo - reloj.t0) / 1000); reloj.t0 = nuevo }
    }
  }
  try {
    Onda.anticipa()
    await esp(red ? 0 : DUR.anticipa) // el disco toma aire antes de la primera sílaba
    if (tok != null) vigilar(tok)
    const conVoz = Voz.decir(texto, alLimite, () => { if (finVoz) finVoz() }, () => { iniciada = true; anclar() })
    if (!conVoz && !opt.simularVoz) ({ inicios, silabas, dur } = mf.lectura) // sin audio: un solo reloj, el de lectura (texto y disco)
    const progresivo = !red && (!!conVoz || !!opt.simularVoz || REVELADO === 'palabra')
    if (progresivo !== progPrevisto) dicho.classList.toggle('lee', progresivo)
    if (!progresivo) spans.forEach((s) => s.classList.add('on'))
    btnC.hidden = !progresivo
    if (opt.nota) { /* la primera vez no hay pista: «Completar la frase» ya está a la vista y la nota del canal humano ocupa su sitio */ }
    else if (progresivo && !leer('pistaFrase', false)) { ayuda.textContent = pistaFrase(); reentrar(ayuda); guardar('pistaFrase', true) }
    if (!conVoz) anclar()
    else t1500 = window.setTimeout(() => { if (!iniciada) { bloqueada = true; anclar(); if (finVoz) finVoz() } }, 1500) // el navegador bloqueó la voz: seguimos con la prosodia simulada
    const promVoz = conVoz ? new Promise<void>((r) => { finVoz = r; tTope = window.setTimeout(r, Math.min(15000, dur * 1600 + 2500)) }) : null
    if (progresivo) {
      const revelar = () => {
        if (!anclado) return
        const ahora = performance.now()
        while (palabrasOn < spans.length && ahora >= reloj.t0 + inicios[palabrasOn] * 1000 - 30) { spans[palabrasOn].classList.add('on'); Onda.tono(tonos[palabrasOn]); palabrasOn++ } // 30 ms antes de sonar
      }
      tick = window.setInterval(revelar, 20)
    } else if (anclado) tick = window.setInterval(() => { const a = performance.now(); let i = 0; while (i < inicios.length && a >= reloj.t0 + inicios[i] * 1000) i++; if (i > 0) Onda.tono(tonos[i - 1]) }, 60)
    if (promVoz) { await Promise.race([promVoz, cortaP]); if (bloqueada && !s0.cortar) await esp(Math.max(0, dur * 1000 - (performance.now() - reloj.t0))) }
    else await esp(dur * 1000)
    if (tok != null) vigilar(tok)
    if (!s0.cortar && /[.?!»"]\s*$/.test(texto.trim())) Onda.asentar() // un único asentamiento: el punto final visual
  } finally {
    clearInterval(tick); clearTimeout(t1500); clearTimeout(tTope)
    s0.cortarFn = null
    spans.forEach((s) => s.classList.add('on'))
    dicho.classList.remove('lee'); btnC.hidden = true; Onda.tono(0)
    if (ayuda.textContent === pistaFrase()) ayuda.textContent = ''
  }
  if (s0.cortar) Onda.callar()
  if (Onda.estadoActual === 'habla') Onda.estado('reposo')
  Cab.finFrase()
}
export function decirCorto(texto: string): void {
  const { spans, silabas, dur } = montarFrase(texto)
  spans.forEach((s) => s.classList.add('on'))
  Onda.estado('habla'); Onda.prosodia(silabas); Voz.decir(texto, () => Onda.pulsoPraxis(), () => {})
  setTimeout(() => { if (Onda.estadoActual === 'habla') Onda.estado(S.enFirma ? 'firma' : 'reposo') }, dur * 1000 + 100)
}
/* Lo que la persona dijo: se muestra entero (varias líneas, sin elipsis) y solo baja hasta .75 (≥ 7:1). No hay animación por tecla:
   al enviar, seis pulsos plata cada 90 ms con amplitud .45–.70. */
let tPersona = 0
export function mostrarPersona(txt: string, fuente?: Fuente): void {
  const p = $('#dijo')
  p.classList.remove('apaga')
  p.textContent = (fuente === 'voz' ? tu('Dijiste: ', 'Dijo: ') : '') + '«' + txt + '»'
  $('#dicho').classList.remove('vacio')
  clearTimeout(tPersona); tPersona = window.setTimeout(() => p.classList.add('apaga'), 1400)
  Onda.fuente(false)
  for (let i = 0; i < 6; i++) setTimeout(() => Onda.usuario(0.45 + Math.random() * 0.25), i * 90)
}
export function ponerSugerencias(lista: string[]): void {
  const box = $('#sugerencias')
  box.textContent = ''
  S.muestras = lista || []
  S.muestras.forEach((t) => box.append(h('button', { type: 'button', class: 'sug', title: t, onclick: () => { const i = $<HTMLInputElement>('#entrada'); i.value = t; i.focus() } }, h('b', null, 'EJEMPLO'), t)))
}
