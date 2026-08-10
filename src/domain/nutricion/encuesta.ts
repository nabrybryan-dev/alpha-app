/**
 * La encuesta que abre el apartado de Nutrición.
 *
 * DOS CAMINOS, UN SOLO FORMULARIO. Quien llega con la encuesta de captación ya
 * respondida trae casi todo: solo le falta una pregunta. Quien lleva meses
 * asesorándose nunca la respondió y las necesita todas. El formulario es el
 * mismo; lo que cambia es cuántos campos aparecen, y eso NO se decide a mano:
 * se mira qué falta.
 *
 * POR QUÉ SE PREGUNTA TAN POCO. Cada pregunta que se hace es una que el
 * asesorado puede abandonar a la mitad. Solo entra aquí lo que las fórmulas
 * necesitan y lo que el registro de comidas nunca va a poder decirnos: que
 * alguien no registre hígado puede ser que no le gusta, que no lo consigue o
 * que esa semana no tocó, y el registro no distingue. Eso sí hay que
 * preguntarlo. Su peso, en cambio, ya lo sabemos.
 */

import type { Genero } from './composicion'

export type ClaveCampo =
  // Lo que necesitan las fórmulas
  | 'genero'
  | 'fechaNacimiento'
  | 'pesoKg'
  | 'alturaCm'
  | 'cuelloCm'
  | 'cinturaCm'
  | 'caderaCm'
  | 'pasosDiarios'
  | 'diasEntreno'
  // Seguridad
  | 'alergias'
  | 'condicionesMedicas'
  // Preferencias y acceso
  | 'excluye'
  | 'comeVisceras'
  | 'noLeGustan'
  | 'lugarCompra'
  | 'frecuenciaCocina'
  | 'sinAcceso'
  | 'tieneBascula'
  // Solo a quien aplica
  | 'cicloMenstrual'
  /**
   * La única condición del catálogo que cambia lo que se puede recomendar: el
   * hígado tiene retinol y el retinol es teratógeno. Ver `embarazo.ts`.
   */
  | 'embarazo'
  | 'fechaProbableParto'
  /**
   * Antecedente de conducta alimentaria. NO se pregunta en la app -no hay
   * ninguna entrada suya en `CAMPOS`- y por eso nunca aparece en el
   * formulario: preguntarlo en una pantalla sin nadie al otro lado que responda
   * es peor que no preguntarlo. Llega solo desde la encuesta de captación, que
   * sí lo pregunta, y lo lee `senalesDeLaEncuesta`.
   */
  | 'antecedenteTca'

export type TipoCampo = 'numero' | 'fecha' | 'opcion' | 'multiple' | 'texto'

export interface CampoEncuesta {
  clave: ClaveCampo
  etiqueta: string
  tipo: TipoCampo
  /** Por qué se pregunta. Se enseña: nadie contesta bien lo que no entiende. */
  porQue?: string
  opciones?: readonly { valor: string; etiqueta: string }[]
  /** Rango admisible. Fuera de él no se guarda: es un error de dedo. */
  minimo?: number
  maximo?: number
  sufijo?: string
  /** Sin esto no se puede seguir. Lo demás se puede dejar en blanco. */
  obligatorio?: boolean
  /** Solo se pregunta si la respuesta de otro campo lo pide. */
  soloSi?: (respuestas: Respuestas) => boolean
}

export type Respuestas = Partial<Record<ClaveCampo, string | number | string[]>>

const esMujer = (r: Respuestas) => r.genero === 'M'

/**
 * Los perímetros que pide la fórmula US Navy.
 *
 * Los topes no son decorativos: 20 cm de cintura o 200 de cuello son errores de
 * dedo, y un perímetro absurdo produce un porcentaje de grasa absurdo que
 * después alguien lee como si fuera una medición.
 */
