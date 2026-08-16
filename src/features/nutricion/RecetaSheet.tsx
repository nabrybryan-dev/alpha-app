import { Fragment, useEffect, useRef, useState, type ReactElement } from 'react'
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

/**
 * Agregar y deshacer viajan juntos a propósito: no se puede cablear el alta sin
 * cablear su marcha atrás. Un «Deshacer» que solo esconde el aviso le miente al
 * asesorado sobre lo que quedó registrado en su día.
 */
export interface RecetaRegistro {
  agregar: (receta: Receta) => void
  deshacer: (receta: Receta) => void
}

export interface RecetaSheetProps {
  receta: Receta
  /**
   * kcal que le quedan al asesorado hoy. Sin dato la línea NO desaparece:
   * cambia al texto de plan. Es lo único que separa esto de un feed cualquiera.
   */
  kcalRestantes?: number
  onCerrar: () => void
  /**
   * DECISIÓN PENDIENTE: sin esto el botón queda de muestra y no escribe nada.
   * El registro de comidas de esta app no admite entradas libres —`RegistroItem`
   * exige `alimentoId` del catálogo— y el encargo prohíbe crear un tipo o una
   * tabla nuevos. Cablearlo pide una decisión sobre el modelo de datos que queda
   * fuera del alcance de este trabajo.
   */
  registro?: RecetaRegistro
}

/** Lo que dura el aviso antes de irse solo. */
const MS_AVISO = 4000

export function RecetaSheet({ receta, kcalRestantes, onCerrar, registro }: RecetaSheetProps) {
  const hoja = useRef<HTMLDivElement>(null)
  const [agregada, setAgregada] = useState(false)
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Esc cierra, y el foco entra en la hoja para no quedarse detrás del scrim.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclear)
    hoja.current?.focus()
    return () => document.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  // El aviso no puede sobrevivir al desmontaje: dejaría un temporizador
  // escribiendo estado sobre una hoja que ya no existe.
  useEffect(() => () => clearTimeout(reloj.current), [])

  const agregar = () => {
    registro?.agregar(receta)
    setAgregada(true)
    clearTimeout(reloj.current)
    reloj.current = setTimeout(() => setAgregada(false), MS_AVISO)
  }

  const deshacer = () => {
    clearTimeout(reloj.current)
    setAgregada(false)
    registro?.deshacer(receta)
  }

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
        className="subir-hoja max-h-[92dvh] w-full overflow-y-auto rounded-t-[22px] border-t border-linea bg-surface-1 px-4 pb-0 pt-4"
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
                className="press inline-flex items-center rounded-boton border border-linea px-3 text-[11px] font-bold text-texto"
                style={{ minHeight: 44 }}
              >
                Ver en Instagram
              </a>
            )}
          </div>
        </div>

        <AjusteAlfa ajuste={ajuste} kcalRestantes={kcalRestantes} />

        <Ingredientes receta={receta} />
        <Preparacion pasos={receta.preparacion} />

        <PieFijo receta={receta} agregada={agregada} onAgregar={agregar} onDeshacer={deshacer} />
      </div>
    </div>
  )
}

/**
 * El botón vive pegado al fondo del scroll, no al final del contenido: con la
 * receta larga quedaba a dos pantallas de distancia y había que ir a buscarlo.
 *
 * El degradado no es adorno — es lo que evita que el texto pase por debajo del
 * botón y se lea a medias mientras se desplaza.
 */
