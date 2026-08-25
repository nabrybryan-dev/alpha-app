/**
 * Qué gira, sobre qué eje, y contra qué línea de fuerza — por patrón de movimiento.
 *
 * Ésta es la tabla que decide, para cada ejercicio, **qué punto hay que mirar
 * con la cámara**. Sin ella, medir palancas es imposible: un brazo de momento
 * no es una propiedad del ejercicio, es la distancia perpendicular entre UN eje
 * concreto y UNA línea de acción concreta, y las dos cosas cambian de un patrón
 * a otro. Preguntar «¿cuál es el brazo de palanca de la sentadilla?» sin decir
 * si se habla de la rodilla o de la cadera no tiene respuesta.
 *
 * Se apoya en dos cosas que ya existen y no las duplica:
 *
 *   1. `domain/taxonomia.ts` — los 32 patrones y qué grupo muscular trabaja en
 *      cada uno. Aquí NO se vuelve a decidir eso: se toma de allí y se añade
 *      **sobre qué eje** genera ese grupo su momento.
 *   2. `Cerebro Alpha/wiki/conocimiento/perfiles-de-resistencia.md` §2.1 — la
 *      regla de la que sale todo: con peso libre la fuerza tira siempre
 *      vertical, así que el brazo de momento externo es la distancia
 *      HORIZONTAL entre la articulación y la carga.
 *
 * Fuente de verdad de la tabla:
 * `Cerebro Alpha/wiki/conocimiento/segmentos-ejes-y-palancas.md`. Si las dos
 * divergen, manda la página: aquí solo vive la copia ejecutable.
 *
 * ## Las tres distinciones que estructuran la tabla
 *
 * **1 · Anclaje contra referencia.** «Segmento fijo» significa dos cosas
 * distintas y confundirlas estropea la medida. Está el **anclaje** —qué toca el
 * mundo y no se mueve: el pie en el suelo, la espalda en el banco, la mano en
 * la barra fija— y está la **referencia**, el eje contra el que se leen los
 * ángulos. En una sentadilla el anclaje es el pie y la referencia es la
 * vertical. El torso NO es fijo, y conviene no tratarlo como si lo fuera: su
 * inclinación es justo la variable que reparte el momento entre rodilla y
 * cadera, así que darla por constante borra la señal que queremos medir. Que
 * *parezca* fijo es una impresión del ojo, no una propiedad del movimiento.
 *
 * **2 · De dónde sale la línea de fuerza.** Tres orígenes, y elegir mal es el
 * error que más daño hace:
 *   - `carga-externa`: la vertical que pasa por la barra. Vale cuando la carga
 *     domina al peso corporal del segmento que se mueve.
 *   - `centro-de-masas`: la vertical del centro de masas del cuerpo (más
 *     lastre). Obligatoria en dominadas, fondos y todo lo que mueve el propio
 *     cuerpo, donde **no hay barra que seguir**.
 *   - `cable`: la del cable, que no es vertical. En polea la dirección la fija
 *     el cable y no la gravedad (perfiles-de-resistencia §6), así que la regla
 *     de la distancia horizontal deja de valer tal cual.
 *
 * **3 · Momento interno contra momento externo.** El externo se MIDE con la
 * cámara: eje articular y línea de acción, los dos visibles. El interno —la
 * distancia del eje a la línea de tracción del tendón— **no se ve** y sale de
 * tabla, con dispersión entre personas y variación con el ángulo. Por eso
 * `brazoInternoMm` es un rango y no un número, y por eso no se usa para
 * anunciar newtons de fuerza muscular: sirve para ordenar y comparar, que es
 * lo que el cociente interno/externo (la ventaja mecánica) permite hacer.
 *
 * ## Lo que esta tabla NO resuelve
 *
 * Los patrones marcados con `dosApoyos` rompen la regla de §2.1: cuando el
 * cuerpo se apoya en dos sitios a la vez —hombros en el banco y pies en el
 * suelo del hip thrust, por ejemplo— el brazo de momento no es la distancia
 * horizontal al eje, porque la carga se reparte entre los dos apoyos y ese
 * reparto depende de la geometría. La cámara ve la geometría; el reparto exige
 * una hipótesis estática o una plataforma de fuerza que no tenemos. Está
 * marcado, no disimulado: sin la marca, esos ejercicios devolverían un número
 * plausible y falso.
 */

