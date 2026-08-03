import { useState } from 'react'
import { descartesPendientes, recuperarDescartes } from '../../data/nube/sync'

/**
 * Avisa de lo que se quedó sin subir, donde ocurrió el fallo.
 *
 * La cola descarta en silencio a propósito: protege el registro local cuando
 * algo del servidor falla. Correcto para los datos, pero significó que el
 * registro de comidas estuviera semanas sin subir mientras el asesorado seguía
 * anotando su día con normalidad, sin ver un solo aviso.
 *
 * TRES COSAS QUE EL TEXTO NO PUEDE HACER:
 *
 * 1. **Culpar.** No es un error de la persona ni algo que hiciera mal.
 * 2. **Asustar.** Su registro NO se perdió: está en el teléfono. Lo que falta es
 *    la copia del servidor.
 * 3. **Prometer un total.** El montón guarda un máximo de operaciones y tira las
 *    más viejas, así que el número es un mínimo. Por eso dice "al menos".
 */
export function AvisoSinSincronizar({ usuarioId }: { usuarioId: string }) {
  const [pendientes, setPendientes] = useState(() => descartesPendientes(usuarioId))
  const [reintentando, setReintentando] = useState(false)

  if (pendientes === 0) return null

  const reintentar = () => {
    setReintentando(true)
    recuperarDescartes(usuarioId)
    // La subida es asíncrona: se relee un momento después para reflejar lo que
    // el procesador ya vació, sin fingir que terminó.
    window.setTimeout(() => {
      setPendientes(descartesPendientes(usuarioId))
      setReintentando(false)
    }, 1200)
  }

  return (
    <section className="rounded-tarjeta border border-ambar/40 bg-ambar/10 px-4 py-3.5">
      <p className="text-sm font-bold text-texto">
        Al menos {pendientes} {pendientes === 1 ? 'registro' : 'registros'} no{' '}
        {pendientes === 1 ? 'ha' : 'han'} llegado al servidor
      </p>
      <p className="mt-1 text-xs leading-relaxed text-tenue">
        Lo que anotaste sigue guardado en tu teléfono, no se perdió. Solo falta que
        suba para que tu coach pueda verlo.
      </p>
      <button
        type="button"
        onClick={reintentar}
        disabled={reintentando}
        className="press mt-2.5 rounded-full bg-ambar px-4 py-2 text-xs font-bold text-bg disabled:opacity-50"
      >
        {reintentando ? 'Intentando…' : 'Intentar de nuevo'}
      </button>
    </section>
  )
}
