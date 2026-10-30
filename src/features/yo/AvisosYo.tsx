import { useEffect, useState } from 'react'
import { activarAvisos, apagarAvisos, leerEstadoAvisos, type EstadoAvisos } from '../avisos/estadoAvisos'

/**
 * UN solo interruptor de avisos en el teléfono (H-03, decisión de Bryan, 28-oct). Enseña el estado REAL del aparato
 * (activados, apagados, sin decidir, bloqueados) y deja volver a pedir el permiso a quien dijo «Ahora no» en la tarjeta
 * de Hoy. Al encender, pide el permiso si hace falta y suscribe a web push, igual que la tarjeta de Hoy.
 */

const TEXTO: Record<EstadoAvisos, string> = {
  'no-soportado': 'Este navegador no puede mostrar avisos. Si instalas la app en la pantalla de inicio, prueba desde ahí.',
  bloqueado:
    'Bloqueados en tu navegador. Para activarlos, permite las notificaciones de esta app en los ajustes del navegador y vuelve aquí.',
  'sin-preguntar': 'Aún no has decidido. Al encenderlos, tu teléfono te pedirá permiso.',
  apagado: 'Apagados. Enciéndelos cuando quieras.',
  activo: 'Activados. Un toque el día de tu sesión, el recordatorio del check-in a las 6 pm y tu revisión de la semana.',
}

export function AvisosYo({ usuarioId }: { usuarioId: string }) {
  const [estado, setEstado] = useState<EstadoAvisos | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    void leerEstadoAvisos().then((e) => {
      if (vivo) setEstado(e)
    })
    return () => {
      vivo = false
    }
  }, [])

  const activo = estado === 'activo'
  const puede = estado === 'activo' || estado === 'apagado' || estado === 'sin-preguntar'

  const alternar = async () => {
    if (!puede || ocupado) return
    setOcupado(true)
    setEstado(await (activo ? apagarAvisos(usuarioId) : activarAvisos(usuarioId)))
    setOcupado(false)
  }

  return (
    <section aria-label="Avisos" className="flex flex-col gap-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Avisos</h3>
      <div className="flex items-start justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-texto">Avisos en el teléfono</p>
          <p className="mt-1 text-xs leading-relaxed text-tenue" role="status" aria-live="polite">
            {estado === null ? 'Mirando el estado…' : TEXTO[estado]}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={activo}
          aria-label="Avisos en el teléfono"
          disabled={!puede || ocupado}
          onClick={() => void alternar()}
          className={`press mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
            activo ? 'border-accion bg-accion' : 'border-linea bg-surface-3'
          }`}
        >
          <span
            aria-hidden="true"
            className={`block h-5 w-5 rounded-full bg-white transition-transform ${activo ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
      </div>
    </section>
  )
}
