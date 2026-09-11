import { useSesion } from '../../app/SessionProvider'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { ProgresoEvolucion } from '../logros/ProgresoEvolucion'
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
 */
export default function ProgresoPage() {
  const { usuario } = useSesion()
  useDbVersion()

  const ruta = db.ruta.byUsuario(usuario.id)
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')
  const competencias = microciclo
    ? calculosDeLaRuta(usuario.id, microciclo, hoyIso()).competencias
    : []

  return (
    // Superficie oscura, como Entrenar: los gráficos se leen mejor y así lo
    // pide el diseño.
    <div className="-mx-4 -mt-4 flex min-h-dvh flex-col gap-3.5 bg-ink-900 px-4 pb-4 pt-3">
      <header className="entrada entrada-1">
        {/* Aquí había una banda de la pieza E encima del título. Ya no: la pieza
            bajó DENTRO del gráfico, recortada por la propia curva, en
            `ProgresoEvolucion`. Una banda decorativa arriba y un gráfico abajo eran
            dos cosas que no se hablaban; ahora son la misma. */}
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-silver-500">
          Cómo vas
        </p>
        <h2 className="mt-1.5 font-display text-2xl leading-[1.05] text-silver-100">Tu progreso</h2>
      </header>

      <div className="entrada entrada-2">
        <ProgresoEvolucion usuarioId={usuario.id} />
      </div>

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

      {/* El historial del encoder. No pinta nada mientras no haya una sola serie
          medida —hoy casi nadie graba— porque una tarjeta vacía en una pantalla
          que se abre cada semana es ruido permanente. */}
      <div className="entrada entrada-3">
        <HistorialDeVelocidad usuarioId={usuario.id} />
      </div>
    </div>
  )
}
