/**
 * La semana a la que pertenece una fecha, de lunes a domingo.
 *
 * Semana natural y no "los ultimos 7 dias": el asesorado piensa en semanas
 * -su microciclo va por semanas- y una tira que se desplaza cada dia no le deja
 * reconocer donde esta.
 */

/**
 * Fecha local en `YYYY-MM-DD`, sin pasar por UTC.
 *
 * `toISOString()` devuelve UTC, y en Colombia (UTC-5) eso significa que a
 * partir de las 7 de la tarde da el dia SIGUIENTE. Una cena registrada a las
 * 8 pm habria caido en el dia equivocado, todos los dias.
 */
export function aIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/** Los siete dias de la semana de `fecha`, de lunes a domingo. */
export function semanaDe(fecha: string): string[] {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  // getDay() da 0 para domingo; aqui la semana empieza en lunes.
  const desplazamiento = (new Date(anio, mes - 1, dia).getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) => aIso(new Date(anio, mes - 1, dia - desplazamiento + i)))
}
