import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Sheet } from '../../components/ui/Sheet'
import { db, useDbVersion } from '../../data/dbInstance'
import { preparacionDe } from '../../data/plantillas/preparacionBase'
import { ejercicioCompleto, sesionCompleta } from '../../domain/cumplimiento'
import type { Contenido } from '../../domain/types'
import { borrarClave, escribirJSON, leerJSON } from '../../lib/persistencia'
import { BloquesSesion } from './BloquesSesion'
import { CheckDibujado } from './CheckDibujado'
import { CronometroSesion, limpiarCronometro } from './CronometroSesion'
import { DescansoTimer } from './DescansoTimer'
import { EjercicioCompletado, type ExCompletado } from './EjercicioCompletado'
import { frasePorSerie } from './frasesMotivacionales'
import { BarraEjercicios, ProximosEjercicios } from './NavegadorEjercicios'
import { PanelRitmo } from './PanelRitmo'
import { PreparacionSesion } from './PreparacionSesion'
import { type RegistroSerieHandle } from './RegistroSerie'
import { SesionCerrada } from './SesionCerrada'
import { SalonDeMaquinas } from './SalonDeMaquinas'
import { TarjetaEjercicio } from './TarjetaEjercicio'
import { TestPostSesion } from './TestPostSesion'
import { VisorContenido } from '../contenidos/VisorContenido'

interface Descanso {
  hasta: number
  totalSeg: number
  /**
   * Cuándo empezó ESTE descanso. Identifica al descanso como tal, a diferencia
   * de `hasta`, que se mueve cada vez que se piden +15 s. Es lo que se usa como
   * `key` del contador: con `hasta` de clave, pedir +15 s lo remontaba y le
   * borraba la pausa que la persona acababa de poner.
   */
  iniciadoEn: number
}

/**
 * Fuerza un remontaje al cambiar de sesión.
 *
 * La ruta `entrenar/sesion/:sesionId` reutiliza el mismo elemento, así que
 * pasar de una sesión a otra NO desmontaba nada. Los `useState(() => leerJSON(…))`
 * solo corren en el primer montaje y conservaban el estado de la sesión
 * anterior, mientras que los efectos que persisten SÍ reaccionaban a la clave
 * nueva: el cronómetro de la sesión vieja se escribía sobre la clave de la
 * nueva —y ese cronómetro alimenta la duración del test post-sesión, que sube
 * al servidor— y el descanso a medias de la nueva se borraba.
 *
 * Le pasa a cualquiera que abra una sesión por error y entre luego a la que
 * de verdad le tocaba.
 */
export default function SesionPage() {
  const { sesionId } = useParams()
  return <SesionEnCurso key={sesionId} />
}

