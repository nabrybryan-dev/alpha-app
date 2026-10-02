import { useState } from 'react'
import {
  crearTarea,
  descartarTarea,
  empezarTarea,
  moverTarea,
  reabrirTarea,
  terminarTarea,
  type Escritura,
} from '../../data/consola/planItems'
import {
  BLOQUES_MIN,
  MAX_MIN_TAREA,
  MAX_TAREAS_DIA,
  bloqueSugerido,
  debePreguntarDestino,
  estaAtascada,
  lunesDe,
  puedeAgregarTarea,
  puedeMoverTarea,
  sumarDias,
  tareasDelDia,
  tareasParaDespues,
  type Dueno,
  type ItemPlan,
  type Prioridad,
} from '../../domain/planOrganizador'
import { CLASE_BOTON, CLASE_BOTON_CHICO, CLASE_BOTON_PRINCIPAL, CLASE_ETIQUETA, CLASE_TARJETA, Tarjeta, Vacio } from './comun'
import { Temporizador } from './Temporizador'

interface Props {
  items: ItemPlan[]
  dueno: Dueno
  hoy: string
  onCambio: () => void
}

/** Ejecuta una escritura, dice el fallo si lo hay y recarga si salió bien. Nunca finge éxito. */
function useEscritor(onCambio: () => void) {
  const [trabajando, setTrabajando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const ejecutar = async (f: () => Promise<Escritura>) => {
    setTrabajando(true)
    setFallo(null)
    const r = await f()
    setTrabajando(false)
    if (r.ok) onCambio()
    else setFallo(r.error)
    return r.ok
  }
  return { trabajando, fallo, ejecutar }
}
type Escritor = ReturnType<typeof useEscritor>

function PreguntaDeArrastre({ t, escritor }: { t: ItemPlan; escritor: Escritor }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-boton border border-ambar p-3 text-sm">
      <span>
        Esta tarea ya se movió {t.vecesMovida} veces. ¿Se hace hoy, se delega a la otra persona del equipo (hablando con ella) o se borra?
      </span>
      <button type="button" disabled={escritor.trabajando} onClick={() => void escritor.ejecutar(() => descartarTarea(t.id))} className={CLASE_BOTON_CHICO}>
        Borrarla del plan
      </button>
    </div>
  )
}

function TarjetaGrande({ t, hito, escritor, items }: { t: ItemPlan; hito: ItemPlan | undefined; escritor: Escritor; items: ItemPlan[] }) {
  const [bloque, setBloque] = useState<number>(bloqueSugerido(t.estimadoMin))
  const enCurso = t.estado === 'en_curso'
  const hecha = t.estado === 'hecha'
  const manana = t.fecha ? sumarDias(t.fecha, 1) : null
  const puedeManana = manana !== null && puedeMoverTarea(items, t, manana).ok
  const inicioMs = t.iniciadaEn ? Date.parse(t.iniciadaEn) : Number.NaN

  return (
    <section aria-label="Tarea principal de hoy" className={`entrada ${CLASE_TARJETA} flex flex-col gap-3 border-texto`}>
      <p className={CLASE_ETIQUETA}>{hecha ? 'Hecha. Una menos.' : 'Tu siguiente acción'}</p>
      <h3 className={`font-display text-2xl leading-tight ${hecha ? 'text-tenue line-through' : 'text-texto'}`}>{t.titulo}</h3>
      {t.primerPaso && (
        <p className="text-base text-texto">
          <span className={CLASE_ETIQUETA}>Primer paso </span>
          {t.primerPaso}
        </p>
      )}
      <p className="cifras text-xs text-tenue">
        {t.estimadoMin !== null ? `${t.estimadoMin} min` : 'sin estimado'}
        {hito ? ` · ${hito.titulo}` : ''}
      </p>

      {!hecha && !enCurso && (
        <>
          <div role="group" aria-label="Duración del bloque" className="flex gap-2">
            {BLOQUES_MIN.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={bloque === m}
                onClick={() => setBloque(m)}
                className={`${CLASE_BOTON_CHICO} flex-1 ${bloque === m ? 'border-rojo text-rojo' : ''}`}
              >
                {m} min
              </button>
            ))}
          </div>
          <button type="button" disabled={escritor.trabajando} onClick={() => void escritor.ejecutar(() => empezarTarea(t.id))} className={CLASE_BOTON_PRINCIPAL}>
            Empezar
          </button>
        </>
      )}

      {enCurso && (
        <>
          {Number.isFinite(inicioMs) ? <Temporizador inicioMs={inicioMs} minutos={bloque} /> : null}
          <button type="button" disabled={escritor.trabajando} onClick={() => void escritor.ejecutar(() => terminarTarea(t.id))} className={CLASE_BOTON_PRINCIPAL}>
            Marcar hecha
          </button>
        </>
      )}

      {hecha && (
        <button type="button" disabled={escritor.trabajando} onClick={() => void escritor.ejecutar(() => reabrirTarea(t.id))} className={CLASE_BOTON_CHICO}>
          Deshacer
        </button>
      )}

      {!hecha && manana !== null && !debePreguntarDestino(t) && (
        <button
          type="button"
          disabled={escritor.trabajando || !puedeManana}
          title={puedeManana ? undefined : 'Mañana no tiene cupo'}
          onClick={() => void escritor.ejecutar(() => moverTarea(t.id, manana, t.vecesMovida))}
          className={CLASE_BOTON_CHICO}
        >
          Mover a mañana
        </button>
      )}
      {debePreguntarDestino(t) && <PreguntaDeArrastre t={t} escritor={escritor} />}
    </section>
  )
}

