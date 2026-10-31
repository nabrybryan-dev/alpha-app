import { nombreDelMicrociclo, palabraMicrociclo, siglaDelMicrociclo } from '../../domain/palabrasLlanas'
import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Cifra3D } from '../../components/ui/Cifra3D'
import { db, hoyIso, idCoach, useDbVersion } from '../../data/dbInstance'
import { visibilidadDelAsesorado } from '../../data/visibilidadDelAsesorado'
import { diaDeSesion, semanaDelAnio } from '../../domain/calendario'
import { sesionCompleta } from '../../domain/cumplimiento'
import { porcentajeAdherencia } from '../../domain/nutricion/adherencia'
import { encuestaPendiente, preguntasQueVuelven } from '../../domain/nutricion/encuesta'
import { faseDeEtiqueta, pautaDelBloque } from '../../domain/nutricion/pautaDelBloque'
import {
  armarSemana,
  microcicloVigente,
  resumenSemana,
  semanaEsAdelantada,
  semanaEsVencida,
  sesionDestacada,
  ultimoDiaDe,
} from '../../domain/rutaEntrenamiento'
import { prioridadDeVolumen } from '../../domain/volumenPrioridad'
import { preguntaPendienteDelCoach } from '../../domain/preguntaDelCoach'
import { hayBorradorDeCribado } from '../cribado/borrador'
import { CribadoForm } from '../cribado/CribadoForm'
import { necesitaPantallaDeSalud } from '../cribado/necesitaCribado'
import { esDeLaCadena, preguntaDelDia } from '../preguntas/preguntasDeLaCadena'
import { TarjetaPregunta } from '../preguntas/TarjetaPregunta'
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
import { ElResto } from './ElResto'
import { TarjetaSesionDeHoy } from './TarjetaSesionDeHoy'
import { RadarAlfa } from './RadarAlfa'
import { notasDelMicrociclo } from '../../domain/notasDeLaSemana'
import { suenoMedio } from '../../domain/miDia'
import { NotasDeLaSemana } from '../entrenar/NotasDeLaSemana'
import { ChequeoDeHoy } from './miDia/ChequeoDeHoy'
import { EntradaMiPlan } from '../plan/EntradaMiPlan'
import { MedidasYPeso } from './miDia/MedidasYPeso'
import { TuSemana } from './miDia/TuSemana'

// Solo la pinta el staff, y arrastra el catálogo de alimentos: a demanda.
const MiNutricionDeHoy = lazy(() => import('./miDia/MiNutricionDeHoy'))

