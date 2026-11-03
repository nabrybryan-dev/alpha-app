import {
  capaDeMomentos,
  INCERTIDUMBRE_DE_EJEMPLO,
  SUJETO_DE_EJEMPLO,
  type CapaDeMomentos,
} from '../../../../domain/sujeto/capaDeMomentos'

/**
 * CÓMO SE ENCIENDE LA CAPA DE MOMENTOS EN EL SALÓN: solo con la bandera `?momentos=ejemplo` en la
 * dirección y solo para la sentadilla con barra, con el sujeto de EJEMPLO. Sin la bandera la capa
 * es vacía y el salón es exactamente el de antes (ni un vértice, ni un nodo de texto).
 *
 * Nunca se calcula con los datos de un asesorado: el sujeto es la constante de ejemplo del dominio.
 * Los umbrales de lectura no están firmados (C-10), así que esta capa no se ofrece a nadie más.
 */
export function banderaDeMomentos(busqueda: string): boolean {
  return new URLSearchParams(busqueda).get('momentos') === 'ejemplo'
}

const VACIA: CapaDeMomentos = { elementos: [], lineas: [], escala: 0, poseDelCalculo: null }

export function capaDelSalon(activa: boolean, categoria: string | undefined, nombre: string | undefined): CapaDeMomentos {
  if (!activa || !categoria || !nombre) return VACIA
  return capaDeMomentos(
    SUJETO_DE_EJEMPLO,
    INCERTIDUMBRE_DE_EJEMPLO,
    { categoria, nombre, sujetoDeEjemplo: true },
    { muestras: 500 },
  )
}
