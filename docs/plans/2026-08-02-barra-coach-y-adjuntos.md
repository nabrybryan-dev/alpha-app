# Barra del coach y adjuntos reales — plan de implementación

> **Para quien ejecute:** los pasos usan casillas (`- [ ]`) para ir marcando. Cada tarea
> termina en verde y en un commit: se puede parar entre tareas sin dejar el repo roto.

**Objetivo:** que el asesorado pueda escribirle al coach desde la cabecera de Hoy y
mandarle una foto o un video que **de verdad llegue**.

**Arquitectura:** el mensaje se escribe primero en el almacén local y se pinta al momento;
los bytes del archivo van a IndexedDB (no a `localStorage`, que es donde vive el almacén
entero y desbordarlo lo perdería todo); el procesador de la cola sube el archivo a un
bucket privado de Supabase Storage y solo entonces encola la fila del mensaje con su
`path`. El `Blob` no se borra hasta que la fila está confirmada arriba.

**Stack:** React 19 + TypeScript estricto + Vite + Tailwind v3 + Supabase. Tests con
vitest y Testing Library. Sin binarios nativos (restricción WDAC del equipo).

**Spec:** [2026-08-02-barra-coach-y-adjuntos-diseno.md](../specs/2026-08-02-barra-coach-y-adjuntos-diseno.md)

---

## Nota sobre "test en rojo primero"

El repo tiene la costumbre de commitear el test que documenta un fallo en rojo y arreglarlo
después. Aquí **no** se hace: el fallo (el adjunto que finge) se sustituye a lo largo de
nueve tareas, y un test en rojo durante nueve commits deja el CI en rojo todo ese rato.
El comportamiento viejo se retira en la tarea 8, y ahí entran los tests que afirman el
comportamiento nuevo.

---

## Tarea 0: Preparar el entorno de test para IndexedDB

**Archivos:**
- Modificar: `package.json`
- Modificar: `src/test/setup.ts`

- [ ] **Paso 1: Instalar la dependencia**

```bash
npm install --save-dev fake-indexeddb@6
```

`fake-indexeddb` es JavaScript puro, sin `.node` ni `.exe`. jsdom no implementa IndexedDB,
así que sin esto los tests de la tarea 2 no pueden correr.

- [ ] **Paso 2: Cargarlo en el setup de los tests**

Añadir al principio de `src/test/setup.ts`, antes de cualquier otro import:

```ts
import 'fake-indexeddb/auto'
```

- [ ] **Paso 3: Comprobar que no se rompió nada**

```bash
npm run verify
```

Esperado: verde, con el mismo número de tests que antes.

- [ ] **Paso 4: Commit**

```bash
git add package.json package-lock.json src/test/setup.ts
git commit -m "chore: IndexedDB en los tests, para poder guardar archivos sin señal"
```

---

## Tarea 1: Reglas de qué archivo se acepta

Lógica pura: qué tipos valen, qué tamaño se admite y a qué tamaño se reduce una imagen.
Va en `domain/` porque es regla de negocio y no toca ni React ni red.

**Archivos:**
- Crear: `src/domain/adjuntos.ts`
- Test: `src/domain/adjuntos.test.ts`

- [ ] **Paso 1: Escribir el test que falla**

`src/domain/adjuntos.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { dimensionesDestino, extensionDe, LADO_MAXIMO, validarAdjunto } from './adjuntos'

describe('validarAdjunto', () => {
  it('acepta una imagen normal', () => {
    expect(validarAdjunto({ type: 'image/jpeg', size: 2_000_000 })).toEqual({
      ok: true,
      tipo: 'imagen',
    })
  })

  it('acepta un video por debajo del tope', () => {
    expect(validarAdjunto({ type: 'video/mp4', size: 20_000_000 })).toEqual({
      ok: true,
      tipo: 'video',
    })
  })

  it('rechaza un video que pasa los 25 MB, diciendo cuánto pesa', () => {
    const resultado = validarAdjunto({ type: 'video/mp4', size: 40_000_000 })
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.motivo).toContain('25')
  })

  it('rechaza un tipo que no es imagen ni video', () => {
    const resultado = validarAdjunto({ type: 'application/pdf', size: 1000 })
    expect(resultado.ok).toBe(false)
  })

  it('rechaza un archivo vacío', () => {
    expect(validarAdjunto({ type: 'image/jpeg', size: 0 }).ok).toBe(false)
  })
})

describe('dimensionesDestino', () => {
  it('no agranda una imagen que ya es pequeña', () => {
    expect(dimensionesDestino(800, 600)).toEqual({ ancho: 800, alto: 600 })
  })

  it('reduce por el lado mayor y conserva la proporción', () => {
    expect(dimensionesDestino(3200, 1600)).toEqual({ ancho: LADO_MAXIMO, alto: LADO_MAXIMO / 2 })
  })

  it('reduce por el alto cuando la foto es vertical', () => {
    expect(dimensionesDestino(600, 2400)).toEqual({ ancho: 400, alto: LADO_MAXIMO })
  })
})

describe('extensionDe', () => {
  it('saca la extensión del tipo MIME', () => {
    expect(extensionDe('image/jpeg')).toBe('jpg')
    expect(extensionDe('video/mp4')).toBe('mp4')
  })

  it('cae en una extensión genérica si el tipo es raro', () => {
    expect(extensionDe('image/vnd.rarito')).toBe('bin')
  })
})
```

- [ ] **Paso 2: Correr el test y ver que falla**

```bash
npm run test -- src/domain/adjuntos.test.ts
```

Esperado: FAIL, "Failed to resolve import './adjuntos'".

- [ ] **Paso 3: Implementar lo mínimo**

`src/domain/adjuntos.ts`:

