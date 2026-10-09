import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { hoyIso } from '../../data/dbInstance'
import { agregarNotaLlamada, notasLlamadaDe, type NotaLlamada } from '../../data/consola/notasLlamada'

interface Props {
  usuarioId: string
}

/**
 * La bitácora de llamadas con este asesorado (8-oct-2026, pedida por Bryan para Manuela):
 * fecha, hora, qué se habló y cuándo es la próxima. Staff-only por RLS, no por este
 * componente — el asesorado nunca llega a esta pantalla.
 *
 * Sin el arnés de dos pasos de `ResponderComoStaff`: esto no habla a nombre de nadie, es
 * la nota propia de quien la escribe, así que un solo paso basta.
 */
export function NotasDeLlamada({ usuarioId }: Props) {
  const [notas, setNotas] = useState<NotaLlamada[] | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(hoyIso())
  const [hora, setHora] = useState('')
  const [conclusiones, setConclusiones] = useState('')
  const [proximaReunion, setProximaReunion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    notasLlamadaDe(usuarioId).then((lista) => {
      if (vivo) setNotas(lista)
    })
    return () => {
      vivo = false
    }
  }, [usuarioId])

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    const resultado = await agregarNotaLlamada(usuarioId, {
      fecha,
      hora: hora || undefined,
      conclusiones,
      proximaReunion: proximaReunion || undefined,
    })
    setGuardando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setNotas((previas) => [resultado.nota, ...(previas ?? [])])
    setConclusiones('')
    setProximaReunion('')
    setHora('')
    setFecha(hoyIso())
    setAbierto(false)
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="kicker">Notas de llamada</p>
        {!abierto && (
          <button
            type="button"
            className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto"
            onClick={() => setAbierto(true)}
          >
            + Anotar llamada
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed border-linea bg-surface-2 p-2.5">
          <div className="flex gap-2">
            <label className="flex-1 text-[11px] font-bold uppercase tracking-wide text-tenue">
              Fecha
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>
            <label className="flex-1 text-[11px] font-bold uppercase tracking-wide text-tenue">
              Hora (opcional)
              <input
                type="time"
                className="mt-1 w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </label>
          </div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-tenue" htmlFor={`conclusiones-${usuarioId}`}>
            Qué se habló
          </label>
          <textarea
            id={`conclusiones-${usuarioId}`}
            className="w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
            rows={3}
            value={conclusiones}
            onChange={(e) => setConclusiones(e.target.value)}
          />
          <label className="text-[11px] font-bold uppercase tracking-wide text-tenue" htmlFor={`proxima-${usuarioId}`}>
            Próxima reunión (opcional)
          </label>
          <input
            id={`proxima-${usuarioId}`}
            type="text"
            placeholder="Ej.: en 2 semanas, o 22 de octubre"
            className="w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
            value={proximaReunion}
            onChange={(e) => setProximaReunion(e.target.value)}
          />
          {error && <p className="text-xs text-rojo">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className="tecla-3d rounded-lg bg-accion px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              disabled={guardando || !conclusiones.trim()}
              onClick={() => void guardar()}
            >
              {guardando ? 'Guardando…' : 'Guardar nota'}
            </button>
            <button
              type="button"
              className="rounded-lg border border-linea px-3 py-1.5 text-xs font-bold text-tenue"
              disabled={guardando}
              onClick={() => {
                setAbierto(false)
                setError(null)
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-2">
        {notas === null && <p className="text-xs text-tenue">Cargando…</p>}
        {notas?.length === 0 && <p className="text-xs text-tenue">Todavía no hay llamadas anotadas.</p>}
        {notas?.map((nota) => (
          <div key={nota.id} className="rounded-lg border border-linea bg-surface-2 p-2.5">
            <p className="text-[11px] font-bold text-tenue">
              {nota.fecha}
              {nota.hora ? ` · ${nota.hora}` : ''}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-texto">{nota.conclusiones}</p>
            {nota.proximaReunion && (
              <p className="mt-1 text-xs text-tenue">Próxima reunión: {nota.proximaReunion}</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