export const CAMPOS: readonly CampoEncuesta[] = [
  {
    clave: 'genero',
    etiqueta: '¿Cuál es tu sexo biológico?',
    porQue: 'La fórmula de composición corporal no es la misma para los dos.',
    tipo: 'opcion',
    obligatorio: true,
    opciones: [
      { valor: 'M', etiqueta: 'Mujer' },
      { valor: 'H', etiqueta: 'Hombre' },
    ],
  },
  {
    clave: 'fechaNacimiento',
    etiqueta: '¿Cuándo naciste?',
    porQue: 'La edad entra en el cálculo de tu metabolismo basal.',
    tipo: 'fecha',
    obligatorio: true,
  },
  { clave: 'pesoKg', etiqueta: 'Tu peso', tipo: 'numero', sufijo: 'kg', minimo: 30, maximo: 300, obligatorio: true },
  { clave: 'alturaCm', etiqueta: 'Tu altura', tipo: 'numero', sufijo: 'cm', minimo: 120, maximo: 230, obligatorio: true },
  {
    clave: 'cuelloCm',
    etiqueta: 'Perímetro del cuello',
    porQue: 'Con el cuello, la cintura y la cadera se estima tu porcentaje de grasa sin pinzas ni báscula especial.',
    tipo: 'numero',
    sufijo: 'cm',
    minimo: 20,
    maximo: 70,
    obligatorio: true,
  },
  { clave: 'cinturaCm', etiqueta: 'Perímetro de la cintura', tipo: 'numero', sufijo: 'cm', minimo: 40, maximo: 200, obligatorio: true },
  {
    clave: 'caderaCm',
    etiqueta: 'Perímetro de la cadera',
    tipo: 'numero',
    sufijo: 'cm',
    minimo: 50,
    maximo: 200,
    obligatorio: true,
    // La fórmula masculina no la usa: a un hombre no le falta este dato.
    soloSi: esMujer,
  },
  {
    clave: 'pasosDiarios',
    etiqueta: '¿Cuántos pasos caminas al día, más o menos?',
    porQue:
      'Es el dato que más mueve tus calorías: entre 8.000 y 11.000 pasos hay 230 kcal de diferencia en la misma persona.',
    tipo: 'numero',
    sufijo: 'pasos',
    minimo: 0,
    maximo: 40000,
    obligatorio: true,
  },
  {
    clave: 'diasEntreno',
    etiqueta: '¿Cuántos días entrenas por semana?',
    tipo: 'numero',
    minimo: 0,
    maximo: 14,
    obligatorio: true,
  },
  {
    clave: 'alergias',
    etiqueta: '¿Tienes alguna alergia o intolerancia alimentaria?',
    porQue: 'Es lo primero que mira el sistema antes de sugerirte cualquier cosa.',
    tipo: 'multiple',
    obligatorio: true,
    opciones: [
      { valor: 'ninguna', etiqueta: 'Ninguna' },
      { valor: 'lacteos', etiqueta: 'Lácteos' },
      { valor: 'gluten', etiqueta: 'Gluten' },
      { valor: 'frutos_secos', etiqueta: 'Frutos secos' },
      { valor: 'mani', etiqueta: 'Maní' },
      { valor: 'mariscos', etiqueta: 'Mariscos' },
      { valor: 'huevo', etiqueta: 'Huevo' },
      { valor: 'soya', etiqueta: 'Soya' },
      { valor: 'otra', etiqueta: 'Otra' },
    ],
  },
  {
    clave: 'condicionesMedicas',
    etiqueta: '¿Alguna condición de salud que afecte lo que comes?',
    tipo: 'multiple',
    opciones: [
      { valor: 'ninguna', etiqueta: 'Ninguna' },
      { valor: 'diabetes', etiqueta: 'Diabetes' },
      { valor: 'hipertension', etiqueta: 'Hipertensión' },
      { valor: 'tiroides', etiqueta: 'Tiroides' },
      { valor: 'colon_irritable', etiqueta: 'Colon irritable' },
      { valor: 'reflujo', etiqueta: 'Reflujo o gastritis' },
      { valor: 'renal', etiqueta: 'Riñón' },
      { valor: 'otra', etiqueta: 'Otra' },
    ],
  },
  {
    clave: 'excluye',
    etiqueta: '¿Hay algo que no comas por decisión propia?',
    tipo: 'multiple',
    opciones: [
      { valor: 'nada', etiqueta: 'Como de todo' },
      { valor: 'carne_roja', etiqueta: 'Carne roja' },
      { valor: 'cerdo', etiqueta: 'Cerdo' },
      { valor: 'pollo', etiqueta: 'Pollo' },
      { valor: 'pescado', etiqueta: 'Pescado' },
      { valor: 'todo_animal', etiqueta: 'Nada de origen animal' },
      { valor: 'otra', etiqueta: 'Otra' },
    ],
  },
  {
    clave: 'comeVisceras',
    etiqueta: '¿Comes vísceras? (hígado, pajarilla, riñón)',
    porQue: 'El hígado es la fuente de hierro más potente que hay. Si lo comes, cambia lo que te sugerimos.',
    tipo: 'opcion',
    opciones: [
      { valor: 'si', etiqueta: 'Sí, sin problema' },
      { valor: 'algunas', etiqueta: 'Algunas' },
      { valor: 'no', etiqueta: 'No' },
    ],
  },
  {
    clave: 'noLeGustan',
    etiqueta: '¿Qué alimentos no te gustan nada?',
    porQue: 'No te vamos a sugerir algo que no te vas a comer.',
    tipo: 'texto',
  },
  {
    clave: 'lugarCompra',
    etiqueta: '¿Dónde compras la comida normalmente?',
    tipo: 'opcion',
    opciones: [
      { valor: 'plaza_mercado', etiqueta: 'Plaza de mercado' },
      { valor: 'supermercado', etiqueta: 'Supermercado' },
      { valor: 'tienda_barrio', etiqueta: 'Tienda de barrio' },
      { valor: 'domicilio', etiqueta: 'A domicilio' },
      { valor: 'mezcla', etiqueta: 'Un poco de todo' },
    ],
  },
  {
    clave: 'frecuenciaCocina',
    etiqueta: '¿Cocinas tú?',
    porQue: 'Si no cocinas, no te podemos preguntar por el aceite, y el registro cambia.',
    tipo: 'opcion',
    opciones: [
      { valor: 'casi_siempre', etiqueta: 'Casi siempre' },
      { valor: 'a_veces', etiqueta: 'A veces' },
      { valor: 'casi_nunca', etiqueta: 'Casi nunca' },
    ],
  },
  {
    clave: 'sinAcceso',
    etiqueta: '¿Hay algo que no consigas o no puedas pagar?',
    tipo: 'texto',
  },
  {
    clave: 'tieneBascula',
    etiqueta: '¿Tienes báscula de cocina?',
    porQue: 'Con báscula el registro tiene ±5 % de margen. Sin ella, ±25 %.',
    tipo: 'opcion',
    obligatorio: true,
    opciones: [
      { valor: 'si', etiqueta: 'Sí' },
      { valor: 'puede_conseguir', etiqueta: 'No, pero puedo conseguir una' },
      { valor: 'no', etiqueta: 'No' },
    ],
  },
  {
    clave: 'cicloMenstrual',
    etiqueta: '¿Cómo es tu ciclo menstrual?',
    porQue:
      'Un ciclo irregular o ausente puede ser la primera señal de que estás comiendo menos de lo que tu cuerpo necesita.',
    tipo: 'opcion',
    soloSi: esMujer,
    opciones: [
      { valor: 'regular', etiqueta: 'Regular' },
      { valor: 'irregular', etiqueta: 'Irregular' },
      { valor: 'ausente', etiqueta: 'No me baja hace meses' },
      { valor: 'anticoncepcion_hormonal', etiqueta: 'Uso anticoncepción hormonal' },
      { valor: 'prefiere_no_decir', etiqueta: 'Prefiero no decirlo' },
    ],
  },
  {
    clave: 'embarazo',
    etiqueta: '¿Estás embarazada o en lactancia?',
    porQue:
      'En el embarazo hay alimentos que no se recomiendan, como el hígado. Si nos lo dices, dejamos de sugerírtelos.',
    tipo: 'opcion',
    soloSi: esMujer,
    opciones: [
      { valor: 'no', etiqueta: 'No' },
      { valor: 'si', etiqueta: 'Sí, estoy embarazada' },
      { valor: 'lactancia', etiqueta: 'En lactancia' },
      { valor: 'prefiere_no_decir', etiqueta: 'Prefiero no decirlo' },
    ],
  },
  {
    clave: 'fechaProbableParto',
    etiqueta: '¿Cuál es tu fecha probable de parto?',
    // Se dice para qué sirve. Pedir una fecha sin explicarla se lee como que la
    // app quiere saber de más, y quien no entiende una pregunta la deja vacía.
    porQue:
      'Solo para dejar de avisarte cuando ya no aplique, en vez de que se quede activo para siempre.',
    tipo: 'fecha',
    soloSi: (r) => r.embarazo === 'si',
  },
]

