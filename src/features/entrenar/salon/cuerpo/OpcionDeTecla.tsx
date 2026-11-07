import type { ReactNode } from 'react'

/**
 * LA TECLA ALZADA de la maqueta 7 (`.sl-capas button`): 12 px de radio, nombre en negrita y
 * su detalle debajo, en tenue. Todas del mismo ancho para que la columna no baile. La elegida
 * lleva un aro de 1,5 px en el color del texto.
 */
const COMPACTO = '!min-h-[48px] !w-[86px] !px-1.5 !py-1 !text-xs'

/**
 * Una opcion de un grupo, con la tecla secundaria `.tecla-2` de `tokens.css` (la de la maqueta
 * 7). **El rojo es del dolor**: la elegida NO se pinta de rojo (no es `Boton3D`, que es la
 * accion principal y es roja); se marca con un aro del color del texto y el texto pleno, y las
 * demas quedan en tenue. Mismo tamano para que no salten.
 */
export function Opcion({
  activa,
  onClick,
  children,
  radio = true,
  etiqueta,
  detalle,
}: {
  activa: boolean
  onClick: () => void
  children: ReactNode
  radio?: boolean
  etiqueta?: string
  /** Una línea corta debajo del nombre: qué enseña la tecla. */
  detalle?: string
}) {
  const aria = radio ? { role: 'radio' as const, 'aria-checked': activa } : {}
  return (
    <button
      type="button"
      {...aria}
      aria-label={etiqueta}
      onClick={onClick}
      className={`press tecla-2 ${COMPACTO}`}
      style={{
        color: activa ? 'var(--texto)' : 'var(--tenue)',
        boxShadow: activa ? '0 2px 0 var(--canto), var(--sombra-alzado), inset 0 0 0 1.5px var(--texto)' : undefined,
      }}
    >
      <span className="flex flex-col items-center leading-tight">
        <span>{children}</span>
        {detalle && (
          <span className="mt-0.5 text-[10px] font-medium" style={{ color: 'var(--tenue)' }}>
            {detalle}
          </span>
        )}
      </span>
    </button>
  )
}