```ts
/**
 * Qué archivo se puede mandar por el chat y a qué tamaño se reduce.
 *
 * Los topes son distintos por una razón concreta: una imagen se puede comprimir
 * en el navegador con `canvas`, así que da igual lo que pese al elegirla. Un
 * video no —comprimirlo bien exige transcodificar— así que su tope es el que
 * viaja de verdad por la red del asesorado.
 */

export type TipoAdjunto = 'imagen' | 'video'

export type ResultadoValidacion =
  | { ok: true; tipo: TipoAdjunto }
  | { ok: false; motivo: string }

/** Lado mayor al que se reduce una imagen antes de subirla. */
export const LADO_MAXIMO = 1600

const TOPE_VIDEO_MB = 25
const TOPE_IMAGEN_MB = 50

const MB = 1_000_000

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

export function validarAdjunto(archivo: { type: string; size: number }): ResultadoValidacion {
  if (archivo.size === 0) return { ok: false, motivo: 'El archivo está vacío.' }

  if (archivo.type.startsWith('image/')) {
    if (archivo.size > TOPE_IMAGEN_MB * MB) {
      return { ok: false, motivo: `La imagen pesa más de ${TOPE_IMAGEN_MB} MB.` }
    }
    return { ok: true, tipo: 'imagen' }
  }

  if (archivo.type.startsWith('video/')) {
    if (archivo.size > TOPE_VIDEO_MB * MB) {
      return {
        ok: false,
        motivo: `El video pesa más de ${TOPE_VIDEO_MB} MB. Graba uno más corto: con 10 o 15 segundos tu coach ve la técnica.`,
      }
    }
    return { ok: true, tipo: 'video' }
  }

  return { ok: false, motivo: 'Solo puedes mandar fotos o videos.' }
}

export function dimensionesDestino(
  ancho: number,
  alto: number,
): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto)
  if (mayor <= LADO_MAXIMO) return { ancho, alto }
  const factor = LADO_MAXIMO / mayor
  return { ancho: Math.round(ancho * factor), alto: Math.round(alto * factor) }
}

export function extensionDe(mime: string): string {
  return EXTENSIONES[mime] ?? 'bin'
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

```bash
npm run test -- src/domain/adjuntos.test.ts
```

Esperado: PASS, 9 tests.

- [ ] **Paso 5: Commit**

```bash
git add src/domain/adjuntos.ts src/domain/adjuntos.test.ts
git commit -m "feat: reglas de que archivo puede mandarle el asesorado a su coach"
```

---

## Tarea 2: El depósito de archivos pendientes

**Archivos:**
- Crear: `src/lib/depositoAdjuntos.ts`
- Test: `src/lib/depositoAdjuntos.test.ts`

- [ ] **Paso 1: Escribir el test que falla**

`src/lib/depositoAdjuntos.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { borrar, guardar, leer, pendientesDe, vaciarDeposito } from './depositoAdjuntos'

const blobDe = (texto: string) => new Blob([texto], { type: 'image/jpeg' })

describe('depositoAdjuntos', () => {
  beforeEach(async () => {
    await vaciarDeposito()
  })

  it('guarda un archivo y lo devuelve igual', async () => {
    await guardar('msg-1', blobDe('foto'), 'u-valentina')
    const recuperado = await leer('msg-1')
    expect(await recuperado?.text()).toBe('foto')
  })

  it('devuelve undefined si no hay nada con ese id', async () => {
    expect(await leer('msg-inexistente')).toBeUndefined()
  })

  it('borra lo que ya subió', async () => {
    await guardar('msg-1', blobDe('foto'), 'u-valentina')
    await borrar('msg-1')
    expect(await leer('msg-1')).toBeUndefined()
  })

  /**
   * Móvil compartido: los archivos de una persona no pueden subirse con la
   * sesión de la siguiente. Es la misma regla que ya protege la cola de sync.
   */
  it('no mezcla los pendientes de dos personas', async () => {
    await guardar('msg-1', blobDe('suya'), 'u-valentina')
    await guardar('msg-2', blobDe('del otro'), 'u-camilo')
    expect(await pendientesDe('u-valentina')).toEqual(['msg-1'])
  })
})
```

- [ ] **Paso 2: Correr el test y ver que falla**

```bash
npm run test -- src/lib/depositoAdjuntos.test.ts
```

Esperado: FAIL, no resuelve el import.

- [ ] **Paso 3: Implementar lo mínimo**

`src/lib/depositoAdjuntos.ts`:

```ts
/**
 * Los bytes de los adjuntos que todavía no han subido.
 *
 * **Por qué IndexedDB y no `localStorage`.** Todo el almacén local de la app vive
 * en UNA clave de `localStorage` (`mockDb.ts`), y el límite del origen ronda los
 * 5 MB. Una foto comprimida son ~250 KB y un video, megas. Si el archivo entrara
 * ahí, desbordar la cuota no perdería la foto: perdería la clave entera, con los
 * microciclos y las series dentro.
 *
 * Este es el ÚNICO archivo que abre esta base. Quien necesite un adjunto pendiente
 * pasa por aquí.
 */

const BASE = 'alpha-adjuntos'
const ALMACEN = 'pendientes'

