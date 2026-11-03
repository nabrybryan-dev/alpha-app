import type { IdDeRegion } from '../../sujeto/regiones'
import type { RespaldoDeCadena } from './zonasDePraxis'

/**
 * Las zonas del cuerpo dichas sin la palabra técnica, para quien no entiende de anatomía.
 * Los textos los aprobó Bryan; la versión técnica (`zonasDePraxis.ts`) no cambia.
 *
 * - `nombre`: cómo le dice la persona a esa parte («el hombro»).
 * - `queHace`: para qué sirve, con un gesto de todos los días.
 * - `conQuien`: con qué otras partes va en línea, sin porcentajes ni nombres de músculos.
 */
export interface FichaLlanaDeRegion {
  nombre: string
  queHace: string
  conQuien: string
}

export const FICHA_LLANA_DE_REGION: Readonly<Record<IdDeRegion, FichaLlanaDeRegion>> = {
  pecho: {
    nombre: 'el pecho',
    queHace: 'Empuja los brazos hacia adelante, como al empujar una puerta',
    conQuien: 'Línea con el bíceps y el antebrazo (visto en cuerpos disecados)',
  },
  delt: {
    nombre: 'el hombro',
    queHace: 'Levanta el brazo hacia todos lados; los músculos pequeños de adentro lo mantienen firme',
    conQuien: 'Línea con la parte alta de la espalda y la parte de atrás del antebrazo',
  },
  bic: {
    nombre: 'el brazo de adelante',
    queHace: 'Dobla el codo, como al subir una taza',
    conQuien: 'Línea con el pecho y el antebrazo',
  },
  tri: {
    nombre: 'el brazo de atrás',
    queHace: 'Estira el codo hasta enderezar el brazo',
    conQuien: 'Línea con la espalda ancha y la parte de atrás del antebrazo',
  },
  ante: {
    nombre: 'el antebrazo',
    queHace: 'Cierra la mano y sostiene el agarre',
    conQuien: 'Línea con el pecho, el bíceps y el hombro',
  },
  abd: {
    nombre: 'la barriga',
    queHace: 'Mantiene el tronco firme y acerca las costillas a la cadera',
    conQuien: 'Es una idea de «línea del frente», sin conexión comprobada',
  },
  obl: {
    nombre: 'los costados de la cintura',
    queHace: 'Giran e inclinan el tronco',
    conQuien: 'Líneas en diagonal, comprobadas solo en parte',
  },
  trap: {
    nombre: 'la parte alta de la espalda',
    queHace: 'Sube, junta y baja los omóplatos',
    conQuien: 'Línea con el hombro; en parte con otras de la espalda',
  },
  dors: {
    nombre: 'la espalda ancha',
    queHace: 'Trae el brazo hacia atrás, como al remar',
    conQuien: 'Línea en diagonal con el glúteo del lado contrario',
  },
  lumb: {
    nombre: 'la parte baja de la espalda',
    queHace: 'La mantiene firme y ayuda a enderezarla',
    conQuien: '«Línea trasera»: pantorrilla, muslo de atrás y espalda baja',
  },
  glu: {
    nombre: 'el glúteo',
    queHace: 'Empuja la cadera al levantarte y la mantiene firme sobre una pierna',
    conQuien: 'Línea en diagonal con la espalda y, en parte, con el costado',
  },
  cua: {
    nombre: 'el muslo de adelante',
    queHace: 'Estira la rodilla, como al ponerte de pie',
    conQuien: 'Idea de «línea del frente», sin conexión comprobada',
  },
  isq: {
    nombre: 'el muslo de atrás',
    queHace: 'Dobla la rodilla y lleva la cadera hacia atrás',
    conQuien: '«Línea trasera»',
  },
  adu: {
    nombre: 'la parte interna del muslo',
    queHace: 'Acerca la pierna al centro y ayuda a estabilizar la cadera',
    conQuien: 'Una idea de línea profunda, que las revisiones no evaluaron',
  },
  gem: {
    nombre: 'la pantorrilla',
    queHace: 'Empuja el pie contra el suelo',
    conQuien: 'Comienza la «línea trasera»; en parte, con el costado de la pierna',
  },
}

/** Cuánto se ha visto de cada línea, dicho llano. Sale del mismo nivel que la ficha técnica: no puede decir más. */
export const ETIQUETA_LLANA_DE_RESPALDO: Readonly<Record<RespaldoDeCadena, string>> = {
  verificada: 'Esta línea se ha visto en cuerpos disecados',
  parcial: 'Esta línea se ha visto solo en parte en cuerpos disecados',
  modelo: 'Es una idea: nadie ha visto esa conexión',
  sin_evaluar: 'Es una idea que los estudios no revisaron',
}

export const NOTA_LLANA_DE_CADENAS =
  'No está demostrado que la fuerza viaje por estas líneas en una persona viva.'
