import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  destacada?: boolean
}

export function Card({ children, destacada = false, className = '', ...rest }: CardProps) {
  const acento = destacada ? 'glass-destacada' : ''
  return (
    <div className={`rounded-panel glass p-4 ${acento} ${className}`} {...rest}>
      {children}
    </div>
  )
}
