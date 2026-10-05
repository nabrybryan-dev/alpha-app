import type { ReactNode } from 'react'

export const CLASE_TARJETA = 'rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm'
export const CLASE_ETIQUETA = 'text-[11px] font-bold uppercase tracking-[0.14em] text-tenue'
export const CLASE_BOTON =
  'press inline-flex min-h-[48px] items-center justify-center rounded-boton border border-texto px-4 font-display text-[13px] uppercase text-texto disabled:opacity-50'
export const CLASE_BOTON_PRINCIPAL =
  'press inline-flex min-h-[56px] w-full items-center justify-center rounded-boton bg-rojo px-4 font-display text-[15px] uppercase text-white disabled:opacity-50'
export const CLASE_BOTON_CHICO =
  'press inline-flex min-h-[44px] items-center justify-center rounded-full border border-linea px-3 text-xs font-bold text-texto disabled:opacity-50'

export function Tarjeta({ etiqueta, children, etiquetaAria }: { etiqueta: string; children: ReactNode; etiquetaAria?: string }) {
  return (
    <section aria-label={etiquetaAria ?? etiqueta} className={`entrada ${CLASE_TARJETA}`}>
      <p className={CLASE_ETIQUETA}>{etiqueta}</p>
      <div className="pt-2">{children}</div>
    </section>
  )
}

/** Barra de avance accesible. Sin tareas no se pinta un 0 % que parezca un dato. */
export function Barra({ pct, etiqueta, tono = 'rojo' }: { pct: number; etiqueta: string; tono?: 'rojo' | 'verde' | 'ambar' }) {
  const color = tono === 'verde' ? 'bg-verde' : tono === 'ambar' ? 'bg-ambar' : 'bg-rojo'
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.max(0, Math.min(100, pct))}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

export function Cargando({ texto = 'Cargando tu plan…' }: { texto?: string }) {
  return (
    <p className="py-6 text-center text-sm text-tenue" aria-busy="true">
      {texto}
    </p>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-tarjeta border border-dashed border-linea p-4 text-sm text-tenue">{children}</p>
}