import { categoriaCanonica, grupoPrimario, type Grupo } from '../taxonomia'
import { MODELOS, VARIANTES } from './modelos'
import { REGLAS_DE_EJE } from './reglas'
import {
  IMPLEMENTOS,
  LIMITE_UNILATERAL,
  esUnilateral,
  implementoDe,
  type Implemento,
  type PerfilDeImplemento,
} from './implementos'
import type { Alineacion, Articulacion, Eje, ModeloDePalanca, Protagonismo, Vista } from './tipos'

export * from './tipos'
export * from './implementos'

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

/**
 * Pega a cada eje lo que tiene que hacer para que el protagonista trabaje.
 *
 * Las reglas viven aparte (`reglas.ts`) para poder leerlas todas juntas —son el
 * texto que alguien lee en el móvil— y se juntan aquí, no en la tabla, para que
 * nadie tenga que acordarse de mirar en dos sitios.
 */
function conReglas(modelo: ModeloDePalanca): ModeloDePalanca {
  const reglas = REGLAS_DE_EJE[modelo.patron]
  if (!reglas) return modelo
  return {
    ...modelo,
    ejes: modelo.ejes.map((eje) => {
      const regla = reglas[eje.articulacion]
      return regla ? { ...eje, regla } : eje
    }),
  }
}

/**
 * El modelo mecánico de un ejercicio, o `undefined` si su patrón no tiene
 * palanca que medir (o la categoría no se reconoce).
 *
 * Como en `aportesDeCategoria`, la variante declarada en el nombre manda sobre
 * el modelo por defecto del patrón.
 */
export function modeloDePalanca(
  categoria: string,
  nombreEjercicio = '',
): ModeloDePalanca | undefined {
  const canonica = categoriaCanonica(categoria)
  if (!canonica) return undefined

  const variantes = VARIANTES[canonica]
  if (variantes) {
    const nombre = normalizar(nombreEjercicio)
    const declarada = variantes.find((v) => v.patron.test(nombre))
    if (declarada) return conReglas(declarada.modelo)
  }
  const modelo = MODELOS[canonica]
  return modelo ? conReglas(modelo) : undefined
}

export interface PlanDeMedida {
  /** Los ejes a calcular, los principales primero. Vacío nunca: si no hay, no hay plan. */
  ejes: readonly Eje[]
  /** Las marcas que hay que ver. Si falta una, el plan no se puede ejecutar. */
  marcas: readonly Articulacion[]
  /** De dónde sale la línea de acción contra la que se mide el brazo. */
  linea: ModeloDePalanca['linea']
  alineacion: Alineacion
  /** `true` cuando el brazo externo no sale de la distancia horizontal. */
  necesitaRepartoDeApoyos: boolean
  /**
   * El grupo que cobra el trabajo directo, de `taxonomia.ts`.
   *
   * Es lo que convierte un eje en una frase que alguien entiende: sin él, el
   * consejo dice «rodilla» donde tiene que decir «cuádriceps». Va aquí y no en
   * la tabla a propósito — quién cobra el volumen ya está decidido en un sitio,
   * y decidirlo dos veces es cómo se separan dos tablas que deberían coincidir.
   */
  grupoObjetivo?: Grupo
  /** Dónde se planta la cámara para medir los ejes principales. */
  vista: Vista
  /** Ejes que NO se ven desde esa vista, con la vista que harían falta. */
  fueraDeVista: readonly string[]
  /**
   * El implemento declarado en el nombre, si lo declara. `undefined` no
   * significa barra: significa que el nombre no dice con qué se hace, y suponer
   * barra ahí es cómo entraría un Smith con el modelo equivocado.
   */
  implemento?: Implemento
  perfilDeImplemento?: PerfilDeImplemento
  /**
   * Si la carga va a un solo lado. Es ortogonal al implemento —hay mancuernas,
   * poleas y prensas unilaterales— y por eso va aparte: un remo a una mano y un
   * jalón unilateral en polea comparten el problema y no comparten implemento.
   */
  unilateral: boolean
  /**
   * Si sigue valiendo la regla de la que sale todo —brazo externo = distancia
   * horizontal del eje a la vertical de la carga, `perfiles-de-resistencia`
   * §2.1—. Con un raíl o una leva de por medio, NO: el número sale igual, varía
   * entre repeticiones y ya no habla del atleta. Cuando esto es `false`, la
   * pantalla enseña ángulos y calla los momentos.
   */
  brazoPorDistanciaHorizontal: boolean
  /**
   * Lo que con este implemento no se puede prometer. Vacío cuando no hay nada
   * que advertir; nunca `undefined`, para que quien lo pinte no tenga que
   * preguntar.
   */
  limites: readonly string[]
  /**
   * En qué articulación se inserta el grupo objetivo — el eje donde ese músculo
   * gira el segmento y, por tanto, donde se genera la tensión que buscamos.
   *
   * Es el eje que hay que medir para saber si el ejercicio está estimulando lo
   * que se prescribió. Los demás no sobran: se colocan para que la carga llegue
   * hasta aquí en vez de quedarse por el camino.
   */
  ejeObjetivo?: Articulacion
}

