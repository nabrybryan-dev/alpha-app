import type { ReactNode } from 'react'

/**
 * La cabecera de las pantallas de Administración del equipo, igual que la de Empresa (zona 4):
 * un rótulo pequeño en versalitas, el título display y una frase que dice qué hay dentro. No
 * lleva acciones: las acciones viven en las tarjetas, para que la cabecera no compita con ellas.
 */
export function Cabecera({ rotulo, titulo, frase }: { rotulo: string; titulo: string; frase: ReactNode }) {
  return (
    <header className="flex flex-col gap-1 pt-1">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">{rotulo}</p>
      <h2 className="font-display text-3xl leading-none text-texto">{titulo}</h2>
      <p className="text-sm text-tenue">{frase}</p>
    </header>
  )
}
