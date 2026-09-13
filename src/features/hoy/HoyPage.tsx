import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { useContadorAnimado } from '../../components/ui/useContadorAnimado'
import { db, hoyIso, idCoach, useDbVersion } from '../../data/dbInstance'
import { diaDeSesion, semanaDelAnio } from '../../domain/calendario'
import { sesionCompleta } from '../../domain/cumplimiento'
import { porcentajeAdherencia } from '../../domain/nutricion/adherencia'
import { encuestaPendiente, preguntasQueVuelven } from '../../domain/nutricion/encuesta'
import { faseDeEtiqueta, pautaDelBloque } from '../../domain/nutricion/pautaDelBloque'
import { duracionTotalSeg, formatoDuracion } from '../../domain/ritmoSesion'
import {
  armarSemana,
  resumenSemana,
  semanaEsAdelantada,
  sesionDestacada,
} from '../../domain/rutaEntrenamiento'
import { prioridadDeVolumen } from '../../domain/volumenPrioridad'
import { preguntaPendienteDelCoach } from '../../domain/preguntaDelCoach'
import { hayBorradorDeCribado } from '../cribado/borrador'
import { CribadoForm } from '../cribado/CribadoForm'
import { necesitaPantallaDeSalud } from '../cribado/necesitaCribado'
import { esDeLaCadena, preguntaDelDia } from '../preguntas/preguntasDeLaCadena'
import { TarjetaPregunta } from '../preguntas/TarjetaPregunta'
import { CheckDibujado } from '../entrenar/CheckDibujado'
import { useGamificacion } from '../logros/useGamificacion'
import { AlbumAlfa } from './AlbumAlfa'
import { AvisoSinSincronizar } from './AvisoSinSincronizar'
import { resumenSemanal } from '../../domain/resumenSemanal/calcular'
import { PedirPermiso } from '../avisos/PedirPermiso'
import { CabeceraSemanal } from '../chat/CabeceraSemanal'
import { remitentesDe } from '../chat/remitentes'
import { BarraCoach } from './BarraCoach'
import { TarjetaDeLaSemana } from './TarjetaDeLaSemana'
import { PreguntaDelCoach } from './PreguntaDelCoach'
import { BloqueActual } from './BloqueActual'
import { enviarRapido } from './enviarRapido'
import { MapaFatiga } from './MapaFatiga'
import { RadarAlfa } from './RadarAlfa'
import monogramaA from '../../assets/brand/monograma-a.png'

