import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { modoNube, supabase } from '../../data/supabase'
import { agrupar, type Consulta, type Grupos, type ViaConsulta } from './consultas'

// ------------------------------------------------------------------- datos

/** Ventana de trabajo. Esto es una cola para resolver, no un archivo histórico. */
const LIMITE = 100

const VIAS: ViaConsulta[] = ['ficha', 'ficha_tentativa', 'ia_vivo', 'escalado']

interface FilaConsulta {
  id: string
  usuario_id: string
  mensaje: string
  ficha_id: string | null
  similitud: number | null
  via: string
  bandera_roja: boolean
  revisado: boolean
  corregido: boolean
  creado_en: string
}

/**
 * Fila de Supabase → modelo de la app.
 *
 * `via` se valida aunque la tabla tenga un CHECK: si algún día entrara un
 * valor nuevo, cae en 'escalado', que lo manda al grupo "requiere tu criterio".
 * El sesgo es que el coach lo vea de más, nunca que se pierda de vista.
 */
function aConsulta(f: FilaConsulta): Consulta {
  return {
    id: f.id,
    usuarioId: f.usuario_id,
    mensaje: f.mensaje,
    similitud: f.similitud === null ? null : Number(f.similitud),
    fichaId: f.ficha_id,
    via: VIAS.includes(f.via as ViaConsulta) ? (f.via as ViaConsulta) : 'escalado',
    banderaRoja: Boolean(f.bandera_roja),
    revisado: Boolean(f.revisado),
    corregido: Boolean(f.corregido),
    creadoEn: f.creado_en,
  }
}

interface Datos {
  consultas: Consulta[]
  /** usuarioId → nombre. */
  nombres: Record<string, string>
  /** fichaId → título. */
  titulos: Record<string, string>
}

/**
 * Lee directo de Supabase, sin pasar por el almacén local: esta vista es solo
 * del coach, se mira con conexión y siempre quiere el dato más fresco.
 *
 * Los nombres y los títulos van en consultas aparte y no como embed
 * (`select=*,usuarios_app(nombre)`) a propósito: si una de las dos fallara,
 * las preguntas se siguen viendo con una etiqueta de reserva. Un embed las
 * tumbaría todas por un adorno.
 */
async function leerConsultas(): Promise<Datos> {
  const sb = supabase()

  const { data, error } = await sb
    .from('consultas_chat')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(LIMITE)
  if (error) throw new Error(error.message)

  const consultas = (data ?? []).map((f) => aConsulta(f as FilaConsulta))

  const [usuarios, fichas] = await Promise.all([
    sb.from('usuarios_app').select('id,nombre'),
    sb.from('fichas_respuesta').select('id,titulo'),
  ])

  const nombres: Record<string, string> = {}
  for (const u of usuarios.data ?? []) nombres[u.id as string] = u.nombre as string

  const titulos: Record<string, string> = {}
  for (const f of fichas.data ?? []) titulos[f.id as string] = f.titulo as string

  return { consultas, nombres, titulos }
}

interface Marca {
  revisado: boolean
  corregido?: boolean
}

/**
 * Marca la fila y devuelve lo que Supabase confirmó haber guardado.
 *
 * El `.select()` no es adorno: un UPDATE que RLS descarta NO devuelve error,
 * devuelve cero filas. Sin comprobar que volvió la fila, la pantalla diría
 * "revisado" de algo que la base nunca guardó.
 */
async function marcarEnSupabase(id: string, campos: Marca): Promise<Consulta> {
  const { data, error } = await supabase()
    .from('consultas_chat')
    .update(campos)
    .eq('id', id)
    .select()
  if (error) throw new Error(error.message)

  const fila = (data ?? [])[0]
  if (!fila) throw new Error('Supabase no confirmó el cambio. Revisa que tu sesión siga abierta.')
  return aConsulta(fila as FilaConsulta)
}

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
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  // Bryan entra a resolver, no a leer: solo el primer grupo abre solo.
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({ criterio: true })
  const [aviso, setAviso] = useState<string | undefined>()

  const cargar = useCallback(async () => {
    setAviso(undefined)
    setEstado({ fase: 'cargando' })
    try {
      setEstado({ fase: 'listo', datos: await leerConsultas() })
    } catch (e) {
      setEstado({ fase: 'error', mensaje: mensajeDeError(e) })
    }
  }, [])

  useEffect(() => {
    if (!modoNube) {
      setEstado({
        fase: 'error',
        mensaje: 'Esta vista lee las consultas directo de Supabase y la app está en modo demo, sin conexión a la nube.',
      })
      return
    }
    void cargar()
  }, [cargar])

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
  const marcar = async (campos: Marca) => {
    setGuardando(true)
    setError(undefined)
    try {
      alMarcar(await marcarEnSupabase(c.id, campos))
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
              onClick={() => void marcar({ revisado: true })}
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
              onClick={() => void marcar({ revisado: true, corregido: true })}
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
