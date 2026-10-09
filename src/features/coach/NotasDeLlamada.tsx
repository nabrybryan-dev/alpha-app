import { useEffect, useRef, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { db, hoyIso } from '../../data/dbInstance'
import {
  agregarNotaLlamada,
  fechaDeLlamada,
  horaDeLlamada,
  notasLlamadaDe,
  type NotaLlamada,
} from '../../data/consola/notasLlamada'

interface Props {
  usuarioId: string
}

/** Lo que Manuela lleva escrito y todavía no ha guardado. */
interface Borrador {
  abierto: boolean
  fecha: string
  hora: string
  conclusiones: string
  tareas: string
  proximaReunion: string
}

const claveBorrador = (usuarioId: string) => `notas-llamada:borrador:${usuarioId}`

/**
 * El borrador vive en `sessionStorage` (de esta pestaña del navegador) y no solo en el estado:
 * en la consola, cambiar de pestaña para mirar un dato DESMONTA este componente, y quien escribe
 * durante la llamada perdía todo lo anotado sin una palabra. Una clave por asesorado — el
 * borrador de uno no es el del siguiente.
 *
 * `sessionStorage` puede no existir o lanzar (modo privado, cuota, política del navegador):
 * todo acceso va en `try/catch` y, sin él, el componente funciona igual que sin borrador.
 */
function leerBorrador(usuarioId: string): Borrador | null {
  try {
    const crudo = window.sessionStorage.getItem(claveBorrador(usuarioId))
    if (!crudo) return null
    const guardado: unknown = JSON.parse(crudo)
    if (typeof guardado !== 'object' || guardado === null) return null
    const g = guardado as Record<string, unknown>
    // Campo a campo y con valor por omisión: un borrador de otra versión o a medio escribir
    // no debe tumbar la tarjeta.
    const texto = (valor: unknown, porDefecto = '') => (typeof valor === 'string' ? valor : porDefecto)
    return {
      abierto: g.abierto === true,
      fecha: texto(g.fecha, hoyIso()),
      hora: texto(g.hora),
      conclusiones: texto(g.conclusiones),
      tareas: texto(g.tareas),
      proximaReunion: texto(g.proximaReunion),
    }
  } catch {
    return null
  }
}

function escribirBorrador(usuarioId: string, borrador: Borrador): void {
  try {
    window.sessionStorage.setItem(claveBorrador(usuarioId), JSON.stringify(borrador))
  } catch {
    // Sin almacenamiento, un borrador perdido es lo de siempre: no se avisa ni se rompe nada.
  }
}

function borrarBorrador(usuarioId: string): void {
  try {
    window.sessionStorage.removeItem(claveBorrador(usuarioId))
  } catch {
    // Ídem.
  }
}

const ETIQUETA_CAMPO = 'text-xs font-bold uppercase tracking-wide text-tenue'
const CAJA_CAMPO = 'w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto'

/**
 * La bitácora de llamadas con este asesorado (8-oct-2026, pedida por Bryan para Manuela):
 * fecha, hora, qué se habló, las tareas que quedan y cuándo es la próxima. Staff-only por RLS
 * (`es_coach()` o la capacidad `leer_entrenamiento`, 0113), no por este componente — el
 * asesorado nunca llega a esta pantalla.
 *
 * Quien lo monte debe ponerle `key={usuarioId}`: el estado (y el borrador que se lee al montar)
 * es de UNA persona, y sin la `key` pasar de un asesorado a otro arrastraría lo escrito al
 * siguiente.
 *
 * Sin el arnés de dos pasos de `ResponderComoStaff`: esto no habla a nombre de nadie, es
 * la nota propia de quien la escribe, así que un solo paso basta.
 *
 * El nombre de quien escribió cada nota sale de `db.usuarios`, que el padre ya mantiene al día
 * (la ficha y la consola se suscriben a la hidratación); si no está en la cartera local,
 * «alguien del equipo».
 */
export function NotasDeLlamada({ usuarioId }: Props) {
  // Se lee UNA vez, al montar: de ahí en adelante manda el estado.
  const [borrador] = useState(() => leerBorrador(usuarioId))
  const [notas, setNotas] = useState<NotaLlamada[] | null>(null)
  /** Texto del aviso cuando la carga falló, o `null`. Mientras haya uno, la lista vacía NO es
   *  «no hay llamadas»: es «no sé». */
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  /** Cuenta los reintentos: cambiarla vuelve a disparar la carga. */
  const [intento, setIntento] = useState(0)
  const [abierto, setAbierto] = useState(borrador?.abierto ?? false)
  const [fecha, setFecha] = useState(borrador?.fecha ?? hoyIso())
  const [hora, setHora] = useState(borrador?.hora ?? '')
  const [conclusiones, setConclusiones] = useState(borrador?.conclusiones ?? '')
  const [tareas, setTareas] = useState(borrador?.tareas ?? '')
  const [proximaReunion, setProximaReunion] = useState(borrador?.proximaReunion ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** El `disabled` del botón ya lo impide, pero el estado se actualiza en el siguiente render:
   *  la referencia cierra la puerta en el mismo instante en que `guardar` arranca. */
  const guardandoAhora = useRef(false)

  useEffect(() => {
    let vivo = true
    notasLlamadaDe(usuarioId).then((resultado) => {
      if (!vivo) return
      if (resultado.ok) {
        setNotas(resultado.notas)
        setErrorCarga(null)
      } else {
        setErrorCarga(resultado.error)
      }
    })
    return () => {
      vivo = false
    }
  }, [usuarioId, intento])

  // Cada cambio del formulario abierto deja su borrador. Cerrado no escribe nada: cerrar es
  // guardar o cancelar, y los dos lo borran a mano.
  useEffect(() => {
    if (!abierto) return
    // Un formulario abierto y vacío no es un borrador: si se guardara, mañana reaparecería
    // abierto con la fecha de hoy y la llamada de mañana quedaría anotada en el día equivocado.
    if (!conclusiones.trim() && !tareas.trim() && !proximaReunion.trim()) {
      borrarBorrador(usuarioId)
      return
    }
    escribirBorrador(usuarioId, { abierto, fecha, hora, conclusiones, tareas, proximaReunion })
  }, [usuarioId, abierto, fecha, hora, conclusiones, tareas, proximaReunion])

  const cerrarYLimpiar = () => {
    setConclusiones('')
    setTareas('')
    setProximaReunion('')
    setHora('')
    setFecha(hoyIso())
    setAbierto(false)
    setError(null)
    // Después de encolar el cierre: nada de lo que se escriba a partir de aquí lo vuelve a dejar.
    borrarBorrador(usuarioId)
  }

  const guardar = async () => {
    if (guardandoAhora.current) return
    guardandoAhora.current = true
    setGuardando(true)
    setError(null)
    try {
      const resultado = await agregarNotaLlamada(usuarioId, {
        fecha,
        hora: hora || undefined,
        conclusiones,
        tareas: tareas || undefined,
        proximaReunion: proximaReunion || undefined,
      })
      if (!resultado.ok) {
        setError(resultado.error)
        return
      }
      // La nota ya está en la base: el borrador se borra YA, antes de releer la lista. Si se
      // esperara a la recarga, quien cambia de pestaña y vuelve con la red lenta encontraría
      // el formulario lleno otra vez y podría guardar la misma nota dos veces.
      borrarBorrador(usuarioId)
      // Se vuelve a pedir la lista en vez de anteponer la nota a mano: así el orden en pantalla
      // es el mismo que al cargar (fecha, hora, creación), y una llamada anotada con fecha de
      // la semana pasada no se queda arriba de las de hoy.
      const recarga = await notasLlamadaDe(usuarioId)
      if (recarga.ok) {
        setNotas(recarga.notas)
        setErrorCarga(null)
      } else {
        // La nota SÍ quedó guardada; solo falló releer. Se deja arriba de lo que ya había.
        setNotas((previas) => [resultado.nota, ...(previas ?? [])])
      }
      cerrarYLimpiar()
    } finally {
      guardandoAhora.current = false
      setGuardando(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="kicker">Notas de llamada</p>
        {!abierto && (
          <button
            type="button"
            className="tecla-3d min-h-[44px] rounded-lg border border-linea bg-surface-2 px-3 text-xs font-bold text-texto"
            onClick={() => setAbierto(true)}
          >
            + Anotar llamada
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed border-linea bg-surface-2 p-2.5">
          <div className="flex gap-2">
            <label className={`flex-1 ${ETIQUETA_CAMPO}`}>
              Fecha
              <input
                type="date"
                className={`mt-1 ${CAJA_CAMPO}`}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>
            <label className={`flex-1 ${ETIQUETA_CAMPO}`}>
              Hora (opcional)
              <input
                type="time"
                className={`mt-1 ${CAJA_CAMPO}`}
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </label>
          </div>
          <label className={ETIQUETA_CAMPO} htmlFor={`conclusiones-${usuarioId}`}>
            Qué se habló
          </label>
          <textarea
            id={`conclusiones-${usuarioId}`}
            className={CAJA_CAMPO}
            rows={3}
            value={conclusiones}
            onChange={(e) => setConclusiones(e.target.value)}
          />
          <label className={ETIQUETA_CAMPO} htmlFor={`tareas-${usuarioId}`}>
            Tareas que quedan (opcional)
          </label>
          <textarea
            id={`tareas-${usuarioId}`}
            className={CAJA_CAMPO}
            rows={2}
            value={tareas}
            onChange={(e) => setTareas(e.target.value)}
          />
          <label className={ETIQUETA_CAMPO} htmlFor={`proxima-${usuarioId}`}>
            Próxima reunión (opcional)
          </label>
          <input
            id={`proxima-${usuarioId}`}
            type="text"
            placeholder="Ej.: en 2 semanas, o 22 de octubre"
            className={CAJA_CAMPO}
            value={proximaReunion}
            onChange={(e) => setProximaReunion(e.target.value)}
          />
          {error && <p className="text-xs text-rojo">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className="tecla-3d min-h-[44px] rounded-lg bg-accion px-4 text-xs font-bold text-white disabled:opacity-50"
              disabled={guardando || !conclusiones.trim()}
              onClick={() => void guardar()}
            >
              {guardando ? 'Guardando…' : 'Guardar nota'}
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-linea px-4 text-xs font-bold text-tenue"
              disabled={guardando}
              onClick={cerrarYLimpiar}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

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
        {notas === null && !errorCarga && <p className="text-xs text-tenue">Cargando…</p>}
        {notas?.length === 0 && !errorCarga && <p className="text-xs text-tenue">Todavía no hay llamadas anotadas.</p>}
        {notas?.map((nota) => (
          <div key={nota.id} className="rounded-lg border border-linea bg-surface-2 p-2.5">
            <p className="text-xs font-bold text-tenue">
              {[
                fechaDeLlamada(nota.fecha),
                nota.hora ? horaDeLlamada(nota.hora) : null,
                db.usuarios.byId(nota.coachId)?.nombre ?? 'alguien del equipo',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-texto">{nota.conclusiones}</p>
            {nota.tareas && <p className="mt-1 whitespace-pre-wrap text-xs text-texto">Tareas: {nota.tareas}</p>}
            {nota.proximaReunion && (
              <p className="mt-1 text-xs text-tenue">Próxima reunión: {nota.proximaReunion}</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
