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
  /**
   * Cuál es la alergia, cuando marcó «Otra».
   *
   * La encuesta ofrecía «Otra» y no tenía dónde decir cuál, así que una alergia
   * declarada llegaba sin nada que apartar del plan. El 2026-08-17 había una
   * persona así, y cuatro con exclusión «otra». Una alergia recogida que el
   * sistema no puede accionar es peor que no haberla preguntado, porque parece
   * recogida.
   *
   * NO es obligatoria, y no por comodidad: `encuestaCompleta` mira solo los
   * obligatorios, y exigirla dejaría a quien la deje en blanco detrás del
   * formulario, sin sus cifras, para siempre. Lo que sí hace es aparecer, que es
   * lo que faltaba. Quien no la conteste sigue en la lista de trabajo de la
   * nutricionista, que es donde estaba antes.
   */
  | 'alergiaOtra'
  | 'condicionesMedicas'
  // Preferencias y acceso
  | 'excluye'
  /** Qué es lo que no come, cuando marcó «Otra». Mismo caso que `alergiaOtra`. */
  | 'excluyeOtra'
  | 'comeVisceras'
  | 'noLeGustan'
  | 'lugarCompra'
  /**
   * Cada cuántos días hace mercado: 8 o 15, alineado con la programación.
   *
   * Las dos, junto con `despensaEs`, las necesita la despensa —que todavía no
   * existe— y por eso van SIN `obligatorio`. Marcarlas obligatorias hoy dejaría a
   * las 11 personas que ya completaron la encuesta detrás del formulario otra
   * vez, perdiendo sus cifras por una funcionalidad que aún no pueden usar.
   * Cuando la despensa exista, será ella quien las pida en su propia puerta.
   * Ver `docs/specs/2026-08-16-de-donde-sale-la-lista-de-compra.md`.
   */
  | 'cicloCompra'
  /**
   * Si lo que compra es solo suyo o de toda la casa. Decide si la cantidad de la
   * despensa significa algo: si es de la casa, se guarda pero no se calcula ni se
   * le enseña. Lo que NO se hace es preguntar cuántos viven allí y dividir —nadie
   * come un cuarto de la nevera.
   */
  | 'despensaEs'
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
   * Las dos que vuelven cada quince días mientras haya embarazo o lactancia.
   *
   * Decisión de Manuela, 2026-08-09: antes de tomar decisiones hay que saber
   * qué le dijo SU médico en su caso. El sistema pone el umbral mínimo mientras
   * no conste nada; lo que conste manda sobre él.
   */
  | 'recomendacionMedica'
  | 'diagnosticoEmbarazo'
  /**
   * Cuándo contestó las dos de arriba. NO es una pregunta —no tiene entrada en
   * `CAMPOS`, nadie la ve— y sin ella no habría forma de saber si la respuesta
   * es de hace tres días o de hace tres meses. La estampa `conSelloDeFecha`.
   */
  | 'preguntasDeEmbarazoEn'
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
  /**
   * Cada cuántos días vuelve a preguntarse, aunque ya esté contestada.
   *
   * SIN ESTO SE PREGUNTA UNA VEZ Y NUNCA MÁS, que es lo que hacían todas hasta
   * el 2026-08-09. Sirve para lo que cambia con el tiempo y no se puede deducir
   * de nada que la app ya sepa: qué le dijo su médico este mes.
   *
   * UNA PREGUNTA QUE VUELVE NUNCA ES OBLIGATORIA. Si lo fuera reabriría la
   * compuerta de Nutrición cada quince días y dejaría a una embarazada sin sus
   * cifras por no haber ido al médico. Lo fija `LAS_QUE_VUELVEN_NO_BLOQUEAN`.
   */
  cadaDias?: number
  /** Dónde se guarda cuándo se contestó. Obligatorio si hay `cadaDias`. */
  selloDeFecha?: ClaveCampo
}

export type Respuestas = Partial<Record<ClaveCampo, string | number | string[]>>

const esMujer = (r: Respuestas) => r.genero === 'M'

/**
 * Si marco esa opcion en una pregunta de las de marcar varias.
 *
 * Se comprueba el ARRAY y no un `includes` a secas porque las respuestas viejas
 * pueden traer el campo sin contestar, y `undefined.includes` revienta la
 * encuesta entera para esa persona.
 */
const marco = (valor: Respuestas[ClaveCampo], opcion: string) =>
  Array.isArray(valor) && valor.includes(opcion)