interface Guardado {
  id: string
  blob: Blob
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

function conAlmacen<T>(
  modo: IDBTransactionMode,
  trabajo: (almacen: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrir().then(
    (base) =>
      new Promise<T>((resolver, rechazar) => {
        const transaccion = base.transaction(ALMACEN, modo)
        const peticion = trabajo(transaccion.objectStore(ALMACEN))
        peticion.onsuccess = () => resolver(peticion.result)
        peticion.onerror = () => rechazar(new Error('Falló el depósito de adjuntos'))
        transaccion.oncomplete = () => base.close()
      }),
  )
}

export function guardar(id: string, blob: Blob, duenio: string): Promise<unknown> {
  return conAlmacen('readwrite', (a) => a.put({ id, blob, duenio } satisfies Guardado))
}

export async function leer(id: string): Promise<Blob | undefined> {
  const fila = await conAlmacen<Guardado | undefined>('readonly', (a) => a.get(id))
  return fila?.blob
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
```

- [ ] **Paso 4: Correr el test y verlo pasar**

```bash
npm run test -- src/lib/depositoAdjuntos.test.ts
```

Esperado: PASS, 4 tests.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/depositoAdjuntos.ts src/lib/depositoAdjuntos.test.ts
git commit -m "feat: los archivos esperan en su propio deposito, no en el almacen de la app"
```

---

## Tarea 3: El mensaje aprende a llevar un adjunto de verdad

**Archivos:**
- Modificar: `src/domain/types.ts` (interfaz `Mensaje`)
- Modificar: `src/data/repos.ts` (`MensajesRepo.enviar`)
- Modificar: `src/data/mockDb.ts` (`mensajes.enviar`)
- Test: `src/data/mockDb.adjuntos.test.ts`

- [ ] **Paso 1: Escribir el test que falla**

`src/data/mockDb.adjuntos.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from './mockDb'

describe('mensajes con adjunto', () => {
  beforeEach(() => localStorage.clear())

  it('guarda el path y el tipo, y lo marca como subiendo', () => {
    const db = crearMockDb()
    db.mensajes.enviar({
      deId: 'u-valentina',
      paraId: 'u-coach',
      texto: '',
      adjuntoPath: 'u-valentina/msg-1.jpg',
      adjuntoTipo: 'imagen',
      adjuntoEstado: 'subiendo',
    })
    const hilo = db.mensajes.hilo('u-valentina', 'u-coach')
    expect(hilo[hilo.length - 1]).toMatchObject({
      adjuntoPath: 'u-valentina/msg-1.jpg',
      adjuntoTipo: 'imagen',
      adjuntoEstado: 'subiendo',
    })
  })

  it('marca el adjunto como listo cuando termina de subir', () => {
    const db = crearMockDb()
    db.mensajes.enviar({
      deId: 'u-valentina',
      paraId: 'u-coach',
      texto: '',
      adjuntoPath: 'u-valentina/msg-1.jpg',
      adjuntoTipo: 'imagen',
      adjuntoEstado: 'subiendo',
    })
    const id = db.mensajes.hilo('u-valentina', 'u-coach').at(-1)!.id
    db.mensajes.marcarAdjuntoListo(id)
    expect(db.mensajes.hilo('u-valentina', 'u-coach').at(-1)?.adjuntoEstado).toBe('listo')
  })

  it('un mensaje de solo texto no trae campos de adjunto', () => {
    const db = crearMockDb()
    db.mensajes.enviar({ deId: 'u-valentina', paraId: 'u-coach', texto: 'hola' })
    expect(db.mensajes.hilo('u-valentina', 'u-coach').at(-1)?.adjuntoPath).toBeUndefined()
  })
})
```

- [ ] **Paso 2: Correr el test y ver que falla**

```bash
npm run test -- src/data/mockDb.adjuntos.test.ts
```

Esperado: FAIL, `adjuntoPath` no existe en el tipo y `marcarAdjuntoListo` no es función.

- [ ] **Paso 3: Cambiar el tipo `Mensaje`**

En `src/domain/types.ts`, sustituir la interfaz `Mensaje` por:

```ts
export interface Mensaje {
  id: string
  deId: string
  paraId: string
  fechaIso: string
  texto: string
  /** Ruta del objeto en el bucket privado. No es una URL: se firma al pintarla. */
  adjuntoPath?: string
  adjuntoTipo?: 'imagen' | 'video'
  /**
   * Solo local, no viaja a la base: dice si el archivo de ESTE dispositivo ya
   * subió. Para cualquier otro dispositivo la respuesta siempre es que sí.
   */
  adjuntoEstado?: 'subiendo' | 'listo'
  leido: boolean
  /** 'alpha' = respuesta automatica del Centro de Respuestas. Sin definir = humano. */
  origen?: 'humano' | 'alpha'
}
```

- [ ] **Paso 4: Cambiar la interfaz del repo**

En `src/data/repos.ts`, dentro de `MensajesRepo`, sustituir la firma de `enviar` y añadir
`marcarAdjuntoListo`:

```ts
  enviar(mensaje: {
    deId: string
    paraId: string
    texto: string
    adjuntoPath?: string
    adjuntoTipo?: 'imagen' | 'video'
    adjuntoEstado?: 'subiendo' | 'listo'
    /** 'alpha' marca la respuesta del Centro de Respuestas. Por defecto, humano. */
    origen?: 'humano' | 'alpha'
  }): void
  /** El archivo terminó de subir: deja de mostrarse como pendiente. */
  marcarAdjuntoListo(mensajeId: string): void
```

- [ ] **Paso 5: Implementar en `mockDb`**

En `src/data/mockDb.ts`, sustituir `mensajes.enviar` y añadir `marcarAdjuntoListo` justo
después:

```ts
      enviar: ({ deId, paraId, texto, adjuntoPath, adjuntoTipo, adjuntoEstado, origen }) => {
        mutar((estado) => ({
          ...estado,
          mensajes: [
            ...estado.mensajes,
            {
              id: `msg-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
              deId,
              paraId,
              texto,
              adjuntoPath,
              adjuntoTipo,
              adjuntoEstado,
              origen: origen ?? 'humano',
              fechaIso: new Date().toISOString(),
              leido: false,
            },
          ],
        }))
      },
      marcarAdjuntoListo: (mensajeId) => {
        mutar((estado) => ({
          ...estado,
          mensajes: estado.mensajes.map((m) =>
            m.id === mensajeId ? { ...m, adjuntoEstado: 'listo' as const } : m,
          ),
        }))
      },
```

- [ ] **Paso 6: Arreglar los usos de `adjuntoUrl` que quedaron rotos**

```bash
npm run typecheck
```

Aparecerán dos: `src/data/nube/sync.ts` (el payload manda `adjunto_url`) y
`src/features/chat/Conversacion.tsx`. En `sync.ts`, cambiar la línea del payload por:

```ts
            adjunto_path: ultimo.adjuntoPath ?? null,
            adjunto_tipo: ultimo.adjuntoTipo ?? null,
```

Y añadir `marcarAdjuntoListo` al objeto `mensajes` de `sync.ts`, delegando en local:

```ts
      marcarAdjuntoListo: (mensajeId) => {
        local.mensajes.marcarAdjuntoListo(mensajeId)
      },