export default function HoyPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()
  // «Mi día» del staff que también entrena (Manuela), maqueta «Espacios de Alpha» aprobada
  // el 28-sep. Lo que ve un asesorado normal no cambia: cada pieza nueva va tras esta marca.
  const esStaff = usuario.rol === 'nutricionista'
  const juego = useGamificacion(usuario.id)

  // El VIGENTE por fecha, no «el primer `activo` que aparezca» (Bryan, 19-sep):
  // si la invariante de un único `activo` se rompe, `microcicloVigente` elige el
  // que cubre hoy y no deja que uno futuro ya cargado desplace al de esta
  // semana. Ver el comentario de la función en `domain/rutaEntrenamiento.ts`.
  const microciclo = microcicloVigente(db.microciclos.byUsuario(usuario.id), hoy)
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
    cuestionariosPendientes.length > 0 && {
      texto: `${cuestionariosPendientes.length} cuestionario${cuestionariosPendientes.length === 1 ? '' : 's'} por responder`,
      ruta: '/cuestionarios',
    },
  ].filter((p): p is { texto: string; ruta: string } => Boolean(p))

  const perfil = db.perfiles.byUsuario(usuario.id)
  // Vista simple: las mismas tarjetas, sin «microciclo», «M11» ni la cadencia (ver `palabrasLlanas`).
  const simple = Boolean(perfil?.vistaSimple)
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
  const notasDelCoach = esStaff ? notasDelMicrociclo(microciclo) : []

  const primerNombre = usuario.nombre.split(' ')[0]
  // El aspecto de la maqueta «Diseño final 3» es SOLO del asesorado. El Hoy del staff (Manuela)
  // queda como en main, con su tema claro y sus tarjetas, hasta el paso 9 de la Fase 3.
  const nuevo = !esStaff
  const diseno = nuevo ? 'nuevo' : 'clasico'

  // ── Las piezas, una vez. Se componen abajo en dos órdenes: el del asesorado, en tres
  // bandas (04 §3.2), y el del staff que también entrena, que no cambia en este paso (el
  // Hoy del staff es el paso 9 de la Fase 3).
  const encabezado = (
    <section className="entrada entrada-1">
      <p className={nuevo ? 'text-[13px] font-bold text-tenue' : 'text-xs font-bold uppercase tracking-[0.16em] text-tenue'}>
        {[
          microciclo
            ? nombreDelMicrociclo(microciclo.numero, simple)
            : simple
              ? 'Sin plan esta semana'
              : 'Sin microciclo activo',
          microciclo && !simple ? `Cadencia ${microciclo.cadenciaDias} días` : undefined,
          simple ? undefined : perfil?.faseEnergetica,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <h2
        className={
          nuevo
            ? 'mt-1 font-display text-[30px] font-black leading-[1.05] tracking-[-0.01em] text-texto'
            : 'mt-1 font-display text-3xl leading-none text-texto'
        }
        style={nuevo ? { fontStretch: '125%' } : undefined}
      >
        Hola, {primerNombre}
      </h2>
    </section>
  )

  // Si algo no subió, se dice antes que nada: el resto de la pantalla da a entender que
  // todo está registrado, y esa es justamente la confusión que dejó el registro de comidas
  // roto durante semanas.
  const avisoSync = (
    <div className={nuevo ? 'entrada entrada-2 empty:hidden' : 'entrada entrada-2'}>
      <AvisoSinSincronizar usuarioId={usuario.id} diseno={diseno} />
    </div>
  )

  // Se pregunta UNA vez y no se insiste: quien ya contestó no lo vuelve a ver. El permiso
  // del navegador es de una sola bala.
  const permiso = (
    <div className="entrada entrada-2 empty:hidden">
      <PedirPermiso usuarioId={usuario.id} />
    </div>
  )

  // La revisión de la semana, sin tener que entrar al chat (decisión de Bryan, 10-sep).
  // Ver `docs/specs/2026-09-10-revision-semanal-en-video.md`.
  const revision = (
    <div className="entrada entrada-2">
      <CabeceraSemanal diseno={diseno}>
        <TarjetaDeLaSemana nombre={primerNombre} resumen={resumen} diseno={diseno} />
        {preguntaCoach && <PreguntaDelCoach texto={preguntaCoach.texto} nombreCoach={nombreCoach} />}
      </CabeceraSemanal>
    </div>
  )

  const notas =
    notasDelCoach.length > 0 ? (
      <div className="entrada entrada-3">
        <NotasDeLaSemana notas={notasDelCoach} />
      </div>
    ) : null

  // La puerta clínica NO bloquea la pantalla: si su plan de hoy ya está prescrito, cerrarle
  // el día por un formulario cuesta una sesión — y quien lo paga es la adherencia, que va por
  // delante de casi todo en la jerarquía del método. Que el cribado sin contestar impida
  // ENTRENAR o solo impida PROGRAMAR es una regla que todavía no está escrita; hasta que lo
  // esté, se pide y se deja pasar.
  const saludPendiente =
    necesitaPantallaDeSalud(db, usuario) || actualizandoSalud || hayBorradorDeCribado(usuario.id)
  const cribado = saludPendiente ? (
    <div className="entrada entrada-2">
      {/* La tarjeta NO se retira a media pregunta: mientras haya borrador empezado sigue en
          pantalla (la ficha del coach, al llegar, ya no la apaga). Su respuesta se guarda
          al lado de la del coach y con su fecha (0062). */}
      <CribadoForm
        usuarioId={usuario.id}
        guardarDias={(dias) => db.perfiles.guardarDiasDisponibles(usuario.id, dias)}
        contestar={db.cribado.contestar}
        hoyIso={hoy}
      />
    </div>
  ) : null
  const volverAContarSalud =
    usuario.rol === 'asesorado' && !saludPendiente ? (
      <p className="entrada entrada-2 text-sm text-tenue">
        ¿Ha cambiado algo en tu salud —una medicación nueva, una molestia, algo que te hayan dicho—?{' '}
        <button
          type="button"
          onClick={() => setActualizandoSalud(true)}
          className="relative font-bold text-texto underline underline-offset-2 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-['']"
        >
          Cuéntanoslo
        </button>
      </p>
    ) : null

  const preguntaDeLaCadena = preguntaPendiente ? (
    <div className="entrada entrada-2">
      {/* El `key` NO es decoración: sin él, React reutiliza la misma tarjeta cuando cambia la
          pregunta y se queda con lo escrito. Las preguntas de la cadena numeran sus casillas
          igual (`p1`, `p2`): la siguiente aparecería RELLENADA y con el botón activo. */}
      <TarjetaPregunta
        key={preguntaPendiente.id}
        pregunta={preguntaPendiente}
        onResponder={(valores) => db.cuestionarios.responder(preguntaPendiente.id, usuario.id, valores)}
      />
    </div>
  ) : null

  const barraCoach = (
    <div className="entrada entrada-2">
      <BarraCoach
        diseno={diseno}
        titulo={equipo.length > 1 ? 'Escríbele a tu coach o a tu nutricionista' : 'Escríbele a tu coach'}
        iniciales={db.usuarios.byId(idCoach())?.avatarIniciales ?? 'AA'}
        noLeidos={noLeidos}
        ultimoTexto={ultimoDelCoach?.texto}
        onEnviar={(envio) => void enviarRapido(usuario.id, envio)}
      />
    </div>
  )

  // Check-in del día, EN LÍNEA también para el asesorado (paso 6 del rediseño). `/bienestar`
  // sigue viva como detalle: el propio formulario lleva su entrada.
  const checkinDelAsesorado = (
    <div className="entrada entrada-2">
      <ChequeoDeHoy usuarioId={usuario.id} hoy={hoy} />
    </div>
  )

  const tarjetaSesion =
    microciclo && siguienteSesion ? (
      <TarjetaSesionDeHoy
        diseno={diseno}
        sesion={siguienteSesion}
        etiqueta={
          sugerida?.esDeHoy
            ? `Sesión de hoy · ${siglaDelMicrociclo(microciclo.numero, simple)}`
            : diaDeSesion(siguienteSesion)
              ? `Pendiente del ${diaDeSesion(siguienteSesion)?.toLowerCase()} · ${siglaDelMicrociclo(microciclo.numero, simple)}`
              : `Tu siguiente sesión · ${siglaDelMicrociclo(microciclo.numero, simple)}`
        }
        totalSeries={totalSeries}
        hecha={sesionHecha}
        prioridad={prioridadVolumen}
      />
    ) : null

  // Las tres cifras (racha, peso, adherencia) siguen en la app hasta el paso 7 (Progreso).
  const cifras = (
    <section className="entrada entrada-2 grid grid-cols-3 gap-2.5">
      <Link to="/logros" className="hoy-cifra-hundida">
        <Cifra3D valor={juego.rachaBienestar.actual} sufijo="d" tamano={28} etiqueta={`Racha de ${juego.rachaBienestar.actual} días`} />
        <small>Racha</small>
      </Link>
      <div className="hoy-cifra-hundida">
        <Cifra3D valor={pesoProm} decimales={1} sufijo="kg" tamano={28} etiqueta={pesoProm === undefined ? 'Peso sin registrar' : `Peso medio de ${pesoProm} kg`} />
        <small>Peso{microciclo ? ` ${siglaDelMicrociclo(microciclo.numero, simple)}` : ''}</small>
      </div>
      <div className="hoy-cifra-hundida">
        <Cifra3D valor={adherenciaPct} sufijo="%" tamano={28} rojo etiqueta={adherenciaPct === undefined ? 'Adherencia sin registrar' : `Adherencia de ${adherenciaPct} por ciento`} />
        <small>Adherencia</small>
      </div>
    </section>
  )

  // Los tres carteles del microciclo. La sesión y el cartel de «empieza el…» CONVIVEN
  // (decisión de Bryan, 11-sep); `semanaEsAdelantada` y `semanaEsVencida` viven en el
  // dominio y son las mismas que usa Entrenar, para que las dos pantallas no discrepen.
  const cajaDeAviso = nuevo ? 'hoy-tarjeta' : 'rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm'
  const carteles = (
    <>
      {microciclo && !siguienteSesion && microcicloCompleto && (
        <div className={`entrada entrada-3 ${cajaDeAviso}`}>
          <p className="text-sm font-bold text-texto">{simple ? 'Semana completa' : 'Microciclo completo'} 💪</p>
          <p className="mt-1 text-sm text-tenue">
            Registraste todas las sesiones. El coach está preparando tu siguiente {palabraMicrociclo(simple)}.
          </p>
        </div>
      )}
      {microciclo && semanaEsAdelantada(microciclo, hoy) && (
        <div className={`entrada entrada-3 ${cajaDeAviso}`}>
          <p className="text-sm font-bold text-texto">Tu {palabraMicrociclo(simple)} empieza el {microciclo.fechaInicio}</p>
          <p className="mt-1 text-sm text-tenue">
            El coach ya lo dejó preparado. Hasta entonces, cuida sueño, pasos e hidratación.
          </p>
        </div>
      )}
      {/* Microciclo VENCIDO (A023): `armarSemana` sigue repartiendo sus sesiones a propósito, y
          sin este aviso la persona vería la sesión de su plan vencido sin saber que ya venció. */}
      {microciclo && semanaEsVencida(microciclo, hoy) && (
        <div className={`entrada entrada-3 ${cajaDeAviso}`}>
          <p className="text-sm font-bold text-texto">
            {simple
              ? `Tu semana ${microciclo.numero} terminó el ${ultimoDiaDe(microciclo)}`
              : `Tu microciclo M${microciclo.numero} terminó el ${ultimoDiaDe(microciclo)}`}
          </p>
          <p className="mt-1 text-sm text-tenue">
            Tu coach está preparando el siguiente. Mientras tanto, sigues viendo este plan.
          </p>
        </div>
      )}
    </>
  )

  const bloqueActual = (
    <div className="entrada entrada-4">
      <BloqueActual
        perfil={perfil}
        pauta={pauta}
        simple={simple}
        verKcal={visibilidadDelAsesorado(usuario.id).verContadorKcal}
      />
    </div>
  )
  const album = (
    <div className="entrada entrada-6">
      <AlbumAlfa stickers={db.contenidoAlfa.album()} />
    </div>
  )
  const radar = (
    <div className="entrada entrada-6">
      <RadarAlfa noticias={db.contenidoAlfa.radar()} semana={semanaDelAnio(hoy)} />
    </div>
  )
  // El mapa de fatiga se mudó a Progreso (paso 7): es «cómo voy», no «qué toca hoy».

  const listaPendientes =
    pendientes.length > 0 ? (
      <section className="entrada entrada-5 flex flex-col gap-2">
        <p className={nuevo ? 'text-[13px] font-bold text-tenue' : 'kicker'}>Pendientes de hoy</p>
        {pendientes.map((p) => (
          <Link
            key={`${p.ruta}|${p.texto}`}
            to={p.ruta}
            className={
              nuevo
                ? 'press hoy-tarjeta hoy-fila !py-3'
                : 'press flex items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm'
            }
          >
            <span className={nuevo ? 'hoy-fila-titulo' : 'text-sm text-texto'}>{p.texto}</span>
            <span
              aria-hidden="true"
              className={
                nuevo
                  ? 'tecla-2 !min-h-9 !px-3 text-rojo'
                  : 'grid h-7 w-7 shrink-0 place-items-center rounded-full border border-hairline text-sm text-rojo'
              }
            >
              →
            </span>
          </Link>
        ))}
      </section>
    ) : null

  const cajaDeFila = nuevo ? 'hoy-tarjeta' : 'rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm'
  const contenidos = (
    <section className="entrada entrada-6 grid grid-cols-2 gap-3">
      <Link to="/contenidos" className={`press h-full ${cajaDeFila}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-rojo">
          <circle cx="12" cy="12" r="9" />
          <path d="M10.2 8.8l5 3.2-5 3.2z" />
        </svg>
        <p className="mt-2 font-display text-sm text-texto">Contenidos</p>
        <p className="text-xs text-tenue">Técnica y educación</p>
      </Link>
      <Link to="/cuestionarios" className={`press h-full ${cajaDeFila}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-rojo">
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
  )

  // El asesorado sigue el tema de la persona (claro u oscuro), como la maqueta «Diseño final 3»; el
  // staff conserva el tema claro de main (`data-theme="light"`, más abajo) hasta el paso 9.
  const marco = '-mx-4 -mt-4 flex min-h-dvh flex-col gap-4 bg-bg px-4 pb-4 pt-5'

  if (esStaff) {
    // «Mi día» del staff (maqueta «Espacios de Alpha», 28-sep): igual que antes de las bandas.
    return (
      <div data-theme="light" className={marco}>
        {encabezado}
        {avisoSync}
        {permiso}
        <EntradaMiPlan />
        <TuSemana
          sesionesHechas={resumen.sesionesHechas}
          sesionesPautadas={resumen.sesionesPautadas}
          suenoH={suenoMedio(db.bienestar.byUsuario(usuario.id), hoy)}
          adherenciaPct={resumen.adherenciaPct}
        />
        {revision}
        {notas}
        {cribado}
        {preguntaDeLaCadena}
        {barraCoach}
        <ChequeoDeHoy usuarioId={usuario.id} hoy={hoy} />
        <Suspense
          fallback={
            <p className="text-sm text-tenue" aria-busy="true">
              Cargando tu nutrición de hoy…
            </p>
          }
        >
          <MiNutricionDeHoy usuarioId={usuario.id} hoy={hoy} />
        </Suspense>
        <MedidasYPeso usuarioId={usuario.id} hoy={hoy} />
        {tarjetaSesion}
        {carteles}
        {bloqueActual}
        {album}
        {radar}
        {listaPendientes}
        {contenidos}
      </div>
    )
  }

  // El asesorado, en tres bandas: 0 (solo si aplica) · Hoy · La semana · El resto.
  return (
    <div className={marco}>
      {encabezado}

      {/* Banda 0: lo que se dice antes que nada. Sin nada que decir, no ocupa sitio. */}
      {avisoSync}
      {permiso}
      {cribado}

      {/* Banda 1: lo de hoy. La sesión primero (04 §1.2: estaba en el puesto 9 de 19); la
          pregunta del día va justo detrás porque es de dolor. */}
      <section aria-label="Lo de hoy" className="flex flex-col gap-4">
        {tarjetaSesion}
        {carteles}
        {preguntaDeLaCadena}
        {checkinDelAsesorado}
        <Suspense fallback={null}>
          <MiNutricionDeHoy usuarioId={usuario.id} hoy={hoy} variante="mini" />
        </Suspense>
        {listaPendientes}
      </section>

      {/* Banda 2: la semana. */}
      <section aria-labelledby="hoy-la-semana" className="flex flex-col gap-4">
        <h3 id="hoy-la-semana" className="hoy-banda-titulo !mb-0 !mt-2">
          La semana
        </h3>
        {revision}
        {barraCoach}
        {volverAContarSalud}
      </section>

      {/* Banda 3: el resto, plegado. */}
      <ElResto>
        {cifras}
        {bloqueActual}
        {album}
        {radar}
        {contenidos}
      </ElResto>
    </div>
  )
}
