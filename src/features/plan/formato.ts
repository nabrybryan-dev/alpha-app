const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
export function diaCorto(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return `${DIAS[d.getDay()]} ${d.getDate()}`
}
export function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}
