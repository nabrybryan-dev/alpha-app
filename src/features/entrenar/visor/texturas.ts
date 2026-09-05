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

import { TEXTURAS_DE_LAS_PIEZAS } from './piezas'

/** Nombre → ruta pública. Las rutas son de `public/texturas/`. */
export const TEXTURAS_DEL_SALON = {
  'suelo-goma': '/texturas/suelo-goma.jpg',
  ...TEXTURAS_DE_LAS_PIEZAS,
} as const

export type NombreDeTextura = keyof typeof TEXTURAS_DEL_SALON

interface MotorQueEstampa {
  cargarTextura(nombre: string, imagen: HTMLImageElement): void
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
  for (const [nombre, ruta] of Object.entries(TEXTURAS_DEL_SALON)) {
    const imagen = crearImagen()
    imagen.onload = () => {
      if (cancelado) return
      motor.cargarTextura(nombre, imagen)
      alCargar(nombre)
    }
    // Sin la imagen se dibuja en blanco. No es un fallo que merezca parar el salón.
    imagen.onerror = () => {}
    imagen.src = ruta
  }
  return () => {
    cancelado = true
  }
}
