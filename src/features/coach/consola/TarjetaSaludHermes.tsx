import { useEffect, useState } from 'react'
import { traerSaludHermes } from '../../../data/nube/saludHermes'
import {
  MINUTOS_SIN_SENAL,
  veredictoDeSalud,
  type FilaSaludHermes,
  type VeredictoSalud,
} from '../../../domain/saludHermes'

type Lectura = { filas: FilaSaludHermes[] } | 'error' | 'demo' | undefined

/** Tarjeta de salud de Hermes para «Mi día» del coach. Solo el puesto de coach la monta. */
export function TarjetaSaludHermes({ ahora = () => Date.now() }: { ahora?: () => number }) {
  const [lectura, setLectura] = useState<Lectura>()

  useEffect(() => {
    let vigente = true
    traerSaludHermes()
      .then((filas) => vigente && setLectura(filas === null ? 'demo' : { filas }))
      .catch(() => vigente && setLectura('error'))
    return () => {
      vigente = false
    }
  }, [])

  if (lectura === undefined || lectura === 'demo') return null
  if (lectura === 'error') {
    return (
      <p className="text-xs text-tenue" role="status">
        No pude leer el estado de Hermes. Si pasa seguido, revisa que la migración 0152 esté aplicada.
      </p>
    )
  }

  const v: VeredictoSalud = veredictoDeSalud(lectura.filas, ahora())
  if (v.tipo === 'todo_bien') {
    return (
      <p className="text-xs text-tenue" role="status">
        Hermes al día · visto hace {v.minutos} min
      </p>
    )
  }
  if (v.tipo === 'sin_senal') {
    return (
      <section role="alert" className="rounded-tarjeta border-2 border-red-600 bg-red-50 p-4 text-red-900">
        <h3 className="text-sm font-bold uppercase">Sin señal del minipc</h3>
        <p className="mt-1 text-sm">
          {v.motivo === 'sin_filas'
            ? 'Todavía no ha llegado ningún aviso del minipc.'
            : `Hace más de ${MINUTOS_SIN_SENAL} minutos que no llega nada.`}{' '}
          Revisa que esté encendido y con internet: mientras tanto Hermes puede estar caído sin que nadie se entere.
        </p>
      </section>
    )
  }
  return (
    <section role="alert" className="rounded-tarjeta border-2 border-amber-600 bg-amber-50 p-4 text-amber-950">
      <h3 className="text-sm font-bold">Hermes necesita ayuda</h3>
      <ul className="mt-1 flex flex-col gap-1 text-sm">
        {v.piezas.map((p) => (
          <li key={p.pieza}>
            <strong>{p.pieza}</strong>
            {p.estado === 'caido' ? ' está caída. ' : ' no se pudo comprobar. '}
            {p.queHacer}
          </li>
        ))}
      </ul>
    </section>
  )
}
