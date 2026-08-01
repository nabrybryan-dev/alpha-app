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
 * `guardada` sin definir = no hay fila en la base, que es el caso normal y
 * significa "nadie ha tenido que decidir nada aquí".
 *
 * EL "EN ESPERA" SE DERIVA, NO SE GUARDA. La tabla de interruptores solo la
 * escribe el staff -si el asesorado pudiera, se encendería los suyos-, así que
 * la app del móvil no puede marcar a nadie. Y no hace falta: si la encuesta
 * levantó una señal y nadie ha decidido todavía, eso YA es estar en espera. Un
 * estado derivado no se puede quedar desincronizado del dato que lo justifica.
 */
export function visibilidadDe(
  guardada: Visibilidad | undefined,
  senales: SenalesDeRevision = {},
): Visibilidad {
  // Una decisión tomada manda siempre: si la nutricionista ya miró y dijo que
  // sí, la señal que la trajo aquí no la vuelve a esconder.
  if (guardada && guardada.estado !== 'en_espera') return guardada
  if (guardada?.estado === 'en_espera') return VISIBILIDAD_EN_ESPERA
  return necesitaRevision(senales) ? VISIBILIDAD_EN_ESPERA : VISIBILIDAD_POR_DEFECTO
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
