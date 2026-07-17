interface EmptyStateProps {
  titulo: string
  detalle: string
}

export function EmptyState({ titulo, detalle }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-linea p-6 text-center">
      <p className="font-display text-base text-texto">{titulo}</p>
      <p className="mt-1 text-sm text-tenue">{detalle}</p>
    </div>
  )
}
