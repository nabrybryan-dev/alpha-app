import { colocar, leerPieza } from '../escena/piezas3d'
import { INDICE_RAIZ } from '../../../domain/patrones/esqueleto'
import type { Malla } from '../../../domain/patrones/malla'
import { PIEZAS_DEL_ATLAS, PIEZAS_DEL_SALON, sitioDe, type PiezaDelSalon } from './piezas'

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
 * QUÉ PIEZAS HAN LLEGADO YA Y SE HAN ENTREGADO, por su nombre.
 *
 * Es de módulo y no de cada llamada a propósito: es la memoria de lo que ya está en la
 * app, y es lo que hace que volver a pedir el atlas no vuelva a bajar el megabyte entero.
 * Una pieza entra aquí cuando sus bytes llegaron, se leyeron bien Y se entregaron. Si la
 * llamada estaba cancelada —el visor se desmontó por el camino— NO entra: nadie la
 * guardó, así que sigue faltando.
 */
const entregadas = new Set<string>()

/**
 * Pide las piezas QUE FALTAN y las va entregando colocadas según llegan.
 *
 * ## Por pieza, y no en bloque
 *
 * Hasta el 2026-09-08 esto pedía la lista entera cada vez y el visor se protegía de las
 * repeticiones con un `if (atlasCargado.size > 0) return`: en cuanto UNA pieza llegaba,
 * el efecto se cortaba y las que hubieran fallado no se pedían nunca más. Con la sala
 * —una sola pieza— eso no se notaba; con el atlas, que son tres, una descarga a medias se
 * quedaba a medias para siempre y el cuerpo aparecía sin músculos sin que nada fallara.
 *
 * Ahora cada pieza va por su cuenta: la que ya está no se vuelve a pedir, la que falló
 * queda pendiente y se vuelve a pedir a la primera ocasión —cuando el visor vuelve a
 * llamar, o cuando el navegador avisa de que hay red otra vez—.
 *
 * ## La reconexión
 *
 * Un gimnasio es un sótano con LTE malo, así que «sin red al abrir» no es un caso raro:
 * es el caso normal de la primera visita. El evento `online` es la única señal fiable de
 * que volvió la red, y reintentar ahí cuesta cero mientras no falte nada — el bucle
 * recorre la lista y no pide ninguna.
 *
 * Devuelve la función que cancela: al desmontar, una pieza que llegue tarde no toca nada
 * y deja de escucharse la reconexión. `traer` se inyecta para poder probarlo sin red. Una
 * pieza que falla no para el salón: se sigue sin ella, como con las imágenes.
 */
export function cargarPiezas(
  alLlegar: (nombre: string, mallas: Malla[]) => void,
  traer: Traer = traerDeRed,
  lista: Record<string, PiezaDelSalon> = PIEZAS_DEL_SALON,
): () => void {
  let cancelado = false
  // En vuelo POR LLAMADA y no por módulo: si fuera de módulo, una llamada cancelada
  // dejaría su pieza marcada como «ya se está pidiendo» y la llamada siguiente se la
  // saltaría — y la que resolviera estaría cancelada. La pieza se perdería entre las dos.
  const pidiendo = new Set<string>()

  const pedirLasQueFaltan = () => {
    if (cancelado) return
    for (const [nombre, pieza] of Object.entries(lista)) {
      if (entregadas.has(nombre) || pidiendo.has(nombre)) continue
      pidiendo.add(nombre)
      traer(pieza.ruta)
        .then((bytes) => {
          pidiendo.delete(nombre)
          if (cancelado) return
          // Se coloca ANTES de darla por entregada: si los bytes no son una pieza,
          // `leerPieza` lanza, entra por el `catch` y queda pendiente de otro intento.
          const mallas = colocar(leerPieza(bytes), sitioDe(pieza))
          entregadas.add(nombre)
          alLlegar(nombre, mallas)
        })
        .catch(() => {
          pidiendo.delete(nombre)
        })
    }
  }

  pedirLasQueFaltan()
  const alVolverLaRed = () => pedirLasQueFaltan()
  // La guarda no sobra: lo que el navegador trae, el entorno de pruebas puede no traerlo.
  if (typeof window !== 'undefined') window.addEventListener('online', alVolverLaRed)
  return () => {
    cancelado = true
    if (typeof window !== 'undefined') window.removeEventListener('online', alVolverLaRed)
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
    this.porCapa.set(capa, mallas)
    // El atlas se da por cargado CUANDO ESTÁN LAS TRES, y no capa a capa. Ver `atlasCargado`.
    if (CAPAS_DEL_ATLAS.every((c) => this.porCapa.has(c))) {
      for (const c of CAPAS_DEL_ATLAS) atlasCargado.add(c)
    }
  }

  get(capa: string): Malla[] | undefined {
    return this.porCapa.get(capa)
  }
}

/** Las capas que tiene el atlas: los nombres de sus piezas, sin el prefijo. */
const CAPAS_DEL_ATLAS = Object.keys(PIEZAS_DEL_ATLAS).map((n) => n.replace('atlas-', ''))

/**
 * TODAS LAS MALLAS DEL ATLAS, en una lista plana.
 *
 * Es un `const` que se rellena con `push` y nunca se reasigna: quien lo importa lee
 * siempre la misma lista, y su `length` es lo que el visor mete en la firma de lo estático
 * para enterarse de que llegó una pieza más.
 */
export const atlasCache: Malla[] = []

/**
 * LAS CAPAS DEL ATLAS, Y SOLO CUANDO ESTÁN TODAS.
 *
 * Se llena de golpe con la última pieza que llega, no una a una, y la diferencia es todo
 * el asunto: quien lo lee es el visor, y lo lee para decidir si hace falta pedir algo. Con
 * dos piezas de tres la respuesta correcta es SÍ. Hasta el 2026-09-08 se llenaba pieza a
 * pieza, así que la primera que llegaba cortaba el efecto y la que faltaba no se pedía
 * nunca más: el cuerpo se abría sin músculos y no fallaba nada.
 *
 * Vacío no significa «no hay nada dibujado»: las capas que hayan llegado están en
 * `atlasPorCapa` y se dibujan. Significa «al atlas todavía le falta una pieza».
 */
export const atlasCargado = new Set<string>()

/** Qué mallas son de cada capa, para poder encender solo el esqueleto o solo el músculo. */
export const atlasPorCapa = new AlmacenDelAtlas()
