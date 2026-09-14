import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { modoNube } from '../../data/supabase'
import { leerBandeja, pararPublicacion, textoCuentaAtras, type FilaBandeja } from './bandejaVetoNube'

function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Error inesperado'
}

function textoAviso(a: unknown): string {
  if (typeof a === 'string') return a
  if (a && typeof a === 'object') {
    const o = a as Record<string, unknown>
    if (typeof o.mensaje === 'string') return o.mensaje
    if (typeof o.texto === 'string') return o.texto
  }
  try {
    return JSON.stringify(a)
  } catch {
    return String(a)
  }
}

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'listo'; filas: FilaBandeja[] }

function CabeceraBandeja({ alActualizar }: { alActualizar?: () => void }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="kicker">Veto de 24 h</p>
        <h3 className="font-display text-base text-texto">Planes que salen solos</h3>
        <p className="mt-1 max-w-lg text-xs leading-relaxed text-tenue">
          La cadena los dejó en bandeja. Si nadie los para, se publican solos a las 24 h. Los que traen
          parada no salen sin que alguien los mire.
        </p>
      </div>
      {alActualizar && (
        <button
          type="button"
          onClick={alActualizar}
          className="press shrink-0 rounded-xl border border-linea bg-surface-2 px-4 py-2.5 text-sm font-bold text-texto"
        >
          Actualizar
        </button>
      )}
    </div>
  )
}

export function BandejaVeto() {
  const [estado, setEstado] = useState<Estado>(() =>
    modoNube ? { fase: 'cargando' } : { fase: 'error', mensaje: 'La bandeja lee de Supabase y la app está en modo demo, sin conexión a la nube.' },
  )
  const [aviso, setAviso] = useState<string | undefined>()
  const [, setTick] = useState(0)

  const traer = useCallback(async () => {
    try {
      const filas = await leerBandeja()
      setEstado({ fase: 'listo', filas })
    } catch (e) {
      setEstado({ fase: 'error', mensaje: mensajeDeError(e) })
    }
  }, [])

  const cargar = useCallback(async () => {
    setAviso(undefined)
    setEstado({ fase: 'cargando' })
    await traer()
  }, [traer])

  useEffect(() => {
    if (!modoNube) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- los setEstado van tras el await
    void traer()
  }, [traer])

  // La cuenta atrás se mueve sin pedir de nuevo: la bandeja es por horas,
  // y un refetch cada segundo sería ruido.
  useEffect(() => {
    if (estado.fase !== 'listo' || estado.filas.length === 0) return
    const id = window.setInterval(() => setTick((n) => n + 1), 60000)
    return () => window.clearInterval(id)
  }, [estado])

  if (estado.fase === 'cargando') {
    return (
      <Card className="flex flex-col gap-3">
        <CabeceraBandeja />
        <p className="p-2 text-center text-sm text-tenue">Cargando bandeja…</p>
      </Card>
    )
  }

  if (estado.fase === 'error') {
    return (
      <Card className="flex flex-col gap-3">
        <CabeceraBandeja alActualizar={modoNube ? () => void cargar() : undefined} />
        <p className="font-display text-sm text-texto">No se pudo cargar la bandeja</p>
        <p className="text-sm text-tenue">{estado.mensaje}</p>
        {modoNube && (
          <button
            type="button"
            onClick={() => void cargar()}
            className="press self-start rounded-boton bg-accion px-4 py-2.5 font-display text-sm uppercase tracking-wide text-white"
          >
            Reintentar
          </button>
        )}
      </Card>
    )
  }

  const { filas } = estado

  if (filas.length === 0) return null

  return (
    <Card className="flex flex-col gap-3">
      <CabeceraBandeja alActualizar={() => void cargar()} />
      {aviso && (
        <p role="status" className="rounded-boton border border-linea bg-surface-2 px-3.5 py-2.5 text-sm text-tenue">
          {aviso}
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        {filas.map((fila) => (
          <FilaBandejaVeto
            key={fila.pendiente.id}
            fila={fila}
            alParar={(id) => {
              setEstado((prev) =>
                prev.fase === 'listo' ? { ...prev, filas: prev.filas.filter((f) => f.pendiente.id !== id) } : prev,
              )
              setAviso('Parado. No se publicará solo.')
            }}
            alError={setAviso}
          />
        ))}
      </div>
    </Card>
  )
}

function FilaBandejaVeto({
  fila,
  alParar,
  alError,
}: {
  fila: FilaBandeja
  alParar: (id: string) => void
  alError: (m: string) => void
}) {
  const { pendiente, nombre, microcicloNumero } = fila
  const [motivo, setMotivo] = useState('')
  const [parando, setParando] = useState(false)
  const [abierto, setAbierto] = useState(false)

  const parar = async () => {
    setParando(true)
    try {
      await pararPublicacion(pendiente.id, motivo.trim() || 'parado desde la bandeja')
      alParar(pendiente.id)
    } catch (e) {
      alError(`No se pudo parar: ${mensajeDeError(e)}`)
    } finally {
      setParando(false)
    }
  }

  const avisos = pendiente.avisos ?? []

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-linea bg-surface-2 px-3 py-3">
      {/* Avisos arriba: lo que tiene que ver el coach antes de decidir. */}
      {avisos.length > 0 && (
        <ul className="flex flex-col gap-1">
          {avisos.map((a, i) => (
            <li key={i} className="text-xs leading-snug text-tenue">
              <span className="font-bold text-texto">Aviso: </span>
              {textoAviso(a)}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-sm text-texto">{nombre}</span>
        {microcicloNumero !== undefined && <Badge>M{microcicloNumero}</Badge>}
        {pendiente.traeParada && <Badge tono="rojo">trae parada</Badge>}
        <Badge tono={pendiente.traeParada ? 'rojo' : 'ambar'}>{textoCuentaAtras(pendiente.publicarEn)}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/coach/asesorado/${pendiente.usuarioId}`}
          className="press rounded-boton border border-linea bg-surface-2 px-3 py-2 text-xs font-bold text-texto"
        >
          Ver plan
        </Link>
        {!abierto ? (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="press rounded-boton border border-accion bg-accion px-3 py-2 font-display text-xs uppercase tracking-wide text-white"
          >
            Parar
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (opcional)"
              className="min-w-0 flex-1 rounded-boton border border-linea bg-white px-3 py-2 text-xs text-texto placeholder:text-tenue"
            />
            <button
              type="button"
              disabled={parando}
              onClick={() => void parar()}
              className="press rounded-boton border border-accion bg-accion px-3 py-2 font-display text-xs uppercase tracking-wide text-white disabled:opacity-40"
            >
              {parando ? 'Parando…' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="press rounded-boton border border-linea bg-surface-2 px-3 py-2 text-xs font-bold text-texto"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
