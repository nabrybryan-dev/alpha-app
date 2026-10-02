import { useSyncExternalStore } from 'react'

/** Desde aquí la app deja de ser «teléfono» y pasa a escritorio: el `lg` de Tailwind. */
const CONSULTA = '(min-width: 1024px)'

function consulta(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(CONSULTA)
}

function suscribir(avisar: () => void): () => void {
  const mq = consulta()
  if (!mq) return () => {}
  mq.addEventListener('change', avisar)
  return () => mq.removeEventListener('change', avisar)
}

function leer(): boolean {
  return consulta()?.matches ?? false
}

/**
 * ¿Escritorio (≥ 1024 px)? Se lee de forma SÍNCRONA en el primer pintado
 * (`useSyncExternalStore`), así que quien decide una redirección con esto no
 * parpadea: no hay un primer render «de teléfono» que luego salte a escritorio.
 * Donde `matchMedia` no existe (jsdom sin declarar) responde `false`: teléfono.
 */
export function useEsEscritorio(): boolean {
  return useSyncExternalStore(suscribir, leer, () => false)
}
