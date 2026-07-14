interface ChipProps {
  etiqueta: string
  seleccionado: boolean
  onSeleccionar: () => void
}

export function Chip({ etiqueta, seleccionado, onSeleccionar }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={seleccionado}
      onClick={onSeleccionar}
      className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        seleccionado
          ? 'border-rojo bg-rojo/15 text-rojo'
          : 'border-linea bg-surface-2 text-tenue active:bg-surface-3'
      }`}
    >
      {etiqueta}
    </button>
  )
}

interface ChipGroupProps {
  opciones: readonly string[]
  valor?: string
  onCambiar: (valor: string) => void
}

export function ChipGroup({ opciones, valor, onCambiar }: ChipGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((opcion) => (
        <Chip
          key={opcion}
          etiqueta={opcion}
          seleccionado={valor === opcion}
          onSeleccionar={() => onCambiar(opcion)}
        />
      ))}
    </div>
  )
}
