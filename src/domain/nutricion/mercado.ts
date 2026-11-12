/**
 * Apoyo puro de «Mi mercado»: de una línea de la lista de compras del plan
 * («Pechuga de pollo (1.5 kg)») a las palabras con las que se busca en el catálogo.
 *
 * Solo propone candidatos: la persona confirma cuál alimento compró. Nada de esto
 * decide por ella ni escribe en la despensa.
 */

const RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'y', 'o', 'en', 'si', 'queda', 'poca', 'kg', 'g', 'l'])

/** Hasta tres palabras útiles de la línea, sin cantidades ni lo que va entre paréntesis. */
export function palabrasDeBusqueda(linea: string, maximo = 3): string[] {
  const sinParentesis = linea.replace(/\([^)]*\)/g, ' ')
  const palabras = sinParentesis
    .split(/[^\p{L}]+/u)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 2 && !RELLENO.has(p))
  return [...new Set(palabras)].slice(0, maximo)
}

/** El texto de un pedido: sin espacios de más y con la primera en mayúscula. `null` si es muy corto. */
export function textoDePedido(escrito: string): string | null {
  const limpio = escrito.trim().replace(/\s+/g, ' ')
  if (limpio.length < 2) return null
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}
