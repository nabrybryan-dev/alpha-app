/**
 * El camino de LECTURA: lo que bajó del servidor con las escrituras locales
 * pendientes puestas encima.
 *
 * Lee la cola (`cola.ts`) y no la modifica nunca. Está separado del procesador a
 * propósito: son dos direcciones distintas del mismo dato —bajar y subir— y
 * mezclarlas en un archivo es lo que hacía difícil ver de dónde salía cada
 * pérdida.
 */
import { leerCola } from './cola'
import { modoNube } from '../supabase'

/**
 * Identidad de una fila, venga del servidor o de la cola.
 *
 * Las dos formas tienen que resolverse IGUAL o la fusión no encontraría el par.
 * Unas tablas se descargan con `select('datos')` (la fila es `{datos}` y el id
 * vive dentro, en camelCase del dominio) y otras con `select('*')` (columnas
 * reales, en snake_case). Se miran las dos.
 */
function identidadDeFila(fila: Record<string, unknown>): string | undefined {
  const datos = fila.datos
  if (datos && typeof datos === 'object') {
    const d = datos as Record<string, unknown>
    if (typeof d.id === 'string') return d.id
    if (typeof d.usuarioId === 'string') return d.usuarioId
  }
  if (typeof fila.id === 'string') return fila.id
  if (typeof fila.usuario_id === 'string') return fila.usuario_id
  return undefined
}

function cumpleFiltro(
  fila: Record<string, unknown>,
  filtro: Record<string, string> | undefined,
): boolean {
  return Object.entries(filtro ?? {}).every(([columna, valor]) => fila[columna] === valor)
}

/**
 * Las filas descargadas del servidor con las escrituras locales PENDIENTES
 * puestas encima.
 *
 * La cola es, por definición, lo que este dispositivo escribió y el servidor
 * todavía no tiene: cualquier operación que siga en ella es más nueva que la
 * fila que acaba de bajar. Sin esta fusión, la foto del servidor —leída ANTES
 * de que la persona tocara "guardar serie"— vuelve a la base local y borra todo
 * lo que se escribió mientras la descarga estaba en vuelo. Con wifi de gimnasio
 * esa ventana son decenas de segundos, y `SIGNED_IN` la abre cada vez que se
 * desbloquea el móvil entre series.
 *
 * Que la cola gane no es solo para no perder el dato en pantalla: si el estado
 * local se pisa, la escritura SIGUIENTE reconstruye su envío leyendo ese estado
 * ya pisado y reemplaza en la cola la operación buena. Ahí la pérdida deja de
 * ser un susto visual y se vuelve definitiva.
 */
export function conPendientes<T>(tabla: string, filas: readonly T[]): T[] {
  if (!modoNube) return [...filas]
  const ops = leerCola().filter((o) => o.tabla === tabla)
  if (ops.length === 0) return [...filas]

  let salida = [...filas] as Record<string, unknown>[]
  for (const op of ops) {
    if (op.tipo === 'update') {
      // Un update es un parche sobre las filas que cumplen su filtro (marcar
      // leído un hilo), no una fila completa: se aplica encima, no reemplaza.
      salida = salida.map((f) => (cumpleFiltro(f, op.filtro) ? { ...f, ...op.payload } : f))
      continue
    }
    const clave = identidadDeFila(op.payload)
    if (clave === undefined) continue
    const i = salida.findIndex((f) => identidadDeFila(f) === clave)
    // Si no está en la descarga es una fila creada en este dispositivo que el
    // servidor aún no conoce (el check-in de hoy): se añade, no se descarta.
    salida = i === -1 ? [...salida, op.payload] : salida.map((f, j) => (j === i ? op.payload : f))
  }
  return salida as T[]
}
