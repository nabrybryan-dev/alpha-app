import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Sheet } from '../../components/ui/Sheet'
import { db, useDbVersion } from '../../data/dbInstance'
import { preparacionDe } from '../../data/plantillas/preparacionBase'
import { ejercicioCompleto, sesionCompleta } from '../../domain/cumplimiento'
import { XP_POR_ACCION } from '../../domain/gamification'
import type { Contenido } from '../../domain/types'
import { borrarClave, escribirJSON, leerJSON } from '../../lib/persistencia'
import { AguilaInteractiva } from './AguilaInteractiva'
import { CheckDibujado } from './CheckDibujado'
import { CronometroSesion, limpiarCronometro } from './CronometroSesion'
import { DescansoTimer } from './DescansoTimer'
import { frasePorSerie } from './frasesMotivacionales'
import { PanelRitmo } from './PanelRitmo'
import { reflexionSesion } from './reflexionSesion'
import { PreparacionSesion } from './PreparacionSesion'
import { RegistroSerie } from './RegistroSerie'
import { TestPostSesion } from './TestPostSesion'
import { VisorContenido } from '../contenidos/VisorContenido'

interface Descanso {
  hasta: number
  totalSeg: number
}

function Estadistica({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="text-center">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-tenue">{etiqueta}</p>
      <p className="cifras font-display text-xl leading-tight text-rojo">{valor}</p>
    </div>
  )
}

function MiniaturaEjercicio() {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-tenue" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-5 w-5">
        <path d="M6.5 6.5v11M17.5 6.5v11" />
        <path d="M3.5 9v6M20.5 9v6" />
        <path d="M6.5 12h11" />
      </svg>
    </span>
  )
}

