/**
 * Recetas virales revisadas por el coach, con la porción exacta que sí encaja
 * en el plan del asesorado.
 *
 * Archivo estático versionado: sin CMS ni backend. El coach añade recetas por
 * pull request y para retirar una basta con borrar su entrada — el handle y el
 * enlace al post original son obligatorios y nunca se ocultan.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL CRÉDITO ES OBLIGATORIO; EL PERMISO, NO
 * ─────────────────────────────────────────────────────────────────────────────
 * Pedir autorización receta por receta se retiró el 2026-08-16. Quien publica
 * un reel busca alcance, y mandarle tráfico desde aquí le sirve a su objetivo.
 *
 * Lo que NO se retira, porque no es lo mismo: `handle` y
 * `media.instagramPermalink` siguen siendo obligatorios y visibles, y el vídeo
 * **no se aloja**. Si el reel se pudiera ver sin salir de Alfa, el creador
 * dejaría de recibir la visita que justifica todo esto — el argumento del
 * alcance se caería solo. Por eso `media.videoUrl` solo se rellena si el
 * creador cede el archivo; sin él, `ReelPlayer` cae al póster con «Reel
 * disponible en Instagram», que es el comportamiento correcto.
 *
 * DECISIÓN PENDIENTE: el encargo dice que los datos semilla (5 recetas) están
 * en el prototipo de Registro de Comidas, en `this.RECETAS`. **No están.** Ese
 * prototipo no contiene ninguna sección de recetas ni de influencers: lo
 * comprobé por nombre, por contenido y listando sus encabezados.
 *
 * Se deja vacío a propósito. Inventar cinco recetas significaría inventar
 * handles de personas reales, cifras de visitas y —sobre todo— notas de ajuste
 * nutricional firmadas por el coach para 21 asesorados de carne y hueso. Eso no
 * es un dato de relleno: es consejo de salud atribuido a alguien.
 *
 * Ojo: retirar el permiso del creador NO levanta esto. Lo que se puede tomar
 * del reel es lo que el reel dice —qué lleva y cuánto—; el «dónde encaja hoy»
 * y el canje siguen siendo criterio del coach sobre una persona concreta.
 *
 * Con la lista vacía el carrusel no se renderiza (spec B.1), así que la app
 * queda exactamente como estaba hasta que lleguen los datos reales.
 */

import type { EstadoAlimento } from '../domain/types'
import { escalarReceta, type IngredienteDelReel } from '../domain/nutricion/escalarReceta'
import { catalogoRepo } from './catalogo/catalogoRepo'

export type NotaTipo = 'encaja' | 'canje' | 'ojo' | 'truco'

export interface RecetaNota {
  tipo: NotaTipo
  label: string
  texto: string
}

/**
 * Un ingrediente en dos columnas: lo que dice el reel y lo que le toca a esta
 * persona.
 *
 * Las dos van juntas a propósito. Enseñar solo «tu cantidad» obliga al
 * asesorado a fiarse a ciegas; enseñar solo la del reel lo deja donde estaba.
 * El valor de la sección es ver **la traducción**, no el resultado.
 */
export interface RecetaIngrediente {
  nombre: string
  /** Cantidad tal como sale en el reel. Ej. «3 huevos», «200 g de avena». */
  enElReel: string
  /** Lo que le toca a esta persona para su porción. Ej. «1 huevo». */
  paraTi: string
  /** Cambia respecto al original: sustitución, no solo menos cantidad. */
  cambiado?: boolean
  /**
   * Id del catálogo de alimentos. Sin él la receta no se puede registrar: los
   * macros del día se derivan de aquí, no de las kcal de la ficha. Ver
   * `domain/nutricion/recetaAlRegistro.ts`.
   */
  alimentoId?: string
  /** `paraTi` en gramos, para poder calcular. «22 g» de texto no se suma. */
  gramosParaTi?: number
  /** Crudo, cocido, seco… Cambia los macros; por defecto se asume crudo. */
  estado?: EstadoAlimento
  /**
   * La cantidad NO la dijo el creador: la puso el coach por referencia.
   *
   * Pasa constantemente. Los reels miden la base —«100 g de mozzarella»— y
   * dejan el relleno suelto: «jamón, rúcula, aguacate y tomate». Para que la
   * receta se pueda registrar hay que poner un número, y ese número es una
   * estimación.
   *
   * Se marca porque si no, a los tres meses nadie distingue lo que dijo el
   * creador de lo que asumimos nosotros, y las dos cosas se leen igual de
   * ciertas. Marcado, se puede auditar y corregir; sin marcar, se hereda.
   */
  estimado?: boolean
}

