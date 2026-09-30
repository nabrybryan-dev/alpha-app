import { useId, useState, type ReactNode } from 'react'
import { TEXTO_PENDIENTE_0102 } from '../../../domain/adminTablero'
import { CLASE_ETIQUETA } from '../../plan/comun'

/**
 * Tarjeta plegable genérica de Administración y Estrategias: el mismo aspecto que `TarjetaSeccion`
 * (título, UNA frase, flecha) para lo que no es una sección del tablero. El cuerpo solo se monta
 * al abrir: así una pantalla pesada (Mi plan, el buzón) no se carga hasta que se toca.
 */
export function TarjetaPlegable({ nombre, frase, children }: { nombre: string; frase: string; children: ReactNode }) {
  const idCuerpo = useId()
  const [abierta, setAbierta] = useState(false)
  return (
    <section aria-label={nombre} className="entrada rounded-tarjeta border border-linea bg-surface-1 shadow-sm">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        onClick={() => setAbierta((a) => !a)}
        className="press flex min-h-[64px] w-full items-start justify-between gap-3 p-4 text-left"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className={CLASE_ETIQUETA}>{nombre}</span>
          <span className="text-sm text-texto">{frase}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-tenue">{abierta ? '▾' : '▸'}</span>
      </button>
      {abierta && (
        <div id={idCuerpo} className="flex flex-col gap-3 border-t border-linea p-4">
          {children}
        </div>
      )}
    </section>
  )
}

/**
 * Tarjeta gris de una sección del tablero de la 0102 que todavía no se puede leer (sin el permiso
 * `ver_administracion` o sin la tabla). No lleva cifra, ni cero, ni semáforo de color.
 */
export function TarjetaPendiente({ nombre }: { nombre: string }) {
  return (
    <section aria-label={nombre} className="entrada rounded-tarjeta border border-dashed border-linea bg-surface-1 shadow-sm">
      <div className="flex min-h-[64px] flex-col gap-1 p-4">
        <span className={CLASE_ETIQUETA}>{nombre}</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-tenue">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border border-tenue bg-surface-3" />
          {TEXTO_PENDIENTE_0102}
        </span>
      </div>
    </section>
  )
}

/** Rótulo de un grupo de tarjetas (el orden de arriba abajo que pidió Bryan). */
export function RotuloGrupo({ titulo, nota }: { titulo: string; nota?: string }) {
  return (
    <div className="flex flex-col gap-0.5 pt-1">
      <h3 className="text-[13px] font-bold text-texto">{titulo}</h3>
      {nota && <p className="text-[11.5px] text-tenue">{nota}</p>}
    </div>
  )
}
