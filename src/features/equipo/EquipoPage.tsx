import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Cifra3D } from '../../components/ui/Cifra3D'
import { db, idCoach, useDbVersion } from '../../data/dbInstance'
import { resumenAsesorado, type ResumenAsesorado } from '../coach/resumenAsesorado'
import { recordarPersonaEnConsola } from '../coach/consola/memoriaConsola'
import { useCapacidadesVigentes } from './useCapacidadesVigentes'
import { usePorAprobar, type PorAprobar } from './usePorAprobar'

/**
 * Espacio «Equipo» del staff que también entrena (Manuela), maqueta «Espacios de Alpha»
 * aprobada por Bryan el 28-sep:
 *
 *   1. «Por aprobar»: la cifra roja de primeros planes y planes renovados que esperan
 *      decisión, contada con la misma lectura que las bandejas (que viven en Nutrición).
 *   2. La cartera con su semáforo real —el de la consola, `resumenAsesorado`—: los que
 *      piden atención primero y con su motivo; los que van al día, plegados. Solo con
 *      `leer_entrenamiento`: sin esa capacidad no se muestra ni un nombre. La capacidad se
 *      vuelve a comprobar al volver a la pestaña y cada pocos minutos
 *      (`useCapacidadesVigentes`): si se la quitan a mitad de sesión, la cartera se retira.
 *   3. La consola completa (solo con `leer_entrenamiento`) y los mensajes.
 *
 * La nutrición del equipo ya no está aquí: tiene su propio espacio en la barra. Las
 * decisiones compartidas de la maqueta llegan cuando exista su tabla.
 */

const ORDEN_COLOR = { rojo: 0, ambar: 1, verde: 2 } as const
const PUNTO: Record<ResumenAsesorado['semaforo']['color'], string> = {
  rojo: 'bg-rojo',
  ambar: 'bg-ambar',
  verde: 'bg-verde',
}

