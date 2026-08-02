import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { validarAdjunto } from '../../domain/adjuntos'

export interface EnvioRapido {
  texto: string
  archivo: File | undefined
}

interface BarraCoachProps {
  iniciales: string
  noLeidos: number
  ultimoTexto: string | undefined
  onEnviar: (envio: EnvioRapido) => void
}

/**
 * La entrada al coach, arriba de Hoy.
 *
 * Estaba al final de la pantalla, después del álbum, el radar y el mapa de
 * fatiga: para escribirle había que recorrer Hoy entera, así que en la práctica
 * no se veía.
 *
 * Recibe qué mostrar en lugar de decidirlo por su cuenta. El ciclo de revisiones
 * le añadirá otro estado —cuenta atrás y temas de la próxima revisión— y con
 * esta forma no hay que reescribirla para eso.
 */
export function BarraCoach({ iniciales, noLeidos, ultimoTexto, onEnviar }: BarraCoachProps) {
  const [texto, setTexto] = useState('')
  const [archivo, setArchivo] = useState<File>()
  const [error, setError] = useState('')
  const idCampoArchivo = useId()
  const navegar = useNavigate()

  const elegir = (elegido: File | undefined) => {
    setError('')
    if (!elegido) return
    const validacion = validarAdjunto(elegido)
    if (!validacion.ok) {
      setError(validacion.motivo)
      return
    }
    setArchivo(elegido)
  }

  const enviar = () => {
    const limpio = texto.trim()
    if (!limpio && !archivo) return
    onEnviar({ texto: limpio, archivo })
    setTexto('')
    setArchivo(undefined)
    setError('')
    // Al enviar se entra al chat: la persona ve su mensaje en el hilo y sigue
    // ahí si quiere. La barra es el atajo, no un chat paralelo.
    navegar('/chat')
  }

  return (
    <section className="glass glass-destacada rounded-bloque p-3.5">
      <button
        type="button"
        onClick={() => navegar('/chat')}
        className="press flex w-full items-center gap-2.5 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-bold text-texto">
          {iniciales}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm text-texto">Escríbele a tu coach</span>
          {ultimoTexto && <span className="block truncate text-xs text-tenue">{ultimoTexto}</span>}
        </span>
        {noLeidos > 0 && (
          <span className="cifras shrink-0 rounded-full bg-rojo px-2 py-0.5 text-[10px] font-bold text-white">
            {noLeidos}
          </span>
        )}
      </button>

      {archivo && (
        <p className="mt-2.5 flex items-center gap-2 rounded-boton border border-linea bg-surface-1 px-3 py-1.5 text-xs text-tenue">
          <span className="truncate">{archivo.name}</span>
          <button
            type="button"
            className="press ml-auto shrink-0 font-bold text-accion"
            onClick={() => setArchivo(undefined)}
          >
            quitar
          </button>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2.5 text-xs font-bold leading-snug text-rojo">
          {error}
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        {/* Un `label` con pinta de botón, no un botón que dispara un input
            oculto: así hay UN solo control con UN solo nombre accesible, en vez
            de dos que se llaman igual. */}
        <input
          id={idCampoArchivo}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          onChange={(e) => elegir(e.target.files?.[0])}
        />
        <label
          htmlFor={idCampoArchivo}
          className="press grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-boton border border-linea bg-surface-1 text-tenue"
        >
          <span className="sr-only">Adjuntar foto o video</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M14.5 4h-5L8 6H4.5A1.5 1.5 0 0 0 3 7.5v11A1.5 1.5 0 0 0 4.5 20h15a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 19.5 6H16z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </label>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') enviar()
          }}
          placeholder="Escríbele un mensaje…"
          className="min-w-0 flex-1 rounded-boton border border-linea bg-surface-1 px-3.5 py-2.5 text-sm text-texto placeholder:text-tenue focus:border-accion focus:outline-none"
        />
        <button
          type="button"
          onClick={enviar}
          aria-label="Enviar mensaje"
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accion text-white"
          style={{ boxShadow: 'var(--glow-accion)' }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="m5 12 7-7 7 7 M12 19V5" />
          </svg>
        </button>
      </div>
    </section>
  )
}
