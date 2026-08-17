/**
 * Las frases que cierran el letrero de inicio de semana.
 *
 * TONO. El del design system y el del coach: tuteo, sin emoji, sin épica de
 * gimnasio. Hablan del proceso —registrar, sostener, volver— y no del resultado,
 * porque el resultado no depende de la semana que empieza. Ninguna promete nada.
 *
 * POR QUÉ UN BANCO Y NO UNA POR MICROCICLO. Escribir una cada ocho días es
 * trabajo que se abandona al tercer mes, y una frase vieja repetida se lee como
 * plantilla. Un banco se escribe una vez y rota solo.
 */
export const FRASES_MICROCICLO: readonly string[] = [
  'El microciclo no se daña por reacomodar. Se daña por desaparecer.',
  'Lo que no se anota no existe: sin registro no hay progresión que calcular.',
  'La carga de esta semana salió de lo que hiciste la pasada. Así de literal.',
  'Parar una repetición antes no es rendirse: es dejar margen para mañana.',
  'El rango completo pesa más que el kilo de más.',
  'Un mal día no rompe un bloque. Faltar tres semanas, sí.',
  'La técnica es la que sostiene la carga cuando la fuerza se acaba.',
  'Si necesitas impulso para levantarlo, el peso no es tuyo todavía.',
  'Los kilos suben cuando cierras el rango, no cuando lo intentas.',
  'Entrenar cansado se puede. Entrenar sin dormir, no rinde igual.',
  'El descanso entre series también está programado. No es tiempo perdido.',
  'Comer y dormir no son el complemento del plan: son la mitad del plan.',
  'Los pasos del día pesan más en el resultado que el cardio del final.',
  'Nadie progresa en línea recta. Se progresa en promedio.',
  'Tu RIR real vale más que el que crees que deberías poner.',
  'La serie que registras hoy es la que programa tu semana que viene.',
  'Constancia no es entrenar perfecto: es volver siempre.',
  'Si la espalda se redondea, la serie ya terminó.',
  'Mejor tres series buenas que cinco arrastradas.',
  'El peso que mueves importa menos que cómo lo mueves.',
  'Los bloques se ganan en las semanas normales, no en las heroicas.',
  'Avisa cuando algo duela. Se ajusta el plan, no se aguanta.',
  'La báscula es un dato del lunes, no un veredicto.',
  'Empieza por el ejercicio que menos te apetece. El resto sale solo.',
]

/**
 * La frase de este microciclo.
 *
 * Deterministica a propósito: la misma persona ve la MISMA frase toda la semana.
 * Si cambiara en cada render, dejaría de ser un mensaje y sería ruido — y nadie
 * puede acordarse de algo que se mueve cada vez que abre la pantalla.
 */
export function fraseDelMicrociclo(
  microcicloId: string,
  frases: readonly string[] = FRASES_MICROCICLO,
): string | undefined {
  if (frases.length === 0) return undefined
  let suma = 0
  for (const caracter of microcicloId) suma = (suma * 31 + caracter.charCodeAt(0)) % 100000
  return frases[suma % frases.length]
}
