import { useState, type ReactNode } from 'react'

interface AcordeonProps {
  numero: string
  titulo: string
  children: ReactNode
  abiertoInicial?: boolean
}

export function Acordeon({ numero, titulo, children, abiertoInicial = false }: AcordeonProps) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  return (
    <section className="overflow-hidden rounded-2xl border border-linea bg-surface-1">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="rounded-full border border-rojo-osc px-2.5 py-0.5 text-[10px] font-black tracking-widest text-rojo">
          {numero}
        </span>
        <span className="flex-1 font-display text-base text-texto">{titulo}</span>
        <span className={`text-tenue transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {abierto && <div className="border-t border-linea px-4 py-4">{children}</div>}
    </section>
  )
}