function FilaPequena({ t, escritor, items }: { t: ItemPlan; escritor: Escritor; items: ItemPlan[] }) {
  const hecha = t.estado === 'hecha'
  const manana = t.fecha ? sumarDias(t.fecha, 1) : null
  const puedeManana = manana !== null && puedeMoverTarea(items, t, manana).ok
  return (
    <li className={`flex flex-col gap-2 ${CLASE_TARJETA}`}>
      <span className={`text-sm font-semibold ${hecha ? 'text-tenue line-through' : 'text-texto'}`}>{t.titulo}</span>
      {t.primerPaso && !hecha && <span className="text-xs text-tenue">Primer paso: {t.primerPaso}</span>}
      <span className="cifras text-xs text-tenue">{t.estimadoMin !== null ? `${t.estimadoMin} min` : 'sin estimado'}</span>
      <div className="flex flex-wrap gap-2">
        {hecha ? (
          <button type="button" disabled={escritor.trabajando} onClick={() => void escritor.ejecutar(() => reabrirTarea(t.id))} className={CLASE_BOTON_CHICO}>
            Deshacer
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={escritor.trabajando}
              onClick={() => void escritor.ejecutar(() => terminarTarea(t.id))}
              className={`${CLASE_BOTON_CHICO} border-texto`}
              aria-label={`Marcar hecha: ${t.titulo}`}
            >
              Hecha
            </button>
            {!debePreguntarDestino(t) && (
              <button
                type="button"
                disabled={escritor.trabajando || !puedeManana}
                onClick={() => manana && void escritor.ejecutar(() => moverTarea(t.id, manana, t.vecesMovida))}
                className={CLASE_BOTON_CHICO}
                aria-label={`Mover a mañana: ${t.titulo}`}
              >
                Mañana
              </button>
            )}
          </>
        )}
      </div>
      {debePreguntarDestino(t) && <PreguntaDeArrastre t={t} escritor={escritor} />}
    </li>
  )
}

