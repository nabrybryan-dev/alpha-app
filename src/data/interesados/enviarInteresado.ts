import type { EnvioInteresado } from '../../domain/interesados/formulario'
import { modoNube, supabase } from '../supabase'

/**
 * Guarda el formulario de un interesado que llega por un creador (migración 0089).
 *
 * Dos filas, dos destinos del mapa de datos (`bola-de-nieve/legal/MAPA-DE-DATOS.md`):
 *   - `piloto_encaje_respuestas` (SB): las 3 respuestas, solo códigos de opción.
 *   - `piloto_autorizaciones` (EVI): la evidencia de la autorización — versión del texto,
 *     canal, las cuatro casillas y la declaración. La FECHA la pone el servidor (un
 *     trigger pisa lo que mande el navegador), porque la prueba no puede depender del
 *     reloj del teléfono.
 *
 * El formulario es PÚBLICO: va con la anon key y sin sesión. RLS solo le deja INSERTAR
 * en esas dos tablas y nunca leer, así que aquí no hay `.select()` después del insert
 * (pediría `return=representation` y el servidor lo negaría).
 *
 * Orden: primero el encaje y después la autorización. Si la segunda falla, el reintento
 * vuelve a mandar las dos con el MISMO `envioId`; el duplicado del encaje (23505) se da
 * por bueno y se sigue con la autorización. Mientras no haya fila de autorización, cuenta
 * como «no» en las cuatro casillas (PASO-A-PASO, paso 5): el hueco es seguro.
 */

export interface FilaEncaje {
  envio_id: string
  codigo: string | null
  cliente_id: string | null
  p1_dias: string
  p1_horarios: string
  p2_lugar: string
  p2_modalidad: string
  p3_expectativa: string
}

export interface FilaAutorizacion {
  envio_id: string
  cliente_id: string | null
  version_autorizacion: string
  canal: 'formulario'
  casilla_a: 'si' | 'no'
  casilla_b: 'si' | 'no'
  casilla_c: 'si' | 'no'
  casilla_d: 'si' | 'no'
  declaracion_aceptada: true
}

export function filasDelEnvio(envio: EnvioInteresado): {
  encaje: FilaEncaje
  autorizacion: FilaAutorizacion
} {
  const { casillas } = envio.autorizacion
  return {
    encaje: {
      envio_id: envio.envioId,
      codigo: envio.codigo,
      cliente_id: envio.clienteId,
      p1_dias: envio.encaje.p1Dias,
      p1_horarios: envio.encaje.p1Horarios,
      p2_lugar: envio.encaje.p2Lugar,
      p2_modalidad: envio.encaje.p2Modalidad,
      p3_expectativa: envio.encaje.p3Expectativa,
    },
    autorizacion: {
      envio_id: envio.envioId,
      cliente_id: envio.clienteId,
      version_autorizacion: envio.autorizacion.version,
      canal: envio.autorizacion.canal,
      casilla_a: casillas.A,
      casilla_b: casillas.B,
      casilla_c: casillas.C,
      casilla_d: casillas.D,
      declaracion_aceptada: true,
    },
  }
}

/** Inserta una fila y devuelve el código de error de Postgres, o null si entró. */
export type Insertar = (tabla: string, fila: object) => Promise<string | null>

const insertarEnNube: Insertar = async (tabla, fila) => {
  const { error } = await supabase().from(tabla).insert(fila)
  return error ? (error.code ?? 'desconocido') : null
}

// ─── Modo demo (y tests): un almacén en memoria, sin nada en el teléfono ────

interface GuardadoDemo {
  encaje: FilaEncaje[]
  autorizaciones: (FilaAutorizacion & { fecha_hora: string })[]
}

const demo: GuardadoDemo = { encaje: [], autorizaciones: [] }

const insertarEnDemo: Insertar = async (tabla, fila) => {
  if (tabla === 'piloto_encaje_respuestas') {
    const f = fila as FilaEncaje
    if (demo.encaje.some((e) => e.envio_id === f.envio_id)) return '23505'
    demo.encaje = [...demo.encaje, { ...f }]
  } else {
    const f = fila as FilaAutorizacion
    if (demo.autorizaciones.some((a) => a.envio_id === f.envio_id)) return '23505'
    // En la nube la fecha la pone el servidor; aquí hace de servidor el almacén.
    demo.autorizaciones = [...demo.autorizaciones, { ...f, fecha_hora: new Date().toISOString() }]
  }
  return null
}

/** Copia de lo guardado en modo demo. Solo para tests y para ver la demo. */
export function guardadoEnDemo(): GuardadoDemo {
  return { encaje: [...demo.encaje], autorizaciones: [...demo.autorizaciones] }
}

export function vaciarDemo(): void {
  demo.encaje = []
  demo.autorizaciones = []
}

export class ErrorAlGuardar extends Error {}

export async function enviarInteresado(
  envio: EnvioInteresado,
  insertar: Insertar = modoNube ? insertarEnNube : insertarEnDemo,
): Promise<'guardado'> {
  const filas = filasDelEnvio(envio)
  const errorEncaje = await insertar('piloto_encaje_respuestas', filas.encaje)
  if (errorEncaje && errorEncaje !== '23505') {
    throw new ErrorAlGuardar(`encaje: ${errorEncaje}`)
  }
  const errorAutorizacion = await insertar('piloto_autorizaciones', filas.autorizacion)
  if (errorAutorizacion && errorAutorizacion !== '23505') {
    throw new ErrorAlGuardar(`autorizacion: ${errorAutorizacion}`)
  }
  return 'guardado'
}