export default function HoyPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()
  const juego = useGamificacion(usuario.id)
  const rachaAnimada = useContadorAnimado(juego.rachaBienestar.actual, 700)

  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')
  // La MISMA respuesta que da Entrenar, y por la misma función. Hoy tenía criterio
  // propio (`sesionSugerida`, que caía en la primera del array) y las dos pantallas
  // proponían sesiones distintas el mismo día: un lunes sin sesión, Hoy empujaba la
  // más antigua colgada mientras Entrenar ofrecía la del martes. Es el mismo bug que
  // ya se arregló DENTRO de Entrenar entre su botón y su calendario.
  const diasDeLaSemana = microciclo ? armarSemana(microciclo, hoy) : undefined
  const sugerida = diasDeLaSemana ? sesionDestacada(diasDeLaSemana) : undefined
  const siguienteSesion = microciclo?.sesiones.find((s) => s.id === sugerida?.sesionId)
  // «No tengo nada que ofrecerte» y «ya lo hiciste todo» NO son lo mismo, y hasta
  // el 2026-08-30 salían por la misma rama (`microciclo && !siguienteSesion`, sin
  // mirar una sola serie). Se vio en producción: un plan recién cargado, cero
  // series, doce ejercicios sin tocar, y la app felicitando. La causa es que
  // `armarSemana` acota por abajo con `fechaInicio` desde el #101 —un microciclo
  // que empieza la semana que viene deja los siete días en blanco—, y el coach
  // tiene «arranca la próxima semana» como opción normal en su generador.
  // Se llamaba `resumen` a secas, pero en `main` ese nombre ya es el de la tarjeta de la
  // revision semanal (`resumenSemanal`, mas abajo), que es OTRA cosa: aquella son los
  // numeros que se pintan debajo del video y esta es la cuenta de sesiones hechas contra
  // programadas. Dos cosas distintas con el mismo nombre en la misma funcion no compilan,
  // y con que compilaran seria peor: el siguiente que lea una creeria estar leyendo la otra.
  const cumplimientoSemana = diasDeLaSemana ? resumenSemana(diasDeLaSemana) : undefined
  const microcicloCompleto = !!cumplimientoSemana && cumplimientoSemana.programadas > 0
    && cumplimientoSemana.completadas === cumplimientoSemana.programadas
  const preguntaPendiente = preguntaDelDia(db, usuario.id)
  // Volver a contestar el cribado es cosa suya y hay que dejarle la puerta abierta: desde
  // la 0062 la respuesta nueva se guarda al lado de la vieja y manda la más reciente, pero
  // si nadie le ofrece dónde decirlo, un cambio de medicación se queda en su cabeza. El
  // formulario solo aparece solo la PRIMERA vez —cuando no hay ficha—, así que después
  // hace falta esta puerta.
  const [actualizandoSalud, setActualizandoSalud] = useState(false)
  const checkinHoy = db.bienestar.byUsuario(usuario.id).some((c) => c.fecha === hoy)
  const adherenciaHoy = db.nutricion.adherenciasByUsuario(usuario.id).some((a) => a.fecha === hoy)
  const noLeidos = db.mensajes.noLeidosDe(usuario.id, idCoach())
  // Las de la cadena NO se cuentan aquí: ya tienen su propia tarjeta arriba
  // (`TarjetaPregunta`), y contarlas otra vez hace que la misma pantalla pida dos veces
  // lo mismo — una vez como pregunta y otra como «1 cuestionario por responder», que
  // además manda a otra pantalla. Es la misma regla que ya se aplicó al check-in y a los
  // mensajes del coach tres líneas más abajo.
  const cuestionariosPendientes = db.cuestionarios
    .asignadosA(usuario.id)
    .filter((q) => !esDeLaCadena(q))
    .filter((q) => !db.cuestionarios.respuestasDe(usuario.id).some((r) => r.cuestionarioId === q.id))

  // El check-in y los mensajes del coach ya tienen su propia tarjeta arriba: si
  // además salieran aquí, la misma pantalla pediría dos veces lo mismo.
  const perfilNutricion = db.perfilNutricion.byUsuario(usuario.id)

  const pendientes = [
    // Va primero a propósito: sin la encuesta no hay peso ni pasos, y sin eso no
    // se puede calcular nada de lo suyo. Antes solo aparecía a quien entraba a la
    // pestaña de Nutrición, y por eso 16 de 20 nunca la llenaron.
    encuestaPendiente(perfilNutricion) && {
      texto: 'Completar tu encuesta de nutrición',
      ruta: '/nutricion',
    },
    // Las quincenales de embarazo y lactancia. Salen aquí y no solo en
    // Nutrición por la misma lección que la encuesta: la regla que vivía en
    // una sola pantalla la vieron 4 de 20. Y salen como recordatorio, no como
    // bloqueo — ver `AlDiaEmbarazo`.
    preguntasQueVuelven(perfilNutricion?.respuestas ?? {}, hoy).length > 0 && {
      texto: 'Contarnos qué te dijo tu médico',
      ruta: '/nutricion/al-dia',
    },
    !adherenciaHoy && { texto: 'Marcar nutrición de hoy', ruta: '/nutricion' },
    cuestionariosPendientes.length > 0 && {
      texto: `${cuestionariosPendientes.length} cuestionario${cuestionariosPendientes.length === 1 ? '' : 's'} por responder`,
      ruta: '/cuestionarios',
    },
  ].filter((p): p is { texto: string; ruta: string } => Boolean(p))

  const perfil = db.perfiles.byUsuario(usuario.id)
  // Los tres números de «Tu bloque actual»: lo que el coach prescribió y, donde
  // no prescribió, lo que sale de la encuesta marcado como estimado.
  const pauta = pautaDelBloque(
    perfil,
    perfilNutricion?.respuestas,
    faseDeEtiqueta(perfil?.faseEnergetica),
    hoy,
  )
  const equipo = remitentesDe(db.usuarios.list(), usuario.id)
  const hiloCoach = db.mensajes.hilo(usuario.id, idCoach())
  const ultimoDelCoach = [...hiloCoach].reverse().find((m) => m.deId === idCoach())
  // La pregunta que el coach dejó y la persona no ha contestado: va debajo del vídeo
  // (Bryan, 12-sep). De su respuesta depende si el plan sigue (riesgo escalonado).
  const preguntaCoach = preguntaPendienteDelCoach(hiloCoach, idCoach())
  const nombreCoach = db.usuarios.byId(idCoach())?.nombre.split(' ')[0] ?? 'Tu coach'
  // Prioridad del BLOQUE: lo que el coach marcó en PERFIL como foco de estos
  // meses. Son tres cosas distintas y conviene no confundirlas:
  //   · esto        → qué se prioriza en el bloque (etiqueta, no número)
  //   · Progreso    → cuántas series le tocaron esta semana y cuántas hizo
  //   · el mapa de abajo → la fatiga ya acumulada
  const prioridadVolumen = prioridadDeVolumen(perfil?.volumenSemanal ?? {})

  const totalSeries = siguienteSesion?.ejercicios.reduce((n, e) => n + e.sets, 0) ?? 0
  const sesionHecha = siguienteSesion ? sesionCompleta(siguienteSesion) : false

  // Stats reales para los tiles del resumen.
  const pesosReg = db.bienestar
    .byUsuario(usuario.id)
    .map((c) => c.pesoKg)
    .filter((p): p is number => p !== undefined)
  const pesoProm = pesosReg.length
    ? Math.round((pesosReg.reduce((a, b) => a + b, 0) / pesosReg.length) * 10) / 10
    : undefined
  const adhs = db.nutricion.adherenciasByUsuario(usuario.id)
  const adherenciaPct = adhs.length ? porcentajeAdherencia(adhs) : undefined

  // Los números que van debajo del vídeo de la revisión semanal. Se calculan
  // aquí, con lo que esta pantalla ya tenía a mano, y la cuenta vive en el
  // dominio: la tarjeta solo los pinta.
  const resumen = resumenSemanal({
    sesiones: microciclo?.sesiones ?? [],
    checkins: db.bienestar.byUsuario(usuario.id),
    adherenciaPct,
  })

  return (
    // Hoy es superficie clara (decisión de diseño), como Bienestar.
    <div data-theme="light" className="-mx-4 -mt-4 flex min-h-dvh flex-col gap-4 bg-bg px-4 pb-4 pt-5">
      <section className="entrada entrada-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tenue">
          {[
            microciclo ? `Microciclo M${microciclo.numero}` : 'Sin microciclo activo',
            microciclo ? `Cadencia ${microciclo.cadenciaDias} días` : undefined,
            perfil?.faseEnergetica,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <h2 className="mt-1 font-display text-3xl leading-none text-texto">
          Hola, {usuario.nombre.split(' ')[0]}
        </h2>
      </section>

      {/* Si algo no subió, se dice antes que nada: el resto de la pantalla da a
          entender que todo está registrado, y esa es justamente la confusión que
          dejó el registro de comidas roto durante semanas. */}
      <div className="entrada entrada-2">
        <AvisoSinSincronizar usuarioId={usuario.id} />
      </div>

      {/* Se pregunta UNA vez y no se insiste: quien ya contestó no lo vuelve a
          ver. El permiso del navegador es de una sola bala. */}
      <div className="entrada entrada-2">
        <PedirPermiso usuarioId={usuario.id} />
      </div>

      {/* La revisión de la semana, ANTES de cualquier otra cosa y sin tener que
          entrar al chat (decisión de Bryan, 10-sep). El vídeo es una cabecera:
          se graba una vez y lo que cambia cada semana es la tarjeta que irá
          debajo. Ver `docs/specs/2026-09-10-revision-semanal-en-video.md`. */}
      <div className="entrada entrada-2">
        <CabeceraSemanal>
          <TarjetaDeLaSemana nombre={usuario.nombre.split(' ')[0]} resumen={resumen} />
          {preguntaCoach && <PreguntaDelCoach texto={preguntaCoach.texto} nombreCoach={nombreCoach} />}
        </CabeceraSemanal>
      </div>

      {/* La puerta clínica y la pregunta de la cadena van justo debajo de la revisión
          de la semana, y no
          bloquean la pantalla: si su plan de hoy ya está prescrito, cerrarle el día
          por un formulario cuesta una sesión — y quien lo paga es la adherencia,
          que va por delante de casi todo en la jerarquía del método. Que el cribado
          sin contestar impida ENTRENAR o solo impida PROGRAMAR es una regla que
          todavía no está escrita; hasta que lo esté, se pide primero y se deja pasar. */}
      {usuario.rol === 'asesorado' &&
        !necesitaPantallaDeSalud(db, usuario) &&
        !actualizandoSalud &&
        !hayBorradorDeCribado(usuario.id) && (
          <p className="entrada entrada-2 text-sm text-tenue">
            ¿Ha cambiado algo en tu salud —una medicación nueva, una molestia, algo que te
            hayan dicho—?{' '}
            <button
              type="button"
              onClick={() => setActualizandoSalud(true)}
              className="font-bold text-texto underline underline-offset-2"
            >
              Cuéntanoslo
            </button>
          </p>
        )}

      {(necesitaPantallaDeSalud(db, usuario) ||
        actualizandoSalud ||
        hayBorradorDeCribado(usuario.id)) && (
        <div className="entrada entrada-2">
          {/* La tarjeta NO se retira a media pregunta: mientras haya borrador empezado
              sigue en pantalla. Antes se apagaba con `necesitaCribado`, que se vuelve
              falso en cuanto llega de arriba la ficha que volcó el coach, y quien
              estuviera contestando las doce preguntas de salud veía desaparecer el
              formulario sin una palabra. Desde la 0062 su respuesta además se guarda
              igual, al lado de la del coach y con su fecha. */}
          <CribadoForm
            usuarioId={usuario.id}
            guardarDias={(dias) => db.perfiles.guardarDiasDisponibles(usuario.id, dias)}
            contestar={db.cribado.contestar}
            hoyIso={hoy}
          />
        </div>
      )}

      {preguntaPendiente && (
        <div className="entrada entrada-2">
          {/* El `key` NO es decoración: sin él, React reutiliza la misma tarjeta cuando
              cambia la pregunta y se queda con lo que ya había escrito dentro. Las
              preguntas que escribe la cadena numeran sus casillas igual (`p1`, `p2`), así
              que la siguiente aparecería RELLENADA con las respuestas de la anterior y
              con el botón activo: un toque y se manda lo que contestó a otra cosa. */}
          <TarjetaPregunta
            key={preguntaPendiente.id}
            pregunta={preguntaPendiente}
            onResponder={(valores) =>
              db.cuestionarios.responder(preguntaPendiente.id, usuario.id, valores)
            }
          />
        </div>
      )}

      {/* El coach, arriba de todo. Estaba al final de la pantalla —después del
          álbum, el radar y el mapa de fatiga— y ahí no se veía. */}
      <div className="entrada entrada-2">
        <BarraCoach
          titulo={
            equipo.length > 1 ? 'Escríbele a tu coach o a tu nutricionista' : 'Escríbele a tu coach'
          }
          iniciales={db.usuarios.byId(idCoach())?.avatarIniciales ?? 'AA'}
          noLeidos={noLeidos}
          ultimoTexto={ultimoDelCoach?.texto}
          onEnviar={(envio) => void enviarRapido(usuario.id, envio)}
        />
      </div>

      {/* Check-in del día */}
      {checkinHoy ? (
        <div className="relieve entrada entrada-2 flex items-center gap-2.5 rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-logrado text-ink-900">
            <CheckDibujado className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold text-texto">Check-in de hoy registrado</span>
        </div>
      ) : (
        <Link
          to="/bienestar"
          className="relieve entrada entrada-2 flex items-center gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline bg-surface-2 text-rojo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-texto">Check-in diario pendiente</span>
            <span className="block text-xs text-tenue">Peso, pasos, sueño y sensaciones · 1 min</span>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-rojo">Llenar →</span>
        </Link>
      )}

      {/* Sesión de hoy: tarjeta oscura que contrasta con la superficie clara */}
      {microciclo && siguienteSesion && (
        <div className="entrada entrada-3 relative overflow-hidden rounded-bloque border border-ink-500 bg-ink-900 p-5 shadow-md">
          <span className="absolute bottom-3.5 left-0 top-3.5 w-[3px] rounded-r bg-accion" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accion">
                {sugerida?.esDeHoy
                  ? `Sesión de hoy · M${microciclo.numero}`
                  : diaDeSesion(siguienteSesion)
                    ? `Pendiente del ${diaDeSesion(siguienteSesion)?.toLowerCase()} · M${microciclo.numero}`
                    : `Tu siguiente sesión · M${microciclo.numero}`}
              </p>
              <h3 className="mt-2 font-display text-2xl leading-tight text-silver-100">{siguienteSesion.nombre}</h3>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-silver-400">
                <span className="cifras">{siguienteSesion.ejercicios.length} ejercicios · {totalSeries} series</span>
                <span className="cifras">≈ {formatoDuracion(duracionTotalSeg(siguienteSesion))}</span>
              </div>
            </div>
            <img src={monogramaA} alt="" aria-hidden="true"
              className="h-12 w-12 shrink-0 rounded-xl bg-ink-900 object-contain p-1.5 opacity-90" />
          </div>
          {prioridadVolumen.length > 0 && (
            <ul aria-label="Prioridad del bloque" className="mt-3 flex flex-wrap gap-1.5">
              {prioridadVolumen.map((g) => (
                <li
                  key={g.grupo}
                  className="rounded-full border border-ink-500 bg-ink-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-silver-300"
                >
                  {g.grupo} <span className="text-silver-500">{g.nivel}</span>
                </li>
              ))}
            </ul>
          )}
          {sesionHecha ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-boton border border-ink-500 bg-ink-700 px-3.5 py-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-logrado text-ink-900">
                <CheckDibujado className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-bold text-silver-100">Sesión registrada</span>
            </div>
          ) : (
            <Link
              to={`/entrenar/sesion/${siguienteSesion.id}`}
              className="press cta-pulso mt-4 flex items-center justify-center gap-2 rounded-boton bg-accion py-3 font-display text-sm uppercase tracking-wide text-white"
              style={{ boxShadow: 'var(--glow-accion)' }}
            >
              Empezar sesión →
            </Link>
          )}
        </div>
      )}

      {/* 3 stat tiles con datos reales; la racha lleva a Logros (nivel/progreso). */}
      <section className="entrada entrada-2 grid grid-cols-3 gap-2.5">
        <Link
          to="/logros"
          className="relieve rounded-tarjeta border border-linea bg-surface-1 p-3 text-center shadow-sm"
        >
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-tenue">Racha</p>
          <p className="cifras mt-1 text-2xl font-bold leading-none text-texto">
            {Math.round(rachaAnimada)}
            <span className="text-sm font-medium text-tenue"> d</span>
          </p>
        </Link>
        <div className="relieve rounded-tarjeta border border-linea bg-surface-1 p-3 text-center shadow-sm">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-tenue">
            Peso{microciclo ? ` M${microciclo.numero}` : ''}
          </p>
          <p className="cifras mt-1 text-2xl font-bold leading-none text-texto">
            {pesoProm ?? '—'}
            <span className="text-sm font-medium text-tenue"> kg</span>
          </p>
        </div>
        <div className="relieve rounded-tarjeta border border-linea bg-surface-1 p-3 text-center shadow-sm">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-tenue">Adherencia</p>
          <p className="cifras mt-1 text-2xl font-bold leading-none text-accion">
            {adherenciaPct ?? '—'}
            <span className="text-sm font-medium text-tenue"> %</span>
          </p>
        </div>
      </section>

      {microciclo && !siguienteSesion && microcicloCompleto && (
        <div className="entrada entrada-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
          <p className="text-sm font-bold text-texto">Microciclo completo 💪</p>
          <p className="mt-1 text-sm text-tenue">
            Registraste todas las sesiones. El coach está preparando tu siguiente microciclo.
          </p>
        </div>
      )}

      {/* EL AVISO Y LA SESION CONVIVEN, y es una decision de Bryan (11-sep): quien tiene
          el plan para la semana que viene ve el cartel de cuando empieza Y la primera
          sesion debajo, para ojearla. Antes el aviso se excluia con `!siguienteSesion`,
          y desde que `main` reparte tambien las semanas adelantadas (10-sep) esa
          condicion no se cumplia nunca: el cartel habia dejado de salir en silencio.
          La regla no se recalcula aqui — `semanaEsAdelantada` vive en el dominio y es la
          misma que usa el panel de Entrenar, para que las dos pantallas no discrepen. */}
      {microciclo && semanaEsAdelantada(microciclo, hoy) && (
        <div className="entrada entrada-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
          <p className="text-sm font-bold text-texto">Tu microciclo empieza el {microciclo.fechaInicio}</p>
          <p className="mt-1 text-sm text-tenue">
            El coach ya lo dejó preparado. Hasta entonces, cuida sueño, pasos e hidratación.
          </p>
        </div>
      )}

      <div className="entrada entrada-4">
        <BloqueActual perfil={perfil} pauta={pauta} />
      </div>

      <div className="entrada entrada-6">
        <AlbumAlfa stickers={db.contenidoAlfa.album()} />
      </div>

      <div className="entrada entrada-6">
        <RadarAlfa noticias={db.contenidoAlfa.radar()} semana={semanaDelAnio(hoy)} />
      </div>

      {/* De aquí abajo, lo que la app tiene de más sobre el diseño. */}
      {microciclo && (
        <section className="entrada entrada-6">
          <p className="kicker mb-2">Fatiga por grupo muscular</p>
          <MapaFatiga microciclo={microciclo} />
        </section>
      )}

      {pendientes.length > 0 && (
        <section className="entrada entrada-5 flex flex-col gap-2">
          <p className="kicker">Pendientes de hoy</p>
          {pendientes.map((p) => (
            <Link
              key={p.ruta}
              to={p.ruta}
              className="press flex items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm"
            >
              <span className="text-sm text-texto">{p.texto}</span>
              <span
                aria-hidden="true"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-hairline text-sm text-rojo"
              >
                →
              </span>
            </Link>
          ))}
        </section>
      )}

      {usuario.rol === 'nutricionista' && (
        <Link
          to="/equipo-nutricion"
          className="press entrada entrada-5 flex items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 py-3.5 shadow-sm"
        >
          <span>
            <span className="block font-display text-sm text-texto">Nutrición del equipo</span>
            <span className="block text-xs text-tenue">Evaluación de adherencia de todos los asesorados</span>
          </span>
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rojo/15 text-base text-rojo">
            →
          </span>
        </Link>
      )}

      <section className="entrada entrada-6 grid grid-cols-2 gap-3">
        <Link to="/contenidos" className="press h-full rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-rojo"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M10.2 8.8l5 3.2-5 3.2z" />
          </svg>
          <p className="mt-2 font-display text-sm text-texto">Contenidos</p>
          <p className="text-xs text-tenue">Técnica y educación</p>
        </Link>
        <Link to="/cuestionarios" className="press h-full rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-rojo"
          >
            <rect x="5" y="4" width="14" height="17" rx="2.5" />
            <path d="M9 4.5V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5v1" />
            <path d="M9 10h6M9 14h6M9 18h3.5" />
          </svg>
          <p className="mt-2 font-display text-sm text-texto">Cuestionarios</p>
          <p className="text-xs text-tenue">
            {cuestionariosPendientes.length > 0
              ? `${cuestionariosPendientes.length} pendiente${cuestionariosPendientes.length === 1 ? '' : 's'}`
              : 'Al día ✓'}
          </p>
        </Link>
      </section>
    </div>
  )
}
