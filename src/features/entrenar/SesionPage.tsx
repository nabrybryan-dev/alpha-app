import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Sheet } from '../../components/ui/Sheet'
import { db, useDbVersion } from '../../data/dbInstance'
import { preparacionDe } from '../../data/plantillas/preparacionBase'
import { etiquetaDeSerie } from '../../domain/calendario'
import { ejercicioCompleto, sesionCompleta } from '../../domain/cumplimiento'
import { XP_POR_ACCION } from '../../domain/gamification'
import type { Contenido } from '../../domain/types'
import { CronometroSesion } from './CronometroSesion'
import { PreparacionSesion } from './PreparacionSesion'
import { RegistroSerie } from './RegistroSerie'
import { TestPostSesion } from './TestPostSesion'
import { VisorContenido } from '../contenidos/VisorContenido'

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
    return (
      <div className="entrada flex flex-col items-center gap-4 py-10 text-center">
        <span className="text-5xl" aria-hidden="true">🏆</span>
        <h2 className="font-display text-3xl text-texto">Sesión {sesion.nombre} registrada</h2>
        <p className="cifras text-lg font-bold text-verde">+{XP_POR_ACCION.sesion} XP</p>
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
              <CronometroSesion />
            </div>
          )}
        </div>
      </section>

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
                    bloque.hechoEn ? 'border-verde bg-verde text-white' : 'border-hairline-fuerte text-tenue'
                  }`}
                >
                  ✓
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
                  {completo && <Badge tono="verde">✓</Badge>}
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

                <div className="mt-2.5 flex items-center gap-3 border-t border-hairline pt-2">
                  <button
                    type="button"
                    onClick={() => alternarNota(ejercicio.id)}
                    aria-expanded={notasVisibles.has(ejercicio.id)}
                    className="press text-[10px] font-bold uppercase tracking-[0.15em] text-tenue"
                  >
                    Nota del coach {notasVisibles.has(ejercicio.id) ? '▴' : '▾'}
                  </button>
                  {contenidoDemo && (
                    <button
                      type="button"
                      onClick={() => setDemo(contenidoDemo)}
                      className="press ml-auto text-[10px] font-bold uppercase tracking-[0.15em] text-azul"
                    >
                      🎬 Técnica
                    </button>
                  )}
                </div>
                {notasVisibles.has(ejercicio.id) && (
                  <div className="entrada mt-2">
                    <p className="font-mono text-[11px] font-bold leading-snug text-texto/90">
                      {ejercicio.prescripcion}
                    </p>
                    <p className="mt-1.5 text-xs italic leading-snug text-tenue">{ejercicio.cues}</p>
                  </div>
                )}

                {ejercicio.series.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1">
                    {ejercicio.series.map((serie) => (
                      <li key={serie.orden} className="flex items-center gap-2 text-sm text-texto">
                        <span className="text-xs text-tenue">S{serie.orden}</span>
                        {etiquetaDeSerie(ejercicio, serie.orden) && (
                          <span className="rounded-full bg-rojo/15 px-1.5 py-px text-[9px] font-bold tracking-[0.1em] text-rojo">
                            {etiquetaDeSerie(ejercicio, serie.orden)}
                          </span>
                        )}
                        <span className="cifras font-bold">{serie.cargaKg} kg</span>
                        <span className="cifras">× {serie.reps} reps</span>
                        <span className="cifras text-tenue">RIR {serie.rir}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {!completo && (
                  <div className="mt-3">
                    <RegistroSerie
                      key={siguienteOrden}
                      ejercicio={ejercicio}
                      orden={siguienteOrden}
                      onGuardar={(serie) => db.microciclos.registrarSerie(microciclo.id, ejercicio.id, serie)}
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
          onGuardar={(test) => {
            db.microciclos.guardarTestPost(microciclo.id, sesion.id, test)
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
    </div>
  )
}