export default function SesionPage() {
  const { sesionId } = useParams()
  const { usuario } = useSesion()
  useDbVersion()
  const [demo, setDemo] = useState<Contenido | undefined>()
  const [cerrada, setCerrada] = useState(false)
  const [notasVisibles, setNotasVisibles] = useState<Set<string>>(new Set())
  const claveDescanso = `alpha-descanso-${sesionId}`
  const [descanso, setDescanso] = useState<Descanso | null>(() => leerJSON<Descanso | null>(claveDescanso, null))
  const [frase, setFrase] = useState<{ texto: string; n: number } | null>(null)
  const contadorFrase = useRef(0)

  useEffect(() => {
    if (descanso) escribirJSON(claveDescanso, descanso)
    else borrarClave(claveDescanso)
  }, [claveDescanso, descanso])

  // La frase motivacional se desvanece sola tras su animación.
  useEffect(() => {
    if (!frase) return
    const id = window.setTimeout(() => setFrase(null), 1600)
    return () => window.clearTimeout(id)
  }, [frase])

  const alGuardarSerie = (descansoMin: number) => {
    contadorFrase.current += 1
    setFrase({ texto: frasePorSerie(contadorFrase.current), n: contadorFrase.current })
    // Si esta serie completó la sesión, no hay descanso: sigue el cierre.
    const micro = db.microciclos.byUsuario(usuario.id).find((m) => m.sesiones.some((s) => s.id === sesionId))
    const ses = micro?.sesiones.find((s) => s.id === sesionId)
    if (ses && sesionCompleta(ses)) {
      setDescanso(null)
      return
    }
    const totalSeg = Math.max(1, Math.round(descansoMin * 60))
    setDescanso({ hasta: Date.now() + totalSeg * 1000, totalSeg })
  }

  const alternarNota = (id: string) =>
    setNotasVisibles((prev) => {
      const copia = new Set(prev)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })

  const microciclo = db.microciclos
    .byUsuario(usuario.id)
    .find((m) => m.sesiones.some((s) => s.id === sesionId))
  const sesion = microciclo?.sesiones.find((s) => s.id === sesionId)

  if (!microciclo || !sesion) {
    return <EmptyState titulo="Sesión no encontrada" detalle="Vuelve al microciclo y elige una sesión." />
  }

  const todasRegistradas = sesionCompleta(sesion)

  if (cerrada) {
    const reflexion = sesion.testPost
      ? reflexionSesion(sesion.testPost.rpeSesion, sesion.testPost.prsEntrada)
      : undefined
    return (
      <div className="entrada flex flex-col items-center gap-4 py-10 text-center">
        <AguilaInteractiva entrada className="h-24 w-24" />
        <h2 className="font-display text-3xl text-texto">Sesión {sesion.nombre} registrada</h2>
        <p className="cifras text-lg font-bold text-verde">+{XP_POR_ACCION.sesion} XP</p>
        {reflexion && (
          <p className="entrada entrada-3 max-w-xs font-display text-lg leading-snug text-texto">{reflexion}</p>
        )}
        <p className="max-w-xs text-sm text-tenue">
          Tus datos ya quedaron guardados para la próxima decisión de programación del coach.
        </p>
        <Link
          to="/"
          className="press mt-2 rounded-full bg-rojo px-8 py-3 font-display text-sm text-white"
        >
          Volver a Hoy →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="entrada entrada-1">
        <div
          className="tarjeta-foto px-5 pb-5 pt-24 text-center"
          style={{ '--foto': 'url(/fondos/atleta-hombre.jpeg)', '--foto-pos': 'center 18%' } as React.CSSProperties}
        >
          <p className="kicker">Microciclo M{microciclo.numero}</p>
          <h2 className="mt-1 font-display text-4xl leading-none">{sesion.nombre}</h2>
          {!todasRegistradas && (
            <div className="mt-3">
              <CronometroSesion sesionId={sesion.id} />
            </div>
          )}
        </div>
      </section>

      {sesion.tipo !== 'metabolica' && !todasRegistradas && (
        <div className="entrada entrada-2">
          <PanelRitmo sesion={sesion} sesionId={sesion.id} />
        </div>
      )}

      <div className="entrada entrada-3">
        <PreparacionSesion
          partes={preparacionDe(sesion)}
          onMarcar={(parteId) => db.microciclos.marcarParte(microciclo.id, sesion.id, parteId)}
          onVerDemo={setDemo}
        />
      </div>

      {(sesion.bloquesCardio ?? []).length > 0 && (
        <div className="entrada entrada-4">
        <Card>
          <p className="kicker">{sesion.tipo === 'metabolica' ? 'Bloques de la sesión' : 'Bloques marcables'}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {(sesion.bloquesCardio ?? []).map((bloque) => (
              <li key={bloque.id} className="flex items-start gap-2.5">
                <button
                  type="button"
                  aria-label={bloque.hechoEn ? `Desmarcar ${bloque.titulo}` : `Marcar ${bloque.titulo}`}
                  onClick={() => db.microciclos.marcarParte(microciclo.id, sesion.id, bloque.id)}
                  className={`press mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-sm font-bold transition-colors duration-200 ease-salida ${
                    bloque.hechoEn ? 'border-logrado bg-logrado text-ink-900' : 'border-hairline-fuerte text-tenue'
                  }`}
                >
                  {bloque.hechoEn && <CheckDibujado className="h-5 w-5" />}
                </button>
                <div className={`transition-opacity duration-200 ${bloque.hechoEn ? 'opacity-60' : ''}`}>
                  <p className="text-sm font-bold text-texto">
                    {bloque.titulo}
                    {bloque.duracionMin ? (
                      <span className="cifras ml-1 text-xs font-normal text-tenue">· {bloque.duracionMin} min</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-tenue">{bloque.indicaciones}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        </div>
      )}

      {sesion.tipo !== 'metabolica' && (
        <section className="flex flex-col gap-4">
          <p className="entrada entrada-4 kicker">Protocolo de ejercicios</p>
          {sesion.ejercicios.map((ejercicio, i) => {
            const completo = ejercicioCompleto(ejercicio)
            const siguienteOrden = ejercicio.series.length + 1
            const contenidoDemo = ejercicio.contenidoDemoId
              ? db.contenidos.byId(ejercicio.contenidoDemoId)
              : undefined

            return (
              <div key={ejercicio.id} className={`entrada entrada-${Math.min(i + 4, 6)}`}>
              <Card className={completo ? 'opacity-75' : ''}>
                <div className="flex items-center gap-3">
                  <MiniaturaEjercicio />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9px] font-bold uppercase tracking-[0.18em] text-tenue">
                      {ejercicio.categoria}
                    </p>
                    <h3 className="mt-0.5 truncate font-display text-base leading-tight text-texto">
                      {ejercicio.nombre}
                    </h3>
                  </div>
                  {completo && (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-logrado text-ink-900">
                      <CheckDibujado className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-around">
                  <Estadistica etiqueta="Sets" valor={ejercicio.sets} />
                  <span className="h-7 w-px bg-linea/60" aria-hidden="true" />
                  <Estadistica etiqueta="Reps" valor={ejercicio.rango.replace(/[()]/g, '')} />
                  <span className="h-7 w-px bg-linea/60" aria-hidden="true" />
                  <Estadistica etiqueta="RIR" valor={ejercicio.rirObjetivo} />
                  <span className="h-7 w-px bg-linea/60" aria-hidden="true" />
                  <Estadistica etiqueta="Descanso" valor={`${ejercicio.descansoMin}'`} />
                </div>

                {/* Prescripción del coach: siempre visible (texto canónico en
                    mono). Los cues de ejecución quedan tras un toggle. */}
                <div
                  className="mt-3 rounded-tarjeta border border-ink-500 bg-ink-700 p-3"
                  style={{ boxShadow: 'var(--inset-top-light)' }}
                >
                  <div className="relative pl-3">
                    <span className="absolute bottom-0.5 left-0 top-0.5 w-[3px] rounded-full bg-accion" aria-hidden="true" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-silver-500">
                      Prescripción del coach
                    </p>
                    <p className="cifras mt-1.5 text-[12.5px] font-semibold leading-relaxed text-silver-100">
                      {ejercicio.prescripcion}
                    </p>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => alternarNota(ejercicio.id)}
                      aria-expanded={notasVisibles.has(ejercicio.id)}
                      className="press text-[10px] font-bold uppercase tracking-[0.1em] text-accion"
                    >
                      {notasVisibles.has(ejercicio.id) ? 'Ocultar ejecución ▴' : 'Ver notas de ejecución ▾'}
                    </button>
                    {contenidoDemo && (
                      <button
                        type="button"
                        onClick={() => setDemo(contenidoDemo)}
                        className="press ml-auto text-[10px] font-bold uppercase tracking-[0.1em] text-silver-400"
                      >
                        🎬 Técnica
                      </button>
                    )}
                  </div>
                  {notasVisibles.has(ejercicio.id) && (
                    <p className="entrada mt-2 border-t border-ink-500 pt-2 text-xs leading-snug text-silver-300">
                      {ejercicio.cues}
                    </p>
                  )}
                </div>

                {ejercicio.series.length > 0 && (
                  <div className="mt-3">
                    <div className="grid grid-cols-[38px_1fr_1fr_1fr_26px] gap-2 px-1 pb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-silver-500">
                      <span>Serie</span>
                      <span>Carga</span>
                      <span>Reps</span>
                      <span>RIR</span>
                      <span />
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {ejercicio.series.map((serie) => (
                        <li
                          key={serie.orden}
                          className="grid grid-cols-[38px_1fr_1fr_1fr_26px] items-center gap-2 rounded-boton border border-ink-500 bg-ink-800 px-2.5 py-2"
                        >
                          <span className="cifras text-center text-[13px] font-bold text-silver-500">{serie.orden}</span>
                          <span className="cifras text-[14px] font-bold text-silver-100">
                            {serie.cargaKg}
                            <span className="ml-0.5 text-[10px] text-silver-500">kg</span>
                          </span>
                          <span className="cifras text-[14px] font-bold text-silver-100">{serie.reps}</span>
                          <span className="cifras text-[14px] font-bold text-accion">{serie.rir}</span>
                          <CheckDibujado className="h-4 w-4 justify-self-center text-logrado" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!completo && (
                  <div className="mt-3">
                    <RegistroSerie
                      key={siguienteOrden}
                      ejercicio={ejercicio}
                      orden={siguienteOrden}
                      borradorId={`${microciclo.id}-${ejercicio.id}-${siguienteOrden}`}
                      onGuardar={(serie) => {
                        db.microciclos.registrarSerie(microciclo.id, ejercicio.id, serie)
                        alGuardarSerie(ejercicio.descansoMin)
                      }}
                    />
                  </div>
                )}
              </Card>
              </div>
            )
          })}
        </section>
      )}

      {todasRegistradas && !sesion.testPost && (
        <TestPostSesion
          sesionId={sesion.id}
          onGuardar={(test) => {
            db.microciclos.guardarTestPost(microciclo.id, sesion.id, test)
            limpiarCronometro(sesion.id)
            setDescanso(null)
            setCerrada(true)
          }}
        />
      )}

      {todasRegistradas && sesion.testPost && (
        <Card>
          <p className="text-sm font-bold text-verde">Sesión completa ✓</p>
          <p className="mt-1 text-sm text-tenue">
            Duración {sesion.testPost.duracionMin} min · RPE {sesion.testPost.rpeSesion}/10 · Recuperación{' '}
            {sesion.testPost.prsEntrada}/10
          </p>
        </Card>
      )}

      <Sheet abierto={demo !== undefined} titulo={demo?.titulo ?? ''} onCerrar={() => setDemo(undefined)}>
        {demo && <VisorContenido contenido={demo} />}
      </Sheet>

      {frase && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
          <span
            key={frase.n}
            className="frase-pop rounded-full bg-rojo px-5 py-2.5 font-display text-base text-white shadow-xl"
          >
            {frase.texto}
          </span>
        </div>
      )}

      {descanso && !todasRegistradas && (
        <DescansoTimer
          key={descanso.hasta}
          hasta={descanso.hasta}
          totalSeg={descanso.totalSeg}
          onCerrar={() => setDescanso(null)}
          onMas15={() => setDescanso((d) => (d ? { hasta: d.hasta + 15000, totalSeg: d.totalSeg + 15 } : d))}
        />
      )}
    </div>
  )
}
