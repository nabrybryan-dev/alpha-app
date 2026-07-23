import { useState } from 'react'
import { Stepper } from '../../components/ui/Stepper'
import type { Cantidad3, CheckinDiario, Cualitativo3 } from '../../domain/types'

const CUALITATIVOS = ['MALA', 'REGULAR', 'BUENA'] as const
const CANTIDADES = ['POCO', 'REGULAR', 'MUCHO'] as const

interface CheckinFormProps {
  usuarioId: string
  fecha: string
  /** Peso/pasos del último check-in, para arrancar los steppers cerca del valor real. */
  pesoInicial?: number
  pasosInicial?: number
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

export function CheckinForm({ usuarioId, fecha, pesoInicial, pasosInicial, onGuardar }: CheckinFormProps) {
  const [pesoKg, setPesoKg] = useState(pesoInicial ?? 70)
  const [pasos, setPasos] = useState(pasosInicial ?? 8000)
  const [entreno, setEntreno] = useState('')
  const [rendimiento, setRendimiento] = useState<Cualitativo3>()
  const [motivacion, setMotivacion] = useState<Cantidad3>()
  const [hambre, setHambre] = useState<Cantidad3>()
  const [cansancio, setCansancio] = useState<Cantidad3>()
  const [estres, setEstres] = useState<Cantidad3>()
  const [horasSueno, setHorasSueno] = useState(7)
  const [calidadSueno, setCalidadSueno] = useState<Cualitativo3>()
  const [alimentacion, setAlimentacion] = useState<Cualitativo3>()
  const [comentarios, setComentarios] = useState('')
  const [intento, setIntento] = useState(false)

  // Campos cualitativos obligatorios (peso/pasos/sueño ya traen valor numérico).
  const camposCualitativos = [rendimiento, motivacion, hambre, cansancio, estres, calidadSueno, alimentacion]
  const faltantes = camposCualitativos.filter((v) => v === undefined).length

  const guardar = () => {
    if (faltantes > 0) {
      setIntento(true)
      return
    }
    onGuardar({
      id: `ck-${usuarioId}-${fecha}`,
      usuarioId,
      fecha,
      pesoKg,
      pasos,
      entreno: entreno || undefined,
      rendimiento,
      motivacion,
      hambre,
      cansancio,
      estres,
      horasSueno,
      calidadSueno,
      alimentacion,
      comentarios: comentarios || undefined,
    })
  }

  const inputTexto =
    'w-full rounded-boton border border-linea bg-surface-1 px-3.5 py-2.5 text-texto shadow-sm placeholder:text-tenue focus:border-accion focus:outline-none'

  return (
    <div className="flex flex-col gap-3">
      {/* Peso ayunas + Pasos como steppers en tarjetas paper */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-tarjeta border border-linea bg-surface-1 p-3 shadow-sm">
          <Stepper etiqueta="Peso ayunas" valor={pesoKg} paso={0.1} decimal sufijo="kg" minimo={30} maximo={250} onCambiar={setPesoKg} />
        </div>
        <div className="rounded-tarjeta border border-linea bg-surface-1 p-3 shadow-sm">
          <Stepper etiqueta="Pasos de ayer" valor={pasos} paso={500} minimo={0} maximo={100000} onCambiar={setPasos} />
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-bold text-texto">
        ¿Qué entrenaste hoy?
        <input value={entreno} onChange={(e) => setEntreno(e.target.value)} placeholder="LEG A / Descanso" className={inputTexto} />
      </label>

      <CampoPills titulo="¿Cómo estuvo tu rendimiento?" opciones={CUALITATIVOS} valor={rendimiento} onCambiar={(v) => setRendimiento(v as Cualitativo3)} />
      <CampoPills titulo="Motivación" opciones={CANTIDADES} valor={motivacion} onCambiar={(v) => setMotivacion(v as Cantidad3)} />
      <CampoPills titulo="Hambre" opciones={CANTIDADES} valor={hambre} onCambiar={(v) => setHambre(v as Cantidad3)} />
      <CampoPills titulo="Cansancio" opciones={CANTIDADES} valor={cansancio} onCambiar={(v) => setCansancio(v as Cantidad3)} />
      <CampoPills titulo="Estrés" opciones={CANTIDADES} valor={estres} onCambiar={(v) => setEstres(v as Cantidad3)} />

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
