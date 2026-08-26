import { Card } from '../../components/ui/Card'
import { db } from '../../data/dbInstance'
import { ejercicioCompleto } from '../../domain/cumplimiento'
import { demoDeEjercicio } from '../../domain/demos'
import type { Contenido, EjercicioPrescrito, SerieRegistrada } from '../../domain/types'
import { CheckDibujado } from './CheckDibujado'
import { ExerciseSlotMachine } from './ExerciseSlotMachine'
import { RegistroSerie, type RegistroSerieHandle } from './RegistroSerie'
import { IconoVideo } from '../../components/ui/Icono'
import { esAlFallo } from '../../domain/objetivoDeIntensidad'

function Estadistica({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="text-center">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-tenue">{etiqueta}</p>
      <p className="cifras font-display text-xl leading-tight text-rojo">{valor}</p>
    </div>
  )
}

interface TarjetaEjercicioProps {
  ejercicio: EjercicioPrescrito
  microcicloId: string
  notaVisible: boolean
  onAlternarNota: () => void
  onVerDemo: (contenido: Contenido) => void
  onGuardarSerie: (serie: SerieRegistrada) => void
  registroRef: React.Ref<RegistroSerieHandle>
  /** Posición del ejercicio en la sesión: la cabecera-gabinete la muestra. */
  indice: number
  total: number
}

/**
 * El ejercicio que el asesorado tiene delante: prescripción del coach, series ya
 * registradas y el formulario de la siguiente.
 *
 * La prescripción se muestra **siempre** y los cues de ejecución van tras un
 * toggle: en mitad de una serie hace falta el dato, no el párrafo.
 */
export function TarjetaEjercicio({
  ejercicio,
  microcicloId,
  notaVisible,
  onAlternarNota,
  onVerDemo,
  onGuardarSerie,
  registroRef,
  indice,
  total,
}: TarjetaEjercicioProps) {
  const completo = ejercicioCompleto(ejercicio)
  const siguienteOrden = ejercicio.series.length + 1
  const contenidoDemo = demoDeEjercicio(ejercicio, db.contenidos.list())

  return (
    <div id={`ej-${ejercicio.id}`} className="entrada scroll-mt-4">
      <Card className={completo ? 'opacity-75' : ''}>
        <ExerciseSlotMachine index={indice} total={total} nombre={ejercicio.nombre} categoria={ejercicio.categoria} rango={ejercicio.rango} tecnica={ejercicio.cues || undefined} paused={completo} onRefTap={contenidoDemo ? () => onVerDemo(contenidoDemo) : undefined} refVisual={contenidoDemo ? 'Ver demostración' : undefined} />

        <div className="mt-3 flex items-center justify-around">
          <Estadistica etiqueta="Sets" valor={ejercicio.sets} />
          <span className="h-7 w-px bg-linea/60" aria-hidden="true" />
          <Estadistica etiqueta="Reps" valor={ejercicio.rango.replace(/[()]/g, '')} />
          <span className="h-7 w-px bg-linea/60" aria-hidden="true" />
          {/* Con el objetivo en FALLO la etiqueta cambia: «RIR FALLO» no
              significa nada, y son dos cosas distintas. */}
          {esAlFallo(ejercicio.rirObjetivo) ? (
            <Estadistica etiqueta="Objetivo" valor="FALLO" />
          ) : (
            <Estadistica etiqueta="RIR" valor={ejercicio.rirObjetivo} />
          )}
          <span className="h-7 w-px bg-linea/60" aria-hidden="true" />
          <Estadistica etiqueta="Descanso" valor={`${ejercicio.descansoMin}'`} />
        </div>

        {/* Prescripción del coach: siempre visible (texto canónico en mono). Los
            cues de ejecución quedan tras un toggle. */}
        <div
          className="mt-3 rounded-tarjeta border border-ink-500 bg-ink-700 p-3"
          style={{ boxShadow: 'var(--inset-top-light)' }}
        >
          <div className="relative pl-3">
            <span className="absolute bottom-0.5 left-0 top-0.5 w-[3px] rounded-full bg-accion" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-silver-500">Prescripción del coach</p>
            <p className="cifras mt-1.5 text-[12.5px] font-semibold leading-relaxed text-silver-100">
              {ejercicio.prescripcion}
            </p>
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <button
              type="button"
              onClick={onAlternarNota}
              aria-expanded={notaVisible}
              className="press text-[10px] font-bold uppercase tracking-[0.1em] text-accion"
            >
              {notaVisible ? 'Ocultar ejecución ▴' : 'Ver notas de ejecución ▾'}
            </button>
            {contenidoDemo && (
              <button
                type="button"
                onClick={() => onVerDemo(contenidoDemo)}
                className="press ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-silver-400"
              >
                <IconoVideo className="h-[13px] w-[13px]" />
                Técnica
              </button>
            )}
          </div>
          {notaVisible && (
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
              key={`${ejercicio.id}-${siguienteOrden}`}
              ref={registroRef}
              mostrarBoton={false}
              ejercicio={ejercicio}
              orden={siguienteOrden}
              borradorId={`${microcicloId}-${ejercicio.id}-${siguienteOrden}`}
              onGuardar={onGuardarSerie}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
