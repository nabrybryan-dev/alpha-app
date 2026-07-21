/**
 * Frases cortas que aparecen al guardar una serie. Tono Alpha: atlético,
 * cercano, sin cursilería. Se rotan por índice para que no se repita seguida
 * la misma (varía la personalidad sin depender de aleatoriedad).
 */
const FRASES = [
  '¡Bien hecho! 💪',
  'Vas como un crack 🔥',
  'Eso es, sigue así',
  'Máquina 🦅',
  'Lo estás logrando',
  'Fuerza y control',
  '¡Otra menos! 🎯',
  'Constancia = resultados',
  'Cada serie cuenta',
  'Disciplina Alpha 🖤',
] as const

export function frasePorSerie(indice: number): string {
  return FRASES[indice % FRASES.length]
}
