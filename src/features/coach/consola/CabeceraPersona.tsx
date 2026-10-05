import type { CSSProperties } from 'react'
import type { CadenaCorrida, EstadoCadenaCorrida } from '../../../data/consola/cadenaCorridas'
import { resumenMicrociclo, type Semaforo } from '../../../domain/cumplimiento'
import { filaDeLaPersona } from '../../../domain/consolaCoach/tableroAgentes'
import { fechaCorta, leerCribado, partirObjetivo, seriePeso, tendencia } from '../../../domain/consolaCoach/perfilCompleto'
import { Kpi } from './piezas'
import type { DatosPersona } from './usePersona'

/**
 * La cabecera de la persona: quién es y cinco cifras que se leen de un vistazo (principio
 * «el número primario, grande y arriba»). Se queda fija mientras se cambia de pestaña, así
 * que cambiar de pestaña no hace perder de quién se habla.
 */

const NOMBRE_PASO = { 1: '① Valoración', 2: '② Planificación', 3: '③ Prescripción', 4: '④ Ejecución' } as const

const ESTADO_CADENA: Record<EstadoCadenaCorrida, { texto: string; tono: 'verde' | 'rojo' | 'ambar' | 'azul' }> = {
  completado: { texto: 'completado', tono: 'verde' },
  fallido: { texto: 'fallido', tono: 'rojo' },
  descartado: { texto: 'descartado', tono: 'ambar' },
  en_curso: { texto: 'en curso', tono: 'azul' },
}

function diaDelMicrociclo(fechaInicio: string, hoy: string): number {
  const d = (new Date(`${hoy}T00:00:00Z`).getTime() - new Date(`${fechaInicio}T00:00:00Z`).getTime()) / 86_400_000
  return Math.floor(d) + 1
}

function ultimoPaso(usuarioId: string, corridas: readonly CadenaCorrida[]): CadenaCorrida | undefined {
  const fila = filaDeLaPersona(usuarioId, corridas)
  return ([4, 3, 2, 1] as const).map((p) => fila.pasos[p]).find(Boolean)
}

function formatoDelta(delta: number, unidad: string): string {
  if (delta === 0) return `= estable`
  return `${delta > 0 ? '▲ +' : '▼ '}${delta.toFixed(1)} ${unidad}`
}

interface CabeceraPersonaProps {
  datos: DatosPersona
  semaforo: Semaforo | undefined
}

