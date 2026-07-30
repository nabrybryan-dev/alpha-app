import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { modoNube } from '../../data/supabase'
import { agrupar, type Consulta, type Grupos } from './consultas'
import { leerConsultas, marcarCorregida, marcarRevisada, type Datos } from './consultasNube'

function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Error inesperado'
}

// ------------------------------------------------------------------ formato

const FMT_FECHA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function cuando(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : FMT_FECHA.format(d)
}

function excerpto(t: string): string {
  const limpio = t.replace(/\s+/g, ' ').trim()
  return limpio.length > 48 ? `${limpio.slice(0, 48).trimEnd()}…` : limpio
}

/**
 * Al marcar, la consulta cambia de grupo y desaparece de la cola abierta.
 * Sin decir nada, el coach acaba de pulsar el botón más fuerte de la app y ve
 * una tarjeta esfumarse: parece un fallo. Esta línea dice qué pasó y adónde fue.
 */
function avisoDe(c: Consulta): string {
  const cita = `«${excerpto(c.mensaje)}»`
  return c.corregido
    ? `Corregida ${cita}. Queda anotada para reescribir la ficha y pasa a Resuelto.`
    : `Revisada ${cita}. Pasa a Resuelto.`
}

/** Qué contestó Alpha, en una línea que el coach pueda leer de un vistazo. */
function queRespondio(c: Consulta, titulos: Record<string, string>): string {
  if (c.via === 'escalado') return 'Ninguna ficha: se te pasó a ti'
  if (c.via === 'ia_vivo') return 'Respondió la IA en vivo'
  const titulo = (c.fichaId && titulos[c.fichaId]) || c.fichaId || 'Ficha desconocida'
  return c.via === 'ficha_tentativa' ? `${titulo} (tentativa)` : titulo
}

// -------------------------------------------------------------------- vista

interface Seccion {
  clave: keyof Grupos
  titulo: string
  vacio: string
}

const SECCIONES: Seccion[] = [
  {
    clave: 'criterio',
    titulo: 'Requiere tu criterio',
    vacio: 'Nada esperándote. Ni banderas rojas ni preguntas sin ficha.',
  },
  {
    clave: 'dudas',
    titulo: 'Con dudas',
    vacio: 'Ninguna ficha respondió a medias.',
  },
  {
    clave: 'resuelto',
    titulo: 'Resuelto',
    vacio: 'Todavía no hay nada resuelto.',
  },
]

const TONO_RECUENTO: Record<keyof Grupos, 'rojo' | 'ambar' | 'neutro'> = {
  criterio: 'rojo',
  dudas: 'ambar',
  resuelto: 'neutro',
}

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'listo'; datos: Datos }

