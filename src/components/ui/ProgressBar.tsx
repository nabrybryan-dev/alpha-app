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
      className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <div className="h-full rounded-full bg-rojo transition-all" style={{ width: `${seguro}%` }} />
    </div>
  )
}
