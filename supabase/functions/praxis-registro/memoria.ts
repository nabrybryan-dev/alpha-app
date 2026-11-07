// La memoria de la charla entre días (0166, aplicada el 7-nov-2026). Qué se guarda: src/domain/praxis/charla/memoria.ts.
//
// EXCEPCIÓN CONSCIENTE a «nunca con service_role» (cabecera de index.ts): la 0166 no deja insertar a nadie con sesión,
// para que nadie escriba turnos con rol 'praxis' ni apague las banderas de riesgo (custodio de datos, hallazgo 4). Aquí
// el usuario sale SIEMPRE de la sesión ya validada (`s.usuarioId`), nunca del cuerpo, y la única tabla que se toca es
// `praxis_charla_turnos`, solo con insert. Apagado salvo PRAXIS_GUARDAR_CHARLA=1. Nunca rompe la respuesta y el log
// no lleva la frase: solo el estado.
import { filasDeTurno, leerMarcaCharla } from '../../../src/domain/praxis/charla/memoria.ts'

const TIMEOUT_MS = 2500

export interface EntornoMemoria {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  PRAXIS_GUARDAR_CHARLA?: string
}

/** Lo único que esta función lee del entorno además de lo común: el interruptor y la clave. Así index.ts no la nombra. */
export function entornoMemoria(get: (k: string) => string | undefined): Pick<EntornoMemoria, 'PRAXIS_GUARDAR_CHARLA' | 'SUPABASE_SERVICE_ROLE_KEY'> {
  return { PRAXIS_GUARDAR_CHARLA: get('PRAXIS_GUARDAR_CHARLA'), SUPABASE_SERVICE_ROLE_KEY: get('SUPABASE_SERVICE_ROLE_KEY') }
}

export interface TurnoParaMemoria {
  marcaBruta: unknown
  frase: string
  /** Lo que contestó Praxis: la primera con texto (la charla del modelo antes que la respuesta de la propuesta). */
  respuestas: (string | null | undefined)[]
  clinico: boolean
  aviso: boolean
}

export async function guardarTurnoCharla(
  d: { entorno: EntornoMemoria; fetch: typeof fetch }, usuarioId: string, t: TurnoParaMemoria,
): Promise<void> {
  try {
    const clave = d.entorno.SUPABASE_SERVICE_ROLE_KEY
    if (d.entorno.PRAXIS_GUARDAR_CHARLA !== '1') return
    if (!clave) { console.log('praxis-registro: memoria sin_clave'); return } // encendida sin clave: que se note en los registros
    const marca = leerMarcaCharla(t.marcaBruta)
    if (!marca) return
    const filas = filasDeTurno({ usuarioId, marca, frase: t.frase, respuesta: t.respuestas.find((x) => typeof x === 'string' && x.trim() !== '') ?? null, clinico: t.clinico, aviso: t.aviso })
    if (!filas.length) return
    const r = await d.fetch(`${d.entorno.SUPABASE_URL}/rest/v1/praxis_charla_turnos?on_conflict=usuario_id,charla_id,n`, {
      method: 'POST',
      headers: {
        apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json',
        prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify(filas),
    })
    console.log('praxis-registro: memoria', r.ok ? 'ok' : `http_${r.status}`)
  } catch (e) {
    console.log('praxis-registro: memoria', `error_${e instanceof Error ? e.name : 'desconocido'}`)
  }
}
