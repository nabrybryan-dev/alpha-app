import type { Usuario } from '../../domain/types'
import { tituloDe } from './remitentes'

interface SelectorRemitenteProps {
  remitentes: Usuario[]
  elegidoId: string
  onElegir: (id: string) => void
}

/**
 * Con quién hablas. Con un solo remitente no se pinta: una fila de pestañas de
 * una sola pestaña es ruido, y hoy hay bases donde la nutricionista todavía no
 * existe.
 */
export function SelectorRemitente({ remitentes, elegidoId, onElegir }: SelectorRemitenteProps) {
  if (remitentes.length < 2) return null

  return (
    <div role="tablist" aria-label="Con quién hablas" className="flex gap-2">
      {remitentes.map((remitente) => {
        const elegido = remitente.id === elegidoId
        return (
          <button
            key={remitente.id}
            type="button"
            role="tab"
            aria-selected={elegido}
            onClick={() => onElegir(remitente.id)}
            className={`press rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ease-salida ${
              elegido
                ? 'border-accion bg-accion text-white'
                : 'border-linea bg-surface-1 text-tenue'
            }`}
          >
            {tituloDe(remitente)}
          </button>
        )
      })}
    </div>
  )
}
