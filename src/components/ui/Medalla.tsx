import type { Logro } from '../../domain/gamification'

export function Medalla({ logro }: { logro: Logro }) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center ${
        logro.desbloqueado ? 'border-rojo-osc bg-rojo/5' : 'border-linea bg-surface-2 opacity-60'
      }`}
    >
      <span
        className={`grid h-12 w-12 place-items-center rounded-full border-2 text-xl ${
          logro.desbloqueado ? 'border-rojo text-rojo' : 'border-linea text-tenue grayscale'
        }`}
        aria-hidden="true"
      >
        {logro.desbloqueado ? '🏅' : '🔒'}
      </span>
      <p className="text-xs font-bold leading-tight text-texto">{logro.titulo}</p>
      <p className="text-[10px] leading-tight text-tenue">{logro.criterio}</p>
    </div>
  )
}
