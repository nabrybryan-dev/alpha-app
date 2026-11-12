import { MiMercado } from './MiMercado'
import { useDisenoFinal } from '../../app/organizacionViva'
import { MI_MERCADO_MAQUETA } from './banderas'

/**
 * La sección «Mercado» del plan: la vista de la maqueta (`MiMercado`) o la lista de siempre.
 * `maqueta` solo existe para probar la vista nueva; en la app manda la bandera de código.
 * Vive aparte de `MiPlan` para no subir su complejidad (trinquete de calidad).
 */
export function SeccionMercado({
  asesoradoId,
  lineas,
  maqueta,
}: {
  asesoradoId: string
  lineas: string[]
  maqueta?: boolean
}) {
  const disenoFinal = useDisenoFinal()
  // Sin argumento manda la bandera de código; encendida también para las cuentas con el diseño final (rapidezLocal.ts).
  if (maqueta ?? (MI_MERCADO_MAQUETA || disenoFinal)) return <MiMercado asesoradoId={asesoradoId} lineas={lineas} />
  return (
    <section className="rounded-2xl border border-linea bg-surface-1 p-4">
      <h2 className="font-display text-base text-texto">Mercado de 15 días</h2>
      <p className="mt-1 text-xs text-tenue">Compra una vez, cumple dos semanas.</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {lineas.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-snug text-texto">
            <span aria-hidden="true" className="text-tenue">
              ·
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}
