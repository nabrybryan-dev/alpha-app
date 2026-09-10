import { useEffect, useState } from 'react'
import { tramoDeHambre } from '../../domain/senales/hambre'
import { tramoDeDolor } from '../../domain/senales/dolor'
import { Stepper } from '../../components/ui/Stepper'
import type { Cantidad3, CheckinDiario, Cualitativo3 } from '../../domain/types'

const CUALITATIVOS = ['MALA', 'REGULAR', 'BUENA'] as const
const CANTIDADES = ['POCO', 'REGULAR', 'MUCHO'] as const

/** Solo para el primer check-in de alguien, cuando aún no hay historial. */
const PESO_DE_FABRICA = 70
const PASOS_DE_FABRICA = 8000

interface CheckinFormProps {
  usuarioId: string
  fecha: string
  /** Peso/pasos del último check-in, para arrancar los steppers cerca del valor real. */
  pesoInicial?: number
  pasosInicial?: number
  /**
   * Si se le pregunta el peso. `false` para quien tiene la composición corporal
   * apagada (migración 0018): Bienestar tiene su propio campo de peso y ningún
   * interruptor lo cubría, así que la persona a la que le ocultamos su
   * porcentaje de grasa se encontraba igualmente un selector de kilos cinco
   * veces por semana. El resto del check-in sigue igual: sus pasos, su sueño y
   * su hambre son justo lo que sostiene su plan.
   */
  pedirPeso?: boolean
  onGuardar: (checkin: CheckinDiario) => void
}

