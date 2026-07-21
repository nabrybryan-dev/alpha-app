/**
 * Citas reales de autores conocidos (dominio público / ampliamente atribuidas),
 * sobre esfuerzo, disciplina y constancia. Se muestran al llenar el test final
 * como un empujón mental. Rotan por índice (no se repite la anterior).
 */
export interface Cita {
  texto: string
  autor: string
}

const CITAS: Cita[] = [
  { texto: 'No es que tengamos poco tiempo, sino que perdemos mucho.', autor: 'Séneca' },
  { texto: 'La disciplina es el puente entre las metas y los logros.', autor: 'Jim Rohn' },
  { texto: 'El dolor que sientes hoy será la fuerza que sentirás mañana.', autor: 'Arnold Schwarzenegger' },
  { texto: 'Somos lo que hacemos repetidamente. La excelencia es un hábito.', autor: 'Aristóteles' },
  { texto: 'La fuerza no viene de la capacidad física, sino de una voluntad indomable.', autor: 'Mahatma Gandhi' },
  { texto: 'No cuentes los días, haz que los días cuenten.', autor: 'Muhammad Ali' },
  { texto: 'El cuerpo logra lo que la mente cree.', autor: 'Napoleon Hill' },
  { texto: 'Cae siete veces, levántate ocho.', autor: 'Proverbio japonés' },
]

export function citaPorIndice(indice: number): Cita {
  return CITAS[indice % CITAS.length]
}

/** Índice inicial estable-por-sesión a partir de un texto (el id de la sesión). */
export function indiceDesdeTexto(texto: string): number {
  let h = 0
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0
  return h % 8
}