function SesionEnCurso() {
  const { sesionId } = useParams()
  const { usuario } = useSesion()
  useDbVersion()
  const [demo, setDemo] = useState<Contenido | undefined>()
  const [cerrada, setCerrada] = useState(false)
  const [notasVisibles, setNotasVisibles] = useState<Set<string>>(new Set())
  const claveDescanso = `alpha-descanso-${sesionId}`
  const [descanso, setDescanso] = useState<Descanso | null>(() => leerJSON<Descanso | null>(claveDescanso, null))
  const [frase, setFrase] = useState<{ texto: string; n: number } | null>(null)
  const [exCompletado, setExCompletado] = useState<ExCompletado | null>(null)
  // Un ejercicio a la vez: null = seguir automáticamente el primer incompleto;
  // un número = el asesorado navegó manualmente a ese ejercicio.
  const [exIdxManual, setExIdxManual] = useState<number | null>(null)
  const contadorFrase = useRef(0)
  const registroRef = useRef<RegistroSerieHandle | null>(null)

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

  const alGuardarSerie = (ejercicioId: string, descansoMin: number) => {
    contadorFrase.current += 1
    setFrase({ texto: frasePorSerie(contadorFrase.current), n: contadorFrase.current })
    // Se relee de la base (ya mutada por registrarSerie) para decidir el flujo.
    const micro = db.microciclos.byUsuario(usuario.id).find((m) => m.sesiones.some((s) => s.id === sesionId))
    const ses = micro?.sesiones.find((s) => s.id === sesionId)
    if (!ses) return
    // 1) ¿Se completó la sesión? → sigue el cierre (test post), sin descanso.
    if (sesionCompleta(ses)) {
      setDescanso(null)
      return
    }
    // 2) ¿Se completó este ejercicio? → overlay "Ejercicio completado" con el
    //    siguiente pendiente; no hay descanso (se pasa al siguiente ejercicio).
    const ej = ses.ejercicios.find((e) => e.id === ejercicioId)
    if (ej && ejercicioCompleto(ej)) {
      setDescanso(null)
      const idx = ses.ejercicios.findIndex((e) => e.id === ejercicioId)
      const siguiente = ses.ejercicios.slice(idx + 1).find((e) => !ejercicioCompleto(e))
      setExCompletado({
        nombre: ej.nombre,
        series: ej.series.length,
        siguienteId: siguiente?.id,
        siguienteNombre: siguiente?.nombre,
      })
      return
    }
    // 3) Serie intermedia → descanso pautado.
    const totalSeg = Math.max(1, Math.round(descansoMin * 60))
    setDescanso({ hasta: Date.now() + totalSeg * 1000, totalSeg, iniciadoEn: Date.now() })
  }

  const irASiguienteEjercicio = () => {
    const id = exCompletado?.siguienteId
    setExCompletado(null)
    if (id) {
      const idx = db.microciclos
        .byUsuario(usuario.id)
        .find((m) => m.sesiones.some((s) => s.id === sesionId))
        ?.sesiones.find((s) => s.id === sesionId)
        ?.ejercicios.findIndex((e) => e.id === id)
      if (idx !== undefined && idx >= 0) {
        setExIdxManual(idx)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
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
  // Índice del ejercicio en pantalla (un ejercicio a la vez): el primero
  // incompleto, salvo que el asesorado haya navegado a otro manualmente.
  const primerIncompleto = sesion.ejercicios.findIndex((e) => !ejercicioCompleto(e))
  const exIdx = exIdxManual ?? (primerIncompleto === -1 ? Math.max(0, sesion.ejercicios.length - 1) : primerIncompleto)
  const ejercicioActual = sesion.ejercicios[exIdx]
  const ordenActual = ejercicioActual ? ejercicioActual.series.length + 1 : 0
  const mostrarCTA =
    sesion.tipo !== 'metabolica' &&
    !todasRegistradas &&
    !exCompletado &&
    !!ejercicioActual &&
    !ejercicioCompleto(ejercicioActual)
  const bloques = sesion.bloquesCardio ?? []

  if (cerrada) return <SesionCerrada sesion={sesion} />

  return (
    // Entreno es oscura siempre (decisión de diseño), sin importar el tema global.
    <div data-theme="dark" className="-mx-4 -mt-4 flex min-h-dvh flex-col gap-4 bg-bg px-4 pb-4 pt-4">
      <section className="entrada entrada-1">
        <div
          className="tarjeta-foto px-5 pb-5 pt-24 text-center"
          style={{ '--foto': 'url(/fondos/atleta-hombre.jpeg)', '--foto-pos': 'center 18%' } as React.CSSProperties}
        >
          {/* La sesión es el segundo nivel de Entrenar: atrás vuelve a la Ruta,
              no a Hoy, aunque se haya entrado desde ahí. */}
          <Link
            to="/entrenar"
            aria-label="Volver a tu ruta de entrenamiento"
            className="press absolute left-3.5 top-3.5 z-[2] grid h-[38px] w-[38px] place-items-center rounded-boton border border-white/20 bg-black/40 text-white backdrop-blur"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
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

      {bloques.length > 0 && (
        <div className="entrada entrada-4">
          <BloquesSesion
            bloques={bloques}
            esMetabolica={sesion.tipo === 'metabolica'}
            onMarcar={(bloqueId) => db.microciclos.marcarParte(microciclo.id, sesion.id, bloqueId)}
          />
        </div>
      )}

      {sesion.tipo !== 'metabolica' && !todasRegistradas && (
        <section className="flex flex-col gap-4">
          <div className="entrada entrada-4 flex items-center justify-between gap-3">
            <p className="kicker">
              Ejercicio {exIdx + 1} de {sesion.ejercicios.length}
            </p>
            <p className="cifras text-[11px] font-bold text-silver-400">
              {sesion.ejercicios.filter(ejercicioCompleto).length}/{sesion.ejercicios.length} hechos
            </p>
          </div>

          <SalonDeMaquinas ejercicios={sesion.ejercicios} />

          <BarraEjercicios ejercicios={sesion.ejercicios} exIdx={exIdx} onIr={setExIdxManual} />

          {ejercicioActual && (
            <TarjetaEjercicio
              key={ejercicioActual.id}
              ejercicio={ejercicioActual}
              indice={exIdx}
              total={sesion.ejercicios.length}
              microcicloId={microciclo.id}
              notaVisible={notasVisibles.has(ejercicioActual.id)}
              onAlternarNota={() => alternarNota(ejercicioActual.id)}
              onVerDemo={setDemo}
              registroRef={registroRef}
              onGuardarSerie={(serie) => {
                db.microciclos.registrarSerie(microciclo.id, ejercicioActual.id, serie)
                alGuardarSerie(ejercicioActual.id, ejercicioActual.descansoMin)
              }}
            />
          )}

          <ProximosEjercicios ejercicios={sesion.ejercicios} exIdx={exIdx} onIr={setExIdxManual} />
        </section>
      )}

      {/* Espacio para que el CTA fijo no tape el contenido inferior.
          Reserva la barra de navegación + el CTA + un margen. Estaba en `h-16`
          (64 px) cuando la franja tapada mide 124 px, así que al final de la página
          quedaban 60 px de contenido imposibles de ver. */}
      {mostrarCTA && (
        <div aria-hidden="true" style={{ height: 'calc(var(--tope-nav) + 5rem)' }} />
      )}

      {todasRegistradas && !sesion.testPost && (
        <TestPostSesion
          sesionId={sesion.id}
          nombreSesion={sesion.nombre}
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
          <p className="flex items-center gap-2 text-sm font-bold text-texto">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-logrado text-ink-900">
              <CheckDibujado className="h-3 w-3" />
            </span>
            Sesión completa
          </p>
          <p className="cifras mt-1 text-sm text-tenue">
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

      {/* Zona fija inferior: el descanso se apila encima del CTA "Guardar serie".
          El `bottom` sale de `--tope-nav` (el borde superior de la barra) y no de un
          número fijo: con `4.25rem` se encimaba con la barra 10 px en escritorio y
          30 px en un iPhone, porque la barra baja con `env(safe-area-inset-bottom)`. */}
      {(mostrarCTA || (descanso && !todasRegistradas && !exCompletado)) && (
        <div
          className="fixed inset-x-0 z-40 px-4"
          style={{ bottom: 'calc(var(--tope-nav) + 0.5rem)' }}
        >
          <div className="mx-auto flex max-w-lg flex-col gap-2">
            {descanso && !todasRegistradas && !exCompletado && (
              <DescansoTimer
                key={descanso.iniciadoEn}
                hasta={descanso.hasta}
                totalSeg={descanso.totalSeg}
                onCerrar={() => setDescanso(null)}
                onMas15={() =>
                  setDescanso((d) => (d ? { ...d, hasta: d.hasta + 15000, totalSeg: d.totalSeg + 15 } : d))
                }
              />
            )}
            {mostrarCTA && (
              <button
                type="button"
                onClick={() => registroRef.current?.guardar()}
                className="press w-full rounded-boton bg-accion py-4 font-display text-base uppercase tracking-wide text-white"
                style={{ boxShadow: 'var(--glow-accion)' }}
              >
                Guardar serie {ordenActual}
              </button>
            )}
          </div>
        </div>
      )}

      {exCompletado && <EjercicioCompletado ex={exCompletado} onSeguir={irASiguienteEjercicio} />}
    </div>
  )
}
