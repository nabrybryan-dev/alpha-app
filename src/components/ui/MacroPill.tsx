type TipoMacro = 'kcal' | 'proteina' | 'carbos' | 'grasa'

const estilos: Record<TipoMacro, { etiqueta: string; color: string }> = {
  kcal: { etiqueta: 'KCAL', color: 'text-texto' },
  proteina: { etiqueta: 'PROTEÍNA', color: 'text-rojo' },
  carbos: { etiqueta: 'CARBOS', color: 'text-ambar' },
  grasa: { etiqueta: 'GRASA', color: 'text-verde' },
}

interface MacroPillProps {
  tipo: TipoMacro
  valor: number
  unidad?: string
}

export function MacroPill({ tipo, valor, unidad = 'g' }: MacroPillProps) {
  const { etiqueta, color } = estilos[tipo]
  return (
    <div className="flex-1 rounded-xl border border-linea bg-surface-2 px-2 py-2.5 text-center">
      <span className={`block text-lg font-black ${color}`}>
        {Math.round(valor)}
        {tipo !== 'kcal' && <span className="text-xs font-normal">{unidad}</span>}
      </span>
      <span className="block text-[10px] uppercase tracking-widest text-tenue">{etiqueta}</span>
    </div>
  )
}
