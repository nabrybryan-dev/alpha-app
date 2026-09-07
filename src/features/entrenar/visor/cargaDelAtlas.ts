import { colocar, leerPieza } from '../escena/piezas3d'
import { INDICE_RAIZ } from '../../../domain/patrones/esqueleto'
import type { Malla } from '../../../domain/patrones/malla'
import { PIEZAS_DEL_SALON, sitioDe, type PiezaDelSalon } from './piezas'

/**
 * CÓMO LLEGAN LAS PIEZAS, y dónde se guarda el atlas anatómico mientras llegan.
 *
 * Salió de `piezas.ts` y de `VisorPatron.tsx` el 2026-09-08, tal cual y sin cambiarle una
 * línea. `piezas.ts` se queda con el CATÁLOGO —qué piezas hay y en qué punto de la sala se
 * plantan—, que es una lista de datos; aquí vive el VIAJE —pedirlas, comprobar que lo que
 * llegó es una pieza, colocarla y avisar— y la caché del atlas, que es lo que el visor
 * tenía dentro de un efecto y no se podía mirar sin montar WebGL.
 *
 * El atlas va en su propia caché y a propósito: no es escenario. Se pide solo cuando
 * alguien abre el cuerpo para estudiarlo, y quien entra a entrenar no paga su megabyte.
 * Compartir caché con la sala habría hecho que apagar una apagara la otra, que son dos
 * decisiones distintas.
 */

type Traer = (ruta: string) => Promise<ArrayBuffer>

/**
 * LA PIEZA VIAJA COMPRIMIDA, Y LA ABRE EL PROPIO NAVEGADOR.
 *
 * Medido el 2026-09-06 sobre la vista previa: la sala suelta son 1,50 MB y Vercel ya la
 * mandaba comprimida, **915 KB** por el cable. Su compresor va rápido, no apretado. La
 * misma pieza con brotli al máximo son **548 KB**, un 40 % menos, y no hay que
 * descomprimir nada a mano: se sirve `.pieza.br` con la cabecera `Content-Encoding: br`
 * (`vercel.json`) y el navegador la abre él solo, como abre cualquier página.
 *
 * Por eso hay que comprobar que lo que llega ES una pieza. Donde nadie pone esa cabecera
 * —el servidor de desarrollo, por ejemplo— el `.br` llega en crudo con un 200 tan
 * tranquilo, y sin esta comprobación el salón se quedaría sin sala en local. Cuatro bytes
 * bastan: toda pieza empieza por `PIEZ`.
 */
const FIRMA = 'PIEZ'

function esUnaPieza(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 4) return false
  const c = new Uint8Array(bytes, 0, 4)
  return FIRMA.split('').every((letra, i) => c[i] === letra.charCodeAt(0))
}

export const traerDeRed: Traer = async (ruta) => {
  try {
    const r = await fetch(`${ruta}.br`)
    if (r.ok) {
      const bytes = await r.arrayBuffer()
      if (esUnaPieza(bytes)) return bytes
    }
  } catch {
    // Sin comprimir también vale: son 915 KB en vez de 548. No es un fallo que merezca
    // dejar al salón sin sala.
  }
  const r = await fetch(ruta)
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`)
  return r.arrayBuffer()
}

/**
 * Pide todas las piezas y las va entregando colocadas según llegan.
 *
 * Devuelve la función que cancela: al desmontar, una pieza que llegue tarde no toca
 * nada. `traer` se inyecta para poder probarlo sin red. Una pieza que falla no para el
 * salón: se queda sin ella y se sigue, como con las imágenes.
 */
export function cargarPiezas(
  alLlegar: (nombre: string, mallas: Malla[]) => void,
  traer: Traer = traerDeRed,
  lista: Record<string, PiezaDelSalon> = PIEZAS_DEL_SALON,
): () => void {
  let cancelado = false
  for (const [nombre, pieza] of Object.entries(lista)) {
    traer(pieza.ruta)
      .then((bytes) => {
        if (cancelado) return
        alLlegar(nombre, colocar(leerPieza(bytes), sitioDe(pieza)))
      })
      .catch(() => {})
  }
  return () => {
    cancelado = true
  }
}

/**
 * EL ALMACÉN DEL ATLAS: qué capa ha llegado y con qué mallas.
 *
 * `set(capa, mallas)` no es un `Map.set` cualquiera: significa **esta capa acaba de
 * llegar**, y eso son cuatro cosas a la vez —colgar cada malla de la raíz del sujeto,
 * sumarlas a la lista plana que se sube a la tarjeta, anotar la capa y guardarla por su
 * nombre—. Van juntas porque separarlas ya costó un fallo mudo: una caché con las mallas
 * y otra sin ellas se ven igual desde fuera, y el atlas se descargaba entero sin
 * dibujarse.
 *
 * Cada vértice cuelga de la RAÍZ del sujeto, no del mundo: así el atlas va con él cuando
 * la demostración lo hace flotar o el press lo tumba.
 */
class AlmacenDelAtlas {
  private porCapa = new Map<string, Malla[]>()

  set(capa: string, mallas: Malla[]): void {
    for (const m of mallas) m.colgarDe(INDICE_RAIZ)
    atlasCache.push(...mallas)
    atlasCargado.add(capa)
    this.porCapa.set(capa, mallas)
  }

  get(capa: string): Malla[] | undefined {
    return this.porCapa.get(capa)
  }
}

/**
 * TODAS LAS MALLAS DEL ATLAS, en una lista plana.
 *
 * Es un `const` que se rellena con `push` y nunca se reasigna: quien lo importa lee
 * siempre la misma lista, y su `length` es lo que el visor mete en la firma de lo estático
 * para enterarse de que llegó una pieza más.
 */
export const atlasCache: Malla[] = []

/** Qué capas del atlas han llegado. Decide si hace falta pedir algo. */
export const atlasCargado = new Set<string>()

/** Qué mallas son de cada capa, para poder encender solo el esqueleto o solo el músculo. */
export const atlasPorCapa = new AlmacenDelAtlas()