```

En `Conversacion.tsx`, el adjunto simulado se retira entero en la tarea 8. Por ahora, para
que compile, quitar `adjuntoUrl: adjunto || undefined` de la llamada a `enviar`.

- [ ] **Paso 7: Correr todo y verlo pasar**

```bash
npm run verify
```

Esperado: verde, con 3 tests más que antes.

- [ ] **Paso 8: Commit**

```bash
git add src/domain/types.ts src/data/repos.ts src/data/mockDb.ts src/data/mockDb.adjuntos.test.ts src/data/nube/sync.ts src/features/chat/Conversacion.tsx
git commit -m "feat: el mensaje guarda donde esta su archivo, no como se llamaba"
```

---

## Tarea 4: Subir el archivo a Supabase Storage

**Archivos:**
- Crear: `src/data/nube/adjuntos.ts`
- Test: `src/data/nube/adjuntos.test.ts`

- [ ] **Paso 1: Escribir el test que falla**

`src/data/nube/adjuntos.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { pathDeAdjunto, subirAdjunto } from './adjuntos'

describe('pathDeAdjunto', () => {
  /**
   * La primera carpeta es el id de quien sube porque la política de Storage
   * decide por prefijo. Y el nombre del archivo original NO se usa: suele traer
   * el nombre de la persona o la fecha.
   */
  it('arma la ruta con el remitente y el id del mensaje', () => {
    expect(pathDeAdjunto('u-valentina', 'msg-9', 'image/jpeg')).toBe('u-valentina/msg-9.jpg')
  })
})

describe('subirAdjunto', () => {
  const clienteQue = (resultado: { error: { message: string } | null }) => ({
    storage: { from: () => ({ upload: vi.fn().mockResolvedValue(resultado) }) },
  })

  it('devuelve el path cuando la subida sale bien', async () => {
    const path = await subirAdjunto(
      clienteQue({ error: null }) as never,
      'u-valentina/msg-9.jpg',
      new Blob(['x'], { type: 'image/jpeg' }),
    )
    expect(path).toBe('u-valentina/msg-9.jpg')
  })

  it('lanza si el bucket la rechaza, para que se reintente', async () => {
    await expect(
      subirAdjunto(
        clienteQue({ error: { message: 'no autorizado' } }) as never,
        'u-valentina/msg-9.jpg',
        new Blob(['x'], { type: 'image/jpeg' }),
      ),
    ).rejects.toThrow('no autorizado')
  })
})
```

- [ ] **Paso 2: Correr el test y ver que falla**

```bash
npm run test -- src/data/nube/adjuntos.test.ts
```

Esperado: FAIL, no resuelve el import.

- [ ] **Paso 3: Implementar lo mínimo**

`src/data/nube/adjuntos.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { extensionDe } from '../../domain/adjuntos'
import { supabase } from '../supabase'

export const BUCKET = 'adjuntos-chat'

/** Vida de la URL firmada. Corta a propósito: es la foto del cuerpo de alguien. */
const SEGUNDOS_FIRMA = 3600

/**
 * La primera carpeta es el id de quien sube: la política de INSERT del bucket
 * decide por ese prefijo. El nombre original del archivo no se usa nunca —trae
 * el nombre de la persona o la fecha con demasiada frecuencia—.
 */
export function pathDeAdjunto(deId: string, mensajeId: string, mime: string): string {
  return `${deId}/${mensajeId}.${extensionDe(mime)}`
}

export async function subirAdjunto(
  cliente: SupabaseClient,
  path: string,
  blob: Blob,
): Promise<string> {
  const { error } = await cliente.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: true })
  if (error) throw new Error(error.message)
  return path
}

/**
 * URL para pintar el adjunto. El bucket es privado, así que no hay URL fija: se
 * firma al mostrarlo y se deja caducar.
 */