function TarjetaPorAprobar({ cuenta }: { cuenta: PorAprobar }) {
  const total = (cuenta.primeros ?? 0) + (cuenta.renovados ?? 0)
  const partes = [
    cuenta.primeros !== null && `${cuenta.primeros} ${cuenta.primeros === 1 ? 'primer plan' : 'primeros planes'}`,
    cuenta.renovados !== null && `${cuenta.renovados} ${cuenta.renovados === 1 ? 'renovado' : 'renovados'}`,
  ].filter(Boolean)
  const pide = total > 0
  return (
    <Link
      to="/equipo-nutricion"
      aria-label={`Por aprobar: ${partes.join(' y ')}. Abrir las bandejas`}
      className={`press entrada entrada-1 flex min-h-[64px] items-center justify-between gap-3 rounded-tarjeta border bg-surface-1 p-4 shadow-sm ${
        pide ? 'border-rojo' : 'border-linea'
      }`}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${pide ? 'text-rojo' : 'text-tenue'}`}>
          Por aprobar
        </span>
        <span className="text-sm font-semibold text-texto">{pide ? partes.join(' · ') : 'Nada esperando tu firma'}</span>
      </span>
      <Cifra3D valor={total} rojo={pide} tamano={44} etiqueta={`${total} por aprobar`} />
    </Link>
  )
}

function FilaCartera({ r, conConsola }: { r: ResumenAsesorado; conConsola: boolean }) {
  const contenido = (
    <>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PUNTO[r.semaforo.color]}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-texto">{r.usuario.nombre}</span>
      <span className="shrink-0 text-right text-xs text-tenue">{r.semaforo.motivo}</span>
    </>
  )
  const clase = 'flex min-h-[56px] items-center gap-3 border-t border-linea'
  return (
    <li>
      {conConsola ? (
        <Link
          to="/coach/consola"
          onClick={() => recordarPersonaEnConsola(r.usuario.id)}
          aria-label={`${r.usuario.nombre}: ${r.semaforo.motivo}. Abrir en la consola`}
          className={`press ${clase}`}
        >
          {contenido}
        </Link>
      ) : (
        <div className={clase}>{contenido}</div>
      )}
    </li>
  )
}

export default function EquipoPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const capacidades = useCapacidadesVigentes()
  const { cargando, tiene } = capacidades
  const porAprobar = usePorAprobar(capacidades)
  const [verTodos, setVerTodos] = useState(false)

  if (usuario.rol !== 'nutricionista') return <Navigate to="/" replace />

  const conConsola = !cargando && tiene('leer_entrenamiento')
  // La cartera (nombres y semáforos, que salen del entrenamiento) solo se calcula con
  // `leer_entrenamiento` (E-11 de la revisión de Codex del 28-sep): la capacidad no limita
  // solo el enlace a la consola, limita lo que se muestra. Sin ella, la lista queda vacía y
  // la pantalla dice por qué. Su propia fila no va: lo suyo está en Mi día.
  const cartera = conConsola
    ? db.usuarios
        .entrenan()
        .filter((u) => u.id !== usuario.id)
        .map((u) => resumenAsesorado(db, u))
        .sort((a, b) => ORDEN_COLOR[a.semaforo.color] - ORDEN_COLOR[b.semaforo.color])
    : []
  const atencion = cartera.filter((r) => r.semaforo.color !== 'verde')
  const alDia = cartera.filter((r) => r.semaforo.color === 'verde')
  const noLeidos = db.mensajes.noLeidosDe(usuario.id, idCoach())

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1 pt-1">
        {conConsola && (
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">
            {cartera.length} {cartera.length === 1 ? 'persona' : 'personas'} · {atencion.length}{' '}
            {atencion.length === 1 ? 'pide' : 'piden'} atención
          </p>
        )}
        <h2 className="font-display text-3xl leading-none text-texto">Equipo</h2>
      </header>

      {porAprobar && <TarjetaPorAprobar cuenta={porAprobar} />}

      <section
        aria-label="Cartera"
        className="entrada entrada-2 flex flex-col rounded-tarjeta border border-linea bg-surface-1 px-4 py-2 shadow-sm"
      >
        <p className="py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Cartera</p>
        {cargando ? (
          <p className="border-t border-linea py-3 text-sm text-tenue" aria-busy="true">Cargando tus permisos…</p>
        ) : !conConsola ? (
          <p className="border-t border-linea py-3 text-sm text-tenue">
            La cartera se ve con el permiso de leer el entrenamiento, y todavía no lo tienes. Pídeselo al coach.
          </p>
        ) : cartera.length === 0 ? (
          <p className="border-t border-linea py-3 text-sm text-tenue">Todavía no hay nadie en la cartera.</p>
        ) : (
          <ul>
            {atencion.map((r) => (
              <FilaCartera key={r.usuario.id} r={r} conConsola={conConsola} />
            ))}
            {verTodos && alDia.map((r) => <FilaCartera key={r.usuario.id} r={r} conConsola={conConsola} />)}
            {alDia.length > 0 && (
              <li>
                <button
                  type="button"
                  aria-expanded={verTodos}
                  onClick={() => setVerTodos((v) => !v)}
                  className="press flex min-h-[56px] w-full items-center gap-3 border-t border-linea text-left"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-verde" aria-hidden="true" />
                  <span className="flex-1 text-sm font-semibold text-texto">{alDia.length} al día</span>
                  <span className="text-xs text-tenue">{verTodos ? 'plegar' : 'ver todos'}</span>
                </button>
              </li>
            )}
          </ul>
        )}
      </section>

      {conConsola && (
        <Link
          to="/coach/consola"
          className="press entrada entrada-3 flex min-h-[48px] items-center justify-center rounded-boton border border-texto font-display text-[13px] uppercase text-texto"
        >
          Abrir la consola completa
        </Link>
      )}

      <Link
        to="/chat"
        className="press entrada entrada-3 flex min-h-[56px] items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Mensajes</span>
          <span className="text-sm text-texto">Conversación con el coach</span>
        </span>
        {noLeidos > 0 ? (
          <span className="cifras shrink-0 text-xs font-bold text-rojo">
            {noLeidos} {noLeidos === 1 ? 'nuevo' : 'nuevos'}
          </span>
        ) : (
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rojo/15 text-base text-rojo">
            →
          </span>
        )}
      </Link>
    </div>
  )
}
