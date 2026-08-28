import { Card } from '../../components/ui/Card'
import { db } from '../../data/dbInstance'
import { ejercicioCompleto } from '../../domain/cumplimiento'
import { demoDeEjercicio } from '../../domain/demos'
import { patronDeCategoria, type Patron } from '../../domain/patrones/catalogo'
import type { Contenido, EjercicioPrescrito, SerieRegistrada } from '../../domain/types'
import { CheckDibujado } from './CheckDibujado'
import { ExerciseSlotMachine } from './ExerciseSlotMachine'
import { RegistroSerie, type RegistroSerieHandle } from './RegistroSerie'
import { IconoVideo, IconoCuerpo3D } from '../../components/ui/Icono'
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
  /** Abre el modelo 3D del patrón de movimiento del ejercicio. */
  onVerPatron: (patron: Patron) => void
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
  onVerPatron,
  onGuardarSerie,
  registroRef,
  indice,
  total,
}: TarjetaEjercicioProps) {
  const completo = ejercicioCompleto(ejercicio)
  const siguienteOrden = ejercicio.series.length + 1
  const contenidoDemo = demoDeEjercicio(ejercicio, db.contenidos.list())
  // El patrón sale de la categoría, que el ejercicio ya trae: los microciclos
  // que están cargados tienen visor sin tocar ni un dato. El nombre es el plan B
  // para las categorías que dicen para qué sirve el ejercicio en vez de qué
  // gesto es, como PREV/REHAB, donde caben un manguito y un salto al cajón.
  const patron = patronDeCategoria(ejercicio.categoria, ejercicio.nombre)

  return (
    // Sin `.entrada`. No era una entrada de pantalla: SesionPage le pone
    // `key={ejercicioActual.id}`, así que el keyframe de 480 ms se repetía ENTERO
    // en cada cambio de ejercicio —desde la barra, desde «A continuación» y al
    // completar uno—, que son decenas de veces por sesión. En ese tramo de
    // frecuencia la decisión es quitar o reducir mucho, y encima un keyframe no se
    // puede interrumpir: tocar dos ejercicios seguidos reiniciaba desde cero.
    <div id={`ej-${ejercicio.id}`} className="scroll-mt-4">
      <Card className={completo ? 'opacity-75' : ''}>
        <ExerciseSlotMachine index={indice} total={total} nombre={ejercicio.nombre} categoria={ejercicio.categoria} rango={ejercicio.rango} tecnica={ejercicio.cues || undefined} paused={completo} onRefTap={contenidoDemo ? () => onVerDemo(contenidoDemo) : undefined} refVisual={contenidoDemo ? 'Ver demostración' : undefined} />

        {/* EL BANCO DE TRABAJO. La tarjeta es la superficie; lo que lleva encima se
            reparte en tres escalones de la escala y ni uno más:

            · las cuatro cifras del objetivo van TROQUELADAS en el banco (`pozo-3d`,
              −8), que es literalmente para lo que existe ese escalón: «materia que
              falta dentro de la misma placa: cifras, troqueles»;
            · la prescripción del coach es una placa POSADA encima (+16). Es lo único
              en relieve, y por eso se lee como lo que hay que hacer;
            · las series ya registradas vuelven a hundirse (−8): son registro, no
              instrucción — están escritas y no se tocan.

            REGISTROSERIE SE QUEDA FUERA DE ESTA ESCENA, y no es una preferencia de
            orden. `perspective` crea bloque contenedor para los descendientes
            `fixed`, y de `RegistroSerie` cuelga `HojaMedicion`, que es `fixed
            inset-0`. Metiéndolo aquí dentro, la hoja de la cámara dejaría de ocupar
            la pantalla para encerrarse en una tarjeta de 350 px. El propio
            `RegistroSerie` ya lo tiene escrito en su marco; esto es el otro lado de
            la misma regla. */}
        <div className="escena-prof">
        <div className="pozo-3d mt-3 flex items-center justify-around rounded-boton bg-ink-800/60 py-2.5">
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
          style={{
            // La única placa en relieve de la tarjeta. Los dos botones de dentro se
            // quedan en `press` a propósito: `tecla-3d` sumaría otros +16 sobre estos
            // —los `translateZ` anidados se suman— y +32 no es ninguno de los cinco
            // escalones. Un relieve dentro de un relieve deja de ser una escala.
            transform: 'translateZ(var(--prof-relieve))',
            boxShadow: 'var(--inset-top-light), var(--sombra-alzado)',
          }}
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
            <span className="ml-auto flex items-center gap-3">
              {/* EL ACCESO AL CUERPO EN 3D.
                  Era texto gris de diez píxeles sin icono, al final de una fila de
                  enlaces secundarios, mientras su hermano de al lado —el vídeo de
                  técnica— sí llevaba icono. Tres personas seguidas no lo encontraron;
                  eso no es que no miren, es que no está.
                  Ahora lleva icono como su hermano, filete y el acento de marca: es lo
                  único que esta app tiene y no tiene ninguna otra, y estaba escondido
                  en el control menos visible de la tarjeta. */}
              {patron && (
                <button
                  type="button"
                  onClick={() => onVerPatron(patron)}
                  className="press flex items-center gap-1.5 rounded-lg border border-accion/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-accion"
                >
                  <IconoCuerpo3D className="h-[14px] w-[14px]" />
                  Ver en 3D
                </button>
              )}
              {contenidoDemo && (
                <button
                  type="button"
                  onClick={() => onVerDemo(contenidoDemo)}
                  className="press flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-silver-400"
                >
                  <IconoVideo className="h-[13px] w-[13px]" />
                  Técnica
                </button>
              )}
            </span>
          </div>
          {notaVisible && (
            <p className="desplegar mt-2 border-t border-ink-500 pt-2 text-xs leading-snug text-silver-300">
              {ejercicio.cues}
            </p>
          )}
        </div>

        {ejercicio.series.length > 0 && (
          // Hundido al mismo escalón que las cifras: lo ya registrado es del mismo
          // material que el objetivo, y ninguno de los dos se toca.
          <div className="mt-3" style={{ transform: 'translateZ(var(--prof-hueco))' }}>
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

        </div>
        {/* Y aquí acaba la escena: de este punto para abajo no hay perspectiva, para
            que la hoja de la cámara siga siendo `fixed` respecto a la pantalla. */}

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