export function CabeceraPersona({ datos, semaforo }: CabeceraPersonaProps) {
  const { usuario, perfil, activo, hoy } = datos
  if (!usuario) return null

  const objetivo = partirObjetivo(perfil?.objetivos)
  const titular = objetivo.titular ?? objetivo.apartados[0]?.titulo ?? objetivo.apartados[0]?.texto
  const adh = activo ? resumenMicrociclo(activo) : undefined
  const peso = tendencia(seriePeso(datos.checkins, perfil?.medidas ?? [], datos.perfilNutricion))
  const cribado = leerCribado(datos.cribado)
  const paso = datos.corridas.estado === 'listo' ? ultimoPaso(usuario.id, datos.corridas.valor) : undefined
  const dia = activo ? diaDelMicrociclo(activo.fechaInicio, hoy) : undefined

  const tonoRiesgo =
    semaforo?.color === 'rojo' || cribado.color === 'rojo'
      ? 'rojo'
      : semaforo?.color === 'ambar' || cribado.color === 'ambar'
        ? 'ambar'
        : semaforo
          ? 'verde'
          : 'neutro'

  return (
    <header className="consola-cabecera flex flex-col gap-3" aria-label={`Resumen de ${usuario.nombre}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="kicker">{usuario.rol === 'asesorado' ? 'Asesorado' : 'Staff que entrena'}</p>
          <h2 className="font-display mt-0.5 truncate text-[26px] leading-none text-texto lg:text-[32px]">
            {usuario.nombre}
          </h2>
        </div>
        {titular && (
          <p className="max-w-xl truncate text-sm text-tenue" title={titular}>
            {titular.length > 110 ? `${titular.slice(0, 110)}…` : titular}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi
          i={0}
          etiqueta="Semana"
          valor={activo?.numero}
          detalle={
            activo && dia !== undefined
              ? `M${activo.numero} · día ${Math.max(1, Math.min(dia, activo.cadenciaDias))} de ${activo.cadenciaDias} · desde ${fechaCorta(activo.fechaInicio)}`
              : undefined
          }
          sinDato="Sin microciclo activo: se carga desde la cadena el lunes."
          tono={activo ? 'azul' : 'rojo'}
        />
        <Kpi
          i={1}
          etiqueta="Adherencia"
          valor={adh?.pctRegistrado}
          sufijo="%"
          detalle={adh ? `${adh.sesionesRegistradas} de ${adh.sesionesTotales} sesiones hechas` : undefined}
          sinDato="Sin semana activa que medir."
          tono={!adh ? 'neutro' : adh.pctRegistrado >= 80 ? 'verde' : adh.pctRegistrado >= 50 ? 'ambar' : 'rojo'}
        />
        <Kpi
          i={2}
          etiqueta="Peso"
          valor={peso?.ultimo.valor}
          decimales={1}
          sufijo="kg"
          detalle={
            peso
              ? `${peso.delta !== undefined ? `${formatoDelta(peso.delta, 'kg')} en 4 sem · ` : ''}${fechaCorta(peso.ultimo.fecha)}`
              : undefined
          }
          sinDato="Sin peso en check-ins, medidas ni formulario."
          tono="neutro"
        />
        <KpiEstado
            i={3}
            etiqueta="Riesgo"
            texto={semaforo ? semaforo.motivo : 'Sin semáforo'}
            detalle={
              datos.cribado
                ? `Cribado: ${cribado.motivo.toLowerCase()}`
                : datos.lecturaRecortada
                  ? 'Cribado: tu permiso no alcanza.'
                  : 'Cribado: sin contestar.'
            }
            tono={tonoRiesgo}
          />
        <KpiEstado
          i={4}
          etiqueta="Cadena"
          texto={
            datos.corridas.estado === 'cargando'
              ? 'Cargando…'
              : paso
                ? `${NOMBRE_PASO[paso.paso]} · ${ESTADO_CADENA[paso.estado].texto}`
                : 'Sin corrida'
          }
          detalle={paso ? `Semana del ${fechaCorta(paso.semanaInicio)}` : 'La cadena todavía no ha escrito a esta persona.'}
          tono={paso ? ESTADO_CADENA[paso.estado].tono : 'neutro'}
        />
      </div>
    </header>
  )
}

const TONO_BARRA = { rojo: 'bg-rojo', ambar: 'bg-ambar', verde: 'bg-verde', azul: 'bg-azul', neutro: 'bg-linea' } as const

function KpiEstado({
  etiqueta,
  texto,
  detalle,
  tono,
  i,
}: {
  etiqueta: string
  texto: string
  detalle: string
  tono: keyof typeof TONO_BARRA
  i: number
}) {
  return (
    <div className="consola-tarjeta h-full min-w-0" style={{ '--i': i } as CSSProperties}>
      <div className="relieve relative h-full overflow-hidden rounded-tarjeta border border-hairline bg-surface-2/70 px-3.5 py-3">
        <span className={`absolute inset-x-0 top-0 h-[3px] ${TONO_BARRA[tono]}`} aria-hidden="true" />
        <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-tenue">{etiqueta}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[15px] font-bold leading-tight text-texto">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONO_BARRA[tono]}`} aria-hidden="true" />
          <span className="min-w-0 truncate" title={texto}>
            {texto}
          </span>
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-tenue">{detalle}</p>
      </div>
    </div>
  )
}