/** Tarjeta paper con una pregunta y 3 opciones tipo pill (look del handoff). */
function CampoPills({
  titulo,
  opciones,
  valor,
  onCambiar,
}: {
  titulo: string
  opciones: readonly string[]
  valor: string | undefined
  onCambiar: (v: string) => void
}) {
  return (
    <fieldset className="rounded-tarjeta border border-linea bg-surface-1 p-3.5 shadow-sm">
      <legend className="mb-2.5 text-sm font-bold text-texto">{titulo}</legend>
      <div className="flex gap-2">
        {opciones.map((o) => {
          const sel = valor === o
          return (
            <button
              key={o}
              type="button"
              onClick={() => onCambiar(o)}
              className={`press flex-1 rounded-full border py-2 text-[11px] font-bold uppercase tracking-wide transition-colors duration-200 ease-salida ${
                sel ? 'border-accion bg-accion text-white' : 'border-linea bg-surface-2 text-tenue'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function CheckinForm({ usuarioId, fecha, pesoInicial, pasosInicial, pedirPeso = true, onGuardar }: CheckinFormProps) {
  const [pesoKg, setPesoKg] = useState(pesoInicial ?? PESO_DE_FABRICA)
  const [pasos, setPasos] = useState(pasosInicial ?? PASOS_DE_FABRICA)
  // Si la persona ya movió el campo, manda ella: una hidratación tardía no
  // puede pisarle lo que acaba de escribir.
  const [pesoTocado, setPesoTocado] = useState(false)
  const [pasosTocados, setPasosTocados] = useState(false)

  /**
   * El historial puede llegar DESPUÉS de abrir el formulario: se entra al
   * vestuario con mala señal (la app deja pasar con los datos locales que
   * haya) y la hidratación aterriza al salir del gimnasio.
   *
   * Sin esto, el valor de fábrica se quedaba puesto. Y no es un placeholder
   * gris: es un número ya cargado en el campo, el peso no es obligatorio para
   * guardar, y el coach decide superávit o déficit sobre lo que se guardó.
   */
  /*
   * Estos dos efectos son intencionados, aunque `set-state-in-effect` los marque.
   *
   * La alternativa que sugiere la regla es derivar en el render:
   *   `pesoTocado ? pesoEscrito : (pesoInicial ?? PESO_DE_FABRICA)`
   * Y funciona para el caso que importa (el peso real llega tarde). Pero pierde la
   * guarda `pesoInicial !== undefined`: si el prop volviera a quedar sin valor
   * —una hidratación que se lleve el historial— la derivación caería al 70 de
   * fábrica, que es EXACTAMENTE el dato equivocado contra el que existe
   * `CheckinForm.peso-obsoleto.test.tsx`. Con el efecto, se conserva el último peso
   * real conocido.
   *
   * Hay una tercera vía (ajustar estado durante el render, patrón documentado de
   * React) que cumple las dos cosas, pero mete un `setState` en el cuerpo del
   * componente: más difícil de leer para quien entre después, a cambio de un aviso
   * de linter. La jerarquía de este proyecto pone integridad de datos y
   * mantenibilidad por encima de eso.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver el comentario de arriba
    if (pesoInicial !== undefined && !pesoTocado) setPesoKg(pesoInicial)
  }, [pesoInicial, pesoTocado])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver el comentario de arriba
    if (pasosInicial !== undefined && !pasosTocados) setPasos(pasosInicial)
  }, [pasosInicial, pasosTocados])
  const [entreno, setEntreno] = useState('')
  const [rendimiento, setRendimiento] = useState<Cualitativo3>()
  const [motivacion, setMotivacion] = useState<Cantidad3>()
  const [hambreEscala, setHambreEscala] = useState<number>()
  const [cansancio, setCansancio] = useState<Cantidad3>()
  const [estres, setEstres] = useState<Cantidad3>()
  const [horasSueno, setHorasSueno] = useState(7)
  const [calidadSueno, setCalidadSueno] = useState<Cualitativo3>()
  const [alimentacion, setAlimentacion] = useState<Cualitativo3>()
  const [dolor, setDolor] = useState<number>()
  const [dolorDonde, setDolorDonde] = useState('')
  const [comentarios, setComentarios] = useState('')
  const [intento, setIntento] = useState(false)

  // Campos cualitativos obligatorios (peso/pasos/sueño ya traen valor numérico).
  const camposCualitativos = [rendimiento, motivacion, hambreEscala, cansancio, estres, calidadSueno, alimentacion, dolor]
  // Un «6» sin sitio no le dice nada al coach: con dolor, el dónde también cuenta.
  const faltaDonde = dolor !== undefined && dolor > 0 && dolorDonde.trim() === ''
  const faltantes = camposCualitativos.filter((v) => v === undefined).length + (faltaDonde ? 1 : 0)

  const guardar = () => {
    if (faltantes > 0) {
      setIntento(true)
      return
    }
    onGuardar({
      id: `ck-${usuarioId}-${fecha}`,
      usuarioId,
      fecha,
      /*
       * Un número que nadie tocó NO es una medición.
       *
       * Los steppers arrancan en 70 kg y 8.000 pasos para que el primer
       * check-in de alguien no empiece en cero, pero eso es una sugerencia, no
       * un dato: los ocho campos obligatorios son los cualitativos, así que
       * quien no toca estos dos guarda igual. Se registraron 70 kg de una
       * persona que pesa bastante menos, y con ese número se decide un
       * superávit o un déficit.
       *
       * `pesoKg` y `pasos` son opcionales en `CheckinDiario` justo para esto:
       * ausente y inventado no valen lo mismo. Misma regla que ya gobierna el
       * catálogo de alimentos y `grasaPct`, que devuelve `null` en vez de un
       * número cuando le falta una medida.
       *
       * Lo que SÍ se conserva es el arrastre de una medida real anterior: eso
       * salió de una báscula alguna vez.
       */
      pesoKg: pedirPeso && (pesoTocado || pesoInicial !== undefined) ? pesoKg : undefined,
      pasos: pasosTocados || pasosInicial !== undefined ? pasos : undefined,
      entreno: entreno || undefined,
      rendimiento,
      motivacion,
      hambreEscala,
      cansancio,
      estres,
      horasSueno,
      calidadSueno,
      alimentacion,
      dolor,
      dolorDonde: dolor !== undefined && dolor > 0 && dolorDonde.trim() ? dolorDonde.trim() : undefined,
      comentarios: comentarios || undefined,
    })
  }

  const inputTexto =
    'w-full rounded-boton border border-linea bg-surface-1 px-3.5 py-2.5 text-texto shadow-sm placeholder:text-tenue focus:border-accion focus:outline-none'

  return (
    <div className="flex flex-col gap-3">
      {/* Peso ayunas + Pasos como steppers en tarjetas paper */}
      <div className={pedirPeso ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
        {pedirPeso && (
          <div className="rounded-tarjeta border border-linea bg-surface-1 p-3 shadow-sm">
            <Stepper etiqueta="Peso ayunas" valor={pesoKg} paso={0.1} decimal sufijo="kg" minimo={30} maximo={250} onCambiar={(v) => { setPesoTocado(true); setPesoKg(v) }} />
          </div>
        )}
        <div className="rounded-tarjeta border border-linea bg-surface-1 p-3 shadow-sm">
          <Stepper etiqueta="Pasos de ayer" valor={pasos} paso={500} minimo={0} maximo={100000} onCambiar={(v) => { setPasosTocados(true); setPasos(v) }} />
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-bold text-texto">
        ¿Qué entrenaste hoy?
        <input value={entreno} onChange={(e) => setEntreno(e.target.value)} placeholder="LEG A / Descanso" className={inputTexto} />
      </label>

      <CampoPills titulo="¿Cómo estuvo tu rendimiento?" opciones={CUALITATIVOS} valor={rendimiento} onCambiar={(v) => setRendimiento(v as Cualitativo3)} />
      <CampoPills titulo="Motivación" opciones={CANTIDADES} valor={motivacion} onCambiar={(v) => setMotivacion(v as Cantidad3)} />
      <EscalaHambre valor={hambreEscala} onCambiar={setHambreEscala} />
      <CampoPills titulo="Cansancio" opciones={CANTIDADES} valor={cansancio} onCambiar={(v) => setCansancio(v as Cantidad3)} />
      <CampoPills titulo="Estrés" opciones={CANTIDADES} valor={estres} onCambiar={(v) => setEstres(v as Cantidad3)} />
      <EscalaDolor valor={dolor} donde={dolorDonde} onCambiar={setDolor} onCambiarDonde={setDolorDonde} claseInput={inputTexto} />

      {/* Horas de sueño: fila con stepper */}
      <div className="flex items-center justify-between rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm">
        <span className="text-sm font-bold text-texto">Horas de sueño</span>
        <div className="w-40">
          <Stepper etiqueta="" valor={horasSueno} paso={0.5} minimo={0} maximo={14} sufijo="h" onCambiar={setHorasSueno} />
        </div>
      </div>

      <CampoPills titulo="Calidad del sueño" opciones={CUALITATIVOS} valor={calidadSueno} onCambiar={(v) => setCalidadSueno(v as Cualitativo3)} />
      <CampoPills titulo="¿Cómo estuvo tu alimentación?" opciones={CUALITATIVOS} valor={alimentacion} onCambiar={(v) => setAlimentacion(v as Cualitativo3)} />

      <input
        value={comentarios}
        onChange={(e) => setComentarios(e.target.value)}
        placeholder="Comentarios para tu coach (opcional)"
        className={inputTexto}
      />

      {intento && faltantes > 0 && (
        <p role="alert" className="text-center text-xs font-bold text-rojo">
          Te falta{faltantes === 1 ? '' : 'n'} {faltantes} campo{faltantes === 1 ? '' : 's'} por marcar
        </p>
      )}
      <button
        type="button"
        onClick={guardar}
        className="press mt-1 w-full rounded-boton bg-accion py-3.5 font-display text-base uppercase tracking-wide text-white"
        style={{ boxShadow: 'var(--glow-accion)' }}
      >
        Guardar check-in
      </button>
    </div>
  )
}

/**
 * El hambre del dia, de 1 a 10.
 *
 * POR QUE DIEZ Y NO TRES. Antes se preguntaba POCO / REGULAR / MUCHO, y con eso
 * no se distingue un 7 de un 9 -que es justo la diferencia entre esperar cinco
 * dias y actuar en dos-. La regla de la nutricionista existia y no se podia
 * ejecutar por falta de este numero.
 *
 * Se enseñan las etiquetas de los cuatro tramos debajo, no como decoracion:
 * "8" no significa nada por si solo, y sin la referencia cada persona calibra su
 * propia escala. Con "interfiere con el trabajo o el entreno" al lado, dos
 * asesorados distintos marcan parecido ante lo mismo.
 */
function EscalaHambre({
  valor,
  onCambiar,
}: {
  valor: number | undefined
  onCambiar: (valor: number) => void
}) {
  const tramo = valor === undefined ? undefined : tramoDeHambre(valor)

  return (
    <div className="rounded-tarjeta border border-linea bg-surface-1 p-3 shadow-sm">
      <p className="text-sm font-bold text-texto">Hambre de hoy</p>
      <p className="mt-0.5 text-[11px] leading-snug text-tenue">
        1 = no la sentiste · 10 = no la pudiste sostener
      </p>

      <div className="mt-2.5 flex gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Hambre ${n} de 10`}
            aria-pressed={valor === n}
            onClick={() => onCambiar(n)}
            className={`press h-9 flex-1 rounded-boton border text-xs font-bold transition-colors ${
              valor === n
                ? 'border-accion bg-accion text-white'
                : 'border-linea bg-surface-2 text-tenue'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {tramo && (
        <p className="mt-2 text-[11px] leading-snug text-tenue">
          <b className="text-texto">{DESCRIPCION_TRAMO[tramo.etiqueta]}</b>
        </p>
      )}
    </div>
  )
}

/** Cómo se vive cada tramo, en palabras del asesorado. */
const DESCRIPCION_TRAMO: Record<string, string> = {
  leve: 'Molesta, pero se lleva.',
  moderada: 'Cuesta, distrae.',
  intensa: 'Interfiere con el trabajo o el entreno.',
  insostenible: 'No la puedes sostener: fatiga, no te concentras.',
}

/**
 * El dolor del día, de 0 a 10 (EVA).
 *
 * POR QUÉ HAY UN BOTÓN DE «SIN DOLOR» Y NO UN HUECO. A la mayoría no le duele
 * nada, y para ellos es un toque. Pero ese toque es una medición: el cero
 * marcado a propósito es lo que permite decir «tres sesiones seguidas sin
 * dolor», que es justo la condición con la que se reabre un ajuste clínico.
 * Un campo que se pudiera dejar vacío no distinguiría «no me duele» de «no lo
 * miré».
 *
 * Con dolor, el dónde es obligatorio: un «6» a secas no le dice al coach si es
 * la rodilla que está vigilando o una agujeta.
 */
function EscalaDolor({
  valor,
  donde,
  onCambiar,
  onCambiarDonde,
  claseInput,
}: {
  valor: number | undefined
  donde: string
  onCambiar: (valor: number) => void
  onCambiarDonde: (donde: string) => void
  claseInput: string
}) {
  const tramo = valor === undefined ? undefined : tramoDeDolor(valor)
  const clase = (activo: boolean) =>
    `press rounded-boton border text-xs font-bold transition-colors ${
      activo ? 'border-accion bg-accion text-white' : 'border-linea bg-surface-2 text-tenue'
    }`

  return (
    <div className="rounded-tarjeta border border-linea bg-surface-1 p-3 shadow-sm">
      <p className="text-sm font-bold text-texto">Dolor de hoy</p>
      <p className="mt-0.5 text-[11px] leading-snug text-tenue">
        0 = ninguno · 10 = el peor que te imaginas
      </p>

      <button
        type="button"
        aria-label="Dolor 0 de 10"
        aria-pressed={valor === 0}
        onClick={() => onCambiar(0)}
        className={`${clase(valor === 0)} mt-2.5 h-9 w-full uppercase tracking-wide`}
      >
        Sin dolor
      </button>

      <div className="mt-1.5 flex gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Dolor ${n} de 10`}
            aria-pressed={valor === n}
            onClick={() => onCambiar(n)}
            className={`${clase(valor === n)} h-9 flex-1`}
          >
            {n}
          </button>
        ))}
      </div>

      {tramo && tramo.etiqueta !== 'ninguno' && (
        <>
          <p className="mt-2 text-[11px] leading-snug text-tenue">
            <b className="text-texto">{tramo.descripcion}</b>
          </p>
          <label className="mt-2 flex flex-col gap-1.5 text-sm font-bold text-texto">
            ¿Dónde?
            <input
              value={donde}
              onChange={(e) => onCambiarDonde(e.target.value)}
              placeholder="Rodilla izquierda, hombro, lumbar…"
              className={claseInput}
            />
          </label>
        </>
      )}
    </div>
  )
}
