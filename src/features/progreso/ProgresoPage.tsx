import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { CifraAnimada } from '../../components/ui/CifraAnimada'
import { IconoCorazon, IconoCubiertos, IconoPesa } from '../../components/ui/Icono'
import { Medalla } from '../../components/ui/Medalla'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { visibilidadDelAsesorado } from '../../data/visibilidadDelAsesorado'
import { microcicloVigente, semanaEsAdelantada } from '../../domain/rutaEntrenamiento'
import { HistorialDeCheckins } from '../bienestar/HistorialDeCheckins'
import { MedidasCard } from '../bienestar/MedidasCard'
import { MapaFatiga } from '../hoy/MapaFatiga'
import { ProgresoEvolucion } from '../logros/ProgresoEvolucion'
import { TiraDeRachas } from '../logros/TiraDeRachas'
import { useGamificacion } from '../logros/useGamificacion'
import { HistorialDeVelocidad } from '../entrenar/encoder/HistorialDeVelocidad'
import { CompetenciasEvaluadas } from '../entrenar/ruta/CompetenciasEvaluadas'
import { EscalaAlfa } from '../entrenar/ruta/EscalaAlfa'
import { calculosDeLaRuta } from '../entrenar/ruta/calculosDeLaRuta'

/**
 * Pestaña Progreso: cómo vas.
 *
 * Evolución de peso y carga, volumen por grupo, desviación de medidas del bloque, el
 * historial del encoder y —desde el 29-ago, por decisión de Bryan— **las competencias
 * evaluadas y la Escala Alfa**.
 *
 * ## Las dos que acaban de mudarse
 *
 * Vivían en el panel de abajo del salón de Entrenar. No se han borrado y no se ha perdido
 * una línea: son los MISMOS dos componentes, `entrenar/ruta/CompetenciasEvaluadas` y
 * `entrenar/ruta/EscalaAlfa`, con los mismos datos, calculados por las mismas funciones del
 * dominio a través de `calculosDeLaRuta()`. Lo que cambia es la casa.
 *
 * Y el motivo es de tiempo, no de contenido. El panel del salón se abre EN mitad del
 * entrenamiento, con el cronómetro corriendo y la barra cargada; «en qué competencias estoy
 * y a qué peldaño de la escala voy» es una pregunta que se hace ANTES o DESPUÉS, sentado.
 * Puesta donde estaba competía con la serie en curso, y perdía.
 *
 * ## Sin microciclo activo no se inventan competencias
 *
 * Las competencias salen del registro del microciclo en curso. Sin uno activo no hay de
 * dónde calcularlas, así que ese bloque no se pinta y la Escala Alfa sí: la escala es la
 * ruta de la persona y existe aunque esta semana no haya programación.
 *
 * **Ni de uno que todavía no arrancó (A023, auditoría del PR #308).** Con
 * `microcicloVigente` eligiendo por fecha, cuando NADA cubre hoy se puede devolver un
 * microciclo FUTURO —ver el comentario de esa función—. Ese microciclo, por definición,
 * tiene cero sesiones registradas: computar sus competencias daría una «Consistencia: 0 %»
 * que no describe que la persona va mal, sino que su semana todavía no empezó. La misma
 * regla que ya protegía «sin activo» se extiende aquí: `semanaEsAdelantada` decide si hay
 * de dónde calcular, no solo si hay un `microciclo`.
 */
