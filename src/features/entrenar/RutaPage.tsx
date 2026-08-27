import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { LienzoCinematico } from '../../components/ui/LienzoCinematico'
import { EmptyState } from '../../components/ui/EmptyState'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { resumenMicrociclo } from '../../domain/cumplimiento'
import { cargaPorGrupo } from '../../domain/fatiga'
import { porcentajeAdherencia } from '../../domain/nutricion/adherencia'
import { desviacionRirMedia, indiceRecuperacion } from '../../domain/readiness'
import {
  armarSemana,
  compararFuerza,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  sesionDestacada,
  valoracionesACompetencias,
  type DatosRuta,
} from '../../domain/rutaEntrenamiento'
import { requisitosParaPeldano } from '../../domain/nivelesAlfa'
import { PortadaMicrociclo } from './PortadaMicrociclo'
import { BloqueEnCurso } from './ruta/BloqueEnCurso'
import { CabeceraNivel } from './ruta/CabeceraNivel'
import { CalendarioSemana } from './ruta/CalendarioSemana'
import { ComoLlegas } from './ruta/ComoLlegas'
import { CompetenciasEvaluadas } from './ruta/CompetenciasEvaluadas'
import { EscalaAlfa } from './ruta/EscalaAlfa'
import { RequisitosNivel } from './ruta/RequisitosNivel'
import { TarjetaProgresoNivel } from './ruta/TarjetaProgresoNivel'
import { IconoCamara } from '../../components/ui/Icono'

/**
 * Vista macro de la pestaña Entrenar: dónde está la persona en su ruta de
 * largo plazo. La sesión es el segundo nivel (`/entrenar/sesion/:id`) y su
 * botón atrás vuelve aquí.
 */
