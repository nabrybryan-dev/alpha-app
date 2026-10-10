import { useEffect, useRef, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { db } from '../../data/dbInstance'
import {
  fechaDeObservacion,
  firmarObservacion,
  observacionesDe,
  type DecisionObservacion,
  type FuenteObservacion,
  type ObservacionAgente,
  type TemaObservacion,
} from '../../data/consola/observacionesAgente'

interface Props {
  usuarioId: string
}

/** Cuántas observaciones ya resueltas (o anotadas) se ven de entrada; el resto queda plegado. */
const VISIBLES = 5

const NOMBRE_DEL_TEMA: Record<TemaObservacion, string> = {
  nota_de_llamada: 'Nota de llamada',
  prescripcion: 'Prescripción',
  estilo_de_vida: 'Estilo de vida',
  seguridad: 'Seguridad',
  nutricion: 'Nutrición',
}

const nombreDe = (id: string | null) => (id ? db.usuarios.byId(id)?.nombre : undefined) ?? 'alguien del equipo'

/** Lo que espera firma: carril de firma y todavía sin decidir. Lo único que lleva botones. */
const esperaFirma = (o: ObservacionAgente) => o.carril === 'para_firma' && o.estado === 'pendiente'

/** Cuándo pasó lo último con ella: la firma si ya la hay, y si no, cuándo se escribió. */
const ultimoMovimiento = (o: ObservacionAgente) => Date.parse(o.firmadaEn ?? o.creadoEn) || 0

function Fuentes({ fuentes }: { fuentes: FuenteObservacion[] }) {
  if (fuentes.length === 0) {
    return <p className="mt-2 text-xs text-ambar">No trae fuentes que se puedan leer.</p>
  }
  return (
    <div className="mt-2">
      <p className="text-xs font-bold text-tenue">Se apoya en:</p>
      <ul className="mt-1 flex flex-col gap-1">
        {fuentes.map((f, i) => (
          <li key={i} className="text-xs text-texto">
            <span className="font-bold text-tenue">
              {f.tipo === 'base' ? 'De la base de conocimiento' : f.tipo === 'dato' ? 'De sus datos' : 'Origen sin indicar'}
            </span>
            {f.ref && <span> · {f.ref}</span>}
            {f.cita && <span className="block italic text-tenue">«{f.cita}»</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** La línea que dice quién la resolvió y cuándo. Solo para las ya firmadas. */
function Resolucion({ observacion: o }: { observacion: ObservacionAgente }) {
  if (o.estado === 'pendiente') return null
  return (
    <p className={`mt-2 text-xs font-bold ${o.estado === 'aceptada' ? 'text-verde' : 'text-tenue'}`}>
      {o.estado === 'aceptada' ? 'Aceptada' : 'Descartada'} por {nombreDe(o.firmadaPor)}
      {o.firmadaEn ? ` · ${fechaDeObservacion(o.firmadaEn)}` : ''}
      {o.notaDeFirma && <span className="block font-normal text-texto">Nota: {o.notaDeFirma}</span>}
    </p>
  )
}

interface TarjetaProps {
  observacion: ObservacionAgente
  /** Hay una firma en curso (de esta u otra tarjeta): los botones esperan. */
  ocupada: boolean
  /** Lo que salió mal al firmar ESTA observación, o `null`. */
  error: string | null
  onFirmar: (id: string, decision: DecisionObservacion, nota?: string) => void
}

function Tarjeta({ observacion: o, ocupada, error, onFirmar }: TarjetaProps) {
  const pendiente = esperaFirma(o)
  /** Descartar pide un segundo toque: primero abre la nota, después confirma. */
  const [descartando, setDescartando] = useState(false)
  const [nota, setNota] = useState('')

  return (
    <article className="rounded-lg border border-linea bg-surface-2 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tono={o.tema === 'seguridad' ? 'rojo' : o.tema === 'prescripcion' ? 'ambar' : 'neutro'}>
          {NOMBRE_DEL_TEMA[o.tema]}
        </Badge>
        {o.carril === 'anotada' && <span className="text-xs text-tenue">Anotada, sin firma</span>}
      </div>
      <h4 className="mt-1.5 text-sm font-bold text-texto">{o.titulo}</h4>
      <p className="mt-1 whitespace-pre-wrap text-sm text-texto">{o.texto}</p>
      <p className="mt-1 text-xs text-tenue">
        {o.agente} · {fechaDeObservacion(o.creadoEn)}
      </p>
      <Fuentes fuentes={o.fuentes} />
      <Resolucion observacion={o} />

      {pendiente && (
        <div className="mt-2">
          {descartando ? (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-linea p-2">
              <label className="text-xs font-bold text-tenue" htmlFor={`nota-${o.id}`}>
                Por qué la descartas (opcional)
              </label>
              <input
                id={`nota-${o.id}`}
                type="text"
                maxLength={500}
                className="w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-label={`Confirmar que descartas «${o.titulo}»`}
                  className="min-h-[44px] rounded-lg border border-rojo/50 px-4 text-xs font-bold text-rojo disabled:opacity-50"
                  disabled={ocupada}
                  onClick={() => onFirmar(o.id, 'descartada', nota)}
                >
                  Sí, descartar
                </button>
                <button
                  type="button"
                  className="min-h-[44px] rounded-lg border border-linea px-4 text-xs font-bold text-tenue"
                  disabled={ocupada}
                  onClick={() => {
                    setDescartando(false)
                    setNota('')
                  }}
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-label={`Aceptar «${o.titulo}»`}
                className="tecla-3d min-h-[44px] rounded-lg bg-accion px-4 text-xs font-bold text-white disabled:opacity-50"
                disabled={ocupada}
                onClick={() => onFirmar(o.id, 'aceptada')}
              >
                Aceptar
              </button>
              <button
                type="button"
                aria-label={`Descartar «${o.titulo}»`}
                className="min-h-[44px] rounded-lg border border-linea px-4 text-xs font-bold text-texto disabled:opacity-50"
                disabled={ocupada}
                onClick={() => setDescartando(true)}
              >
                Descartar
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-rojo">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

/**
 * Lo que un agente de IA observó de este asesorado (migración 0115). Interno del equipo: el asesorado
 * nunca llega a esta pantalla, y la base solo deja leer a quien entra a la consola.
 *
 * La regla del dueño (Bryan, 9-oct-2026): la base de conocimiento tiene la última palabra, salvo en
 * seguridad y prescripciones, donde la tienen él y Manuela. Por eso hay dos carriles y se ven distinto:
 *  - `para_firma` PENDIENTE: arriba, en un bloque destacado, con «Aceptar» y «Descartar». Nada de lo que
 *    proponen cambia hasta que alguien firma; aceptar o descartar queda con quién y cuándo.
 *  - todo lo demás (las `anotada` y las ya firmadas): debajo, la más reciente primero. Las `anotada` no
 *    llevan botones: no hay nada que decidir.
 *
 * Esta pieza NO escribe observaciones —las escribe el agente, fuera de la app—; lo único que hace es
 * firmar, y solo por la función `firmar_observacion_agente`. Quién firma y cuándo los pone la base.
 *
 * Quien lo monte debe ponerle `key={usuarioId}`: el estado es de UNA persona, y sin la `key` pasar de un
 * asesorado a otro dejaría un instante las observaciones del anterior bajo el nombre del siguiente.
 *
 * Un fallo de carga NO se pinta como «todavía no hay observaciones»: alguien podría creer que el agente no
 * encontró nada de seguridad cuando lo que pasó es que la lista no llegó. Se dice y se ofrece reintentar.
 */
export function ObservacionesDelAgente({ usuarioId }: Props) {
  const [observaciones, setObservaciones] = useState<ObservacionAgente[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  /** Cuenta los reintentos: cambiarla vuelve a disparar la carga. */
  const [intento, setIntento] = useState(0)
  const [verTodas, setVerTodas] = useState(false)
  const [firmando, setFirmando] = useState(false)
  /** El error de la última firma fallida, con la observación a la que pertenece. */
  const [errorFirma, setErrorFirma] = useState<{ id: string; texto: string } | null>(null)
  /** El `disabled` del botón llega un render tarde: la referencia cierra la puerta en el mismo instante. */
  const firmandoAhora = useRef(false)

  useEffect(() => {
    let vivo = true
    observacionesDe(usuarioId).then((resultado) => {
      if (!vivo) return
      if (resultado.ok) {
        setObservaciones(resultado.observaciones)
        setErrorCarga(null)
      } else {
        setErrorCarga(resultado.error)
      }
    })
    return () => {
      vivo = false
    }
  }, [usuarioId, intento])

  const firmar = async (id: string, decision: DecisionObservacion, nota?: string) => {
    if (firmandoAhora.current) return
    firmandoAhora.current = true
    setFirmando(true)
    setErrorFirma(null)
    try {
      const resultado = await firmarObservacion(id, decision, nota)
      if (resultado.ok) {
        // Se repinta con la fila que devolvió la base (con quién firmó y la hora de ella), no con un
        // «aceptada» supuesto aquí.
        const firmada = resultado.observacion
        setObservaciones((previas) => (previas ?? []).map((o) => (o.id === firmada.id ? firmada : o)))
        return
      }
      setErrorFirma({ id, texto: resultado.error })
      // Otra persona se adelantó: lo que hay en pantalla está viejo, y el botón fallaría siempre.
      if (resultado.yaFirmada) setIntento((n) => n + 1)
    } finally {
      firmandoAhora.current = false
      setFirmando(false)
    }
  }

  const pendientes = (observaciones ?? []).filter(esperaFirma)
  // Las ya firmadas suben según CUÁNDO se resolvieron: lo que acabas de firmar queda a la vista.
  const resto = (observaciones ?? [])
    .filter((o) => !esperaFirma(o))
    .sort((a, b) => ultimoMovimiento(b) - ultimoMovimiento(a))
  const visibles = verTodas ? resto : resto.slice(0, VISIBLES)
  const plegadas = resto.length - visibles.length

  const tarjeta = (o: ObservacionAgente) => (
    <Tarjeta
      key={o.id}
      observacion={o}
      ocupada={firmando}
      error={errorFirma?.id === o.id ? errorFirma.texto : null}
      onFirmar={(id, decision, nota) => void firmar(id, decision, nota)}
    />
  )

  return (
    <Card>
      <h3 className="kicker">Observaciones del agente</h3>
      <p className="mt-1 text-xs text-tenue">
        Lo escribe un agente de IA a partir de la base de conocimiento. Seguridad y prescripciones no cambian hasta que
        alguien del equipo firme.
      </p>

      <div className="mt-2 flex flex-col gap-2">
        {errorCarga && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rojo/40 bg-rojo/10 p-2.5">
            <p role="alert" className="text-xs text-rojo">
              {errorCarga}
            </p>
            <button
              type="button"
              className="press min-h-[44px] rounded-lg border border-linea bg-surface-2 px-3 text-xs font-bold text-texto"
              onClick={() => {
                setErrorCarga(null)
                setIntento((n) => n + 1)
              }}
            >
              Reintentar
            </button>
          </div>
        )}
        {observaciones === null && !errorCarga && <p className="text-xs text-tenue">Cargando…</p>}
        {observaciones?.length === 0 && !errorCarga && (
          <p className="text-xs text-tenue">Todavía no hay observaciones del agente para esta persona.</p>
        )}

        {pendientes.length > 0 && (
          <section
            aria-label="Esperan tu firma"
            className="flex flex-col gap-2 rounded-bloque border border-ambar/50 bg-ambar/10 p-2.5"
          >
            <p className="text-sm font-bold text-texto">
              Esperan tu firma <span className="text-tenue">({pendientes.length})</span>
            </p>
            {pendientes.map(tarjeta)}
          </section>
        )}

        {visibles.map(tarjeta)}
        {resto.length > VISIBLES && (
          <button
            type="button"
            className="min-h-[44px] self-start rounded-lg border border-linea px-3 text-xs font-bold text-texto"
            onClick={() => setVerTodas((v) => !v)}
          >
            {verTodas ? 'Ver solo las más recientes' : `Ver ${plegadas} ${plegadas === 1 ? 'anterior' : 'anteriores'}`}
          </button>
        )}
      </div>
    </Card>
  )
}