/**
 * Qué hay que medir en este ejercicio y qué no se puede prometer.
 *
 * Éste es el nodo de decisión: antes de pedirle nada a la cámara, dice qué
 * marcas hacen falta, qué ejes se calculan y en qué orden, contra qué línea, y
 * —lo que más importa— qué preguntas de ese ejercicio **no** tienen respuesta
 * desde un plano sagital. Un plan que promete menos es un plan que no miente.
 */
export function planDeMedida(categoria: string, nombreEjercicio = ''): PlanDeMedida | undefined {
  const modelo = modeloDePalanca(categoria, nombreEjercicio)
  if (!modelo) return undefined

  const orden: Record<Protagonismo, number> = { principal: 0, secundario: 1, estabilizador: 2 }
  const ejes = [...modelo.ejes].sort((a, b) => orden[a.protagonismo] - orden[b.protagonismo])

  // Un eje que pide otra cámara no se mide, y punto. Decirlo aquí evita que un
  // número salga a pantalla como si estuviera medido: es el mismo criterio que
  // `revisarEscala` aplica al recorrido — un «no lo sé» explícito no se puede
  // confundir con un «está bien».
  const fueraDeVista = modelo.ejes
    .filter((e) => e.vista !== modelo.vista)
    .map((e) => `${e.articulacion}: ${e.accion} solo se ve con la cámara ${e.vista}`)

  const grupoObjetivo = grupoPrimario(categoria, nombreEjercicio)

  // El implemento entra DESPUÉS del patrón y puede mandar sobre él: el patrón
  // dice qué gira, el implemento dice contra qué. Un remo con mancuerna a una
  // mano y uno con barra son el mismo patrón y dos medidas distintas.
  const implemento = implementoDe(nombreEjercicio)
  const perfil = implemento ? IMPLEMENTOS[implemento] : undefined

  const marcas = perfil?.marcasExtra
    ? [...new Set([...modelo.marcas, ...perfil.marcasExtra])]
    : modelo.marcas

  // Un plano que el implemento exige y el patrón no da es exactamente el mismo
  // problema que un eje fuera de vista, así que se cuenta en la misma lista: la
  // pantalla ya sabe qué hacer con ella.
  if (perfil?.vistaExtra && perfil.vistaExtra !== modelo.vista) {
    fueraDeVista.push(
      `${perfil.nombre}: la carga sale del plano sagital y su momento solo se ve con la cámara ${perfil.vistaExtra}`,
    )
  }

  const unilateral = esUnilateral(nombreEjercicio)
  if (unilateral && modelo.vista !== 'frontal') {
    fueraDeVista.push(
      'carga a un lado: el momento en el plano frontal solo se ve con la cámara frontal',
    )
  }

  return {
    ejes,
    grupoObjetivo,
    ejeObjetivo: grupoObjetivo
      ? ejes.find((e) => e.motores.includes(grupoObjetivo))?.articulacion
      : undefined,
    marcas,
    linea: perfil?.linea ? { ...modelo.linea, origen: perfil.linea } : modelo.linea,
    alineacion: modelo.alineacion,
    necesitaRepartoDeApoyos: modelo.dosApoyos !== undefined,
    vista: modelo.vista,
    fueraDeVista,
    implemento,
    perfilDeImplemento: perfil,
    unilateral,
    // Sin implemento declarado no se sabe, y no saber se parece más a que valga
    // que a que no: el patrón por defecto de la tabla es peso libre.
    brazoPorDistanciaHorizontal: perfil ? perfil.distanciaHorizontalVale : true,
    limites: [...(perfil?.limite ? [perfil.limite] : []), ...(unilateral ? [LIMITE_UNILATERAL] : [])],
  }
}

/** El eje que manda, para etiquetar. `undefined` si el patrón no tiene modelo. */
export function ejePrincipal(categoria: string, nombreEjercicio = ''): Articulacion | undefined {
  return modeloDePalanca(categoria, nombreEjercicio)?.ejes.find((e) => e.protagonismo === 'principal')
    ?.articulacion
}

/** Para tests y para recorrer la tabla entera. */
export const MODELOS_DE_PALANCA = MODELOS