/**
 * Los campos que hay que preguntar de verdad.
 *
 * Se cae uno cuando ya se sabe la respuesta -de la encuesta de captación o de
 * lo que ya haya en el perfil- o cuando no aplica a esa persona.
 */
export function camposAPreguntar(
  yaSabidos: Respuestas,
  respuestasEnCurso: Respuestas = {},
): CampoEncuesta[] {
  const todo = { ...yaSabidos, ...respuestasEnCurso }
  return CAMPOS.filter((campo) => {
    if (campo.soloSi && !campo.soloSi(todo)) return false
    return !tieneValor(yaSabidos[campo.clave])
  })
}

/**
 * Si la encuesta ya se puede dar por respondida.
 *
 * Mira SOLO los campos obligatorios. Los opcionales -qué no te gusta, a qué no
 * tienes acceso- mejoran las recomendaciones pero no hacen falta para calcular
 * nada, y exigirlos dejaría fuera para siempre a quien los deje en blanco: la
 * compuerta no se volvería a abrir nunca.
 */
export function encuestaCompleta(respuestas: Respuestas): boolean {
  return camposAPreguntar(respuestas).every((campo) => !campo.obligatorio)
}

/**
 * Si a esta persona todavía hay que pedirle la encuesta.
 *
 * Vive aquí y no en la pantalla porque lo consultan dos sitios: la compuerta de
 * Nutrición -que decide si enseñar cifras o el formulario- y el aviso de «Hoy».
 * Cuando la regla estaba solo en la compuerta, la encuesta únicamente aparecía a
 * quien entraba a la pestaña de Nutrición: 16 de 20 asesorados nunca la vieron.
 */