export default function ConsultasPage() {
  // `modoNube` es una constante de módulo: se sabe antes del primer render si esta
  // vista puede funcionar. Es estado inicial, no algo que sincronizar por efecto.
  const [estado, setEstado] = useState<Estado>(() =>
    modoNube
      ? { fase: 'cargando' }
      : {
          fase: 'error',
          mensaje:
            'Esta vista lee las consultas directo de Supabase y la app está en modo demo, sin conexión a la nube.',
        },
  )
  // Bryan entra a resolver, no a leer: solo el primer grupo abre solo.
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({ criterio: true })
  const [aviso, setAviso] = useState<string | undefined>()

  /** Pide las consultas y deja el resultado. No toca el estado antes de pedir. */
  const traer = useCallback(async () => {
    try {
      setEstado({ fase: 'listo', datos: await leerConsultas() })
    } catch (e) {
      setEstado({ fase: 'error', mensaje: mensajeDeError(e) })
    }
  }, [])

  /**
   * Recarga a petición (el botón de reintentar): además de pedir, limpia el aviso
   * y vuelve a "cargando" para que se vea que algo está pasando.
   */
  const cargar = useCallback(async () => {
    setAviso(undefined)
    setEstado({ fase: 'cargando' })
    await traer()
  }, [traer])

  /*
   * `set-state-in-effect` marca este `void traer()` porque `traer` contiene
   * `setEstado`. Es un falso positivo: los `setEstado` de `traer` ocurren DESPUÉS
   * del `await`, o sea en la continuación asíncrona, que es justo el patrón que la
   * documentación de la propia regla recomienda ("subscribe for updates from some
   * external system, calling setState in a callback"). Pedir datos al montar es
   * para lo que existen los efectos; la regla no distingue el await.
   */
  useEffect(() => {
    // En modo demo el estado ya arranca en error (arriba): no hay nada que cargar.
    if (!modoNube) return
    // `traer` y no `cargar`: al montar, el estado ya ES 'cargando', así que volver
    // a ponerlo serían dos renders de más.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- los setEstado van tras el await
    void traer()
  }, [traer])

  /** Reemplaza una consulta por la versión que confirmó Supabase. */
  const reemplazar = useCallback((c: Consulta) => {
    setAviso(avisoDe(c))
    setEstado((prev) =>
      prev.fase === 'listo'
        ? {
            ...prev,
            datos: {
              ...prev.datos,
              consultas: prev.datos.consultas.map((x) => (x.id === c.id ? c : x)),
            },
          }
        : prev,
    )
  }, [])

  // La cabecera se queda puesta mientras carga: al pulsar "Actualizar", ver
  // desaparecer la página entera y volver parece un error, no una recarga.
  if (estado.fase === 'cargando') {
    return (
      <div className="flex flex-col gap-3">
        <Cabecera />
        <p className="p-6 text-center text-sm text-tenue">Cargando consultas…</p>
      </div>
    )
  }

  if (estado.fase === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <Cabecera />
        <Card>
          <p className="font-display text-base text-texto">No se pudieron cargar las consultas</p>
          <p className="mt-1 text-sm text-tenue">{estado.mensaje}</p>
          {modoNube && (
            <button
              type="button"
              onClick={() => void cargar()}
              className="press mt-3 rounded-boton bg-accion px-4 py-2.5 font-display text-sm uppercase tracking-wide text-white"
            >
              Reintentar
            </button>
          )}
        </Card>
      </div>
    )
  }

  const grupos = agrupar(estado.datos.consultas)

  return (
    <div className="flex flex-col gap-4">
      <Cabecera alRecargar={() => void cargar()} />

      {aviso && (
        <p
          role="status"
          className="rounded-boton border border-linea bg-surface-2 px-3.5 py-2.5 text-sm text-tenue"
        >
          {aviso}
        </p>
      )}

      {estado.datos.consultas.length === 0 ? (
        <EmptyState
          titulo="Todavía nadie ha preguntado nada"
          detalle="Cuando un asesorado escriba en el chat, su consulta aparece aquí."
        />
      ) : (
        SECCIONES.map((s) => (
          <SeccionConsultas
            key={s.clave}
            seccion={s}
            consultas={grupos[s.clave]}
            datos={estado.datos}
            abierta={abiertas[s.clave] ?? false}
            alAlternar={() => setAbiertas((a) => ({ ...a, [s.clave]: !(a[s.clave] ?? false) }))}
            alMarcar={reemplazar}
          />
        ))
      )}
    </div>
  )
}

function Cabecera({ alRecargar }: { alRecargar?: () => void }) {
  return (
    <section className="flex items-end justify-between gap-3">
      <div>
        <p className="kicker">Centro de respuestas</p>
        <h2 className="font-display text-3xl text-texto">Consultas</h2>
        <p className="mt-1.5 max-w-lg text-sm text-tenue">
          Lo que te preguntaron y lo que contestó Alpha. Lo que marques como “no es lo que yo habría
          dicho” es lo que reescribe la ficha.
        </p>
      </div>
      {alRecargar && (
        <button
          type="button"
          onClick={alRecargar}
          className="press shrink-0 rounded-xl border border-linea bg-surface-2 px-4 py-2.5 text-sm font-bold text-texto"
        >
          Actualizar
        </button>
      )}
    </section>
  )
}

interface SeccionProps {
  seccion: Seccion
  consultas: Consulta[]
  datos: Datos
  abierta: boolean
  alAlternar: () => void
  alMarcar: (c: Consulta) => void
}

