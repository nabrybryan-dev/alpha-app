/**
 * Lo que el asesorado tiene en casa, para que el motor solo recomiende con eso.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GUARDA PRESENCIA, NO SALDO. AQUÍ NO SE DESCUENTA NADA
 * ─────────────────────────────────────────────────────────────────────────────
 * Es LA decisión de diseño de esta sección, y por eso este módulo no tiene —ni
 * va a tener— ninguna función de «consumir» o «restar».
 *
 * Lo intuitivo sería llevar inventario: compró 1,5 kg de pollo, comió 150 g,
 * quedan 1,35 kg. No. Un inventario que se descuenta se desincroniza en tres
 * días —nadie anota el pollo que se comió su pareja— y a partir de ahí el motor
 * recomienda comida que no está, o se niega a recomendar comida que sí está.
 *
 * Un dato que va derivando es peor que no tenerlo, porque nadie sabe cuándo
 * dejó de ser cierto. La despensa dice «esto lo tengo», se refresca cada compra
 * y en cualquier momento se puede quitar lo que se acabó.
 *
 * `cantidadG` es ORIENTATIVA. Sirve para que Manuela vea si alguien compró
 * proteína para tres días o para quince. No se resta de nada. Si algún día
 * alguien escribe aquí un `descontar()`, este comentario es el motivo de que no
 * exista.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL ALIMENTO PEDIDO ENTRA, PERO NO CALCULA
 * ─────────────────────────────────────────────────────────────────────────────
 * Cuando alguien busca algo que no está en el catálogo, la búsqueda deja de ser
 * un callejón: el texto entra igual en su despensa, marcado sin datos, y va a
 * una cola que resuelve el staff. Se ve —la persona lo tiene de verdad, y su
 * nutricionista necesita saberlo—, pero `paraElMotor` lo deja fuera: un
 * alimento sin tabla nutricional no puede entrar en un cálculo de cantidades
 * sin fabricar un número con pinta de medido.
 *
 * Ver `docs/specs/2026-08-03-motor-de-ajuste-nutricional-diseno.md` §11.
 */

/** De dónde salió: de la compra de este ciclo o de lo que ya había en casa. */
export type OrigenItem = 'compra' | 'ya_tenia'

export interface ItemDespensa {
  /** Id del catálogo. `null` = pedido que todavía no existe como alimento. */
  alimentoId: string | null
  /** Lo que escribió la persona cuando no lo encontró. Solo en los pedidos. */
  textoPedido?: string
  /**
   * Orientativa y opcional. `null` = no la dijo, que no es lo mismo que cero.
   * NO se descuenta: ver la cabecera.
   */
  cantidadG: number | null
  /** Fecha ISO (`YYYY-MM-DD`) en que se metió o se refrescó. */
  agregadoEn: string
  origen: OrigenItem
}

/**
 * Un item con su dueño: es como se GUARDA.
 *
 * El dominio trabaja con `ItemDespensa` a secas —las funciones de aquí operan
 * sobre la despensa de una sola persona y no tienen por qué saber de quién es—,
 * pero la base y el almacén local necesitan el dueño en cada fila. Esta es la
 * costura entre las dos formas, y vive aquí para que `seed` y `repos` no tengan
 * que inventarse cada uno la suya.
 */
export interface ItemDespensaDe extends ItemDespensa {
  usuarioId: string
}

/**
 * El ciclo de compra más largo que maneja Alpha.
 *
 * Las programaciones van a 8 o a 15 días. Pasado el más largo sin tocar nada,
 * lo que dice la despensa ya no habla de lo que hay en la cocina.
 */
export const DIAS_CICLO_MAXIMO = 15

/**
 * Con qué se identifica un item.
 *
 * Los pedidos no tienen id, así que se identifican por su texto normalizado:
 * «Kefir» y «kefir » son la misma petición escrita dos veces, y contarlas por
 * separado llenaría la cola del staff de duplicados.
 */
export function claveDe(item: ItemDespensa): string {
  if (item.alimentoId) return item.alimentoId
  return `pedido:${(item.textoPedido ?? '').trim().toLowerCase().replace(/\s+/g, ' ')}`
}

/** Si tiene tabla nutricional detrás y, por tanto, sirve para calcular. */
export function tieneDatos(item: ItemDespensa): boolean {
  return item.alimentoId !== null
}

/**
 * Mete un alimento, o lo refresca si ya estaba.
 *
 * Volver a comprar algo no es tenerlo dos veces: es tenerlo otra vez. La entrada
 * nueva reemplaza a la vieja y con ella la fecha, que es lo que mantiene la
 * despensa al día tras cada compra.
 */
export function agregar(
  despensa: readonly ItemDespensa[],
  item: ItemDespensa,
): ItemDespensa[] {
  const clave = claveDe(item)
  return [...despensa.filter((i) => claveDe(i) !== clave), item]
}

/** Saca lo que se acabó. Quitar algo que no está no es un error. */
export function quitar(despensa: readonly ItemDespensa[], clave: string): ItemDespensa[] {
  return despensa.filter((i) => claveDe(i) !== clave)
}

/** Lo único con lo que el motor puede calcular cantidades. */
export function paraElMotor(despensa: readonly ItemDespensa[]): ItemDespensa[] {
  return despensa.filter(tieneDatos)
}

/** Lo que está esperando a que el staff le encuentre su tabla. */
export function pedidos(despensa: readonly ItemDespensa[]): ItemDespensa[] {
  return despensa.filter((i) => !tieneDatos(i))
}

/**
 * Si toca volver a preguntar qué hay en casa.
 *
 * Cuenta desde lo ÚLTIMO que se tocó, no desde lo más viejo: si ayer añadió
 * algo, la despensa está viva aunque el arroz lleve un mes ahí.
 *
 * Una despensa vacía no está vieja, está sin estrenar. Decir que sí le
 * reclamaría una actualización a quien todavía no ha hecho su primera compra.
 */
export function estaVieja(
  despensa: readonly ItemDespensa[],
  hoy: string,
  diasCiclo: number = DIAS_CICLO_MAXIMO,
): boolean {
  if (despensa.length === 0) return false
  const ultima = despensa.reduce(
    (mayor, i) => (i.agregadoEn > mayor ? i.agregadoEn : mayor),
    despensa[0].agregadoEn,
  )
  return diasEntre(ultima, hoy) > diasCiclo
}

/** Días naturales entre dos fechas ISO, sin arrastrar la hora local. */
function diasEntre(desdeIso: string, hastaIso: string): number {
  const desde = Date.parse(`${desdeIso}T00:00:00Z`)
  const hasta = Date.parse(`${hastaIso}T00:00:00Z`)
  if (Number.isNaN(desde) || Number.isNaN(hasta)) return 0
  return Math.round((hasta - desde) / 86_400_000)
}
