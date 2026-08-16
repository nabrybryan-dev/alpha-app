import { useEffect, useRef, type ReactElement } from 'react'
import type { Receta, RecetaNota } from '../../data/recetas'
import { ReelPlayer } from './ReelPlayer'

/**
 * La hoja que traduce un viral de Instagram al plan del asesorado: no le
 * prohíbe la receta, le dice la porción que sí entra hoy.
 */

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

/** Trazos de Lucide: target, repeat-2, alert-triangle, lightbulb. */
const ICONO_NOTA: Record<RecetaNota['tipo'], ReactElement> = {
  encaja: <svg {...trazo} className="h-4 w-4"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>,
  canje: <svg {...trazo} className="h-4 w-4"><path d="m2 9 3-3 3 3M5 6v8a3 3 0 0 0 3 3h8M22 15l-3 3-3-3M19 18v-8a3 3 0 0 0-3-3H8" /></svg>,
  ojo: <svg {...trazo} className="h-4 w-4"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>,
  truco: <svg {...trazo} className="h-4 w-4"><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" /></svg>,
}

const COLOR_NOTA: Record<RecetaNota['tipo'], string> = {
  encaja: 'text-accion',
  canje: 'text-azul',
  ojo: 'text-ambar',
  truco: 'text-logrado',
}

export interface RecetaSheetProps {
  receta: Receta
  /** kcal que le quedan al asesorado hoy. Sin dato, la línea no se pinta. */
  kcalRestantes?: number
  onCerrar: () => void
  /**
   * DECISIÓN PENDIENTE: sin este handler el botón «Agregar al registro» no se
   * renderiza. El registro de comidas de esta app no admite entradas libres
   * —`RegistroItem` exige `alimentoId` del catálogo— y el encargo prohíbe crear
   * un tipo o una tabla nuevos. Cablearlo pide una decisión sobre el modelo de
   * datos que queda fuera del alcance de este trabajo.
   */
  onAgregar?: (receta: Receta) => void
}

export function RecetaSheet({ receta, kcalRestantes, onCerrar, onAgregar }: RecetaSheetProps) {
  const hoja = useRef<HTMLDivElement>(null)

  // Esc cierra, y el foco entra en la hoja para no quedarse detrás del scrim.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclear)
    hoja.current?.focus()
    return () => document.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  const { ajuste, media, social } = receta

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(8,9,10,.66)' }}
      onClick={onCerrar}
      role="presentation"
    >
      <div
        ref={hoja}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${receta.nombre}, de ${receta.handle}`}
        onClick={(e) => e.stopPropagation()}
        className="subir-hoja max-h-[92dvh] w-full overflow-y-auto rounded-t-[22px] border-t border-linea bg-surface-1 px-4 pb-5 pt-4"
      >
        <Cabecera receta={receta} onCerrar={onCerrar} />

        <div className="mt-3">
          <ReelPlayer media={media} handle={receta.handle} />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="cifras text-[10.5px] text-tenue">
              {social.likes} me gusta · {social.guardados} guardados
            </span>
            {media.instagramPermalink && (
              <a
                href={media.instagramPermalink}
                target="_blank"
                rel="noreferrer noopener"
                className="press rounded-boton border border-linea px-3 py-1.5 text-[11px] font-bold text-texto"
              >
                Ver en Instagram
              </a>
            )}
          </div>
        </div>

        <AjusteAlfa ajuste={ajuste} kcalRestantes={kcalRestantes} />

        {onAgregar && (
          <button
            type="button"
            onClick={() => onAgregar(receta)}
            className="press mt-4 w-full rounded-boton bg-accion py-3 text-[13px] font-bold uppercase tracking-wide text-white"
          >
            Agregar al registro
          </button>
        )}
      </div>
    </div>
  )
}

function Cabecera({ receta, onCerrar }: { receta: Receta; onCerrar: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-3 text-sm font-bold text-texto">
        {receta.handle.replace('@', '').charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-texto">{receta.handle}</p>
        <p className="cifras text-[10.5px] text-tenue">
          Reel · {receta.media.duracion} · {receta.social.views} de vistas
        </p>
      </div>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="press grid h-8 w-8 shrink-0 place-items-center rounded-boton border border-linea text-tenue"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function AjusteAlfa({ ajuste, kcalRestantes }: { ajuste: Receta['ajuste']; kcalRestantes?: number }) {
  return (
    <section className="mt-4 rounded-[18px] border border-linea bg-ink-800 p-4">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-accion">Tu ajuste Alfa</p>
      <p className="cifras mt-1.5 text-[26px] font-bold leading-none text-texto">{ajuste.porcion}</p>
      <p className="mt-1 text-xs text-tenue">{ajuste.porcionNota}</p>
      {kcalRestantes !== undefined && (
        <p className="cifras mt-1 text-xs text-tenue">Te quedan {kcalRestantes} kcal hoy</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-y border-linea py-2.5">
        <Macro etiqueta="kcal" valor={ajuste.kcal} clase="text-texto" />
        <Macro etiqueta="prot" valor={ajuste.prot} clase="text-azul" sufijo="g" />
        <Macro etiqueta="carb" valor={ajuste.carb} clase="text-ambar" sufijo="g" />
        <Macro etiqueta="grasa" valor={ajuste.grasa} clase="text-oro" sufijo="g" />
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {ajuste.notas.map((nota) => (
          <li key={nota.tipo} className="flex gap-2.5">
            <span className={`mt-0.5 shrink-0 ${COLOR_NOTA[nota.tipo]}`}>{ICONO_NOTA[nota.tipo]}</span>
            <span className="min-w-0">
              <span className={`block text-[11px] font-bold uppercase tracking-[0.1em] ${COLOR_NOTA[nota.tipo]}`}>
                {nota.label}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-silver-300">{nota.texto}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Macro({ etiqueta, valor, clase, sufijo }: { etiqueta: string; valor: number; clase: string; sufijo?: string }) {
  return (
    <span className="text-center">
      <span className="cifras block text-[10px] font-bold uppercase tracking-[0.1em] text-tenue">{etiqueta}</span>
      <span className={`cifras mt-0.5 block text-[15px] font-bold ${clase}`}>
        {valor}
        {sufijo}
      </span>
    </span>
  )
}
