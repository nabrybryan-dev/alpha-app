import { Badge } from '../../../../components/ui/Badge'
import { fechaCorta, serieDeCheckins } from '../../../../domain/consolaCoach/perfilCompleto'
import { SeccionCribado } from '../ficha/SeccionPerfil'
import { GraficaLinea } from '../graficas'
import { PendienteDeCadena } from '../PendienteDeCadena'
import { Falta, Tarjeta } from '../piezas'
import { usePersona } from '../usePersona'

/**
 * Módulo 5: cribado con su semáforo, sueño y dolor en el tiempo (de los check-ins),
 * check-ins recientes con todas sus señales, cardio concurrente del microciclo activo, y
 * vacío honesto para lo que no tiene tabla (marcadores cardiorrespiratorios, postura).
 */

const TONO_CANTIDAD = { POCO: 'verde', REGULAR: 'neutro', MUCHO: 'rojo' } as const
const TONO_CUALI = { BUENA: 'verde', REGULAR: 'neutro', MALA: 'rojo' } as const

function Senal({ etiqueta, valor, tono }: { etiqueta: string; valor: string | undefined; tono: 'verde' | 'neutro' | 'rojo' | undefined }) {
  if (!valor) return null
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="text-tenue">{etiqueta}</span>
      <Badge tono={tono ?? 'neutro'}>{valor.toLowerCase()}</Badge>
    </span>
  )
}

export function CondicionSaludTab({ usuarioId }: { usuarioId: string }) {
  const datos = usePersona(usuarioId)
  const { activo, checkins } = datos
  const recientes = [...checkins].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10)
  const bloquesCardio = (activo?.sesiones ?? []).flatMap((s) => s.bloquesCardio ?? [])
  const sueno = serieDeCheckins(checkins, 'horasSueno')
  const dolor = serieDeCheckins(checkins, 'dolor')

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      <SeccionCribado datos={datos} i={0} className="xl:col-span-5" />

      <Tarjeta titulo="Sueño y dolor (check-in)" i={1} className="xl:col-span-7">
        {sueno.length === 0 && dolor.length === 0 ? (
          <Falta
            que="Ningún check-in trae horas de sueño ni dolor"
            como="Se llenan con el check-in diario («¿Cuánto dormiste?» y «Dolor de hoy», 0 a 10)."
          />
        ) : (
          <div className={`grid grid-cols-1 gap-3 ${sueno.length && dolor.length ? "lg:grid-cols-2" : ""}`}>
            <div>
              <p className="mb-1 text-[11px] font-bold text-tenue">Horas de sueño</p>
              {sueno.length ? (
                <GraficaLinea series={[{ nombre: 'Sueño', puntos: sueno }]} unidad="h" alto={170} descripcion={`Horas de sueño: ${sueno.length} noches.`} />
              ) : (
                <p className="text-[12px] text-tenue">Sin horas de sueño registradas.</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold text-tenue">Dolor (0-10)</p>
              {dolor.length ? (
                <GraficaLinea series={[{ nombre: 'Dolor', puntos: dolor }]} unidad="/10" alto={170} descripcion={`Dolor: ${dolor.length} registros.`} />
              ) : (
                <p className="text-[12px] text-tenue">Sin dolor registrado (el campo existe desde septiembre).</p>
              )}
            </div>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo={`Check-ins recientes (${checkins.length} en total)`} i={2} className="xl:col-span-8">
        {recientes.length === 0 ? (
          <Falta que="Sin check-ins registrados." como="Los hace la persona desde Hoy; el coach los ve aquí al sincronizar." />
        ) : (
          <ul className="flex flex-col text-xs">
            {recientes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-linea py-1.5 first:border-0 first:pt-0">
                <span className="cifras w-14 font-bold text-texto">{fechaCorta(c.fecha)}</span>
                {c.pesoKg !== undefined && <span className="cifras text-texto">{c.pesoKg} kg</span>}
                {c.horasSueno !== undefined && <span className="cifras text-tenue">{c.horasSueno} h sueño</span>}
                {c.pasos !== undefined && <span className="cifras text-tenue">{c.pasos.toLocaleString('es-CO')} pasos</span>}
                {c.dolor !== undefined && (
                  <span className={`cifras ${c.dolor >= 5 ? 'font-bold text-rojo' : 'text-tenue'}`}>dolor {c.dolor}/10</span>
                )}
                <Senal etiqueta="estrés" valor={c.estres} tono={c.estres ? TONO_CANTIDAD[c.estres] : undefined} />
                <Senal etiqueta="cansancio" valor={c.cansancio} tono={c.cansancio ? TONO_CANTIDAD[c.cansancio] : undefined} />
                <Senal etiqueta="calidad sueño" valor={c.calidadSueno} tono={c.calidadSueno ? TONO_CUALI[c.calidadSueno] : undefined} />
                {c.entreno && <span className="min-w-0 truncate text-tenue">«{c.entreno}»</span>}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo={`Cardio concurrente · M${activo?.numero ?? '—'}`} i={3} className="xl:col-span-4">
        {bloquesCardio.length === 0 ? (
          <Falta
            que="Sin bloques de cardio prescritos en el microciclo activo."
            como="Salen de los bloques de cardio de cada sesión de la semana cargada."
          />
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {bloquesCardio.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span className="text-texto/90">{b.titulo}</span>
                <Badge tono={b.hechoEn ? 'verde' : 'neutro'}>{b.hechoEn ? 'Hecho' : 'Sin marcar'}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <div className="xl:col-span-12">
        <PendienteDeCadena
          titulo="Marcadores cardiorrespiratorios, factores de riesgo y evaluación postural"
          detalle="No hay hoy tabla de origen para VO2/FC de reposo, el inventario de factores de riesgo ni la evaluación postural (observación ≠ hipótesis ≠ intervención, protocolo todavía sin escribir). Llega cuando la cadena sincronice."
        />
      </div>
    </div>
  )
}
