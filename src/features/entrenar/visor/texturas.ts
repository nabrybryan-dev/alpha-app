/**
 * LAS IMÁGENES DEL SALÓN, y cómo llegan al motor.
 *
 * El motor no sabe de rutas ni de red: recibe una imagen ya cargada y un nombre. Esto es
 * la lista de qué imágenes hay, dónde están, y la carga en segundo plano. Se pide todo al
 * montar el visor; cada imagen que llega se entrega al motor y se avisa para volver a
 * pintar. Mientras no llega, la malla que la esperaba se dibuja en blanco —el shader
 * multiplica por blanco cuando no hay textura—, así que el salón se abre igual y la
 * goma del suelo aparece un instante después. Sin parpadeo raro: pasa de plano a
 * estampado y ya.
 *
 * Una imagen que falla no para nada: se queda en blanco y se sigue. El salón tiene que
 * abrirse con conexión mala, que es la del gimnasio.
 */

/**
 * Nombre → ruta pública y COLOR MEDIO de la imagen.
 *
 * El color medio no es decoración: es lo que se pinta mientras la imagen viaja. Una malla
 * horneada lleva albedo 1 —el color oscuro del suelo vive en la imagen, no en el vértice—,
 * así que sin imagen se dibujaría con la luz desnuda, o sea BLANCA. Medido sobre los JPEG
 * con `scripts/blender/` el 2026-09-05.
 */
export const TEXTURAS_DEL_SALON: Record<string, { ruta: string; medio: readonly [number, number, number] }> = {
  'suelo-goma': { ruta: '/texturas/suelo-goma.jpg', medio: [82, 81, 87] },
  hormigon: { ruta: '/texturas/hormigon.jpg', medio: [58, 58, 58] },
  'gym-atlas': { ruta: '/texturas/gym-atlas.jpg', medio: [38, 29, 33] },
  'rack-acero': { ruta: '/texturas/rack-acero.jpg', medio: [57, 57, 57] },
  'rack-barra': { ruta: '/texturas/rack-barra.jpg', medio: [144, 144, 149] },
}

export type NombreDeTextura = keyof typeof TEXTURAS_DEL_SALON

interface MotorQueEstampa {
  cargarTextura(nombre: string, imagen: HTMLImageElement): void
  cargarTexturaPlana(nombre: string, rgb: readonly [number, number, number]): void
}

/**
 * Pide todas las imágenes y las va entregando al motor según llegan.
 *
 * Devuelve la función que CANCELA: al desmontar el visor, una imagen que llegue tarde no
 * debe tocar un motor que ya no existe. `crearImagen` se inyecta para poder probar esto
 * sin red: jsdom no descarga nada.
 */
export function cargarTexturas(
  motor: MotorQueEstampa,
  /** Se llama con el nombre de cada imagen que ya está en el motor. */
  alCargar: (nombre: string) => void,
  crearImagen: () => HTMLImageElement = () => new Image(),
): () => void {
  let cancelado = false
  // PRIMERO EL COLOR MEDIO, y de forma síncrona: para cuando llegue la sala, sus
  // superficies ya tienen su tono aunque las imágenes sigan de camino.
  for (const [nombre, t] of Object.entries(TEXTURAS_DEL_SALON)) motor.cargarTexturaPlana(nombre, t.medio)
  for (const [nombre, t] of Object.entries(TEXTURAS_DEL_SALON)) {
    const imagen = crearImagen()
    imagen.onload = () => {
      if (cancelado) return
      motor.cargarTextura(nombre, imagen)
      alCargar(nombre)
    }
    // Si la imagen no llega, se queda el color medio. No es un fallo que merezca parar
    // el salón, y con la plana puesta tampoco se ve mal: se ve sin detalle.
    imagen.onerror = () => {}
    imagen.src = t.ruta
  }
  return () => {
    cancelado = true
  }
}
