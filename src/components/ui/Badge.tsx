import type { ReactNode } from 'react'

type TonoBadge = 'rojo' | 'verde' | 'ambar' | 'azul' | 'neutro'

const tonos: Record<TonoBadge, string> = {
  rojo: 'bg-rojo/15 text-rojo border-rojo-osc',
  verde: 'bg-verde/15 text-verde border-verde/40',
  ambar: 'bg-ambar/15 text-ambar border-ambar/40',
  azul: 'bg-azul/15 text-azul border-azul/40',
  neutro: 'bg-surface-3 text-tenue border-linea',
}

interface BadgeProps {
  children: ReactNode
  tono?: TonoBadge
}

export function Badge({ children, tono = 'neutro' }: BadgeProps) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tonos[tono]}`}
    >
      {children}
    </span>
  )
}