export interface Receta {
  id: string
  /** Obligatorio y siempre visible: es el crédito al creador. */
  handle: string
  nombre: string
  categoria: 'Postre' | 'Desayuno' | 'Snack' | 'Almuerzo' | 'Cena'
  media: {
    thumbnail: string
    videoUrl?: string
    instagramPermalink?: string
    duracion: string
  }
  social: { views: string; likes: string; guardados: string }
  ajuste: {
    porcion: string
    porcionNota: string
    kcal: number
    prot: number
    carb: number
    grasa: number
    notas: RecetaNota[]
  }
  /**
   * Qué lleva y cuánto, en las dos columnas. Vacío o ausente: la sección no se
   * pinta y la hoja se queda con el ajuste, que es lo mínimo útil.
   */
  ingredientes?: RecetaIngrediente[]
  /** Los pasos, tal cual. Cortos: esto se lee de pie en una cocina. */
  preparacion?: string[]
  /**
   * Cuántas porciones salen con las cantidades de la columna «en el reel». Se
   * usa para explicar de dónde sale la porción del asesorado.
   */
  rinde?: string
}

/** Miniatura de muestra: SVG en línea, sin red y sin peso. */
function miniatura(a: string, b: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="90" height="160" fill="url(#g)"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * MUESTRA PARA REVISAR EL DISEÑO. No son recetas reales.
 *
 * Los handles son inventados a propósito y las notas están escritas como
 * ejemplo de formato, no como consejo. Nada de esto lo ha firmado el coach.
 * Sirve para ver la sección funcionando; se sustituye por las recetas de verdad
 * antes de que esto llegue a nadie.
 */
/**
 * Los ingredientes del brownie tal como los diría el reel, sin dividir nada.
 *
 * De aquí sale TODO lo demás —la columna «para ti» y los cuatro macros de la
 * ficha— vía `escalarReceta`. Es el flujo con el que se meten las recetas de
 * verdad: el coach copia lo que ve, dice cuántas porciones salen, y no calcula.
 *
 * Las cifras de la ficha dejan así de estar escritas a mano, que era un hueco
 * real: si la ficha decía 180 y los ingredientes daban 240, el asesorado veía
 * un número al abrir y otro al registrar sin poder saber cuál valía.
 */
const BROWNIE_DEL_REEL: IngredienteDelReel[] = [
  { nombre: 'Avena en hojuelas', enElReel: '200 g', alimentoId: 'avena-en-hojuelas-peso-en-seco', gramosTotales: 200, estado: 'seco' },
  { nombre: 'Cacao en polvo', enElReel: '40 g', alimentoId: 'cacao-tostado-y-molido', gramosTotales: 40, estado: 'seco' },
  { nombre: 'Huevo', enElReel: '3 unidades', alimentoId: 'huevo-de-gallina-entero-crudo', gramosTotales: 150, estado: 'crudo' },
  { nombre: 'Miel de abejas', enElReel: '120 g de panela', alimentoId: 'miel-de-abejas', gramosTotales: 120, cambiado: true },
  { nombre: 'Mantequilla de maní', enElReel: '60 g', alimentoId: 'mantequilla-de-mani', gramosTotales: 60, estado: 'listo' },
]

const PORCIONES_BROWNIE = 9
const BROWNIE = escalarReceta(BROWNIE_DEL_REEL, PORCIONES_BROWNIE, (id) => catalogoRepo.porId(id))

const RECETAS_DEMO: Receta[] = [
  {
    id: 'demo-1',
    handle: '@ejemplo.postres',
    nombre: 'Brownie de avena y cacao',
    categoria: 'Postre',
    media: { thumbnail: miniatura('#3a2f2a', '#0f0d0c'), duracion: '0:47' },
    social: { views: '—', likes: '—', guardados: '—' },
    ajuste: {
      porcion: '1 porción',
      porcionNota: `de las ${PORCIONES_BROWNIE} que salen del molde`,
      kcal: BROWNIE.kcal, prot: BROWNIE.prot, carb: BROWNIE.carb, grasa: BROWNIE.grasa,
      notas: [
        { tipo: 'encaja', label: 'Dónde encaja hoy', texto: 'Texto de ejemplo: aquí va cómo entra en el día actual.' },
        { tipo: 'canje', label: 'El canje', texto: 'Texto de ejemplo: qué quitar si la suma.' },
        { tipo: 'ojo', label: 'Ojo con', texto: 'Texto de ejemplo: advertencia sobre la receta original.' },
        { tipo: 'truco', label: 'Truco Alfa', texto: 'Texto de ejemplo: tip de ejecución.' },
      ],
    },
    rinde: `Rinde ${PORCIONES_BROWNIE} porciones`,
    // Derivados, no escritos: es la que demuestra el alta en el registro. Las
    // otras dos se quedan sin medir a propósito, para ver también el camino en
    // que el botón explica que no puede.
    ingredientes: BROWNIE.ingredientes,
    preparacion: [
      'Licúa la avena hasta que quede harina.',
      'Mezcla con el cacao, el huevo y el endulzante.',
      'Hornea 18 min a 180 °C en molde cuadrado.',
      'Deja enfriar y corta en 9 porciones iguales.',
    ],
  },
  {
    id: 'demo-2',
    handle: '@ejemplo.desayunos',
    nombre: 'Tortitas de banano y clara',
    categoria: 'Desayuno',
    media: { thumbnail: miniatura('#2b3320', '#0d0f0b'), duracion: '1:02' },
    social: { views: '—', likes: '—', guardados: '—' },
    ajuste: {
      porcion: '2 tortitas medianas',
      porcionNota: 'de las 6 de la receta',
      kcal: 240, prot: 18, carb: 30, grasa: 5,
      notas: [
        { tipo: 'encaja', label: 'Dónde encaja hoy', texto: 'Texto de ejemplo.' },
        { tipo: 'truco', label: 'Truco Alfa', texto: 'Texto de ejemplo.' },
      ],
    },
  },
  {
    id: 'demo-3',
    handle: '@ejemplo.snacks',
    nombre: 'Bolitas de dátil y maní',
    categoria: 'Snack',
    media: { thumbnail: miniatura('#33291c', '#0f0c08') , duracion: '0:31' },
    social: { views: '—', likes: '—', guardados: '—' },
    ajuste: {
      porcion: '2 unidades',
      porcionNota: 'de las 14 de la bandeja',
      kcal: 150, prot: 4, carb: 18, grasa: 7,
      notas: [{ tipo: 'ojo', label: 'Ojo con', texto: 'Texto de ejemplo.' }],
    },
  },
]

/**
 * En desarrollo se sirven las de muestra para poder revisar el diseño; en
 * producción, nada hasta que existan recetas de verdad.
 *
 * No es un apaño: es la garantía de que un despliegue accidental no le enseña
 * a 21 personas consejo nutricional que nadie escribió.
 */
export const RECETAS: Receta[] =
  import.meta.env.MODE === 'development' ? RECETAS_DEMO : []
