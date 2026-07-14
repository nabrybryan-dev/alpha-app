import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  destacada?: boolean
}

export function Card({ children, destacada = false, className = '', ...rest }: CardProps) {
  const borde = destacada ? 'border-rojo-osc' : 'border-linea'
  return (
    <div className={`rounded-2xl border bg-surface-1 p-4 ${borde} ${className}`} {...rest}>
      {children}
    </div>
  )
}
