import { useSearchParams } from 'react-router-dom'
import { FalloDeLectura } from '../../../components/ui/FalloDeLectura'
import {
  contarQueRequierenAccion,
  seccionRequiereAccion,
  type Seccion,
  type SeccionLeida,
} from '../../../domain/adminTablero'
import { Cargando } from '../../plan/comun'
import { DecisionesCompartidas } from '../../equipo/DecisionesCompartidas'
import { Cabecera } from './Cabecera'
import { JornadaLaboral } from './JornadaLaboral'
import { RiesgosAdmin } from './RiesgosAdmin'
import { RotuloGrupo, TarjetaPlegable } from './TarjetaPlegable'
import { SeccionTablero } from './SeccionTablero'
import { useTableroAdmin } from './useTableroAdmin'
import type { EnlaceSeccion } from './TarjetaSeccion'

/**
 * ÁREA ADMINISTRATIVA (ESPEC-ADMINISTRACION-INTERACTIVA.md; orden pedido por Bryan el 30-sep),
 * de arriba abajo y todo plegado (una tarjeta por sección con una frase; al tocarla, el detalle):
 *
 *   1. Estrategias de la empresa: el plan de 90 días y la operación (sección «plan»).
 *   2. Calendario y agenda por horizonte (hoy, semana, 90 días, largo plazo) con el tiempo de trabajo
 *      de hoy: `JornadaLaboral`, sobre `plan_items`, sin duplicar «Mi plan».
 *   3. Indicadores financieros y de operación.
 *   4. Riesgos (financieros, operativos y de estrategia, desde las filas rojas del tablero) y desvíos.
 *   5. Lo que proponen los agentes: propuesta, nunca aprobación; pueden pedir «sentarse a revisar con Bryan».
 *   6. Al final, las decisiones de Bryan y Manuela, con dirección y responsable.
 *
 * Mi plan y las decisiones funcionan con lo que ya existe en la base (`organizar_plan`,
 * `decisiones_compartidas`). Las secciones del tablero (0102) solo se leen con `ver_administracion`:
 * sin ese permiso, o sin la tabla, salen como «Pendiente de activar (migración 0102)», nunca como
 * un cero ni un verde; un error de lectura se ve como error, distinto de «sin datos».
 */

/** Secciones del tablero que caen en Administración, en el orden de la pantalla. */
const SECCIONES_ADMIN: readonly Seccion[] = ['finanzas', 'plataforma', 'plan', 'desvios', 'propuestas']

type Filtro = 'todo' | 'accion'

export default function AdministracionPage() {
  const t = useTableroAdmin()
  // El filtro vive en la URL (no en `useState`): sobrevive a recargar y a volver, y el gesto
  // atrás sale de la pantalla en vez de deshacer el filtro. Se escribe con `replace`.
  const [parametros, setParametros] = useSearchParams()
  const filtro: Filtro = parametros.get('filtro') === 'accion' ? 'accion' : 'todo'
  const cambiarFiltro = (nuevo: Filtro) => {
    const siguientes = new URLSearchParams(parametros)
    if (nuevo === 'accion') siguientes.set('filtro', 'accion')
    else siguientes.delete('filtro')
    setParametros(siguientes, { replace: true })
  }

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
      <Cabecera
        rotulo="Empresa"
        titulo="Área administrativa"
        frase={
          t.estado.tipo === 'ok'
            ? corteReciente
              ? `Último corte cargado: ${corteReciente}. Toca una tarjeta para ver el detalle.`
              : 'Todavía no hay ningún corte cargado.'
            : 'Cómo va el negocio, de lo de hoy a lo más detallado.'
        }
      />

      {t.estado.tipo === 'cargando' && <Cargando texto="Cargando el área administrativa…" />}
      {t.estado.tipo === 'fallo' && (
        <FalloDeLectura texto={`No se pudo leer el área administrativa (${t.estado.error}).`} onReintentar={t.reintentar} />
      )}

      {t.estado.tipo === 'ok' && (
        <div role="group" aria-label="Filtro" className="flex gap-1.5 overflow-x-auto pb-0.5">
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
              onClick={() => cambiarFiltro(id)}
              className={`press flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold ${
                filtro === id ? 'border-texto bg-surface-3 text-texto' : 'border-linea bg-surface-1 text-tenue'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      )}

      {t.estado.tipo === 'ok' && filtro === 'accion' && visibles.length === 0 && (
        <p className="rounded-tarjeta border border-dashed border-linea p-4 text-sm text-tenue">
          Ninguna sección pide acción en este corte.
        </p>
      )}

      {(t.estado.tipo === 'pendiente' || t.estado.tipo === 'ok') && (
        <>
          <RotuloGrupo titulo="Estrategias de la empresa" nota="El plan de 90 días y la operación: si se está cumpliendo." />
          {tarjeta('plan')}
        </>
      )}

      {puedePlan && (
        <>
          <RotuloGrupo titulo="Calendario y agenda" nota="Hoy, esta semana y el largo plazo, con el tiempo de trabajo de hoy." />
          <TarjetaPlegable nombre="Jornada laboral" frase="Hoy, la semana, los 90 días y el largo plazo: las tareas las tachas tú y cada una dice a qué objetivo aporta.">
            <JornadaLaboral />
          </TarjetaPlegable>
        </>
      )}

      {(t.estado.tipo === 'pendiente' || t.estado.tipo === 'ok') && (
        <>
          <RotuloGrupo titulo="Indicadores financieros y de operación" nota="Cómo vamos, qué revisan los agentes y hacia dónde." />
          {tarjeta('finanzas')}
          {tarjeta('plataforma')}
          <RotuloGrupo titulo="Riesgos y desvíos" nota="Financieros, operativos y de estrategia: lo que está en rojo y lo que se sale de lo estandarizado." />
          <RiesgosAdmin t={t} />
          {tarjeta('desvios')}
          <RotuloGrupo
            titulo="Lo que proponen los agentes"
            nota="Son propuestas para cambiar o para «sentarse a revisar con Bryan»: ninguna está aprobada hasta que Bryan o Manuela decidan."
          />
          {tarjeta('propuestas')}
        </>
      )}

      {t.estado.tipo === 'ok' && (
        <p className="text-[11.5px] text-tenue">
          Lo que dice «FALTA» no es cero: es un dato que nadie ha cargado todavía. Cada tarjeta indica quién debe aportar la información.
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
