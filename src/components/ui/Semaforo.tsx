import type { Semaforo as SemaforoDatos } from '../../domain/cumplimiento'

const colores = {
  verde: 'bg-verde',
  ambar: 'bg-ambar',
  rojo: 'bg-rojo',
} as const

export function Semaforo({ datos }: { datos: SemaforoDatos }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-tenue">
      <span className={`h-2.5 w-2.5 rounded-full ${colores[datos.color]}`} aria-hidden="true" />
      {datos.motivo}
    </span>
  )
}
