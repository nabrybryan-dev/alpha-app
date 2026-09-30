import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Cifra3D } from '../../components/ui/Cifra3D'
import { db, useDbVersion } from '../../data/dbInstance'
import { resumenAsesorado, type ResumenAsesorado } from '../coach/resumenAsesorado'
import { recordarPersonaEnConsola } from '../coach/consola/memoriaConsola'
import { MensajesEquipo } from './MensajesEquipo'
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
 * 4. «Decisiones compartidas» (0094; solo con `decisiones_compartidas`) y «Mensajes» con
 *    pestañas (asesorados, creadores, Bryan).
 *
 * La nutrición del equipo ya no está aquí: tiene su propio espacio en la barra.
 */

const ORDEN_COLOR = { rojo: 0, ambar: 1, verde: 2 } as const
const PUNTO: Record<ResumenAsesorado['semaforo']['color'], string> = {
  rojo: 'bg-rojo',
  ambar: 'bg-ambar',
  verde: 'bg-verde',
}

const NOMBRES_BANDEJA = {
  primeros: { uno: 'primer plan', varios: 'primeros planes' },
  renovados: { uno: 'renovado', varios: 'renovados' },
} as const

/**
 * Si alguna bandeja no se pudo leer (APP-F01 de la revisión final de Codex, 28-sep), la
 * tarjeta no da un total definitivo ni dice «Nada esperando tu firma»: cuenta lo que sí se
 * leyó como mínimo («2 o más»), dice qué bandeja falta y deja reintentar.
 */
function TarjetaPorAprobarIncompleta({ cuenta }: { cuenta: PorAprobar }) {
  const leidas: { k: keyof typeof NOMBRES_BANDEJA; n: number }[] = []
  const fallidas: { k: keyof typeof NOMBRES_BANDEJA; error: string }[] = []
  for (const k of ['primeros', 'renovados'] as const) {
    const c = cuenta[k]
    if (c === null) continue
    if (c.ok) leidas.push({ k, n: c.n })
    else fallidas.push({ k, error: c.error })
  }
  const minimo = leidas.reduce((s, b) => s + b.n, 0)
  const texto =
    leidas.length === 0
      ? `No se pudieron leer las bandejas (${fallidas[0]?.error ?? 'error'}). Puede haber planes esperando tu firma.`
      : [
          ...leidas.map((b) => `${b.n} ${b.n === 1 ? NOMBRES_BANDEJA[b.k].uno : NOMBRES_BANDEJA[b.k].varios}`),
          ...fallidas.map((f) => `${NOMBRES_BANDEJA[f.k].varios}: no se pudieron leer`),
        ].join(' · ')
  return (
    <section
      aria-label="Por aprobar"
      className="entrada entrada-1 flex flex-col gap-3 rounded-tarjeta border border-rojo bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-rojo">Por aprobar</span>
          <span role="alert" className="text-sm font-semibold text-texto">
            {texto}
          </span>
        </span>
        <Cifra3D
          valor={leidas.length === 0 ? undefined : minimo}
          sufijo="+"
          rojo
          tamano={44}
          etiqueta={leidas.length === 0 ? 'por aprobar: no se sabe' : `${minimo} o más por aprobar`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={cuenta.reintentar}
          className="press min-h-[44px] rounded-full border border-linea px-4 text-sm font-bold text-texto"
        >
          Reintentar
        </button>
        <Link
          to="/equipo-nutricion"
          className="press inline-flex min-h-[44px] items-center px-2 text-sm text-tenue underline"
        >
          Abrir las bandejas
        </Link>
      </div>
    </section>
  )
}

function TarjetaPorAprobar({ cuenta }: { cuenta: PorAprobar }) {
  if (cuenta.primeros?.ok === false || cuenta.renovados?.ok === false) {
    return <TarjetaPorAprobarIncompleta cuenta={cuenta} />
  }
  const primeros = cuenta.primeros?.ok ? cuenta.primeros.n : null
  const renovados = cuenta.renovados?.ok ? cuenta.renovados.n : null
  const total = (primeros ?? 0) + (renovados ?? 0)
  const partes = [
    primeros !== null && `${primeros} ${primeros === 1 ? 'primer plan' : 'primeros planes'}`,
    renovados !== null && `${renovados} ${renovados === 1 ? 'renovado' : 'renovados'}`,
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
      <details className="group border-t border-linea">
        <summary className="press flex min-h-[56px] cursor-pointer list-none items-center gap-3">
          {contenido}
          <span aria-hidden="true" className="text-tenue group-open:rotate-180">⌄</span>
        </summary>
        <div className="grid grid-cols-2 gap-2 pb-3" aria-label={`Áreas de ${r.usuario.nombre}`}>
      {conConsola ? (
        <Link
          to="/coach/consola"
          onClick={() => recordarPersonaEnConsola(r.usuario.id)}
          aria-label={`Entrenamiento de ${r.usuario.nombre}`}
          className="press flex min-h-[48px] items-center justify-center rounded-boton border border-linea text-sm font-semibold text-texto"
        >
          Entrenamiento
        </Link>
      ) : (
        <div className={clase}>{contenido}</div>
      )}
          <Link to={`/equipo-nutricion?persona=${encodeURIComponent(r.usuario.id)}`} className="press flex min-h-[48px] items-center justify-center rounded-boton border border-linea text-sm font-semibold text-texto" aria-label={`Nutrición de ${r.usuario.nombre}`}>
            Nutrición
          </Link>
        </div>
      </details>
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
  // La consola cuenta a TODOS los que entrenan, y la nutricionista entrena con el plan: quien
  // abre esta pantalla está en esa cuenta (26 aquí frente a 27 allá). Se dice, no se oculta.
  const entrenan = db.usuarios.entrenan()
  const yoEntreno = entrenan.some((u) => u.id === usuario.id)
  const atencion = cartera.filter((r) => r.semaforo.color !== 'verde')
  const alDia = cartera.filter((r) => r.semaforo.color === 'verde')

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
        {conConsola && yoEntreno && (
          <p className="text-xs text-tenue">
            La consola cuenta {entrenan.length}: incluye a quien abre la pantalla. Aquí no te cuentas a ti.
          </p>
        )}
      </header>

      <Link to="/equipo-nutricion" className="press flex min-h-[48px] items-center justify-center rounded-boton border border-linea font-semibold text-texto">Nutrición del equipo</Link>

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

      <MensajesEquipo usuarioId={usuario.id} />
    </div>
  )
}
