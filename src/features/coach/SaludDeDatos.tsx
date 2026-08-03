import { Card } from '../../components/ui/Card'
import { db, hoyIso, idCoach } from '../../data/dbInstance'
import {
  familiasEnRiesgo,
  saludDeDatos,
  UMBRAL_ATRASO_DIAS,
  VENTANA_DIAS,
  type EstadoSalud,
  type FamiliaDeDatos,
  type SaludDeFamilia,
} from '../../domain/saludDeDatos'

const COLOR: Record<EstadoSalud, string> = {
  'al-dia': 'text-verde',
  atrasado: 'text-ambar',
  'sin-datos': 'text-rojo',
}

const ETIQUETA: Record<EstadoSalud, string> = {
  'al-dia': 'Al día',
  atrasado: 'Atrasado',
  'sin-datos': 'Nunca llegó',
}

/** Fechas de los últimos N días para no recorrer el histórico entero. */
function ultimasFechas(dias: number, hoy: string): string[] {
  const base = new Date(`${hoy}T00:00:00`).getTime()
  return Array.from({ length: dias + 1 }, (_, i) => {
    const d = new Date(base - i * 24 * 60 * 60 * 1000)
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, '0')}`
  })
}

/**
 * Junta, de TODO el equipo, las fechas en que llegó cada familia de dato.
 *
 * No mide adherencia: mide si el canal está vivo. Que una persona no registre
 * es normal; que no registre nadie, nunca, es una avería.
 */
function familiasDelEquipo(hoy: string): FamiliaDeDatos[] {
  const gente = db.usuarios.entrenan()
  const ventana = ultimasFechas(VENTANA_DIAS + UMBRAL_ATRASO_DIAS, hoy)
  const coach = idCoach()

  const comidas: string[] = []
  const checkins: string[] = []
  const adherencias: string[] = []
  const calibraciones: string[] = []
  const mensajes: string[] = []

  for (const persona of gente) {
    for (const fecha of ventana) {
      if (db.registroComidas.delDia(persona.id, fecha).length > 0) comidas.push(fecha)
    }
    checkins.push(...db.bienestar.byUsuario(persona.id).map((c) => c.fecha))
    adherencias.push(...db.nutricion.adherenciasByUsuario(persona.id).map((a) => a.fecha))
    calibraciones.push(...db.calibracion.byUsuario(persona.id).map((p) => p.fecha))
    mensajes.push(...db.mensajes.hilo(persona.id, coach).map((m) => m.fechaIso.slice(0, 10)))
  }

  return [
    { id: 'comidas', nombre: 'Registro de comidas', fechas: comidas },
    { id: 'checkins', nombre: 'Check-ins', fechas: checkins },
    { id: 'adherencia', nombre: 'Adherencia nutricional', fechas: adherencias },
    { id: 'calibracion', nombre: 'Pruebas de calibración', fechas: calibraciones },
    { id: 'mensajes', nombre: 'Mensajes', fechas: mensajes },
  ]
}

function Fila({ familia }: { familia: SaludDeFamilia }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-linea py-2 last:border-0">
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-texto">{familia.nombre}</span>
        <span className="block text-xs text-tenue">
          {familia.ultimo === undefined
            ? 'Sin un solo registro'
            : familia.diasSinRegistrar === 0
              ? `${familia.recientes} en los últimos ${VENTANA_DIAS} días · el último, hoy`
              : `${familia.recientes} en los últimos ${VENTANA_DIAS} días · el último, hace ${familia.diasSinRegistrar} d`}
        </span>
      </span>
      <span className={`shrink-0 text-[11px] font-bold uppercase tracking-wide ${COLOR[familia.estado]}`}>
        {ETIQUETA[familia.estado]}
      </span>
    </div>
  )
}

/**
 * ¿Está llegando lo que la gente registra?
 *
 * El registro de comidas estuvo roto semanas sin que nadie lo viera: la app
 * guardaba en el teléfono y la subida fallaba en silencio. Este bloque existe
 * para que ese cero se vea al día siguiente y no al mes.
 */
export function SaludDeDatos() {
  const hoy = hoyIso()
  const salud = saludDeDatos(familiasDelEquipo(hoy), hoy)
  const enRiesgo = familiasEnRiesgo(salud)

  if (salud.sinEstrenar) return null

  return (
    <Card destacada={enRiesgo.length > 0}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="kicker">Salud de los datos</p>
        {enRiesgo.length === 0 && (
          <span className="text-[11px] font-bold uppercase tracking-wide text-verde">
            Todo llegando
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-col">
        {salud.familias.map((familia) => (
          <Fila key={familia.id} familia={familia} />
        ))}
      </div>

      {enRiesgo.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-tenue">
          Un dato que no llega no siempre significa que nadie lo registre: puede estar
          guardado en el teléfono sin subir. Si una familia lleva días en cero para todo
          el equipo, revísalo antes de dar por hecho que nadie la usa.
        </p>
      )}
    </Card>
  )
}
