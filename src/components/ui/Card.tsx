import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  destacada?: boolean
}

export function Card({ children, destacada = false, className = '', ...rest }: CardProps) {
  const acento = destacada ? 'glass-destacada' : ''
  return (
    // `tarjeta-base`: marca para la piel de la maqueta 7 (tokens.css); sin `data-piel` en la raíz no cambia nada.
    <div className={`tarjeta-base rounded-panel glass p-4 ${acento} ${className}`} {...rest}>
      {children}
    </div>
  )
}
