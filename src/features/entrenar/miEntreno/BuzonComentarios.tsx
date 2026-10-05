import { useId, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FalloDeLectura } from '../../../components/ui/FalloDeLectura'
import { useLectura } from '../../../components/ui/useLectura'
import { enviarComentario, misComentarios } from '../../../data/consola/comentarios'
import {
  AVISO_SALUD,
  ESTADO_PUBLICO,
  LARGO_MAXIMO_COMENTARIO,
  NOMBRE_TIPO,
  TIPOS_COMENTARIO,
  soloLaRuta,
  type TipoComentario,
} from '../../../domain/comentariosApp'

/**
 * «Tus comentarios sobre la app» de Mi entreno (maqueta «Espacios de Alpha», 28-sep;
 * migración 0095): se elige el tipo (algo falla · una idea · no entiendo), se escribe qué
 * pasó y se envía. Debajo, el ESTADO de los comentarios propios: RECIBIDO, EN CONTRATO o
 * ARREGLADO (solo los míos: la base no deja ver los de otros).
 *
 * Honesto con lo que pasa: si el envío falla, lo dice y conserva lo escrito (no lo da por
 * enviado); un error al leer los propios se dice como error, no como «no hay comentarios».
 * El aviso de que esto no es para salud ni urgencias va SIEMPRE antes del botón. Solo se
 * manda la ruta de la pantalla (`pathname`), nunca la consulta ni el fragmento.
 */

const CLASE_CHIP = 'press min-h-[44px] rounded-full border px-3.5 text-[13px] font-semibold text-texto'

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).toUpperCase()

export function BuzonComentarios() {
  const id = useId()
  const { pathname } = useLocation()
  const { lectura, reintentar } = useLectura(misComentarios)
  const [tipo, setTipo] = useState<TipoComentario>('falla')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  const vacio = texto.trim() === ''

  const enviar = async () => {
    if (vacio || enviando) return
    setEnviando(true)
    setError(null)
    setEnviado(false)
    const version = (import.meta.env.VITE_VERSION_APP as string | undefined) ?? null
    const r = await enviarComentario({ tipo, pantalla: soloLaRuta(pathname), texto: texto.trim(), version })
    setEnviando(false)
    if (!r.ok) {
      // NO se borra lo escrito: quien escribió no tiene que volver a redactarlo.
      setError(r.error)
      return
    }
    setTexto('')
    setEnviado(true)
    reintentar()
  }

  return (
    <section
      aria-label="Tus comentarios sobre la app"
      className="entrada entrada-4 flex flex-col gap-3 rounded-tarjeta border border-rojo bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-rojo">Tus comentarios sobre la app</span>
        <span className="text-[13px] leading-snug text-tenue">
          Lo que escribas aquí se convierte en tareas para los agentes que mejoran la app.
        </span>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <div role="group" aria-label="Tipo de comentario" className="flex flex-wrap gap-2">
          {TIPOS_COMENTARIO.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={`${CLASE_CHIP} ${tipo === t ? 'border-rojo bg-rojo/10' : 'border-linea bg-surface-2'}`}
            >
              {NOMBRE_TIPO[t]}
            </button>
          ))}
        </div>

        <label htmlFor={`${id}-texto`} className="flex flex-col gap-1.5 text-[13px] text-tenue">
          ¿Qué pasó y en qué pantalla?
          <textarea
            id={`${id}-texto`}
            rows={3}
            maxLength={LARGO_MAXIMO_COMENTARIO}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setEnviado(false)
            }}
            placeholder="Ej.: en la sesión, el cronómetro se reinicia si bloqueo el celular"
            className="resize-none rounded-xl border border-linea bg-bg p-3 text-sm text-texto placeholder:text-tenue"
          />
          <span className="cifras self-end text-[11px]" aria-live="off">
            {texto.length}/{LARGO_MAXIMO_COMENTARIO}
          </span>
        </label>

        <p className="text-xs leading-snug text-tenue">{AVISO_SALUD}</p>

        {error && (
          <p role="alert" className="text-sm font-semibold text-rojo">
            No se envió: {error}. Lo que escribiste sigue aquí.
          </p>
        )}
        {enviado && <p role="status" className="text-sm font-semibold text-texto">Recibido. Su estado aparece abajo.</p>}

        <button
          type="submit"
          disabled={vacio || enviando}
          className="press min-h-[48px] rounded-boton bg-texto font-display text-[13px] uppercase text-bg disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Enviar comentario'}
        </button>
      </form>

      <div className="flex flex-col gap-2 border-t border-linea pt-2.5">
        {lectura === null ? (
          <p className="text-sm text-tenue" aria-busy="true">Cargando tus comentarios…</p>
        ) : !lectura.ok ? (
          <FalloDeLectura texto={`No se pudieron leer tus comentarios (${lectura.error}).`} onReintentar={reintentar} />
        ) : lectura.datos.length === 0 ? (
          <p className="text-sm text-tenue">Todavía no has enviado comentarios.</p>
        ) : (
          <ul aria-label="Tus comentarios enviados" className="flex flex-col gap-2">
            {lectura.datos.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-texto">{c.texto ?? '(texto borrado)'}</span>
                  <span className="text-[11px] text-tenue">
                    {NOMBRE_TIPO[c.tipo]} · {fechaCorta(c.creadoEn)}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${
                    c.estado === 'arreglado' ? 'bg-texto text-bg' : 'border border-tenue text-texto'
                  }`}
                >
                  {ESTADO_PUBLICO[c.estado]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