/** Quien declaró embarazo o lactancia. Es a quien le vuelven las dos quincenales. */
const enEmbarazoOLactancia = (r: Respuestas) => r.embarazo === 'si' || r.embarazo === 'lactancia'

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
    clave: 'alergiaOtra',
    etiqueta: '¿Cuál es esa alergia o intolerancia?',
    porQue:
      'Sin saber cuál, no podemos apartar nada de tu plan: quedaría anotada y sin efecto.',
    tipo: 'texto',
    // Solo a quien marcó «Otra». Preguntárselo a todo el mundo sería una
    // pregunta muerta en el 90% de los casos, y esta pantalla es la que le tapa
    // sus cifras hasta que la termine.
    soloSi: (r) => marco(r.alergias, 'otra'),
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
    clave: 'excluyeOtra',
    etiqueta: '¿Qué es lo que no comes?',
    tipo: 'texto',
    soloSi: (r) => marco(r.excluye, 'otra'),
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
    clave: 'cicloCompra',
    etiqueta: '¿Cada cuánto haces mercado?',
    porQue: 'Para calcular cuánto necesitas hasta la próxima compra, no un número suelto.',
    tipo: 'opcion',
    // 8 y 15, no 7 y 15. Las programaciones van a 8 o a 15 días: con la compra a
    // 7 se desfasaría un día por ciclo, y al sexto iría casi una semana por
    // delante del plan que tiene que abastecer.
    opciones: [
      { valor: '8', etiqueta: 'Cada 8 días' },
      { valor: '15', etiqueta: 'Cada 15 días' },
    ],
  },
  {
    clave: 'despensaEs',
    etiqueta: '¿La comida que compras es solo tuya o de toda la casa?',
    porQue: 'Dos kilos de pollo no dicen lo mismo si son para ti que si son para cuatro.',
    tipo: 'opcion',
    opciones: [
      { valor: 'solo_yo', etiqueta: 'Solo mía' },
      { valor: 'toda_la_casa', etiqueta: 'De toda la casa' },
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
      // ES UN ESTADO, NO UN «NO» MÁS. Quien no puede quedar embarazada
      // -menopausia, cirugía, cualquier motivo suyo- responde algo distinto de
      // quien hoy no lo está: a ella esta pregunta no hay que volver a hacérsela
      // nunca. Sin esta opción, «no» tendría que releerse cada cierto tiempo a
      // todo el mundo. Ver `puedeQuedarEmbarazada`.
      { valor: 'sin_fertilidad', etiqueta: 'No, y no puedo quedar embarazada' },
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
  {
    clave: 'diagnosticoEmbarazo',
    etiqueta: '¿Te han diagnosticado algo en este tiempo?',
    // De todo lo que un médico puede decir en una consulta de embarazo, estas
    // tres son las que CAMBIAN lo que el sistema debería recomendar: la anemia
    // mueve el hierro, la diabetes gestacional mueve el carbohidrato entero y
    // la hipertensión mueve el sodio. Lo demás se conversa con Manuela; esto se
    // pregunta porque sin ello el sistema calcularía sobre una persona que ya
    // no es la que tiene delante.
    porQue: 'Si te han diagnosticado algo, tu plan tiene que cambiar con eso y no después.',
    tipo: 'multiple',
    cadaDias: 15,
    selloDeFecha: 'preguntasDeEmbarazoEn',
    soloSi: enEmbarazoOLactancia,
    opciones: [
      { valor: 'ninguno', etiqueta: 'Nada, todo bien' },
      { valor: 'anemia', etiqueta: 'Anemia o hierro bajo' },
      { valor: 'diabetes_gestacional', etiqueta: 'Diabetes gestacional' },
      { valor: 'hipertension', etiqueta: 'Tensión alta o preeclampsia' },
      { valor: 'otro', etiqueta: 'Otra cosa' },
    ],
  },
  {
    clave: 'recomendacionMedica',
    etiqueta: '¿Tu médico te indicó algo sobre tu alimentación?',
    // ABIERTA Y NO DE OPCIONES, a propósito. Una indicación médica no cabe en
    // una lista que escribimos nosotros, y una lista incompleta haría que la
    // respuesta correcta fuera «otro» casi siempre. Lo que ella escriba lo lee
    // Manuela, que es quien decide con eso.
    porQue:
      'Lo que te diga tu médico manda sobre lo que calcule la app. Mientras no nos digas nada, la app se pone en el margen más prudente.',
    tipo: 'texto',
    cadaDias: 15,
    selloDeFecha: 'preguntasDeEmbarazoEn',
    soloSi: enEmbarazoOLactancia,
  },
]

/**
 * Ninguna pregunta que vuelve puede bloquear. Se comprueba, no se confía.
 *
 * Si una lo fuera, `encuestaCompleta` daría falso cada quince días y la
 * compuerta de Nutrición se cerraría sola: una embarazada perdería sus cifras
 * por no haber ido al médico todavía. Es justo el error que este archivo evita
 * en `encuestaCompleta` mirando solo los obligatorios.
 */
export const LAS_QUE_VUELVEN_NO_BLOQUEAN = CAMPOS.every(
  (campo) => !campo.cadaDias || !campo.obligatorio,
)

/** Días enteros entre dos fechas ISO. Negativo si la segunda es anterior. */
function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  // Mediodía en las dos para que un cambio de horario no reste un día entero.
  const uno = Date.UTC(a1, m1 - 1, d1, 12)
  const dos = Date.UTC(a2, m2 - 1, d2, 12)
  return Math.round((dos - uno) / 86_400_000)
}