export function encuestaPendiente(
  perfil: { respuestas?: Respuestas; completadaEn?: string } | undefined,
): boolean {
  if (!perfil?.completadaEn) return true
  return !encuestaCompleta(perfil.respuestas ?? {})
}

/** Si una respuesta cuenta como contestada. */
export function tieneValor(valor: string | number | string[] | undefined): boolean {
  if (valor === undefined || valor === null) return false
  if (Array.isArray(valor)) return valor.length > 0
  if (typeof valor === 'number') return Number.isFinite(valor)
  return valor.trim().length > 0
}

export interface ErrorCampo {
  clave: ClaveCampo
  mensaje: string
}

/**
 * Qué impide guardar. Lista vacía = se puede seguir.
 *
 * Los rangos rechazan errores de dedo, no personas: 300 kg y 230 cm entran. Lo
 * que no entra es un 3 donde iban 30, porque de ahí sale un porcentaje de grasa
 * que después alguien lee como si lo hubieran medido.
 */
export function revisarRespuestas(
  campos: readonly CampoEncuesta[],
  respuestas: Respuestas,
): ErrorCampo[] {
  const errores: ErrorCampo[] = []
  for (const campo of campos) {
    const valor = respuestas[campo.clave]

    if (!tieneValor(valor)) {
      if (campo.obligatorio) errores.push({ clave: campo.clave, mensaje: 'Falta responder' })
      continue
    }

    if (campo.tipo === 'numero') {
      const n = Number(valor)
      if (!Number.isFinite(n)) {
        errores.push({ clave: campo.clave, mensaje: 'Tiene que ser un número' })
      } else if (campo.minimo !== undefined && n < campo.minimo) {
        errores.push({ clave: campo.clave, mensaje: `Parece muy bajo (mínimo ${campo.minimo})` })
      } else if (campo.maximo !== undefined && n > campo.maximo) {
        errores.push({ clave: campo.clave, mensaje: `Parece muy alto (máximo ${campo.maximo})` })
      }
    }

    if (campo.tipo === 'opcion' && campo.opciones) {
      const admitidos = campo.opciones.map((o) => o.valor)
      if (!admitidos.includes(String(valor))) {
        errores.push({ clave: campo.clave, mensaje: 'Esa opción no existe' })
      }
    }
  }
  return errores
}

/**
 * El género en la forma que esperan las fórmulas, o `null`.
 *
 * Se valida en vez de castear: un género mal escrito aplicaría la fórmula
 * equivocada y daría un porcentaje de grasa creíble pero falso, que es peor que
 * no dar ninguno.
 */
export function generoDe(respuestas: Respuestas): Genero | null {
  const valor = respuestas.genero
  return valor === 'M' || valor === 'H' ? valor : null
}
