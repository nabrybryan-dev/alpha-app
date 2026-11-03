import { useId, useState, type ReactNode } from 'react'
import { TEXTO_PENDIENTE_0102, TEXTO_SIN_PERMISO_0102 } from '../../../domain/adminTablero'

/**
 * La flecha de un plegable: un solo glifo que gira 90° al abrir, con la duración base del sistema
 * y sin transición cuando el sistema pide movimiento reducido. No se anima el alto de la tarjeta
 * (regla 4 del 03): el cuerpo se monta al abrir y se desmonta al cerrar.
 */
export function Flecha({ abierta }: { abierta: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 text-lg leading-none text-tenue transition-transform duration-[var(--dur-base)] motion-reduce:transition-none ${
        abierta ? 'rotate-90' : ''
      }`}
    >
      ›
    </span>
  )
}

/**
 * Tarjeta plegable genérica de Administración y Estrategias: el mismo aspecto que `TarjetaSeccion`
 * (título, UNA frase, flecha) para lo que no es una sección del tablero. El cuerpo solo se monta
 * al abrir: así una pantalla pesada (Mi plan, el buzón) no se carga hasta que se toca.
 */
export function TarjetaPlegable({ nombre, frase, children }: { nombre: string; frase: string; children: ReactNode }) {
  const idCuerpo = useId()
  const [abierta, setAbierta] = useState(false)
  return (
    <section
      aria-label={nombre}
      className="entrada overflow-hidden rounded-tarjeta border border-linea bg-surface-1 shadow-sm"
    >
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        onClick={() => setAbierta((a) => !a)}
        className="press flex min-h-[64px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-texto">{nombre}</span>
          <span className="text-xs leading-snug text-tenue">{frase}</span>
        </span>
        <Flecha abierta={abierta} />
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
export function TarjetaPendiente({ nombre, motivo = 'sin_tabla' }: { nombre: string; motivo?: 'sin_permiso' | 'sin_tabla' }) {
  return (
    <section
      aria-label={nombre}
      className="entrada rounded-tarjeta border border-dashed border-linea bg-surface-1 shadow-sm"
    >
      <div className="flex min-h-[64px] flex-col justify-center gap-1 p-4">
        <span className="text-sm font-semibold text-texto">{nombre}</span>
        <span className="inline-flex items-center gap-1.5 text-sm text-tenue">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border border-tenue bg-surface-3" />
          {motivo === 'sin_permiso' ? TEXTO_SIN_PERMISO_0102 : TEXTO_PENDIENTE_0102}
        </span>
      </div>
    </section>
  )
}

/** Rótulo de un grupo de tarjetas (el orden de arriba abajo que pidió Bryan). */
export function RotuloGrupo({ titulo, nota }: { titulo: string; nota?: string }) {
  return (
    <div className="flex flex-col gap-0.5 pt-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">{titulo}</h3>
      {nota && <p className="text-xs text-tenue">{nota}</p>}
    </div>
  )
}
