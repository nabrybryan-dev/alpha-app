import type { Malla } from '../../../domain/patrones/malla'
import { colocar, leerPieza } from '../escena/piezas3d'

/**
 * LAS PIEZAS DEL SALÓN: qué hay, dónde va cada una, y cómo llegan.
 *
 * Es la lista de piezas hechas en Blender que se plantan en la sala, con su sitio. Se
 * piden al montar el visor; cada una que llega se lee, se coloca y se avisa para
 * reconstruir. Hasta que llega, la sala está como estaba: el salón se abre igual y el
 * rack aparece cuando aparece.
 *
 * ## Dónde se plantan
 *
 * Las posiciones son ÁNGULOS DE LA SALA, como los marcadores: la pared es un cilindro y
 * todo lo que se apoya en ella se dice en grados y radio. Se dejan por dentro del muro
 * (7 m) y por fuera de la órbita (4,6 m), que es la franja donde el mobiliario ya vive.
 * El giro pone la pieza tangente a la pared: su eje largo —la barra del rack— sigue la
 * curva en vez de clavarse en ella.
 */

export interface PiezaDelSalon {
  ruta: string
  /** Ángulo de la sala en grados, desde +X, y radio en metros. */
  anguloGrados: number
  radio: number
}

/**
 * LA SALA ENTERA HECHA EN BLENDER: 16 × 11 m con el sujeto en el centro. Cuando esta
 * pieza está cargada, la sala de cajas no se construye y los marcadores se cuelgan de
 * sus paredes. Las medidas son las del exportador; si cambian allí, cambian aquí.
 */
export const SALA_GIMNASIO = { nombre: 'sala-gimnasio', medioAncho: 8, medioFondo: 5.5 } as const

export const PIEZAS_DEL_SALON: Record<string, PiezaDelSalon> = {
  // Radio 0: la sala ya viene centrada en el sujeto y con sus paredes en su sitio.
  [SALA_GIMNASIO.nombre]: { ruta: '/piezas/sala-gimnasio.pieza', anguloGrados: 0, radio: 0 },
  // A 150°: entre los marcadores fijos de 90° y 210°, que cuelgan a 1,62 m y no se pueden
  // tapar. A 250° el rack caía justo delante del marcador de enfrente del press y se
  // comía el último dígito (visto el 2026-09-05).
  // Radio 6,2: el rack mide 1,55 de fondo, así que va de 5,4 a 7,0 —pegado al muro y a
  // 0,8 m de la órbita—. A 5,7 su cara cercana quedaba a 30 cm de la cámara y al orbitar
  // llenaba la pantalla entera (visto el 2026-09-05).
  'rack-sentadillas': { ruta: '/piezas/rack-sentadillas.pieza', anguloGrados: 150, radio: 6.2 },
}

/** Las imágenes que piden las piezas, para `TEXTURAS_DEL_SALON`. */
export const TEXTURAS_DE_LAS_PIEZAS = {
  'rack-acero': '/texturas/rack-acero.jpg',
  'rack-barra': '/texturas/rack-barra.jpg',
  hormigon: '/texturas/hormigon.jpg',
  'metal-placa': '/texturas/metal-placa.jpg',
  'gym-atlas': '/texturas/gym-atlas.jpg',
} as const

/** Dónde queda una pieza de la sala, en coordenadas del motor. */
export function sitioDe(p: PiezaDelSalon): { x: number; z: number; giroY: number } {
  const a = (p.anguloGrados * Math.PI) / 180
  // Tangente a la pared: girar el eje local Z hasta la dirección (−sen a, cos a).
  return { x: Math.cos(a) * p.radio, z: Math.sin(a) * p.radio, giroY: -a }
}

type Traer = (ruta: string) => Promise<ArrayBuffer>

const traerDeRed: Traer = async (ruta) => {
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
): () => void {
  let cancelado = false
  for (const [nombre, pieza] of Object.entries(PIEZAS_DEL_SALON)) {
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
