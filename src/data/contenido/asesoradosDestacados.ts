/**
 * "Fichas Panini" de asesorados reales de Alpha. El foco: demostrar que si
 * quieres entrenar, siempre hay un dónde, un cómo y un cuándo — la vida no es
 * excusa. Los textos parten de lo que el coach contó de cada persona.
 *
 * `aniosEntrenando` queda opcional a propósito: se muestra solo cuando el coach
 * confirma el dato real (no se inventa un número).
 */
export interface AsesoradoDestacado {
  id: string
  nombre: string
  rol: string
  superpoder: string
  historia: string
  frase: string
  foto?: string
  fotoPos?: string
  aniosEntrenando?: number
}

export const ASESORADOS_DESTACADOS: AsesoradoDestacado[] = [
  {
    id: 'juan-diego',
    nombre: 'Juan Diego',
    rol: 'Entrenador',
    superpoder: 'Disciplina',
    historia:
      'Trabaja en algo muy distinto a su pasión y aun así construyó un físico de élite. Su secreto no fue tiempo de sobra: fue constancia y una metodología hecha a su medida. En 5 semanas, resultados que se ven.',
    frase: 'El trabajo no es la excusa: es el contexto.',
    foto: '/asesorados/juan-diego.jpeg',
    fotoPos: 'center 22%',
  },
  {
    id: 'mara',
    nombre: 'Mara Piedrahita',
    rol: 'Ciclismo + Fuerza',
    superpoder: 'Recomposición',
    historia:
      'Le dijeron que un deporte de resistencia y el gimnasio no se llevaban. Los unió. Con un déficit bien llevado mejoró su composición corporal sin dejar de rodar.',
    frase: 'Dos mundos que creían opuestos, un solo plan.',
    foto: '/asesorados/mara.jpeg',
    fotoPos: 'center 28%',
  },
  {
    id: 'luis',
    nombre: 'Luis Hernández',
    rol: 'Empresario',
    superpoder: 'Constancia',
    historia:
      'Entre varios negocios, corre y pedalea, y sostiene su masa muscular. Con un plan que respeta su vida, está soltando la grasa que le sobraba y llegando al físico que siempre quiso.',
    frase: 'Ocupado no es incapaz: es cuestión de plan.',
    foto: '/asesorados/luis.jpeg',
    fotoPos: 'center 30%',
  },
  {
    id: 'valentina',
    nombre: 'Valentina',
    rol: 'Mamá',
    superpoder: 'Superación',
    historia:
      'Hace más de un año nació su bebé. Demostró lo contrario a lo que muchos creen: la maternidad no frena el progreso. Cuidó a su hija y mejoró su físico a la vez.',
    frase: 'Siempre hay un dónde, un cómo y un cuándo.',
    foto: '/asesorados/valentina.jpeg',
    fotoPos: 'center 26%',
  },
]
