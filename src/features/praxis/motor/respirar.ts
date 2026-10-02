import { Cab, compactar } from './cabecera'
import { $, h } from './dom'
import { guardar, leer, reducido } from './entorno'
import { Onda } from './onda'
import { cerrarMenuMas } from './sala'
import { S } from './sesion'

/**
 * La respiración escondida. Inhalar 4 s, soltar 6 s, tres veces. Entradas: el botón
 * «Respirar un minuto» (en la ayuda y en «Más»). Mantener el agujero ya no la abre: desde el
 * 2-oct ese gesto es hablar (hablar.ts). Con movimiento reducido: cuenta atrás en mono y el anillo cambia solo entre .75 y 1.
 */
export async function respirar(): Promise<boolean> {
  if (S.respirando || S.quieta || $('#sala').hidden) return false
  const s0 = S
  s0.respirando = true; Cab.pendiente = false; cerrarMenuMas()
  const eraCompacta = $('#ondaCaja').classList.contains('compacta')
  compactar(false) // el aliento vive en la onda grande
  const pie = $('#ondaPie')
  pie.textContent = ''; $('#ondaCaja').classList.add('respirando')
  const red = reducido()
  const puntos = h('div', { class: 'puntos', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'))
  const txt = h('span', { class: 'respira-txt' + (red ? ' mono' : ''), 'aria-live': 'polite' }, 'Inhala')
  const saltar = h('button', { type: 'button', class: 'chip' }, 'Saltar')
  let cancel = false
  saltar.addEventListener('click', () => { cancel = true })
  pie.append(txt, puntos, saltar)
  const t0 = performance.now()
  await new Promise<void>((res) => {
    const paso = () => {
      if (cancel || $('#sala').hidden) return res()
      const t = (performance.now() - t0) / 1000, ciclo = Math.floor(t / 10)
      if (ciclo >= 3) return res()
      const c = t % 10, nivel = c < 4 ? 0.5 - 0.5 * Math.cos((Math.PI * c) / 4) : 0.5 + 0.5 * Math.cos((Math.PI * (c - 4)) / 6)
      Onda.respirar(nivel)
      let t2
      if (red) { // cuenta atrás: «Inhala 4 · 3 · 2 · 1», «Suelta 6 … 1»
        const inhala = c < 4, n = inhala ? 4 - Math.floor(c) : 6 - Math.floor(c - 4), tot = inhala ? 4 : 6, lista: number[] = []
        for (let k = tot; k >= n; k--) lista.push(k)
        t2 = (inhala ? 'Inhala ' : 'Suelta ') + lista.join(' · ')
      } else t2 = ciclo === 0 ? (c < 4 ? 'Inhala' : 'Suelta') : ''
      if (txt.textContent !== t2) txt.textContent = t2
      Array.from(puntos.children).forEach((s, i) => s.classList.toggle('on', i < ciclo || (i === ciclo && c >= 4)))
      requestAnimationFrame(paso)
    }
    requestAnimationFrame(paso)
  })
  Onda.respirar(null); pie.textContent = ''; $('#ondaCaja').classList.remove('respirando'); s0.respirando = false
  if (eraCompacta && !$('#sala').hidden) compactar(true)
  if (cancel) guardar('saltosRespira', leer('saltosRespira', 0) + 1)
  return !cancel
}
