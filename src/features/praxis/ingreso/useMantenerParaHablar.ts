import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { limpiarDictado } from '../motor/dictado'
import { ESPERA_FINAL_MS, TOMA_MAX_MS, UMBRAL_MS, leerResultados, reconocedor, type Reconocedor } from '../motor/reconocedor'
import { Voz } from '../motor/voz'

/**
 * Mantener presionado para hablar, para la prueba del ingreso: el MISMO gesto y el mismo reconocedor del navegador
 * que el agujero de Praxis (`motor/hablar.ts`), sin la escena. La app no toca el audio: solo recibe texto.
 *
 *  - Mantener ≥ 250 ms abre el reconocedor del navegador (Google en Android/Chrome, Apple en iPhone);
 *    un toque corto no graba nada y enseña el gesto.
 *  - Al soltar, espera lo final (como mucho 2,5 s), lo limpia de pausas con `limpiarDictado` y lo entrega.
 *  - Un minuto como máximo por toma.
 *  - Con teclado: mantener la barra espaciadora hace lo mismo.
 *  - Antes de escuchar, Praxis se calla (no se oye a sí misma).
 */
export interface OpcionesToma {
  /** Lo dicho, ya limpio. */
  alTexto: (texto: string) => void
  habilitado?: boolean
  /** Elige entre el tú y el usted. */
  t: (tu: string, usted: string) => string
}

type Fase = 'libre' | 'armando' | 'oyendo' | 'cerrando'

