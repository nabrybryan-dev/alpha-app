import { useState } from 'react'
import { z } from 'zod'
import { ChipGroup } from '../../components/ui/Chip'
import { Stepper } from '../../components/ui/Stepper'
import type { Cantidad3, CheckinDiario, Cualitativo3 } from '../../domain/types'

const CUALITATIVOS = ['MALA', 'REGULAR', 'BUENA'] as const
const CANTIDADES = ['POCO', 'REGULAR', 'MUCHO'] as const

const esquema = z.object({
  pesoKg: z.number().min(30, 'Peso fuera de rango').max(250, 'Peso fuera de rango').optional(),
  pasos: z.number().min(0).max(100000, 'Pasos fuera de rango').optional(),
})

interface CheckinFormProps {
  usuarioId: string
  fecha: string
  onGuardar: (checkin: CheckinDiario) => void
}

export function CheckinForm({ usuarioId, fecha, onGuardar }: CheckinFormProps) {
  const [pesoKg, setPesoKg] = useState('')
  const [pasos, setPasos] = useState('')
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
  const [error, setError] = useState('')

  const guardar = () => {
    const numeros = {
      pesoKg: pesoKg ? Number.parseFloat(pesoKg.replace(',', '.')) : undefined,
      pasos: pasos ? Number.parseInt(pasos, 10) : undefined,
    }
    const validacion = esquema.safeParse(numeros)
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? 'Revisa los valores')
      return
    }
    setError('')
    onGuardar({
      id: `ck-${usuarioId}-${fecha}`,
      usuarioId,
      fecha,
      ...validacion.data,
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

  const campoNumero = 'w-full rounded-xl border border-linea bg-surface-2 px-3 py-2.5 text-texto placeholder:text-tenue focus:border-rojo focus:outline-none'

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold text-texto">
          Peso en ayunas (kg)
          <input inputMode="decimal" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} placeholder="59.0" className={campoNumero} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-texto">
          Pasos de ayer
          <input inputMode="numeric" value={pasos} onChange={(e) => setPasos(e.target.value)} placeholder="9000" className={campoNumero} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-bold text-texto">
        ¿Qué entrenaste hoy?
        <input value={entreno} onChange={(e) => setEntreno(e.target.value)} placeholder="LEG A / Descanso" className={campoNumero} />
      </label>

      {[
        { titulo: '¿Cómo estuvo tu rendimiento?', valor: rendimiento, set: setRendimiento, opciones: CUALITATIVOS },
        { titulo: 'Motivación', valor: motivacion, set: setMotivacion, opciones: CANTIDADES },
        { titulo: 'Hambre', valor: hambre, set: setHambre, opciones: CANTIDADES },
        { titulo: 'Cansancio', valor: cansancio, set: setCansancio, opciones: CANTIDADES },
        { titulo: 'Estrés', valor: estres, set: setEstres, opciones: CANTIDADES },
      ].map((campo) => (
        <fieldset key={campo.titulo}>
          <legend className="mb-1.5 text-sm font-bold text-texto">{campo.titulo}</legend>
          <ChipGroup
            opciones={campo.opciones}
            valor={campo.valor}
            onCambiar={(v) => (campo.set as (x: string) => void)(v)}
          />
        </fieldset>
      ))}

      <div className="flex justify-start">
        <Stepper etiqueta="Horas de sueño" valor={horasSueno} paso={0.5} minimo={0} maximo={14} sufijo="h" onCambiar={setHorasSueno} />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-texto">Calidad del sueño</legend>
        <ChipGroup opciones={CUALITATIVOS} valor={calidadSueno} onCambiar={(v) => setCalidadSueno(v as Cualitativo3)} />
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-texto">¿Cómo estuvo tu alimentación?</legend>
        <ChipGroup opciones={CUALITATIVOS} valor={alimentacion} onCambiar={(v) => setAlimentacion(v as Cualitativo3)} />
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-bold text-texto">
        Comentarios para el coach
        <textarea
          value={comentarios}
          onChange={(e) => setComentarios(e.target.value)}
          rows={3}
          placeholder="Dolores, sensaciones, algo que el coach deba saber…"
          className={campoNumero}
        />
      </label>

      {error && <p className="text-sm font-bold text-rojo">{error}</p>}

      <button type="button" onClick={guardar} className="rounded-xl bg-rojo py-3 font-display text-sm text-white active:opacity-90">
        Guardar check-in de hoy ✓
      </button>
    </div>
  )
}
