import { Link, Navigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { useCapacidades } from '../coach/consola/useCapacidades'

/**
 * Espacio «Equipo» del staff que también entrena (Manuela), maqueta «Espacios de Alpha»
 * aprobada por Bryan el 28-sep. Reúne lo que ya existía repartido: la consola del equipo
 * (entrenamiento de los asesorados, con `leer_entrenamiento`), la nutrición del equipo y los
 * mensajes. Las decisiones compartidas llegan en la fase siguiente, con su tabla.
 */
interface Acceso {
  a: string
  titulo: string
  detalle: string
  visible: boolean
}

export default function EquipoPage() {
  const { usuario } = useSesion()
  const { cargando, tiene } = useCapacidades()

  if (usuario.rol !== 'nutricionista') return <Navigate to="/" replace />

  const accesos: Acceso[] = [
    {
      a: '/coach/consola',
      titulo: 'Consola del equipo',
      detalle: 'Estructuras de entrenamiento de cada asesorado, planes por aprobar y la ficha',
      visible: tiene('leer_entrenamiento'),
    },
    {
      a: '/equipo-nutricion',
      titulo: 'Nutrición del equipo',
      detalle: 'Adherencia de los últimos 30 días, ordenada por atención requerida',
      visible: true,
    },
    {
      a: '/chat',
      titulo: 'Mensajes',
      detalle: 'Conversación con el coach',
      visible: true,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <section className="pt-2">
        <p className="kicker">Tu equipo</p>
        <h2 className="font-display text-3xl text-texto">Equipo</h2>
      </section>
      {cargando && (
        <p className="text-sm text-tenue" aria-busy="true">
          Comprobando tus accesos…
        </p>
      )}
      <ul className="flex flex-col gap-2.5">
        {accesos
          .filter((x) => x.visible)
          .map((x, i) => (
            <li key={x.a}>
              <Link
                to={x.a}
                className={`press entrada entrada-${i + 2} flex items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 py-4 shadow-sm`}
              >
                <span>
                  <span className="block font-display text-base text-texto">{x.titulo}</span>
                  <span className="block text-xs text-tenue">{x.detalle}</span>
                </span>
                <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rojo/15 text-base text-rojo">
                  →
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  )
}
