import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { NOMBRE_SOMBRERO, type Sombrero } from '../../domain/equipo/sombreros'
import { BandejaPlanesRenovados } from '../coach/consola/BandejaPlanesRenovados'
import { BandejaPrimerosPlanes } from '../coach/consola/BandejaPrimerosPlanes'
import { ocupaPuestoCoach } from '../coach/consola/usePuestoCoach'
import MiPlanPage from '../plan/MiPlanPage'
import { AvisosDeSeguridad } from './AvisosDeSeguridad'
import { useFiltroSombrero } from './filtroSombreros'
import { MensajesEquipo } from './MensajesEquipo'
import { Sombreros } from './Sombreros'
import { useCapacidadesVigentes } from './useCapacidadesVigentes'

/**
 * BANDEJA del equipo (maqueta 7, paso 9 del plan 14): tareas de la agenda, mensajes que se
 * abren y firmas, en un solo sitio para los tres sombreros.
 *
 * No inventa un modelo nuevo: compone lo que ya existe —`MiPlanPage` para las tareas,
 * el chat/consultas (o el buzón del equipo) para los mensajes, y las dos bandejas de firma
 * para los planes—. Lo único nuevo es el sitio y el filtro.
 *
 * La SEGURIDAD va fuera de las pestañas y del filtro: con cualquier sombrero puesto, una
 * alerta de dolor sigue delante. Es la regla que no se negocia.
 */

type Pestana = 'tareas' | 'mensajes' | 'firmas'

const PESTANAS: readonly { id: Pestana; nombre: string; sombrero: Sombrero }[] = [
  { id: 'tareas', nombre: 'Tareas', sombrero: 'administracion' },
  { id: 'mensajes', nombre: 'Mensajes', sombrero: 'entreno' },
  { id: 'firmas', nombre: 'Firmas', sombrero: 'nutricion' },
]

function Enlace({ a, titulo, nota }: { a: string; titulo: string; nota: string }) {
  return (
    <Link
      to={a}
      className="press flex min-h-[56px] items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 shadow-sm"
    >
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-texto">{titulo}</span>
        <span className="text-xs text-tenue">{nota}</span>
      </span>
      <span aria-hidden="true" className="text-tenue">›</span>
    </Link>
  )
}

export default function BandejaPage() {
  const { usuario } = useSesion()
  const capacidades = useCapacidadesVigentes()
  const { cargando, tiene } = capacidades
  const esCoach = ocupaPuestoCoach(usuario.rol, cargando, tiene)
  const [pestana, setPestana] = useState<Pestana>('tareas')
  const filtro = useFiltroSombrero()

  // La puerta de la propia pantalla: el marco del asesorado no aplica `soloEquipo`.
  if (usuario.rol === 'asesorado' && cargando) return null
  if (usuario.rol !== 'nutricionista' && !esCoach) return <Navigate to="/" replace />

  const actual = PESTANAS.find((p) => p.id === pestana)!
  const visible = filtro === 'todo' || filtro === actual.sombrero
  const conNombres = esCoach || !cargando && tiene('leer_entrenamiento')

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Un solo sitio</p>
        <h2 className="font-display text-3xl leading-none text-texto">Bandeja</h2>
        <p className="text-sm text-tenue">
          Tareas de tu agenda, mensajes que se abren y firmas. Los tres sombreros, juntos.
        </p>
      </header>

      <Sombreros />

      <AvisosDeSeguridad conNombres={conNombres} />

      <div role="group" aria-label="Qué ver en la Bandeja" className="flex gap-1.5 overflow-x-auto pb-0.5">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`press min-h-[44px] shrink-0 rounded-full border px-4 text-xs font-bold ${
              pestana === p.id
                ? 'border-texto bg-surface-3 text-texto'
                : 'border-linea bg-surface-1 text-tenue'
            }`}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {!visible ? (
        <p className="rounded-tarjeta border border-dashed border-linea p-4 text-sm text-tenue">
          Esta pestaña es del sombrero {NOMBRE_SOMBRERO[actual.sombrero]}. Elige «Todo» o{' '}
          «{NOMBRE_SOMBRERO[actual.sombrero]}» arriba para verla.
        </p>
      ) : pestana === 'tareas' ? (
        <MiPlanPage />
      ) : pestana === 'mensajes' ? (
        esCoach ? (
          <div className="flex flex-col gap-2.5">
            <Enlace a="/coach/chat" titulo="Chat con los asesorados" nota="Lo que espera respuesta, por persona." />
            <Enlace a="/coach/consultas" titulo="Consultas" nota="Las preguntas que piden tu criterio." />
          </div>
        ) : (
          <MensajesEquipo usuarioId={usuario.id} />
        )
      ) : (
        <div className="flex flex-col gap-3.5">
          <BandejaPrimerosPlanes />
          <BandejaPlanesRenovados />
        </div>
      )}
    </div>
  )
}