export default function RutaPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()

  const microciclos = db.microciclos.byUsuario(usuario.id)
  const microciclo = microciclos.find((m) => m.estado === 'activo')
  const ruta = db.ruta.byUsuario(usuario.id)
  const recuperacion = indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy)

  if (!microciclo) {
    return (
      <EmptyState
        titulo="Sin microciclo activo"
        detalle="El coach está preparando tu siguiente programación."
      />
    )
  }

  // Nivel, competencias y requisitos se valoran con SUS datos, no con cifras
  // iguales para todos. Lo único compartido es el criterio de cada nivel.
  const resumen = resumenMicrociclo(microciclo)
  // El anterior con series: el 1RM estimado solo se puede comparar contra un
  // microciclo que la persona llegó a registrar.
  const previo = microciclos
    .filter((m) => m.id !== microciclo.id && m.numero < microciclo.numero)
    .sort((a, b) => b.numero - a.numero)[0]
  const adherencias = db.nutricion.adherenciasByUsuario(usuario.id)

  const perfil = db.perfiles.byUsuario(usuario.id)
  const datos: DatosRuta = {
    microcicloNumero: microciclo.numero,
    sesionesRegistradas: resumen.sesionesRegistradas,
    sesionesTotales: resumen.sesionesTotales,
    desviacionRir: desviacionRirMedia(microciclo),
    seriesPorGrupo: cargaPorGrupo(microciclo).map((g) => g.seriesPautadas),
    progresoFuerza: compararFuerza(microciclo, previo),
    adherenciaPct: adherencias.length > 0 ? porcentajeAdherencia(adherencias) : undefined,
    // La técnica es la compuerta humana del ascenso: la app no ve ejecución.
    tecnicaPct: perfil?.valoraciones?.find((v) => v.id === 'tecnica')?.pct,
  }
  // Los requisitos son los del peldaño AL QUE VA, no una lista igual para todos.
  const peldanoActual = perfil?.peldanoAlfa ?? 1
  const requisitos = requisitosParaPeldano(peldanoActual + 1, datos)
  const competencias = [
    ...competenciasCalculadas(datos),
    ...valoracionesACompetencias(perfil?.valoraciones),
  ]

  const semana = armarSemana(microciclo, hoy)
  const destacada = sesionDestacada(semana)
  const sesionCta = destacada
    ? {
        id: destacada.sesionId,
        nombre: destacada.titulo,
        esDeHoy: destacada.esDeHoy,
        empezada:
          microciclo.sesiones
            .find((s) => s.id === destacada.sesionId)
            ?.ejercicios.some((e) => e.series.length > 0) ?? false,
      }
    : undefined

  return (
    // Entrenar es superficie oscura siempre, como la sesión: la pantalla se usa
    // en el gimnasio y no debe cambiar de piel con el tema de la app.
    //
    // LA TINTA YA NO LA PONE ESTE DIV. La pone `LienzoCinematico`, que es una capa
    // fija en `--z-lienzo` con el fondo de tinta y la pieza asomando por arriba.
    // Si este contenedor siguiera llevando `bg-ink-900`, taparía la pieza entera.
    <>
      {/* B · Órbita. La cámara rodea al atleta sentado entre series, y aquí quien
          la conduce es el scroll: bajar por la pantalla equivale a rodearlo. Las
          tarjetas suben por delante y lo ocultan de verdad — no hay recorte a 16:9
          ni caja con borde, la pieza se pierde bajo el contenido. */}
      <LienzoCinematico secuencia="orbita" altura={352} />

      <div
        className="-mx-4 -mt-4"
        style={{ position: 'relative', zIndex: 'var(--z-contenido)' }}
      >
        {/* La ventana por la que se ve la pieza en reposo. 178 px deja ver la mitad
            de los 352 y hace que se lea como escena; con los 60 px que dejaba el
            `pt-3` original parecía una textura del fondo. */}
        <div className="h-[178px]" aria-hidden="true" />

        {/* EL CONTENIDO ES UNA LÁMINA OPACA, y esto es la regla dura hecha
            estructura: el texto no puede caer sobre la pieza porque sube una
            superficie de tinta que la tapa. Sin esto, al hacer scroll el titular
            «NIVEL 03 · RENDIMIENTO» —que va suelto, no dentro de una tarjeta—
            quedaba escrito encima del atleta.
            El degradado de 40 px es el CANTO de esa lámina, no un velo para poder
            escribir encima: por debajo de él ya no hay pieza, hay tinta. */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-10 h-10"
            style={{ background: 'linear-gradient(180deg, transparent, var(--ink-900))' }}
          />
          <div
            className="flex min-h-dvh flex-col gap-3.5 bg-ink-900 px-4 pt-1"
            style={{ paddingBottom: 'var(--tope-nav)' }}
          >
      {/* El letrero de inicio de semana: se ve una vez por microciclo y
          desaparece al empezar. Va antes de las rutinas, a propósito. */}
      <PortadaMicrociclo microciclo={microciclo} />

      <CabeceraNivel nivel={ruta.nivelActual} />

      {/* La mesa de trabajo del encoder: la tanda entera, los criterios y el
          CSV. Medir se mide dentro de la serie; esto es para ver el conjunto y
          exportarlo. Discreto a propósito — está en pruebas. */}
      <Link
        to="/entrenar/encoder"
        className="press flex items-center justify-between rounded-bloque border border-white/10 bg-ink-700 px-4 py-3 text-sm text-tenue"
      >
        <span className="flex items-center gap-2">
          <IconoCamara className="h-[18px] w-[18px] shrink-0" />
          <span>
            <b className="text-texto">Encoder</b> · tanda y criterios
          </span>
        </span>
        <span className="rounded-tag bg-ambar/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ambar">
          en pruebas
        </span>
      </Link>

      <div className="entrada entrada-2">
        <TarjetaProgresoNivel
          pct={progresoAlSiguiente(requisitos)}
          nivelActual={ruta.nivelActual}
          siguienteNivel={ruta.siguienteNivel}
          estadisticas={estadisticasCalculadas(datos)}
        />
      </div>

      <div className="entrada entrada-3">
        <ComoLlegas recuperacion={recuperacion} />
      </div>

      <div className="entrada entrada-4">
        <BloqueEnCurso bloque={ruta.bloque} sesion={sesionCta} />
      </div>

      <div className="entrada entrada-5">
        <CalendarioSemana
          dias={semana}
          titulo={`Semana ${ruta.bloque.semana} · Microciclo ${microciclo.numero}`}
        />
      </div>

      <div className="entrada entrada-6">
        <CompetenciasEvaluadas competencias={competencias} />
      </div>

      {/* Los dos ultimos bloques entran SIN retardo, y no es un descuido. La
          escala solo llega a `.entrada-6` y aqui hay siete bloques mas la
          cabecera, asi que antes habia dos pares compartiendo retardo — que no
          es una decision, es que se acabaron las clases. Estos dos caen por
          debajo del pliegue en un movil: nadie los ve entrar, y el escalonado
          es decorativo por definicion. Estirar la escala habria puesto el
          ultimo a 420 ms de retardo sobre contenido que se esta leyendo. */}
      <div className="entrada">
        <RequisitosNivel requisitos={requisitos} siguienteNivel={ruta.siguienteNivel} />
      </div>

      <div className="entrada">
        <EscalaAlfa niveles={ruta.escala} />
      </div>
    </div>
        </div>
      </div>
    </>
  )
}
