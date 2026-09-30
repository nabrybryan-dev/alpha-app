import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FalloDeLectura } from '../../../components/ui/FalloDeLectura'
import {
  contarQueRequierenAccion,
  seccionRequiereAccion,
  type Seccion,
  type SeccionLeida,
} from '../../../domain/adminTablero'
import { Cargando, CLASE_ETIQUETA } from '../../plan/comun'
import MiPlanPage from '../../plan/MiPlanPage'
import { DecisionesCompartidas } from '../../equipo/DecisionesCompartidas'
import { RotuloGrupo, TarjetaPlegable } from './TarjetaPlegable'
import { SeccionTablero } from './SeccionTablero'
import { useTableroAdmin } from './useTableroAdmin'
import type { EnlaceSeccion } from './TarjetaSeccion'

/**
 * ÁREA ADMINISTRATIVA (ESPEC-ADMINISTRACION-INTERACTIVA.md; orden pedido por Bryan el 30-sep),
 * de arriba abajo y todo plegado (una tarjeta por sección con una frase; al tocarla, el detalle):
 *
 *   1. Hoy y calendario: «Mi plan» (hoy, semana y 90 días).
 *   2. Indicadores financieros y de operación.
 *   3. ¿Cumplimos los objetivos? Plan estratégico y desvíos (riesgos financieros, operativos y
 *      de estrategia).
 *   4. Lo que proponen los agentes: propuesta, nunca aprobación.
 *   5. Al final, las decisiones de Bryan y Manuela, con dirección y responsable.
 *
 * Mi plan y las decisiones funcionan con lo que ya existe en la base (`organizar_plan`,
 * `decisiones_compartidas`). Las secciones del tablero (0102) solo se leen con `ver_administracion`:
 * sin ese permiso, o sin la tabla, salen como «Pendiente de activar (migración 0102)», nunca como
 * un cero ni un verde; un error de lectura se ve como error, distinto de «sin datos».
 */

/** Secciones del tablero que caen en Administración, en el orden de la pantalla. */
const SECCIONES_ADMIN: readonly Seccion[] = ['finanzas', 'plataforma', 'plan', 'desvios', 'propuestas']

type Filtro = 'todo' | 'accion'

function PlanHoyYCalendario() {
  return (
    <>
      <p className="text-[12.5px] text-tenue">
        Hoy: lo del día. Corto plazo: la semana. Mediano plazo: los 90 días. Largo plazo: sin horizonte cargado en el plan;
        no se inventa una duración.
      </p>
      <MiPlanPage />
    </>
  )
}

export default function AdministracionPage() {
  const t = useTableroAdmin()
  const [filtro, setFiltro] = useState<Filtro>('todo')

  const puedePlan = t.esCoach || t.tiene('organizar_plan')
  const puedeDecisiones = t.esCoach || t.tiene('decisiones_compartidas')

  const enlaceDe = (seccion: Seccion): EnlaceSeccion | null =>
    seccion === 'plataforma' ? { a: '/mi-entreno', texto: 'Abrir el buzón de comentarios de la app' } : null

  const leidas: SeccionLeida[] =
    t.estado.tipo === 'ok' ? t.estado.secciones.filter((s) => SECCIONES_ADMIN.includes(s.seccion)) : []
  const visibles = filtro === 'todo' ? leidas : leidas.filter(seccionRequiereAccion)
  const visiblesIds = visibles.map((s) => s.seccion)
  const pidenAccion = contarQueRequierenAccion(leidas)
  const cortes = leidas.flatMap((s) => (s.estado === 'sin_corte' ? [] : [s.corte]))
  const corteReciente = cortes.length > 0 ? [...cortes].sort().at(-1) : null

  const tarjeta = (seccion: Seccion) => (
    <SeccionTablero t={t} seccion={seccion} soloAccion={filtro === 'accion'} enlace={enlaceDe(seccion)} visibles={visiblesIds} />
  )

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1 pt-1">
        <p className={CLASE_ETIQUETA}>Empresa</p>
        <h2 className="font-display text-2xl uppercase text-texto">Área administrativa</h2>
        <p className="text-sm text-tenue">
          {t.estado.tipo === 'ok'
            ? corteReciente
              ? `Último corte cargado: ${corteReciente}. Toca una tarjeta para ver el detalle.`
              : 'Todavía no hay ningún corte cargado.'
            : 'Cómo va el negocio, de lo de hoy a lo más detallado.'}
        </p>
      </header>

      {puedePlan && (
        <TarjetaPlegable nombre="Hoy y calendario" frase="Tu plan de hoy, de la semana y de los 90 días.">
          <PlanHoyYCalendario />
        </TarjetaPlegable>
      )}

      {t.estado.tipo === 'cargando' && <Cargando texto="Cargando el área administrativa…" />}
      {t.estado.tipo === 'fallo' && (
        <FalloDeLectura texto={`No se pudo leer el área administrativa (${t.estado.error}).`} onReintentar={t.reintentar} />
      )}

      {t.estado.tipo === 'ok' && (
        <div role="group" aria-label="Filtro" className="flex items-center gap-2">
          {(
            [
              ['todo', 'Todo'],
              ['accion', `Requiere acción · ${pidenAccion}`],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
              className={`press min-h-[44px] rounded-full border px-4 text-xs font-bold ${
                filtro === id ? 'border-texto bg-texto text-bg' : 'border-linea text-texto'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      )}

      {t.estado.tipo === 'ok' && visibles.length === 0 && (
        <p className="rounded-tarjeta border border-dashed border-linea p-4 text-sm text-tenue">
          Ninguna sección pide acción en este corte.
        </p>
      )}

      {(t.estado.tipo === 'pendiente' || t.estado.tipo === 'ok') && (
        <>
          <RotuloGrupo titulo="Indicadores financieros y de operación" />
          {tarjeta('finanzas')}
          {tarjeta('plataforma')}
          <RotuloGrupo titulo="¿Cumplimos los objetivos?" nota="Riesgos financieros, operativos y de estrategia." />
          {tarjeta('plan')}
          {tarjeta('desvios')}
          <RotuloGrupo titulo="Lo que proponen los agentes" nota="Son propuestas: ninguna está aprobada hasta que Bryan o Manuela decidan." />
          {tarjeta('propuestas')}
        </>
      )}

      {t.estado.tipo === 'ok' && (
        <p className="text-[11.5px] text-tenue">
          Lo que dice «FALTA» no es cero: es un dato que nadie ha cargado todavía. Cada tarjeta indica quién debe aportar la información.{' '}
          <Link to="/" className="underline">
            Volver a Mi día
          </Link>
        </p>
      )}

      {puedeDecisiones && (
        <TarjetaPlegable nombre="Decisiones de Bryan y Manuela" frase="Lo que decidió cada uno, hacia dónde lleva y a quién le toca.">
          <DecisionesCompartidas puedeAnotar />
        </TarjetaPlegable>
      )}
    </div>
  )
}