function AgregarTarea({ items, dueno, hoy, escritor }: { items: ItemPlan[]; dueno: Dueno; hoy: string; escritor: Escritor }) {
  const [abierto, setAbierto] = useState(false)
  const [hitoId, setHitoId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [paso, setPaso] = useState('')
  const [minutos, setMinutos] = useState('25')
  const [cuando, setCuando] = useState<'hoy' | 'manana' | 'despues'>('hoy')
  const [prioridad, setPrioridad] = useState<Prioridad>('pequena')
  const [motivo, setMotivo] = useState<string | null>(null)

  const desde = lunesDe(hoy)
  const hitos = items.filter((i) => i.nivel === 'hito' && i.dueno === dueno && i.estado !== 'descartada' && i.fecha !== null && i.fecha >= desde)
  const fecha = cuando === 'hoy' ? hoy : cuando === 'manana' ? sumarDias(hoy, 1) : null

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={CLASE_BOTON}>
        Agregar tarea
      </button>
    )
  }
  if (hitos.length === 0) {
    return <Vacio>No hay hitos de esta semana en adelante: una tarea cuelga de un hito. El lunes se propone la semana; cuando esté cargada podrás agregar tareas aquí.</Vacio>
  }

  const guardar = async () => {
    const min = Number(minutos)
    const v = puedeAgregarTarea(items, dueno, {
      titulo,
      primerPaso: paso,
      fecha,
      estimadoMin: Number.isFinite(min) && minutos.trim() !== '' ? min : null,
      prioridad,
    })
    if (!v.ok) return setMotivo(v.motivo)
    setMotivo(null)
    const ok = await escritor.ejecutar(() =>
      crearTarea({ padreId: hitoId || hitos[0].id, titulo, primerPaso: paso, dueno, fecha, estimadoMin: min, prioridad }),
    )
    if (ok) {
      setTitulo('')
      setPaso('')
      setAbierto(false)
    }
  }

  const campo = 'min-h-[44px] w-full rounded-md border border-linea bg-surface-1 px-3 text-sm text-texto'
  return (
    <form
      aria-label="Agregar tarea"
      className={`flex flex-col gap-3 ${CLASE_TARJETA}`}
      onSubmit={(e) => {
        e.preventDefault()
        void guardar()
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-tenue">
        Hito al que sirve
        <select className={campo} value={hitoId || hitos[0].id} onChange={(e) => setHitoId(e.target.value)}>
          {hitos.map((h) => (
            <option key={h.id} value={h.id}>
              {h.titulo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-tenue">
        Tarea
        <input className={campo} value={titulo} maxLength={160} onChange={(e) => setTitulo(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-tenue">
        Primer paso físico (qué abres o qué tocas primero)
        <input className={campo} value={paso} maxLength={240} onChange={(e) => setPaso(e.target.value)} />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs text-tenue">
          Minutos (máx. {MAX_MIN_TAREA})
          <input className={campo} inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value)} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-tenue">
          Cuándo
          <select className={campo} value={cuando} onChange={(e) => setCuando(e.target.value as typeof cuando)}>
            <option value="hoy">Hoy</option>
            <option value="manana">Mañana</option>
            <option value="despues">Después</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-tenue">
          Peso
          <select className={campo} value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
            <option value="pequena">Pequeña</option>
            <option value="principal">Principal</option>
          </select>
        </label>
      </div>
      {motivo && (
        <p role="alert" className="text-sm text-rojo">
          {motivo}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={escritor.trabajando} className={CLASE_BOTON}>
          Guardar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={CLASE_BOTON_CHICO}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** Pestaña «Hoy»: 1 grande + 2 pequeñas. Todo lo demás está escondido hasta terminar. */
export function HoyTab({ items, dueno, hoy, onCambio }: Props) {
  const escritor = useEscritor(onCambio)
  const propios = items.filter((i) => i.dueno === dueno)
  const dia = tareasDelDia(propios, dueno, hoy)
  const atascadas = propios.filter((t) => estaAtascada(t, hoy) && t.fecha !== hoy)
  const despues = tareasParaDespues(propios, dueno)
  const hechasHoy = dia.vivas.filter((t) => t.estado === 'hecha').length
  const hitoDe = (t: ItemPlan) => propios.find((h) => h.id === t.padreId)

  return (
    <div className="flex flex-col gap-3.5">
      {dia.vivas.length > 0 && (
        <p className="cifras text-xs text-tenue" aria-live="polite">
          {hechasHoy} de {dia.vivas.length} hechas hoy · máximo {MAX_TAREAS_DIA} por día
        </p>
      )}

      {atascadas.map((t) => (
        <p key={t.id} role="status" className="rounded-boton border border-ambar p-3 text-sm">
          Lleva días sin moverse: <strong>{t.titulo}</strong>. Empieza con su primer paso o muévela.
        </p>
      ))}

      {dia.principal ? (
        <TarjetaGrande t={dia.principal} hito={hitoDe(dia.principal)} escritor={escritor} items={propios} />
      ) : (
        <Vacio>
          {dia.pequenas.length > 0
            ? 'Hoy no hay tarea principal: haz primero una de las pequeñas, o agrega la principal.'
            : 'Hoy no hay tareas planeadas. Cuando se cargue la semana o agregues una, aparece aquí.'}
        </Vacio>
      )}

      {dia.pequenas.length > 0 && (
        <ul aria-label="Tareas pequeñas de hoy" className="flex flex-col gap-2">
          {dia.pequenas.map((t) => (
            <FilaPequena key={t.id} t={t} escritor={escritor} items={propios} />
          ))}
        </ul>
      )}

      {escritor.fallo && (
        <p role="alert" className="text-sm text-rojo">
          No se guardó: {escritor.fallo}
        </p>
      )}

      <AgregarTarea items={propios} dueno={dueno} hoy={hoy} escritor={escritor} />

      {despues.length > 0 && (
        <Tarjeta etiqueta={`Después (${despues.length})`}>
          <ul className="flex flex-col gap-1 text-sm text-texto">
            {despues.map((t) => (
              <li key={t.id}>{t.titulo}</li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  )
}
