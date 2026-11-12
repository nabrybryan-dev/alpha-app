/** Sin acentos, sin mayúsculas y sin espacios de más. Lo comparten la carga, la huella de referencia y las órdenes de voz. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}
