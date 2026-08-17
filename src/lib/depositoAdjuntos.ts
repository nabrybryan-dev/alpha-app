/**
 * Los bytes de los adjuntos que todavía no han subido.
 *
 * **Por qué IndexedDB y no `localStorage`.** Todo el almacén local de la app vive
 * en UNA clave de `localStorage` (`mockDb.ts`), y el límite del origen ronda los
 * 5 MB. Una foto comprimida son ~250 KB y un video, megas. Si el archivo entrara
 * ahí, desbordar la cuota no perdería la foto: perdería la clave entera, con los
 * microciclos y las series dentro.
 *
 * Este es el ÚNICO archivo que abre esta base. Quien necesite un adjunto
 * pendiente pasa por aquí.
 */

const BASE = 'alpha-adjuntos'
const ALMACEN = 'pendientes'

/**
 * Se guardan los BYTES y el tipo, no el `Blob`.
 *
 * Un `Blob` sí se puede meter en IndexedDB sobre el papel, pero al recuperarlo
 * no siempre vuelve entero: en los tests reaparece sin sus métodos, y Safari
 * arrastra fallos conocidos guardando blobs. Un `ArrayBuffer` se clona igual en
 * todas partes, y reconstruir el `Blob` al leer cuesta una línea.
 */
interface Guardado {
  id: string
  datos: ArrayBuffer
  tipo: string
  duenio: string
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(BASE, 1)
    peticion.onupgradeneeded = () => {
      if (!peticion.result.objectStoreNames.contains(ALMACEN)) {
        peticion.result.createObjectStore(ALMACEN, { keyPath: 'id' })
      }
    }
    peticion.onsuccess = () => resolver(peticion.result)
    peticion.onerror = () => rechazar(new Error('No se pudo abrir el depósito de adjuntos'))
  })
}

async function conAlmacen<T>(
  modo: IDBTransactionMode,
  trabajo: (almacen: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const base = await abrir()
  return new Promise<T>((resolver, rechazar) => {
    const transaccion = base.transaction(ALMACEN, modo)
    const peticion = trabajo(transaccion.objectStore(ALMACEN))
    peticion.onsuccess = () => resolver(peticion.result)
    peticion.onerror = () => rechazar(new Error('Falló el depósito de adjuntos'))
    transaccion.oncomplete = () => base.close()
  })
}

export async function guardar(id: string, blob: Blob, duenio: string): Promise<void> {
  const datos = await blob.arrayBuffer()
  await conAlmacen('readwrite', (a) => a.put({ id, datos, tipo: blob.type, duenio } satisfies Guardado))
}

export async function leer(id: string): Promise<Blob | undefined> {
  const fila = await conAlmacen<Guardado | undefined>('readonly', (a) => a.get(id))
  if (!fila) return undefined
  return new Blob([fila.datos], { type: fila.tipo })
}

export function borrar(id: string): Promise<unknown> {
  return conAlmacen('readwrite', (a) => a.delete(id))
}

export async function pendientesDe(usuarioId: string): Promise<string[]> {
  const todas = await conAlmacen<Guardado[]>('readonly', (a) => a.getAll())
  return todas.filter((f) => f.duenio === usuarioId).map((f) => f.id)
}

/** Solo para los tests y para el cierre de sesión. */
export function vaciarDeposito(): Promise<unknown> {
  return conAlmacen('readwrite', (a) => a.clear())
}

/** Si el navegador no lo soporta o está lleno, el texto tiene que seguir funcionando. */
export function depositoDisponible(): boolean {
  return typeof indexedDB !== 'undefined'
}
