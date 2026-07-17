interface ProgressBarProps {
  pct: number
  etiqueta?: string
}

export function ProgressBar({ pct, etiqueta }: ProgressBarProps) {
  const seguro = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div
      role="progressbar"
      aria-valuenow={seguro}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta}
      className="h-1.5 w-full overflow-hidden rounded-full border border-hairline bg-surface-3/60"
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-salida"
        style={{
          width: `${seguro}%`,
          background: 'linear-gradient(90deg, var(--rojo-osc), var(--rojo))',
          boxShadow: '0 0 8px rgba(255, 30, 30, 0.45)',
        }}
      />
    </div>
  )
}
