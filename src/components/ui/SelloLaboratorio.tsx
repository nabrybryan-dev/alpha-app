import { TEXTO_DEL_SELLO, type Sello } from '../../domain/praxis/laboratorio/sello'

const tonos: Record<Sello, string> = {
  evidencia: 'bg-verde/15 text-verde border-verde/40',
  simulado: 'bg-ambar/15 text-ambar border-ambar/40',
  estimado: 'bg-azul/15 text-azul border-azul/40',
  no_afirmable: 'bg-surface-3 text-tenue border-linea',
}

interface SelloLaboratorioProps {
  sello: Sello
  /** De dónde sale el dato. Vacía no dibuja nada: sin fuente no hay sello que valga. */
  fuente: string
}

/**
 * Sello de procedencia de un dato del laboratorio. Solo pinta; quién lo ve lo decide
 * `puedeDibujarse` (dominio), y mientras `LABORATORIO_VISIBLE` sea falso nadie lo monta en una pantalla.
 */
export function SelloLaboratorio({ sello, fuente }: SelloLaboratorioProps) {
  if (fuente.trim().length === 0) return null
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${tonos[sello]}`}>
        {TEXTO_DEL_SELLO[sello]}
      </span>
      <small className="text-xs text-tenue">Fuente: {fuente}</small>
    </span>
  )
}
