import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { db } from '../../../data/dbInstance'
import { detenerPublicacion, reportarRiesgo, type Orden } from '../../../data/consola/ordenes'
import { useCapacidades } from './useCapacidades'

/**
 * «Detener publicación» y «Reportar riesgo» de una persona en su semana (Módulo 1 de la
 * maqueta, DISENO-CONSOLA-V2.md §2.1 y §4). Escribe en `ordenes` (migración 0083) — solo
 * al pulsar «Confirmar», nunca al montar ni al abrir el cuadro de motivo.
 *
 * El motivo se pide en un cuadro DENTRO de la página, nunca con `prompt`/`confirm` del
 * navegador (encargo, punto 2): eso no se puede probar con Testing Library ni queda
 * registrado en la propia pantalla.
 */

function formatoHora(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function nombreDe(usuarioId: string): string {
  return db.usuarios.byId(usuarioId)?.nombre ?? 'alguien del equipo'
}

type TipoAccion = 'detener' | 'reportar'

interface AccionesRevisionProps {
  usuarioId: string
  semanaInicio: string
  /** Las órdenes ya traídas por quien pinta la lista (una sola consulta para toda la
   *  cartera) — este componente solo filtra las que le tocan a `usuarioId`+`semanaInicio`. */
  ordenes: readonly Orden[]
  /** Avisa a quien pinta la lista de que hay una orden nueva, para refrescar `ordenes`. */
  onOrdenCreada: () => void
}

export function AccionesRevision({ usuarioId, semanaInicio, ordenes, onOrdenCreada }: AccionesRevisionProps) {
  const { cargando: cargandoCapacidades, tiene, usuarioId: actorId } = useCapacidades()
  const [abierta, setAbierta] = useState<TipoAccion | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const esDeEstaPersonaYSemana = (orden: Orden) =>
    orden.objetivo.usuario_id === usuarioId && orden.objetivo.semana_inicio === semanaInicio

  const detencion = ordenes.find((o) => o.tipo === 'detener' && esDeEstaPersonaYSemana(o))
  const riesgo = ordenes.find((o) => o.tipo === 'reportar_riesgo' && esDeEstaPersonaYSemana(o))

  const puedeDetener = tiene('detener_publicacion')
  const puedeReportar = tiene('reportar_riesgo')

  const abrir = (tipo: TipoAccion) => {
    setError(null)
    setInfo(null)
    setMotivo('')
    setAbierta(tipo)
  }

  const cancelar = () => {
    setAbierta(null)
    setMotivo('')
    setError(null)
  }

  const enviar = async () => {
    if (!abierta) return
    if (!motivo.trim()) {
      setError('Escribe el motivo antes de enviar.')
      return
    }
    if (!actorId) {
      setError('Sin sesión: no se puede enviar.')
      return
    }
    setEnviando(true)
    setError(null)
    const params = { usuarioId, semanaInicio, motivo: motivo.trim(), actorId }
    const resultado = abierta === 'detener' ? await detenerPublicacion(params) : await reportarRiesgo(params)
    setEnviando(false)

    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setInfo(
      resultado.yaExistia
        ? abierta === 'detener'
          ? 'Ya estaba detenida.'
          : 'Ya habías reportado este riesgo.'
        : null,
    )
    setAbierta(null)
    setMotivo('')
    onOrdenCreada()
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-linea pt-2.5">
      {info && <p className="text-[11px] text-tenue">{info}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {detencion ? (
          <Badge tono="rojo">
            Detenida por {nombreDe(detencion.actorId)} a las {formatoHora(detencion.creadaEn)}
          </Badge>
        ) : (
          <>
            <button
              type="button"
              className="tecla-3d rounded-lg border border-rojo/50 bg-rojo/10 px-3 py-1.5 text-xs font-bold text-rojo disabled:cursor-not-allowed disabled:opacity-40"
              disabled={cargandoCapacidades || !puedeDetener}
              onClick={() => abrir('detener')}
            >
              Detener publicación
            </button>
            {!cargandoCapacidades && !puedeDetener && (
              <span className="text-[11px] text-tenue">— hace falta la capacidad «detener publicación».</span>
            )}
          </>
        )}

        {riesgo && <Badge tono="ambar">Riesgo reportado por {nombreDe(riesgo.actorId)}</Badge>}
        <button
          type="button"
          className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto disabled:cursor-not-allowed disabled:opacity-40"
          disabled={cargandoCapacidades || !puedeReportar}
          onClick={() => abrir('reportar')}
        >
          Reportar riesgo
        </button>
        {!cargandoCapacidades && !puedeReportar && (
          <span className="text-[11px] text-tenue">— hace falta la capacidad «reportar riesgo».</span>
        )}
      </div>

      {detencion && (
        <p className="text-[11.5px] text-tenue">
          Detenida hasta que alguien con permiso la resuelva; no se reanuda sola por el simple paso del tiempo.
          Todavía no hay botón de «reanudar» — llega con la vía de firma.
        </p>
      )}

      {abierta && (
        <div className="rounded-lg border border-dashed border-linea bg-surface-2 p-2.5">
          <label
            className="text-[11px] font-bold uppercase tracking-wide text-tenue"
            htmlFor={`motivo-${abierta}-${usuarioId}`}
          >
            Motivo {abierta === 'detener' ? 'para detener la publicación' : 'del riesgo reportado'}
          </label>
          <textarea
            id={`motivo-${abierta}-${usuarioId}`}
            className="mt-1 w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {error && <p className="mt-1 text-xs text-rojo">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="tecla-3d rounded-lg bg-rojo px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              disabled={enviando}
              onClick={() => void enviar()}
            >
              {enviando ? 'Enviando…' : abierta === 'detener' ? 'Confirmar detener' : 'Confirmar reporte'}
            </button>
            <button
              type="button"
              className="rounded-lg border border-linea px-3 py-1.5 text-xs font-bold text-tenue"
              disabled={enviando}
              onClick={cancelar}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