export async function urlFirmada(path: string): Promise<string | undefined> {
  const { data } = await supabase().storage.from(BUCKET).createSignedUrl(path, SEGUNDOS_FIRMA)
  return data?.signedUrl
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

```bash
npm run test -- src/data/nube/adjuntos.test.ts
```

Esperado: PASS, 3 tests.

- [ ] **Paso 5: Commit**

```bash
git add src/data/nube/adjuntos.ts src/data/nube/adjuntos.test.ts
git commit -m "feat: subida del archivo al bucket privado, con url que caduca"
```

---

## Tarea 5: Encadenarlo — primero el archivo, después la fila

**Archivos:**
- Modificar: `src/data/nube/sync.ts` (`mensajes.enviar`)
- Test: `src/data/nube/adjuntos-orden.test.ts`

- [ ] **Paso 1: Escribir el test que falla**

`src/data/nube/adjuntos-orden.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enviarConAdjunto } from './sync'
import { guardar, leer, vaciarDeposito } from '../../lib/depositoAdjuntos'

describe('enviarConAdjunto', () => {
  beforeEach(async () => {
    localStorage.clear()
    await vaciarDeposito()
  })

  /**
   * El orden importa: si la fila subiera antes que el archivo, el coach vería un
   * mensaje con un adjunto que todavía no existe y al tocarlo no habría nada.
   */
  it('no encola la fila hasta que el archivo subió', async () => {
    const orden: string[] = []
    const subir = vi.fn(async () => {
      orden.push('archivo')
      return 'u-valentina/msg-1.jpg'
    })
    const encolarFila = vi.fn(() => {
      orden.push('fila')
    })

    await enviarConAdjunto(
      { mensajeId: 'msg-1', deId: 'u-valentina', path: 'u-valentina/msg-1.jpg' },
      { subir, encolarFila },
    )

    expect(orden).toEqual(['archivo', 'fila'])
  })

  it('si el archivo no sube, la fila no se encola y el blob sobrevive', async () => {
    await guardar('msg-1', new Blob(['foto'], { type: 'image/jpeg' }), 'u-valentina')
    const encolarFila = vi.fn()

    await enviarConAdjunto(
      { mensajeId: 'msg-1', deId: 'u-valentina', path: 'u-valentina/msg-1.jpg' },
      {
        subir: vi.fn().mockRejectedValue(new Error('sin red')),
        encolarFila,
      },
    )

    expect(encolarFila).not.toHaveBeenCalled()
    expect(await leer('msg-1')).toBeDefined()
  })

  it('borra el blob solo cuando la fila ya se encoló', async () => {
    await guardar('msg-1', new Blob(['foto'], { type: 'image/jpeg' }), 'u-valentina')

    await enviarConAdjunto(
      { mensajeId: 'msg-1', deId: 'u-valentina', path: 'u-valentina/msg-1.jpg' },
      { subir: vi.fn().mockResolvedValue('u-valentina/msg-1.jpg'), encolarFila: vi.fn() },
    )

    expect(await leer('msg-1')).toBeUndefined()
  })
})
```

- [ ] **Paso 2: Correr el test y ver que falla**

```bash
npm run test -- src/data/nube/adjuntos-orden.test.ts
```

Esperado: FAIL, `enviarConAdjunto` no está exportada.

- [ ] **Paso 3: Implementar en `sync.ts`**

Añadir al final de `src/data/nube/sync.ts`:

```ts
/**
 * Sube el archivo y solo entonces encola la fila del mensaje.
 *
 * El orden no es un detalle de implementación: al revés, el coach vería en su
 * hilo un mensaje con adjunto y al tocarlo no habría archivo. Y el `Blob` no se
 * borra hasta que la fila está encolada — mismo principio que protege las series
 * de quien entrena sin señal.
 *
 * Nunca lanza: un fallo aquí significa "todavía no", no "se perdió". El archivo
 * se queda en el depósito y lo retoma el siguiente intento.
 */
export async function enviarConAdjunto(
  mensaje: { mensajeId: string; deId: string; path: string },
  puertos: {
    subir: (path: string, blob: Blob) => Promise<string>
    encolarFila: (path: string) => void
  },
): Promise<void> {
  const blob = await leerDeposito(mensaje.mensajeId)
  if (!blob) return
  try {
    await puertos.subir(mensaje.path, blob)
  } catch {
    return
  }
  puertos.encolarFila(mensaje.path)
  await borrarDeposito(mensaje.mensajeId)
}
```

Y arriba, con los demás imports:

```ts
import { borrar as borrarDeposito, leer as leerDeposito } from '../../lib/depositoAdjuntos'
```

- [ ] **Paso 4: Correr el test y verlo pasar**

```bash
npm run test -- src/data/nube/adjuntos-orden.test.ts
```

Esperado: PASS, 3 tests.

> El primer test pasa un `mensajeId` que no está en el depósito y aun así espera
> `['archivo','fila']`. Si falla porque `leerDeposito` devuelve `undefined` y sale antes,
> añadir el `guardar` correspondiente al principio de ese test, igual que en los otros dos.

- [ ] **Paso 5: Commit**

```bash
git add src/data/nube/sync.ts src/data/nube/adjuntos-orden.test.ts
git commit -m "feat: el archivo sube primero; la fila del mensaje espera a que exista"
```

---

## Tarea 5b: Reducir la imagen antes de guardarla

Sin esto se sube la foto tal como sale del teléfono. Es lo mismo que ya se anotó del Álbum
Alfa: hoy se sirven imágenes de 591×1280 para pintarlas a 122 px.

**Archivos:**
- Crear: `src/lib/comprimirImagen.ts`
- Test: `src/lib/comprimirImagen.test.ts`

- [ ] **Paso 1: Escribir el test que falla**

jsdom no dibuja en `canvas`, así que lo que se prueba aquí es la decisión —qué se comprime
y qué se deja pasar—, no el pixelado. El cálculo de dimensiones ya tiene sus tests en
`domain/adjuntos.test.ts`.

`src/lib/comprimirImagen.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { comprimirSiEsImagen } from './comprimirImagen'

describe('comprimirSiEsImagen', () => {
  it('devuelve el video tal cual, sin tocarlo', async () => {
    const video = new File(['x'], 'v.mp4', { type: 'video/mp4' })
    expect(await comprimirSiEsImagen(video)).toBe(video)
  })

  it('devuelve el original si el navegador no puede dibujar', async () => {
    const foto = new File(['x'], 'f.jpg', { type: 'image/jpeg' })
    expect(await comprimirSiEsImagen(foto)).toBe(foto)
  })
})
```

- [ ] **Paso 2: Correr el test y ver que falla**

```bash
npm run test -- src/lib/comprimirImagen.test.ts
```

Esperado: FAIL, no resuelve el import.

- [ ] **Paso 3: Implementar lo mínimo**

`src/lib/comprimirImagen.ts`:

```ts
import { dimensionesDestino } from '../domain/adjuntos'

/**
 * Reduce la foto antes de subirla. El video se devuelve intacto: comprimirlo
 * bien exige transcodificar, y las soluciones de navegador son pesadas y
 * frágiles. Su control es el tope de tamaño, no la compresión.
 *
 * Ante cualquier fallo devuelve el original. Perder la foto por no poder
 * encogerla sería peor que subirla grande.
 */
export async function comprimirSiEsImagen(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) return archivo
  if (typeof createImageBitmap !== 'function') return archivo

  try {
    const bitmap = await createImageBitmap(archivo)
    const { ancho, alto } = dimensionesDestino(bitmap.width, bitmap.height)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const contexto = lienzo.getContext('2d')
    if (!contexto) return archivo
    contexto.drawImage(bitmap, 0, 0, ancho, alto)
    const reducida = await new Promise<Blob | null>((resolver) =>
      lienzo.toBlob(resolver, 'image/jpeg', 0.8),
    )
    return reducida ?? archivo
  } catch {
    return archivo
  }
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

```bash
npm run test -- src/lib/comprimirImagen.test.ts
```

Esperado: PASS, 2 tests.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/comprimirImagen.ts src/lib/comprimirImagen.test.ts
git commit -m "feat: la foto se encoge antes de salir del telefono"
```

---

## Tarea 6: La barra

**Archivos:**
- Crear: `src/features/hoy/BarraCoach.tsx`
- Test: `src/features/hoy/BarraCoach.test.tsx`

- [ ] **Paso 1: Escribir el test que falla**

`src/features/hoy/BarraCoach.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BarraCoach } from './BarraCoach'

const pintar = (props: Partial<Parameters<typeof BarraCoach>[0]> = {}) =>
  render(
    <MemoryRouter>
      <BarraCoach iniciales="SC" noLeidos={0} ultimoTexto={undefined} onEnviar={vi.fn()} {...props} />
    </MemoryRouter>,
  )

describe('BarraCoach', () => {
  it('invita a escribirle al coach', () => {
    pintar()
    expect(screen.getByText(/escríbele a tu coach/i)).toBeInTheDocument()
  })

  it('muestra el contador cuando hay mensajes sin leer', () => {
    pintar({ noLeidos: 3, ultimoTexto: 'Subiste bien esta semana' })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/subiste bien/i)).toBeInTheDocument()
  })

  it('envía el texto escrito', async () => {
    const onEnviar = vi.fn()
    pintar({ onEnviar })
    await userEvent.type(screen.getByPlaceholderText(/mensaje/i), 'me duele el hombro')
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }))
    expect(onEnviar).toHaveBeenCalledWith({ texto: 'me duele el hombro', archivo: undefined })
  })

  it('no envía nada si no hay texto ni archivo', async () => {
    const onEnviar = vi.fn()
    pintar({ onEnviar })
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }))
    expect(onEnviar).not.toHaveBeenCalled()
  })

  /** El fallo que estamos arreglando: nada de aceptar un archivo que no se puede mandar. */
  it('rechaza un video demasiado grande antes de enviarlo', async () => {
    const onEnviar = vi.fn()
    pintar({ onEnviar })
    const grande = new File(['x'.repeat(40)], 'v.mp4', { type: 'video/mp4' })
    Object.defineProperty(grande, 'size', { value: 40_000_000 })
    await userEvent.upload(screen.getByLabelText(/foto o video/i), grande)
    expect(screen.getByRole('alert')).toHaveTextContent(/25 MB/)
    expect(onEnviar).not.toHaveBeenCalled()
  })
})
```

- [ ] **Paso 2: Correr el test y ver que falla**

```bash
npm run test -- src/features/hoy/BarraCoach.test.tsx
```

Esperado: FAIL, no resuelve el import.

- [ ] **Paso 3: Implementar lo mínimo**

`src/features/hoy/BarraCoach.tsx`:

```tsx
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { validarAdjunto } from '../../domain/adjuntos'

export interface EnvioRapido {
  texto: string
  archivo: File | undefined
}

interface BarraCoachProps {
  iniciales: string
  noLeidos: number
  ultimoTexto: string | undefined
  onEnviar: (envio: EnvioRapido) => void
}

/**
 * La entrada al coach, arriba de Hoy.
 *
 * Estaba al final de la pantalla, después del álbum y el radar: para escribirle
 * había que recorrer Hoy entera, así que en la práctica no se veía.
 *
 * Recibe qué mostrar en lugar de decidirlo: el ciclo de revisiones le añadirá
 * otro estado (cuenta atrás y temas) sin tener que reescribirla.
 */
export function BarraCoach({ iniciales, noLeidos, ultimoTexto, onEnviar }: BarraCoachProps) {
  const [texto, setTexto] = useState('')
  const [archivo, setArchivo] = useState<File>()
  const [error, setError] = useState('')
  const inputArchivo = useRef<HTMLInputElement>(null)
  const navegar = useNavigate()

  const elegir = (elegido: File | undefined) => {
    setError('')
    if (!elegido) return
    const validacion = validarAdjunto(elegido)
    if (!validacion.ok) {
      setError(validacion.motivo)
      return
    }
    setArchivo(elegido)
  }

  const enviar = () => {
    const limpio = texto.trim()
    if (!limpio && !archivo) return
    onEnviar({ texto: limpio, archivo })
    setTexto('')
    setArchivo(undefined)
    navegar('/chat')
  }

  return (
    <section className="glass glass-destacada rounded-bloque p-3.5">
      <button
        type="button"
        onClick={() => navegar('/chat')}
        className="press flex w-full items-center gap-2.5 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-bold text-texto">
          {iniciales}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm text-texto">Escríbele a tu coach</span>
          {ultimoTexto && (
            <span className="block truncate text-xs text-tenue">{ultimoTexto}</span>
          )}
        </span>
        {noLeidos > 0 && (
          <span className="cifras rounded-full bg-rojo px-2 py-0.5 text-[10px] font-bold text-white">
            {noLeidos}
          </span>
        )}
      </button>

      {archivo && (
        <p className="mt-2 flex items-center gap-2 rounded-boton border border-linea bg-surface-1 px-3 py-1.5 text-xs text-tenue">
          <span className="truncate">{archivo.name}</span>
          <button type="button" className="ml-auto font-bold text-accion" onClick={() => setArchivo(undefined)}>
            quitar
          </button>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-rojo">
          {error}
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <input
          ref={inputArchivo}
          id="adjunto-barra"
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          aria-label="Adjuntar foto o video"
          onChange={(e) => elegir(e.target.files?.[0])}
        />
        <button
          type="button"
          aria-label="Adjuntar foto o video"
          onClick={() => inputArchivo.current?.click()}
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-boton border border-linea bg-surface-1 text-tenue"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M14.5 4h-5L8 6H4.5A1.5 1.5 0 0 0 3 7.5v11A1.5 1.5 0 0 0 4.5 20h15a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 19.5 6H16z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </button>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') enviar()
          }}
          placeholder="Escríbele un mensaje…"
          className="min-w-0 flex-1 rounded-boton border border-linea bg-surface-1 px-3.5 py-2.5 text-sm text-texto placeholder:text-tenue focus:border-accion focus:outline-none"
        />
        <button
          type="button"
          onClick={enviar}
          aria-label="Enviar mensaje"
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accion text-white"
          style={{ boxShadow: 'var(--glow-accion)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="m5 12 7-7 7 7 M12 19V5" />
          </svg>
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

```bash
npm run test -- src/features/hoy/BarraCoach.test.tsx
```

Esperado: PASS, 5 tests.

- [ ] **Paso 5: Commit**

```bash
git add src/features/hoy/BarraCoach.tsx src/features/hoy/BarraCoach.test.tsx
git commit -m "feat: la barra para escribirle al coach, con su archivo validado antes de mandarlo"
```

---

## Tarea 7: Ponerla arriba de Hoy y quitar la tarjeta del final

**Archivos:**
- Modificar: `src/features/hoy/HoyPage.tsx`
- Borrar: `src/features/hoy/MensajeCoach.tsx`
- Test: `src/features/hoy/HoyPage.barra.test.tsx`

- [ ] **Paso 1: Escribir el test que falla**

`src/features/hoy/HoyPage.barra.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import HoyPage from './HoyPage'
import { SessionProvider } from '../../app/SessionProvider'

describe('Hoy · barra del coach', () => {
  it('la barra está antes que el check-in', async () => {
    render(
      <MemoryRouter>
        <SessionProvider>
          <HoyPage />
        </SessionProvider>
      </MemoryRouter>,
    )
    const barra = await screen.findByText(/escríbele a tu coach/i)
    const checkin = await screen.findByText(/check-in/i)
    expect(barra.compareDocumentPosition(checkin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
```

- [ ] **Paso 2: Correr el test y ver que falla**

```bash
npm run test -- src/features/hoy/HoyPage.barra.test.tsx
```

Esperado: FAIL, no encuentra "Escríbele a tu coach".

> Si `SessionProvider` necesita envoltura extra, copiar el arranque que ya usa
> `src/features/hoy/HoyPage.bloques.test.tsx`, que monta esta misma página.

- [ ] **Paso 3: Enganchar la barra en `HoyPage`**

Sustituir el import de `MensajeCoach` por el de la barra:

```tsx
import { BarraCoach } from './BarraCoach'
import { enviarRapido } from './enviarRapido'
```

Insertar el bloque **justo después** de la `<section>` del saludo y **antes** de la tarjeta
de check-in:

```tsx
      <div className="entrada entrada-2">
        <BarraCoach
          iniciales={db.usuarios.byId(idCoach())?.avatarIniciales ?? 'AA'}
          noLeidos={noLeidos}
          ultimoTexto={ultimoDelCoach?.texto}
          onEnviar={(envio) => void enviarRapido(usuario.id, envio)}
        />
      </div>
```

Y borrar el bloque de `MensajeCoach` que está al final (el `<div className="entrada entrada-5">`
que lo contiene).

- [ ] **Paso 4: Crear el puente que envía**

`src/features/hoy/enviarRapido.ts`:

```ts
import { db, idCoach } from '../../data/dbInstance'
import { pathDeAdjunto } from '../../data/nube/adjuntos'
import { guardar } from '../../lib/depositoAdjuntos'
import type { EnvioRapido } from './BarraCoach'

/**
 * Escribe el mensaje en local YA —para que se vea con o sin señal— y deja el
 * archivo esperando en el depósito. La subida la hace la capa de sincronización.
 */
export async function enviarRapido(usuarioId: string, envio: EnvioRapido): Promise<void> {
  const { texto, archivo } = envio
  if (!archivo) {
    db.mensajes.enviar({ deId: usuarioId, paraId: idCoach(), texto })
    return
  }
  db.mensajes.enviar({
    deId: usuarioId,
    paraId: idCoach(),
    texto,
    adjuntoTipo: archivo.type.startsWith('video/') ? 'video' : 'imagen',
    adjuntoEstado: 'subiendo',
  })
  const hilo = db.mensajes.hilo(usuarioId, idCoach())
  const mensajeId = hilo[hilo.length - 1].id
  const reducido = await comprimirSiEsImagen(archivo)
  await guardar(mensajeId, reducido, usuarioId)
  db.mensajes.anotarPath(mensajeId, pathDeAdjunto(usuarioId, mensajeId, reducido.type))
}
```

Con los imports:

```ts
import { comprimirSiEsImagen } from '../../lib/comprimirImagen'
```

- [ ] **Paso 5: Añadir `anotarPath` al repo**

El path necesita el id del mensaje, que solo existe después de crearlo. En `repos.ts`,
dentro de `MensajesRepo`:

```ts
  /** El path se sabe después de crear el mensaje: necesita su id. */
  anotarPath(mensajeId: string, path: string): void
```

En `mockDb.ts`, junto a `marcarAdjuntoListo`:

```ts
      anotarPath: (mensajeId, path) => {
        mutar((estado) => ({
          ...estado,
          mensajes: estado.mensajes.map((m) => (m.id === mensajeId ? { ...m, adjuntoPath: path } : m)),
        }))
      },
```

En `sync.ts`, dentro del objeto `mensajes`:

```ts
      anotarPath: (mensajeId, path) => {
        local.mensajes.anotarPath(mensajeId, path)
      },
```

- [ ] **Paso 6: Borrar `MensajeCoach`**

```bash
git rm src/features/hoy/MensajeCoach.tsx
```

Si algún test lo importaba, actualizarlo para apuntar a `BarraCoach`.

- [ ] **Paso 7: Correr todo y verlo pasar**

```bash
npm run verify
```

Esperado: verde.

- [ ] **Paso 8: Commit**

```bash
git add -A
git commit -m "feat: el coach deja de estar al final de Hoy y pasa a la cabecera"
```

---

## Tarea 8: Pintar el adjunto en el hilo y retirar el que fingía

**Archivos:**
- Modificar: `src/features/chat/Conversacion.tsx`
- Crear: `src/features/chat/AdjuntoMensaje.tsx`
- Test: `src/features/chat/AdjuntoMensaje.test.tsx`

- [ ] **Paso 1: Escribir el test que falla**

`src/features/chat/AdjuntoMensaje.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdjuntoMensaje } from './AdjuntoMensaje'

describe('AdjuntoMensaje', () => {
  it('avisa mientras el archivo todavía sube', () => {
    render(<AdjuntoMensaje path="u/msg-1.jpg" tipo="imagen" estado="subiendo" />)
    expect(screen.getByText(/subiendo/i)).toBeInTheDocument()
  })

  it('no pinta nada si el mensaje no lleva adjunto', () => {
    const { container } = render(<AdjuntoMensaje path={undefined} tipo={undefined} estado={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Paso 2: Correr el test y ver que falla**

```bash
npm run test -- src/features/chat/AdjuntoMensaje.test.tsx
```

Esperado: FAIL, no resuelve el import.

- [ ] **Paso 3: Implementar lo mínimo**

`src/features/chat/AdjuntoMensaje.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { urlFirmada } from '../../data/nube/adjuntos'
import { modoNube } from '../../data/supabase'

interface AdjuntoMensajeProps {
  path: string | undefined
  tipo: 'imagen' | 'video' | undefined
  estado: 'subiendo' | 'listo' | undefined
}

/**
 * El bucket es privado: no hay URL fija que guardar. Se firma al pintar y se
 * deja caducar, porque una URL pública de Storage es un enlace permanente a la
 * foto del cuerpo de alguien.
 */
export function AdjuntoMensaje({ path, tipo, estado }: AdjuntoMensajeProps) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    if (!path || !modoNube) return
    let vigente = true
    void urlFirmada(path).then((u) => {
      if (vigente) setUrl(u)
    })
    return () => {
      vigente = false
    }
  }, [path])

  if (!path || !tipo) return null

  if (estado === 'subiendo') {
    return (
      <p className="cifras mb-1.5 text-[11px] opacity-80">
        {tipo === 'video' ? 'Video' : 'Foto'} subiendo…
      </p>
    )
  }

  if (!url) return <p className="cifras mb-1.5 text-[11px] opacity-60">Cargando…</p>

  return tipo === 'video' ? (
    <video src={url} controls className="mb-1.5 max-h-72 w-full rounded-tarjeta" />
  ) : (
    <img src={url} alt="Adjunto del mensaje" className="mb-1.5 max-h-72 w-full rounded-tarjeta object-cover" />
  )
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

```bash
npm run test -- src/features/chat/AdjuntoMensaje.test.tsx
```

Esperado: PASS, 2 tests.

- [ ] **Paso 5: Usarlo en el hilo y retirar el adjunto simulado**

En `Conversacion.tsx`:

1. Borrar el estado `adjunto`, la referencia `inputArchivo`, el `<input type="file">`, el
   botón de adjuntar y el párrafo que dice "(adjunto simulado en etapa 1)".
2. Dentro de la burbuja, antes del `<p>` del texto, añadir:

```tsx
                <AdjuntoMensaje
                  path={mensaje.adjuntoPath}
                  tipo={mensaje.adjuntoTipo}
                  estado={mensaje.adjuntoEstado}
                />
```

3. Simplificar `enviar` a solo texto:

```tsx
  const enviar = () => {
    const limpio = texto.trim()
    if (!limpio) return
    db.mensajes.enviar({ deId: yoId, paraId: otroId, texto: limpio })
    setTexto('')
    if (respondeAlpha) void consultarAlpha(limpio)
  }
```

> El envío con archivo vive en la barra. El chat pinta lo que llega y manda texto: dos
> sitios para elegir archivo serían dos validaciones que mantener sincronizadas.

- [ ] **Paso 6: Correr todo y verlo pasar**

```bash
npm run verify
```

Esperado: verde.

- [ ] **Paso 7: Commit**

```bash
git add -A
git commit -m "fix: el adjunto deja de fingir; la foto se ve en el hilo o dice que esta subiendo"
```

---

## Tarea 9: La migración

**Archivos:**
- Crear: `supabase/migrations/0022_adjuntos_chat.sql`
- Modificar: `supabase/comprobar-migraciones.sql`

- [ ] **Paso 1: Escribir la migración**

`supabase/migrations/0022_adjuntos_chat.sql`:

```sql
-- Adjuntos del chat: bucket privado + columnas del mensaje.
--
-- Privado, no publico: son imagenes de cuerpos, dato de salud. Una URL publica
-- de Storage es un enlace permanente a la foto de alguien.

insert into storage.buckets (id, name, public)
values ('adjuntos-chat', 'adjuntos-chat', false)
on conflict (id) do nothing;

alter table mensajes add column if not exists adjunto_path text;
alter table mensajes add column if not exists adjunto_tipo text
  check (adjunto_tipo in ('imagen', 'video'));

-- Subir: solo dentro de la carpeta propia. La primera carpeta de la ruta es el
-- id de quien sube, y por eso se puede decidir por prefijo.
create policy "sube en su propia carpeta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'adjuntos-chat'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leer: quien lo mando y quien lo recibio. Se resuelve contra `mensajes`, NO
-- contra el rol: el aislamiento entre asesorados ya se rompio dos veces por
-- politicas que miraban el rol.
create policy "lee quien envio o recibio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'adjuntos-chat'
    and exists (
      select 1 from mensajes m
      where m.adjunto_path = storage.objects.name
        and (m.de_id = auth.uid() or m.para_id = auth.uid())
    )
  );

-- Borrar desde el cliente: nadie.
```

- [ ] **Paso 2: Añadir su señal al comprobador**

Abrir `supabase/comprobar-migraciones.sql`, mirar el formato de las señales que ya están y
añadir esta al final, adaptando el nombre de las columnas del resultado al que usen las
demás:

```sql
-- 0022 · adjuntos del chat
select
  '0022_adjuntos_chat' as migracion,
  exists (select 1 from storage.buckets where id = 'adjuntos-chat') as bucket,
  exists (
    select 1 from information_schema.columns
    where table_name = 'mensajes' and column_name = 'adjunto_path'
  ) as columna;
```

- [ ] **Paso 3: Commit**

```bash
git add supabase/migrations/0022_adjuntos_chat.sql supabase/comprobar-migraciones.sql
git commit -m "feat: bucket privado para los adjuntos del chat, con sus politicas"
```

- [ ] **Paso 4: Aplicarla a mano**

> En este repo las migraciones **no se aplican solas**: hay que pegarlas en el SQL Editor
> de Supabase. Hasta que eso ocurra, la subida falla en producción aunque el código esté
> bien. Avisar al usuario y esperar confirmación antes de dar el proyecto por terminado.

---

## Cierre

- [ ] **Verificación final**

```bash
npm run verify
```

- [ ] **Comprobar en el navegador**

Levantar la app, entrar como asesorado, mandar una foto desde la barra y comprobar que
aparece en el hilo. En modo demo (sin Supabase) el adjunto se queda en "subiendo": es el
comportamiento correcto, no hay nube a la que subir.

- [ ] **Rama y PR**

```bash
git push -u origin barra-coach-y-adjuntos
```