export function useMantenerParaHablar({ alTexto, habilitado = true, t }: OpcionesToma) {
  const [escuchando, setEscuchando] = useState(false)
  const [vivo, setVivo] = useState('')
  const [aviso, setAviso] = useState('')
  const disponible = useMemo(() => reconocedor() !== null, [])

  const estado = useRef({
    fase: 'libre' as Fase, rec: null as Reconocedor | null, final: '', interino: '', error: '', enviar: true, porTiempo: false,
    tUmbral: 0, tMax: 0, tFin: 0, puntero: -1,
  })
  // Lo último que llegó por props, para que los callbacks del reconocedor no usen uno viejo.
  const vivas = useRef({ alTexto, habilitado, t })
  useEffect(() => { vivas.current = { alTexto, habilitado, t } })

  const terminar = useCallback(() => {
    const e = estado.current
    if (e.fase !== 'oyendo' && e.fase !== 'cerrando') return
    clearTimeout(e.tMax); clearTimeout(e.tFin)
    const rec = e.rec
    e.rec = null; e.fase = 'libre'
    if (rec) { rec.onresult = null; rec.onerror = null; rec.onend = null }
    setEscuchando(false); setVivo('')
    if (!e.enviar) return
    const { t: tt, alTexto: enviar } = vivas.current
    if (e.error === 'microfono') { setAviso(tt('Este navegador no deja usar el micrófono aquí. Revisa el permiso, o escribe tu respuesta.', 'Este navegador no deja usar el micrófono aquí. Revise el permiso, o escriba su respuesta.')); return }
    const texto = limpiarDictado(e.final || e.interino)
    if (!texto) {
      setAviso(e.error === 'red'
        ? tt('No pude entenderte: el reconocimiento de voz necesita internet.', 'No pude entenderle: el reconocimiento de voz necesita internet.')
        : tt('No te oí. Mantén presionado mientras hablas.', 'No le oí. Mantenga presionado mientras habla.'))
      return
    }
    setAviso(e.porTiempo ? tt('Un minuto como máximo por toma: envié lo que entendí.', 'Un minuto como máximo por toma: envié lo que entendí.') : '')
    enviar(texto)
  }, [])

  const cerrar = useCallback(() => {
    const e = estado.current
    if (e.fase !== 'oyendo') return
    e.fase = 'cerrando'; clearTimeout(e.tMax)
    e.tFin = window.setTimeout(terminar, ESPERA_FINAL_MS)
    try { e.rec?.stop() } catch { terminar() }
  }, [terminar])

  const empezar = useCallback(() => {
    const e = estado.current
    if (e.fase !== 'armando') return
    e.fase = 'libre'
    const C = reconocedor()
    if (!vivas.current.habilitado || !C) return
    Voz.callar()
    let rec: Reconocedor
    try {
      rec = new C()
      rec.lang = 'es-CO'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1
      rec.onresult = (ev) => {
        const { final, interino } = leerResultados(ev)
        e.final = final; e.interino = interino
        if (e.fase === 'oyendo') setVivo((final + ' ' + interino).trim())
      }
      rec.onerror = (ev) => {
        const err = (ev && ev.error) || ''
        if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') e.error = 'microfono'
        else if (err === 'network') e.error = 'red'
      }
      rec.onend = terminar
      rec.start()
    } catch {
      setAviso(vivas.current.t('Este navegador no deja usar el micrófono aquí.', 'Este navegador no deja usar el micrófono aquí.'))
      return
    }
    Object.assign(e, { rec, final: '', interino: '', enviar: true, porTiempo: false, error: '', fase: 'oyendo' as Fase })
    setEscuchando(true); setAviso(''); setVivo('')
    e.tMax = window.setTimeout(() => { if (e.fase === 'oyendo') { e.porTiempo = true; cerrar() } }, TOMA_MAX_MS)
  }, [cerrar, terminar])

  const presionar = useCallback((): boolean => {
    const e = estado.current
    if (e.fase !== 'libre' || !vivas.current.habilitado) return false
    if (!reconocedor()) { setAviso(vivas.current.t('Este navegador no tiene reconocimiento de voz: escribe tu respuesta.', 'Este navegador no tiene reconocimiento de voz: escriba su respuesta.')); return false }
    e.fase = 'armando'
    e.tUmbral = window.setTimeout(empezar, UMBRAL_MS)
    return true
  }, [empezar])

  const soltar = useCallback(() => {
    const e = estado.current
    if (e.fase === 'armando') { // un toque corto: no se graba nada, solo se enseña el gesto
      clearTimeout(e.tUmbral); e.fase = 'libre'
      setAviso(vivas.current.t('Mantén presionado el botón mientras hablas.', 'Mantenga presionado el botón mientras habla.'))
      return
    }
    cerrar()
  }, [cerrar])

  /** Corta la toma sin entregar nada (salir de la pantalla, cambiar de turno). */
  const cancelar = useCallback(() => {
    const e = estado.current
    if (e.fase === 'armando') { clearTimeout(e.tUmbral); e.fase = 'libre'; return }
    if (e.fase === 'libre') return
    e.enviar = false
    const rec = e.rec
    try { rec?.abort() } catch { /* nada */ }
    e.fase = 'cerrando'
    terminar()
  }, [terminar])

  useEffect(() => cancelar, [cancelar])
  useEffect(() => {
    const alOcultar = () => { if (document.hidden) cancelar() }
    document.addEventListener('visibilitychange', alOcultar)
    return () => document.removeEventListener('visibilitychange', alOcultar)
  }, [cancelar])

  const propsBoton = {
    onPointerDown: (ev: PointerEvent<HTMLButtonElement>) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return
      if (!presionar()) return
      estado.current.puntero = ev.pointerId ?? 0
      try { ev.currentTarget.setPointerCapture(ev.pointerId) } catch { /* nada */ }
    },
    onPointerUp: (ev: PointerEvent<HTMLButtonElement>) => {
      if (estado.current.puntero < 0 || (ev.pointerId ?? 0) !== estado.current.puntero) return
      estado.current.puntero = -1
      try { ev.currentTarget.releasePointerCapture(ev.pointerId) } catch { /* nada */ }
      soltar()
    },
    onPointerCancel: (ev: PointerEvent<HTMLButtonElement>) => {
      if (estado.current.puntero < 0 || (ev.pointerId ?? 0) !== estado.current.puntero) return
      estado.current.puntero = -1
      soltar()
    },
    onKeyDown: (ev: KeyboardEvent<HTMLButtonElement>) => {
      if (ev.key !== ' ' && ev.key !== 'Spacebar') return
      ev.preventDefault()
      if (!ev.repeat) presionar()
    },
    onKeyUp: (ev: KeyboardEvent<HTMLButtonElement>) => {
      if (ev.key !== ' ' && ev.key !== 'Spacebar') return
      ev.preventDefault()
      if (estado.current.puntero < 0) soltar()
    },
    onBlur: () => { if (estado.current.puntero < 0 && estado.current.fase !== 'libre') soltar() },
    onContextMenu: (ev: { preventDefault: () => void }) => ev.preventDefault(), // mantener no abre el menú del sistema
  }

  return { disponible, escuchando, vivo, aviso, propsBoton, cancelar }
}