function SeccionConsultas({ seccion, consultas, datos, abierta, alAlternar, alMarcar }: SeccionProps) {
  const id = `consultas-${seccion.clave}`
  return (
    <section>
      <button
        type="button"
        onClick={alAlternar}
        aria-expanded={abierta}
        aria-controls={id}
        className="press flex w-full items-center gap-2.5 rounded-boton px-1 py-2 text-left"
      >
        <span
          aria-hidden="true"
          className={`text-tenue transition-transform duration-200 ease-salida ${abierta ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
        <span className="font-display text-lg text-texto">{seccion.titulo}</span>
        <Badge tono={consultas.length > 0 ? TONO_RECUENTO[seccion.clave] : 'neutro'}>
          {consultas.length}
        </Badge>
      </button>

      {abierta && (
        <div id={id} className="mt-1 flex flex-col gap-2.5">
          {consultas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-linea px-4 py-5 text-center text-sm text-tenue">
              {seccion.vacio}
            </p>
          ) : (
            consultas.map((c) => (
              <TarjetaConsulta key={c.id} consulta={c} datos={datos} alMarcar={alMarcar} />
            ))
          )}
        </div>
      )}
    </section>
  )
}

interface TarjetaProps {
  consulta: Consulta
  datos: Datos
  alMarcar: (c: Consulta) => void
}

function TarjetaConsulta({ consulta: c, datos, alMarcar }: TarjetaProps) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | undefined>()

  // Nada se pinta como guardado antes de que Supabase lo confirme: decirle al
  // coach que quedó marcado algo que no se guardó sería mentirle.
  const marcar = async (guardar: () => Promise<Consulta>) => {
    setGuardando(true)
    setError(undefined)
    try {
      alMarcar(await guardar())
    } catch (e) {
      setError(`No se guardó: ${mensajeDeError(e)}`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card destacada={c.banderaRoja} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {c.banderaRoja && <Badge tono="rojo">Bandera roja</Badge>}
        {c.corregido && <Badge tono="rojo">Corregida</Badge>}
        {c.revisado && !c.corregido && <Badge>Revisada</Badge>}
      </div>

      {/* El mensaje del asesorado es el protagonista de la tarjeta. */}
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-texto">{c.mensaje}</p>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-tenue">
        <span className="font-bold text-texto">{datos.nombres[c.usuarioId] ?? 'Asesorado'}</span>
        <span aria-hidden="true">·</span>
        <span>{cuando(c.creadoEn)}</span>
        <span aria-hidden="true">·</span>
        <span className="min-w-0 truncate">{queRespondio(c, datos.titulos)}</span>
        {c.similitud !== null && (
          <span className="cifras font-bold" title="Similitud con la ficha que respondió">
            {Math.round(c.similitud * 100)}%
          </span>
        )}
      </div>

      {(!c.revisado || !c.corregido) && (
        <div className="flex flex-wrap items-center gap-2">
          {!c.revisado && (
            <button
              type="button"
              disabled={guardando}
              onClick={() => void marcar(() => marcarRevisada(c.id))}
              className="press shrink-0 rounded-boton border border-linea bg-surface-2 px-4 py-2.5 text-sm font-bold text-texto disabled:opacity-40"
            >
              Revisado
            </button>
          )}
          {/* El botón que da sentido a toda la vista: de aquí sale la señal
              para reescribir la ficha. Ocupa el ancho que sobra y es lo único
              rojo de la tarjeta. El borde del color del fondo es invisible,
              pero iguala la altura con "Revisado", que sí lleva uno. */}
          {!c.corregido && (
            <button
              type="button"
              disabled={guardando}
              onClick={() => void marcar(() => marcarCorregida(c.id))}
              className="press min-w-0 flex-1 rounded-boton border border-accion bg-accion px-4 py-2.5 font-display text-sm uppercase tracking-wide text-white disabled:opacity-40"
            >
              Esto no es lo que yo habría dicho
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm font-bold text-rojo">{error}</p>}
    </Card>
  )
}