export default function ProgresoPage() {
  const { usuario } = useSesion()
  useDbVersion()

  const ruta = db.ruta.byUsuario(usuario.id)
  const hoy = hoyIso()
  // Vigente por FECHA (Bryan, 19-sep): ver `microcicloVigente` en
  // `domain/rutaEntrenamiento.ts`. Mismo criterio que Hoy y Entrenar, para que
  // las competencias evaluadas describan la MISMA semana que ven esas pantallas.
  const microciclo = microcicloVigente(db.microciclos.byUsuario(usuario.id), hoy)
  const competencias =
    microciclo && !semanaEsAdelantada(microciclo, hoy)
      ? calculosDeLaRuta(usuario.id, microciclo, hoy).competencias
      : []
  const juego = useGamificacion(usuario.id)
  const checkins = db.bienestar.byUsuario(usuario.id)
  const verPeso = visibilidadDelAsesorado(usuario.id).verComposicion
  const rachas = [
    // Cada racha con el icono de su dominio, como en Logros.
    { nombre: 'Bienestar', racha: juego.rachaBienestar, Icono: IconoCorazon },
    { nombre: 'Entrenamiento', racha: juego.rachaEntrenamiento, Icono: IconoPesa },
    { nombre: 'Nutrición', racha: juego.rachaNutricion, Icono: IconoCubiertos },
  ]

  return (
    // Superficie oscura, como Entrenar: los gráficos se leen mejor y así lo
    // pide el diseño.
    <div className="-mx-4 -mt-4 flex min-h-dvh flex-col gap-3.5 bg-ink-900 px-4 pb-4 pt-3">
      <header className="entrada entrada-1">
        {/* Aquí había una banda de la pieza E encima del título. Ya no: la pieza
            bajó DENTRO del gráfico, recortada por la propia curva, en
            `ProgresoEvolucion`. Una banda decorativa arriba y un gráfico abajo eran
            dos cosas que no se hablaban; ahora son la misma. */}
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-silver-500">
          Cómo vas
        </p>
        <h2 className="mt-1.5 font-display text-2xl leading-[1.05] text-silver-100">Tu progreso</h2>
      </header>

      <div className="entrada entrada-2">
        <ProgresoEvolucion usuarioId={usuario.id} />
      </div>

      {/* EL HISTORIAL DE CHECK-INS, que antes vivía en Bienestar. */}
      <div data-bloque="checkins" data-theme="dark" className="entrada entrada-3">
        <HistorialDeCheckins checkins={checkins} verPeso={verPeso} />
      </div>

      {/* LAS MEDIDAS: se registran aquí, no en una pestaña aparte. */}
      <section data-bloque="medidas" data-theme="dark" aria-label="Medidas y peso" className="entrada entrada-3">
        <p className="kicker mb-2">Medidas y peso</p>
        <MedidasCard usuarioId={usuario.id} verPeso={verPeso} />
      </section>

      {/* LOS LOGROS: nivel, XP, rachas y medallas. El ranking y las historias siguen en /logros. */}
      <section data-bloque="logros" data-theme="dark" aria-label="Tus logros" className="entrada entrada-3 flex flex-col gap-3">
        <p className="kicker">Tu nivel</p>
        <div className="rounded-tarjeta border border-ink-500 bg-ink-900 p-4">
          <p className="font-display text-2xl text-silver-100">{juego.nivel.nombre}</p>
          <p className="cifras mt-1 text-sm text-silver-400">
            <CifraAnimada valor={juego.xp} /> XP acumulados
          </p>
          <div className="mt-3">
            <ProgressBar pct={juego.pctHaciaSiguiente} etiqueta="Progreso al siguiente nivel" />
          </div>
        </div>
        <TiraDeRachas celdas={rachas} />
        <p className="kicker mt-1">Logros</p>
        <div className="grid grid-cols-2 gap-2.5">
          {juego.logros.map((logro) => (
            <Medalla key={logro.id} logro={logro} />
          ))}
        </div>
        <Link to="/logros" className="text-xs font-semibold text-silver-300 underline underline-offset-2">
          Ver el ranking y las historias
        </Link>
      </section>

      {/* LAS COMPETENCIAS EVALUADAS, en su casa nueva. */}
      {competencias.length > 0 && (
        <section data-bloque="competencias" className="entrada entrada-3">
          <CompetenciasEvaluadas competencias={competencias} />
        </section>
      )}

      {/* LA ESCALA ALFA: dónde estás y qué falta para el peldaño siguiente. */}
      <section data-bloque="escala-alfa" className="entrada entrada-3">
        <EscalaAlfa niveles={ruta.escala} />
      </section>

      {/* EL MAPA DE FATIGA, que antes vivía en Hoy: es «cómo voy», no «qué toca hoy». */}
      {microciclo && (
        <section data-bloque="fatiga" data-theme="dark" aria-label="Fatiga por grupo muscular" className="entrada entrada-3">
          <p className="kicker mb-2">Fatiga por grupo muscular</p>
          <MapaFatiga microciclo={microciclo} />
        </section>
      )}

      {/* El historial del encoder. No pinta nada mientras no haya una sola serie
          medida —hoy casi nadie graba— porque una tarjeta vacía en una pantalla
          que se abre cada semana es ruido permanente. */}
      <div className="entrada entrada-3">
        <HistorialDeVelocidad usuarioId={usuario.id} />
      </div>
    </div>
  )
}
