/**
 * Qué cifras ve el asesorado de sí mismo.
 *
 * Espejo de la migración 0018. La regla de fondo: **el cálculo corre siempre**;
 * esto solo decide qué se le muestra. El staff ve todo, y la alerta de
 * disponibilidad energética —la que protege a quien está en riesgo— funciona
 * igual con los tres interruptores apagados.
 *
 * SIN DECISIÓN, TODO ENCENDIDO. Ver el propio progreso es parte del
 * acompañamiento y es el caso normal. Apagar por defecto habría dejado a los 19
 * a ciegas por proteger a unos pocos.
 */

export type EstadoVisibilidad = 'automatico' | 'en_espera' | 'decidido'

export interface Visibilidad {
  verComposicion: boolean
  verObjetivoCalorico: boolean
  verContadorKcal: boolean
  estado: EstadoVisibilidad
}

/** Lo que ve quien nunca ha pasado por una decisión: todo. */
export const VISIBILIDAD_POR_DEFECTO: Visibilidad = {
  verComposicion: true,
  verObjetivoCalorico: true,
  verContadorKcal: true,
  estado: 'automatico',
}

/**
 * Mientras la decisión está pendiente, las tres cifras se retienen.
 *
 * No es que la app decida: es que **todavía no lo ha decidido nadie**. Enseñar
 * un porcentaje de grasa a alguien cuya encuesta acaba de levantar una bandera,
 * solo porque la nutricionista aún no ha entrado esta semana, sería decidir por
 * omisión — y en la dirección más arriesgada de las dos.
 */
export const VISIBILIDAD_EN_ESPERA: Visibilidad = {
  verComposicion: false,
  verObjetivoCalorico: false,
  verContadorKcal: false,
  estado: 'en_espera',
}

/**
 * La visibilidad efectiva de un asesorado.
 *
 * `undefined` = no hay fila en la base, que es el caso normal y significa
 * "nadie ha tenido que decidir nada aquí".
 */
export function visibilidadDe(guardada: Visibilidad | undefined): Visibilidad {
  if (!guardada) return VISIBILIDAD_POR_DEFECTO
  // `en_espera` manda sobre lo que digan los booleanos: una fila puede quedar a
  // medio escribir -alguien la creó con los valores por defecto y la marcó para
  // revisar- y en ese caso lo que vale es que falta la decisión.
  if (guardada.estado === 'en_espera') return VISIBILIDAD_EN_ESPERA
  return guardada
}

/**
 * Señales de la encuesta que piden que alguien lo mire antes de enseñar cifras.
 *
 * Son las que la literatura asocia a riesgo de baja disponibilidad energética o
 * a que un número sobre el cuerpo haga daño. La app NO concluye nada con ellas:
 * solo levanta la mano.
 */
export interface SenalesDeRevision {
  /** La encuesta pregunta por antecedente de conducta alimentaria. */
  antecedenteTca?: boolean
  /** 'irregular' o 'ausente' en el ciclo menstrual. */
  cicloAlterado?: boolean
  /** Quiere bajar de peso Y ganar masa a la vez: objetivos que tiran opuesto. */
  objetivoContradictorio?: boolean
}

/**
 * Si hace falta que la nutricionista decida antes de enseñar las cifras.
 *
 * UNA sola señal basta. No se exigen dos porque el coste de equivocarse no es
 * simétrico: retener unas cifras una semana de más se arregla con un clic;
 * enseñárselas a quien no debía, no.
 *
 * El antecedente de conducta alimentaria pesa solo. El ciclo alterado y el
 * objetivo contradictorio también, y son señales distintas: un ciclo ausente
 * puede venir de comer poco sin que nadie lo haya llamado nunca así.
 */
export function necesitaRevision(senales: SenalesDeRevision): boolean {
  return Boolean(
    senales.antecedenteTca || senales.cicloAlterado || senales.objetivoContradictorio,
  )
}

/** Por qué se marcó, para que Manuela no tenga que adivinarlo. */
export function motivosDeRevision(senales: SenalesDeRevision): string[] {
  const motivos: string[] = []
  if (senales.antecedenteTca) motivos.push('antecedente de conducta alimentaria en la encuesta')
  if (senales.cicloAlterado) motivos.push('ciclo menstrual irregular o ausente')
  if (senales.objetivoContradictorio) motivos.push('quiere bajar de peso y ganar masa a la vez')
  return motivos
}