function PieFijo({
  receta,
  agregada,
  onAgregar,
  onDeshacer,
}: {
  receta: Receta
  agregada: boolean
  onAgregar: () => void
  onDeshacer: () => void
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-4 px-4">
      {agregada && (
        <div
          role="status"
          className="aviso-registro mb-2 flex items-center gap-3 rounded-boton border border-linea bg-surface-3 px-3 py-2"
        >
          <span className="min-w-0 flex-1 text-[12px] leading-snug text-silver-200">
            <span className="font-bold text-texto">{receta.nombre}</span>
            <span className="text-tenue"> · {receta.ajuste.porcion} agregada</span>
          </span>
          <button
            type="button"
            onClick={onDeshacer}
            className="press -my-2 shrink-0 px-1 text-[12px] font-bold uppercase tracking-[0.08em] text-accion"
            style={{ minHeight: 44 }}
          >
            Deshacer
          </button>
        </div>
      )}

      <div
        className="relative pb-[max(16px,env(safe-area-inset-bottom))] pt-3"
        // Atado al token, no a un hex: en tema claro el velo tiene que ser
        // blanco. Los navegadores interpolan `transparent` en alfa
        // premultiplicado, así que no aparece la banda gris de siempre.
        style={{ background: 'linear-gradient(180deg, transparent 0%, var(--surface-1) 34%)' }}
      >
        {/* Filo de tinta: separa el botón del contenido que pasa por detrás. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linea" />
        <button
          type="button"
          onClick={onAgregar}
          className="press w-full rounded-boton bg-accion text-[13px] font-bold uppercase tracking-wide text-white"
          style={{ height: 50 }}
        >
          Agregar al registro
        </button>
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
        // 44px de área táctil: el borde visible sigue siendo de 32.
        className="press -m-1.5 grid shrink-0 place-items-center text-tenue"
        style={{ width: 44, height: 44 }}
      >
        <span className="grid h-8 w-8 place-items-center rounded-boton border border-linea">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </span>
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
      {/*
        Esta línea NUNCA se omite. Sin ella la porción es un número más y la
        sección se vuelve un feed de recetas; con ella, la receta está medida
        contra el día concreto de esta persona. Si falta el dato de kcal, se
        dice de dónde sale la porción, no se calla.
      */}
      <p className="cifras mt-1 text-xs text-tenue">
        {kcalRestantes === undefined ? 'Según tu plan de hoy' : `Te quedan ${kcalRestantes} kcal hoy`}
      </p>

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

/**
 * Los ingredientes en dos columnas: lo que dice el reel y lo que te toca.
 *
 * Van juntas a propósito. Solo «tu cantidad» obliga a fiarse a ciegas; solo la
 * del reel deja al asesorado donde estaba. Lo que vale es ver la traducción.
 */
function Ingredientes({ receta }: { receta: Receta }) {
  const lista = receta.ingredientes
  if (!lista || lista.length === 0) return null

  return (
    <section className="mt-3 rounded-[18px] border border-linea bg-ink-800 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-accion">Qué lleva</p>
        {receta.rinde && <span className="cifras text-[10px] text-tenue">{receta.rinde}</span>}
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 gap-y-2">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-tenue">Ingrediente</span>
        <span className="cifras text-right text-[9.5px] font-bold uppercase tracking-[0.1em] text-tenue">
          En el reel
        </span>
        <span className="cifras text-right text-[9.5px] font-bold uppercase tracking-[0.1em] text-accion">
          Para ti
        </span>

        {lista.map((ing) => (
          <Fragment key={ing.nombre}>
            <span className="text-[12.5px] leading-snug text-silver-200">
              {ing.nombre}
              {ing.cambiado && (
                <span className="ml-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ambar">
                  cambia
                </span>
              )}
            </span>
            {/* Tachado: se ve de un vistazo que esa cantidad no es la tuya. */}
            <span className="cifras text-right text-[12px] text-tenue line-through">{ing.enElReel}</span>
            <span className="cifras text-right text-[12.5px] font-bold text-texto">{ing.paraTi}</span>
          </Fragment>
        ))}
      </div>
    </section>
  )
}

function Preparacion({ pasos }: { pasos?: string[] }) {
  if (!pasos || pasos.length === 0) return null
  return (
    <section className="mt-3 rounded-[18px] border border-linea bg-ink-800 p-4">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-accion">Cómo se hace</p>
      <ol className="mt-2.5 flex flex-col gap-2">
        {pasos.map((paso, i) => (
          <li key={paso} className="flex gap-2.5">
            <span className="cifras mt-0.5 shrink-0 text-[11px] font-bold text-accion">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-[12.5px] leading-snug text-silver-300">{paso}</span>
          </li>
        ))}
      </ol>
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
