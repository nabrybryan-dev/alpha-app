import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { movimientoReducido } from '../../components/ui/movimientoReducido'
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
import { FONDO_SESION_FUERZA, FONDO_SESION_METABOLICA } from './fondoSesion'
import { frasePorSerie } from './frasesMotivacionales'
import { BarraEjercicios, ProximosEjercicios } from './NavegadorEjercicios'
import { PanelRitmo } from './PanelRitmo'
import { PreparacionSesion } from './PreparacionSesion'
import { type RegistroSerieHandle } from './RegistroSerie'
import { conTransicionDeVista } from '../../lib/transicionDeVista'
import { SesionCerrada } from './SesionCerrada'
import { SalonDeMaquinas } from './SalonDeMaquinas'
import { TarjetaEjercicio } from './TarjetaEjercicio'
import { TestPostSesion } from './TestPostSesion'
import { VisorContenido } from '../contenidos/VisorContenido'
import { VisorPatron } from './visor/VisorPatron'
import type { Patron } from '../../domain/patrones/catalogo'

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
  const [patron, setPatron] = useState<Patron | undefined>()
  const [cerrada, setCerrada] = useState(false)

  /**
   * El cierre, como UNA escena y no como dos entradas encadenadas.
   *
   * Hasta hoy, al guardar el test post la hoja —que acababa de subir— y la sesion
   * entera desaparecian en un fotograma, y la pantalla de cierre entraba por su
   * cuenta. Dos llegadas seguidas sin ninguna salida entre medias, y justo en el
   * momento de mas carga emocional de la app.
   *
   * El porque y las trampas viven en `lib/transicionDeVista.ts`, con sus tests.
   */
  const cerrarLaSesion = () =>
    conTransicionDeVista(() => {
      setDescanso(null)
      setCerrada(true)
    })
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
        // Es el desplazamiento más largo que hace esta pantalla y se lanzaba sin
        // consultar la preferencia. Si `behavior: 'smooth'` honra o no
        // `prefers-reduced-motion` depende del motor y de la versión, así que no
        // se delega en el navegador: se decide aquí, con la lectura puntual que
        // existe justo para manejadores.
        window.scrollTo({ top: 0, behavior: movimientoReducido() ? 'auto' : 'smooth' })
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
    !todasRegistradas &&
    !exCompletado &&
    !!ejercicioActual &&
    !ejercicioCompleto(ejercicioActual)
  /**
   * Si esta sesión pinta o no la maquinaria de fuerza — cabecera, salón, barra,
   * tarjeta y botón de guardar serie.
   *
   * Lo decide **haber ejercicios**, no la etiqueta `tipo`. Antes lo decidía
   * `tipo !== 'metabolica'`, y una etiqueta mal puesta borraba de la pantalla
   * trabajo que sí estaba prescrito: el 2026-08-25 había dos sesiones marcadas
   * `metabolica` **con ejercicios dentro** —7 de Alejandra Tapasco y 6 de Karin
   * Better—, y esos 13 ejercicios no se pintaban ni se podían registrar. La
   * inversa también existía: la Zona 2 de Natalia venía marcada `fuerza` con
   * cero ejercicios, y se llevaba la cabecera «Ejercicio 1 de 0».
   *
   * `tipo` sigue mandando en lo que de verdad describe —el fondo y el panel de
   * ritmo—, pero ya no puede esconder contenido.
   */
  const hayEjercicios = sesion.ejercicios.length > 0
  const bloques = sesion.bloquesCardio ?? []
  const fondoDeLaSesion =
    sesion.tipo === 'metabolica' ? FONDO_SESION_METABOLICA : FONDO_SESION_FUERZA

  if (cerrada) return <SesionCerrada sesion={sesion} />

  return (
    // Entreno es oscura siempre (decisión de diseño), sin importar el tema global.
    <div data-theme="dark" className="-mx-4 -mt-4 flex min-h-dvh flex-col gap-4 bg-bg px-4 pb-4 pt-4">
      <section className="entrada entrada-1">
        <div
          className="tarjeta-foto px-5 pb-5 pt-24 text-center"
          // El fondo lo decide el tipo de sesión: hierro para fuerza, sprint resistido
          // para metabólica. Las dos rutas viven en `fondoSesion.ts` y las mide
          // `src/test/fondos-de-tarjeta.test.ts`, que impide que se amplíen.
          style={{ '--foto': `url(${fondoDeLaSesion})`, '--foto-pos': 'center 18%' } as React.CSSProperties}
        >
          {/* La sesión es el segundo nivel de Entrenar: atrás vuelve a la Ruta,
              no a Hoy, aunque se haya entrado desde ahí. */}
          <Link
            to="/entrenar"
            aria-label="Volver a tu ruta de entrenamiento"
            // Sin `backdrop-blur`: este botón es `absolute` dentro de la tarjeta
            // con foto, o sea contenido normal que SE DESPLAZA con el scroll, y un
            // backdrop-filter ahí obliga a re-muestrear y desenfocar la región en
            // cada fotograma —encima sobre una fotografía a sangre—. La regla está
            // escrita en tokens.css: el blur solo va en superficies fijas.
            // El contraste del icono no lo daba el desenfoque, lo da el velo de
            // `.tarjeta-foto::after`; el fondo sólido se queda como estaba.
            //
            // OJO CON EL COLOR: tiene que ser `bg-black/40` y no `bg-ink-900/NN`.
            // Los colores `ink-*` se declaran en `tailwind.config.js` como `var()`
            // a secas, sin el marcador `<alpha-value>`, así que Tailwind DESCARTA
            // el modificador de opacidad sin avisar y no genera ninguna regla: el
            // botón se queda sin fondo. Comprobado en el navegador —
            // `.bg-ink-900\/80` no existe en el CSS compilado—. `black` sí lo
            // admite porque es un color por defecto en hexadecimal.
            className="press absolute left-3.5 top-3.5 z-[2] grid h-[38px] w-[38px] place-items-center rounded-boton border border-white/20 bg-black/40 text-white"
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

      {hayEjercicios && !todasRegistradas && (
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

      {/* `sesion.ejercicios.length > 0`: una sesión de Zona 2, movilidad o hábito
          no lleva ejercicios y no es un error. Sin esta guarda pintaba la cabecera
          entera —«Ejercicio 1 de 0», «0/0 hechos»— sobre un salón, una barra y una
          lista vacíos, y el asesorado abría su sesión y no veía ninguna sección. */}
      {hayEjercicios && !todasRegistradas && (
        <section className="flex flex-col gap-4">
          {/* `entrada-5` y no `entrada-4`: el bloque de cardio de arriba ya usa
              el 4, y una sesión de fuerza CON bloques de cardio existe —se tratan
              como aditivas—, así que las dos aterrizaban a la vez y la cascada se
              cortaba justo ahí. El paso de 60 ms se mantiene. */}
          <div className="entrada entrada-5 flex items-center justify-between gap-3">
            <p className="kicker">
              Ejercicio {exIdx + 1} de {sesion.ejercicios.length}
            </p>
            <p className="cifras text-[11px] font-bold text-silver-400">
              {sesion.ejercicios.filter(ejercicioCompleto).length}/{sesion.ejercicios.length} hechos
            </p>
          </div>

          {/* UNA SOLA COSA CONTRA EL CRISTAL.
              La tarjeta del ejercicio se queda en el plano de delante, y todo lo
              que la acompaña —la colección, el riel de navegación y la cola de lo
              que viene— recede a `--prof-fondo`. Es el escalón escrito para esto:
              «otro plano, detrás de la superficie: rieles, colas, lo que espera».

              Nadie sube: el sujeto no se despega, es el contexto el que se retira.
              Así no hay dos cosas compitiendo por decir dónde mirar, que es la
              única regla que `--prof-sujeto` tiene puesta encima.

              Y cada bloque trae SU escena en vez de una común arriba, porque de la
              tarjeta cuelga la hoja de la cámara, que es `fixed`: una perspectiva
              en un ancestro compartido la encerraría en una tarjeta de 350 px. */}
          <div className="escena-prof al-fondo">
            <SalonDeMaquinas ejercicios={sesion.ejercicios} />
          </div>

          <div className="escena-prof al-fondo">
            <BarraEjercicios ejercicios={sesion.ejercicios} exIdx={exIdx} onIr={setExIdxManual} />
          </div>

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
              onVerPatron={setPatron}
              registroRef={registroRef}
              onGuardarSerie={(serie) => {
                db.microciclos.registrarSerie(microciclo.id, ejercicioActual.id, serie)
                alGuardarSerie(ejercicioActual.id, ejercicioActual.descansoMin)
              }}
            />
          )}

          <div className="escena-prof al-fondo">
            <ProximosEjercicios ejercicios={sesion.ejercicios} exIdx={exIdx} onIr={setExIdxManual} />
          </div>
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
            cerrarLaSesion()
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

      {/* Sin animación de entrada, por el mismo motivo que `HojaMedicion`: al
          abrirse arranca WebGL y compila los shaders, y los 420 ms de la entrada
          caerían justo encima del instante más caro. */}
      <Sheet
        abierto={patron !== undefined}
        titulo={patron?.titulo ?? ''}
        onCerrar={() => setPatron(undefined)}
        animar={false}
      >
        {patron && <VisorPatron patron={patron} />}
      </Sheet>

      {frase && (
        // `--z-superpuesto` se declaró en tokens.css sin consumidor y con la nota
        // de que se resolvería «el día que la app tenga toasts o tooltips con capa
        // propia». Este es ese día: la frase es exactamente eso —fija, transitoria
        // y sin puntero—, así que deja de apilarse con un `z-50` suelto.
        <div
          className="pointer-events-none fixed inset-x-0 top-20 flex justify-center px-4"
          style={{ zIndex: 'var(--z-superpuesto)' }}
        >
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