/**
 * Si a este campo ya le toca volver a preguntarse.
 *
 * SIN SELLO DE FECHA, TOCA. Una respuesta de la que no se sabe cuándo se dio
 * podría ser de hace medio año, y aquí lo barato es preguntar de más: la
 * alternativa es decidir la alimentación de una embarazada con lo que su médico
 * dijo hace meses.
 */
function toca(campo: CampoEncuesta, respuestas: Respuestas, hoy: string): boolean {
  if (!campo.cadaDias) return false
  const sello = campo.selloDeFecha ? respuestas[campo.selloDeFecha] : undefined
  if (typeof sello !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sello)) return true
  return diasEntre(sello, hoy) >= campo.cadaDias
}

/**
 * Los campos que hay que preguntar de verdad.
 *
 * Se cae uno cuando ya se sabe la respuesta -de la encuesta de captación o de
 * lo que ya haya en el perfil- o cuando no aplica a esa persona.
 *
 * `hoy` solo hace falta para las que vuelven. Sin él se comportan como el resto
 * —contestadas es contestadas— y por eso `encuestaCompleta`, que pregunta por
 * los obligatorios y no por el calendario, lo sigue llamando sin fecha.
 */
export function camposAPreguntar(
  yaSabidos: Respuestas,
  respuestasEnCurso: Respuestas = {},
  hoy?: string,
): CampoEncuesta[] {
  const todo = { ...yaSabidos, ...respuestasEnCurso }
  return CAMPOS.filter((campo) => {
    if (campo.soloSi && !campo.soloSi(todo)) return false
    if (!tieneValor(yaSabidos[campo.clave])) return true
    // Ya está contestada: solo vuelve si es de las que vuelven y ya le toca. Y
    // no vuelve dentro de la misma sesión, o desaparecería al contestarla.
    if (hoy === undefined || tieneValor(respuestasEnCurso[campo.clave])) return false
    return toca(campo, todo, hoy)
  })
}

/**
 * Las preguntas que hoy vuelven a tocar. Vacío es lo normal.
 *
 * Lo consultan los dos sitios que avisan -«Hoy» y el diario de Nutrición- y por
 * eso vive aquí: cuando la regla de la encuesta vivió solo en la compuerta, 16
 * de 20 asesorados nunca la vieron.
 */
export function preguntasQueVuelven(respuestas: Respuestas, hoy: string): CampoEncuesta[] {
  return camposAPreguntar(respuestas, {}, hoy).filter((campo) => Boolean(campo.cadaDias))
}

/**
 * Estampa la fecha del día en el campo que ACABA de contestarse.
 *
 * SE LLAMA AL RESPONDER, no al guardar el conjunto. Estampar mirando «qué
 * campos tienen valor» reiniciaría el reloj de los quince días cada vez que
 * alguien tocara cualquier otra pregunta, y la quincenal no volvería nunca.
 *
 * Y hace falta: sin sello, `toca` da true y la pregunta vuelve al día
 * siguiente, cada vez que abra la app, hasta hartarla.
 */
export function conSelloDeFecha(
  respuestas: Respuestas,
  contestada: ClaveCampo,
  hoy: string,
): Respuestas {
  const campo = CAMPOS.find((c) => c.clave === contestada)
  if (!campo?.selloDeFecha) return respuestas
  return { ...respuestas, [campo.selloDeFecha]: hoy }
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
