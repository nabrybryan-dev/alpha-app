import {
  SELLOS,
  filtraPorRol,
  type DatoLaboratorio,
  type RolLaboratorio,
  type SelloLaboratorio,
} from './sello'

interface Props {
  datos: ReadonlyArray<DatoLaboratorio | null | undefined>
  rol: RolLaboratorio
  /** `laboratorioVisible`. Por omisión apagado. */
  visible?: boolean
}

/**
 * Bloque del laboratorio. No se conecta a ninguna pantalla todavía (B3).
 * Apagado y asesorado: no dibuja nada. Cada dato lleva su sello y su fuente.
 */
export function SelloLab({ datos, rol, visible = false }: Props) {
  if (rol === 'asesorado' && !visible) return null
  const validos = filtraPorRol(datos, rol, visible)
  return (
    <section aria-label="Laboratorio" data-testid="sello-lab" className="grid gap-2 rounded-2xl p-3">
      <div className="flex items-baseline justify-between gap-2">
        <strong>Laboratorio</strong>
        <span className="text-xs font-extrabold uppercase">
          {visible ? 'visible' : 'apagado · no va a prescripción'}
        </span>
      </div>
      {validos.length === 0 ? (
        <p>Sin datos del laboratorio con sello y fuente.</p>
      ) : (
        <ul className="grid gap-2">
          {validos.map((d, i) => (
            <li key={i} className="grid gap-1">
              <span data-sello={d.sello} className="inline-flex w-fit rounded-full border px-2 text-xs font-extrabold">
                {SELLOS[d.sello as SelloLaboratorio].nombre}
              </span>
              <span>{d.texto ?? ''}</span>
              <small>Fuente: {d.fuente}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
