export function diasAtras(n: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - n)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export function fechaIsoAtras(n: number, hora: string): string {
  return `${diasAtras(n)}T${hora}`
}
