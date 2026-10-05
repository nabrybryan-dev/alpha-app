/** Un fallo de lectura se dice como fallo y se puede reintentar: nunca se disfraza de «no hay nada». */
export function FalloDeLectura({
  texto,
  onReintentar,
}: {
  texto: string
  onReintentar: () => void
}) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-rojo">
      <span>{texto}</span>
      <button
        type="button"
        onClick={onReintentar}
        className="press min-h-[44px] rounded-full border border-rojo px-4 text-xs font-bold text-rojo"
      >
        Reintentar
      </button>
    </div>
  )
}
