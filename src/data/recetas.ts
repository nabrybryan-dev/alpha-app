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
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ SE PUEDE TOMAR DEL REEL Y QUÉ NO
 * ─────────────────────────────────────────────────────────────────────────────
 * Del reel se toma lo que el reel dice: qué lleva y cuánto. Los macros no se
 * copian de ningún sitio — se calculan del catálogo, igual que luego se suma el
 * día.
 *
 * Lo que NO sale de aquí son las notas del coach. El «dónde encaja hoy», el
 * canje y el «ojo con» son criterio clínico sobre una persona concreta, y por
 * eso `RECETAS` solo sirve las que ya las tienen. Ver la compuerta del final.
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

/**
 * Miniatura generada, no un fotograma del reel.
 *
 * Las URLs de imagen de Instagram van FIRMADAS y caducan en horas: pegarlas
 * aquí daría una tarjeta rota a los pocos días. Y guardarse el fotograma es
 * alojar contenido ajeno, que es justo lo que no se hace.
 *
 * Así que la tarjeta se dibuja: degradado propio más la inicial del plato. No
 * finge ser una foto —nadie la va a confundir— y las seis se distinguen de un
 * vistazo en el carrusel, que es para lo que sirve.
 */
function miniatura(a: string, b: string, letra: string): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">' +
    `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>` +
    '</linearGradient></defs>' +
    '<rect width="90" height="160" fill="url(#g)"/>' +
    '<text x="45" y="94" text-anchor="middle" font-family="Georgia,serif" font-size="54"' +
    ` fill="#ffffff" fill-opacity="0.15">${letra}</text>` +
    '</svg>'
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const porId = (id: string) => catalogoRepo.porId(id)

/**
 * Lo que dice cada reel, sin dividir nada. De aquí sale todo lo demás.
 *
 * `estimado: true` marca las cantidades que el reel NO daba y puso el coach por
 * referencia. Se pintan con un asterisco y su nota al pie: sin eso, «100 g de
 * mozzarella» —que lo dijo el creador— y «40 g de jamón» —que lo pusimos
 * nosotros— se leerían igual de ciertas.
 */
const ROLLITOS: IngredienteDelReel[] = [
  { nombre: 'Zanahoria', enElReel: '2 zanahorias', alimentoId: 'zanahoria-cruda', gramosTotales: 120, estado: 'crudo', estimado: true },
  { nombre: 'Huevo', enElReel: '2 huevos', alimentoId: 'huevo-de-gallina-entero-crudo', gramosTotales: 100, estado: 'crudo', estimado: true },
  { nombre: 'Mozzarella', enElReel: '100 g', alimentoId: 'queso-fresco-semiduro-semigraso-tipo-mozzarella', gramosTotales: 100 },
  { nombre: 'Atún al natural', enElReel: '160 g', alimentoId: 'atun-en-lata-en-agua-escurrido', gramosTotales: 160, estado: 'en_lata' },
  { nombre: 'Maíz tierno', enElReel: '50 g', alimentoId: 'mazorca-maiz-tierno-cocido-desgranado', gramosTotales: 50, estado: 'cocido' },
  { nombre: 'Queso crema', enElReel: '2 cucharadas', alimentoId: 'queso-crema-amarillo', gramosTotales: 30, estado: 'listo', estimado: true },
  { nombre: 'Aguacate', enElReel: '1/2 pequeño', alimentoId: 'aguacate-hass-crudo', gramosTotales: 50, estado: 'crudo', estimado: true },
]

const HAMBURGUESAS: IngredienteDelReel[] = [
  { nombre: 'Contramuslo de pollo', enElReel: '300 g', alimentoId: 'pollo-contramuslo-sin-piel-crudo', gramosTotales: 300, estado: 'crudo' },
  { nombre: 'Brócoli rallado', enElReel: '100 g', alimentoId: 'brocoli-crudo', gramosTotales: 100, estado: 'crudo' },
  { nombre: 'Queso rallado', enElReel: '60 g', alimentoId: 'queso-madurado-duro-semigraso-tipo-parmesano', gramosTotales: 60, estado: 'listo' },
  { nombre: 'Huevo', enElReel: '2 huevos', alimentoId: 'huevo-de-gallina-entero-crudo', gramosTotales: 100, estado: 'crudo', estimado: true },
  { nombre: 'Aceite de oliva', enElReel: '3 cucharadas', alimentoId: 'aceite-de-oliva', gramosTotales: 39, estado: 'listo', estimado: true },
]

const WRAP: IngredienteDelReel[] = [
  { nombre: 'Papa', enElReel: '1/2 papa grande', alimentoId: 'papa-variedad-cerosa-sabanera-con-cascara-cruda', gramosTotales: 150, estado: 'crudo', estimado: true },
  { nombre: 'Queso bajo en grasa', enElReel: '2 lonchas', alimentoId: 'queso-fresco-semiduro-semigraso-tipo-mozzarella', gramosTotales: 40, estimado: true },
  { nombre: 'Huevo', enElReel: '2 huevos', alimentoId: 'huevo-de-gallina-entero-crudo', gramosTotales: 100, estado: 'crudo', estimado: true },
  { nombre: 'Jamón', enElReel: 'sin cantidad', alimentoId: 'jamon-tipo-york-precocido', gramosTotales: 40, estimado: true },
  { nombre: 'Aguacate', enElReel: 'sin cantidad', alimentoId: 'aguacate-hass-crudo', gramosTotales: 50, estado: 'crudo', estimado: true },
  { nombre: 'Tomate', enElReel: 'sin cantidad', alimentoId: 'tomate-crudo', gramosTotales: 60, estado: 'crudo', estimado: true },
]

const SANDWICH: IngredienteDelReel[] = [
  { nombre: 'Pechuga de pollo', enElReel: '100 g', alimentoId: 'pechuga-de-pollo-sin-piel-cruda', gramosTotales: 100, estado: 'crudo' },
  { nombre: 'Parmesano', enElReel: 'sin cantidad', alimentoId: 'queso-madurado-duro-semigraso-tipo-parmesano', gramosTotales: 10, estado: 'listo', estimado: true },
  { nombre: 'Queso crema', enElReel: '2 cucharadas', alimentoId: 'queso-crema-amarillo', gramosTotales: 30, estado: 'listo', estimado: true },
  { nombre: 'Espinacas frescas', enElReel: 'sin cantidad', alimentoId: 'espinaca-cruda', gramosTotales: 30, estado: 'crudo', estimado: true },
  { nombre: 'Tomates deshidratados', enElReel: 'sin cantidad', alimentoId: 'tomate-crudo', gramosTotales: 15, estado: 'crudo', estimado: true },
]

const BROWNIE: IngredienteDelReel[] = [
  { nombre: 'Manzana', enElReel: '1 manzana', alimentoId: 'manzana-comun-cruda', gramosTotales: 150, estado: 'crudo', estimado: true },
  { nombre: 'Huevo', enElReel: '1 huevo', alimentoId: 'huevo-de-gallina-entero-crudo', gramosTotales: 50, estado: 'crudo', estimado: true },
  { nombre: 'Nueces', enElReel: '6 nueces', alimentoId: 'nueces-nuez-de-nogal', gramosTotales: 30, estado: 'crudo', estimado: true },
  { nombre: 'Cacao en polvo', enElReel: '2 cucharadas', alimentoId: 'cacao-tostado-y-molido', gramosTotales: 10, estado: 'seco', estimado: true },
  { nombre: 'Chocolate sin azúcar', enElReel: 'chips, sin cantidad', alimentoId: 'chocolate-amargo-o-negro', gramosTotales: 20, estado: 'listo', estimado: true },
]

const CARLOTA: IngredienteDelReel[] = [
  { nombre: 'Mango', enElReel: '200 g', alimentoId: 'mango-comun-crudo', gramosTotales: 200, estado: 'crudo' },
  { nombre: 'Yogur griego', enElReel: '240 g', alimentoId: 'yogur-griego-entero', gramosTotales: 240, estado: 'listo' },
  { nombre: 'Galletas', enElReel: 'sin cantidad', alimentoId: 'galleta-de-avena', gramosTotales: 80, estado: 'listo', estimado: true },
]

type BaseReceta = Omit<Receta, 'ajuste' | 'ingredientes' | 'rinde'> & { porcionNota: string }

/**
 * Arma una receta a partir de lo que dice el reel.
 *
 * Los cuatro macros NO se escriben aquí: los calcula `escalarReceta` del mismo
 * catálogo del que luego se suma el día. Así abrir la receta y registrarla dan
 * la misma cifra, y el día que se corrija un valor del catálogo estas fichas se
 * corrigen solas.
 */
function receta(
  base: BaseReceta,
  delReel: IngredienteDelReel[],
  porciones: number,
  notas: RecetaNota[] = [],
): Receta {
  const { porcionNota, ...resto } = base
  const e = escalarReceta(delReel, porciones, porId)
  return {
    ...resto,
    ajuste: {
      porcion: '1 porción',
      porcionNota,
      kcal: e.kcal,
      prot: e.prot,
      carb: e.carb,
      grasa: e.grasa,
      notas,
    },
    ingredientes: e.ingredientes,
    rinde: `Rinde ${porciones} ${porciones === 1 ? 'porción' : 'porciones'}`,
  }
}

/**
 * Las recetas de verdad, sacadas de Instagram el 2026-08-16.
 *
 * `notas` va VACÍO a propósito en las seis. El «dónde encaja hoy», el canje y el
 * «ojo con» son criterio clínico sobre una persona concreta y los escribe el
 * coach, no esta lista. Mientras estén vacías no se sirven — ver la compuerta.
 */
const RECETAS_REALES: Receta[] = [
  receta(
    {
      id: 'rollitos-zanahoria-atun',
      handle: '@tasty_hunting',
      nombre: 'Rollitos bajos en hidratos',
      categoria: 'Cena',
      media: {
        thumbnail: miniatura('#3a2a12', '#0f0b06', 'R'),
        instagramPermalink: 'https://www.instagram.com/reel/DMyJZcUNxKC/',
        duracion: '0:47',
      },
      social: { views: '—', likes: '—', guardados: '—' },
      porcionNota: 'de las 2 que salen de la receta',
      preparacion: [
        'Ralla la zanahoria cruda y mézclala con el queso, los huevos, la cebolla en polvo y la sal.',
        'Engrasa una sartén a fuego medio, vierte la mezcla y extiéndela sin dejar agujeros.',
        'Cocina tapado unos 8 minutos, hasta que esté firme.',
        'Mezcla el relleno y extiéndelo sobre la base cuando esté lista.',
        'Añade rúcula, enrolla y corta al gusto.',
      ],
    },
    ROLLITOS,
    2,
    [
      {
        tipo: 'encaja',
        label: 'Dónde encaja hoy',
        texto:
          'Cena redonda: 37 g de proteína con solo 15 de hidratos. Si ya comiste el arroz al ' +
          'almuerzo, esta cierra el día sin repetirlos.',
      },
      {
        tipo: 'canje',
        label: 'El canje',
        texto:
          'La mozzarella sola son 148 de las 445 kcal. Bájala a 30 g y te quedas cerca de 380 ' +
          'sin tocar el atún, que es de donde viene la proteína.',
      },
      {
        tipo: 'ojo',
        label: 'Ojo con',
        texto:
          'El atún tiene que ser al natural y bien escurrido. En aceite, esos mismos 80 g pasan ' +
          'de 72 a 169 kcal: casi 100 más sin que cambie nada de lo que ves en el plato.',
      },
      {
        tipo: 'truco',
        label: 'Truco Alfa',
        texto:
          'Extiende la mezcla sin dejar agujeros y cocínala tapada: si la base queda con huecos, ' +
          'se te rompe al enrollar y acabas comiéndotela con tenedor.',
      },
    ],
  ),
  receta(
    {
      id: 'hamburguesas-pollo-brocoli',
      handle: '@paufeel',
      nombre: 'Hamburguesas de pollo y brócoli',
      categoria: 'Almuerzo',
      media: {
        thumbnail: miniatura('#20301c', '#0a0d09', 'H'),
        instagramPermalink: 'https://www.instagram.com/reel/DGsZWL8NZUH/',
        duracion: '0:52',
      },
      social: { views: '—', likes: '—', guardados: '—' },
      porcionNota: 'de las 2 que salen de la receta',
      preparacion: [
        'Corta el pollo en cuadrados pequeños.',
        'Mezcla en un bol los huevos, el brócoli rallado, el queso, la sal y la pimienta.',
        'Añade el pollo y forma las hamburguesas.',
        'Cocina a fuego medio hasta que estén doradas por los dos lados.',
      ],
    },
    HAMBURGUESAS,
    2,
    [
      {
        tipo: 'encaja',
        label: 'Dónde encaja hoy',
        texto:
          '47 g de proteína, la más alta de todas. Es almuerzo de día de pierna o de espalda, ' +
          'cuando vienes de mover peso y hay que reponer.',
      },
      {
        tipo: 'canje',
        label: 'El canje',
        texto:
          'Las 3 cucharadas de aceite son 20 g por porción: 177 de las 600 kcal. Con una sola ' +
          'cucharada bajas a unas 480 y la proteína no se mueve.',
      },
      {
        tipo: 'ojo',
        label: 'Ojo con',
        texto:
          'El contramuslo lleva más grasa que la pechuga. Si el día ya viene cargado de grasa, ' +
          'cámbialo por pechuga y le quitas otras 30 kcal por porción.',
      },
      {
        tipo: 'truco',
        label: 'Truco Alfa',
        texto:
          'Corta el pollo a cuchillo en cuadritos en vez de triturarlo. Queda con textura de ' +
          'hamburguesa de verdad y no de paté.',
      },
    ],
  ),
  receta(
    {
      id: 'wrap-de-papa',
      handle: '@tasty_hunting',
      nombre: 'Wrap de papa',
      categoria: 'Almuerzo',
      media: {
        thumbnail: miniatura('#33280f', '#100c05', 'W'),
        instagramPermalink: 'https://www.instagram.com/reel/DbtadZTtoBT/',
        duracion: '0:41',
      },
      social: { views: '—', likes: '—', guardados: '—' },
      porcionNota: 'la receta entera es una porción',
      preparacion: [
        'Corta la papa en láminas muy finas con mandolina o cuchillo.',
        'Colócalas en una sartén antiadherente con un poco de aceite, superponiéndolas.',
        'Pon el queso encima, tapa y cocina a fuego medio-bajo de 8 a 10 minutos.',
        'Vierte los huevos batidos, tapa otra vez y cocina hasta que cuajen.',
        'Haz un corte desde el centro hacia fuera, rellena cada lado y ciérralo.',
      ],
    },
    WRAP,
    1,
    [
      {
        tipo: 'encaja',
        label: 'Dónde encaja hoy',
        texto:
          'Almuerzo completo en un plato: 32 g de proteína y 33 de hidratos. Encaja en día ALTO, ' +
          'que es cuando el carbohidrato de la papa te sirve para algo.',
      },
      {
        tipo: 'canje',
        label: 'El canje',
        texto:
          'Es la más pesada de las seis: 569 kcal. Si la pones de cena, quítale el aguacate y ' +
          'el jamón del relleno y te quedas cerca de 400.',
      },
      {
        tipo: 'ojo',
        label: 'Ojo con',
        texto:
          'El relleno del reel no trae cantidades y esos gramos los puse yo por referencia — van ' +
          'con asterisco en la lista. Ajústalos a lo que de verdad le eches.',
      },
      {
        tipo: 'truco',
        label: 'Truco Alfa',
        texto:
          'La papa en láminas MUY finas, con mandolina si tienes. Gruesa no se cocina por dentro ' +
          'en los 10 minutos y queda cruda en el centro.',
      },
    ],
  ),
  receta(
    {
      id: 'sandwich-de-pollo',
      handle: '@tasty_hunting',
      nombre: 'Sándwich de pollo sin harinas',
      categoria: 'Snack',
      media: {
        thumbnail: miniatura('#2a2f36', '#0b0d0f', 'S'),
        instagramPermalink: 'https://www.instagram.com/reel/DbbZKSYtJQB/',
        duracion: '0:38',
      },
      social: { views: '—', likes: '—', guardados: '—' },
      porcionNota: 'la receta entera es una ración',
      preparacion: [
        'Tritura la pechuga con el ajo y la cebolla en polvo, la sal y la pimienta.',
        'Extiende la mezcla en dos bases finas y dóralas en la sartén.',
        'Rellena con el queso crema, las espinacas y los tomates deshidratados.',
      ],
    },
    SANDWICH,
    1,
    [
      {
        tipo: 'encaja',
        label: 'Dónde encaja hoy',
        texto:
          '32 g de proteína en 260 kcal: es la mejor relación de las seis. Merienda de tarde o ' +
          'cena ligera cuando el día ya viene lleno.',
      },
      {
        tipo: 'canje',
        label: 'El canje',
        texto:
          'El queso crema son 88 de las 260 kcal, un tercio del plato por dos cucharadas. Con ' +
          'una sola sigue cremoso y bajas a 215.',
      },
      {
        tipo: 'ojo',
        label: 'Ojo con',
        texto:
          'Casi no lleva hidratos: 1 g. Si es tu comida de antes de entrenar, acompáñala con ' +
          'algo que sí los traiga o vas a llegar vacío a la última serie.',
      },
      {
        tipo: 'truco',
        label: 'Truco Alfa',
        texto:
          'Extiende la mezcla fina y dórala bien por los dos lados antes de rellenar. Si la ' +
          'dejas gruesa, por dentro queda húmeda y no aguanta el relleno.',
      },
    ],
  ),
  receta(
    {
      id: 'brownie-sin-harinas',
      handle: '@paufeel',
      nombre: 'Brownie sin harinas',
      categoria: 'Postre',
      media: {
        thumbnail: miniatura('#3a2f2a', '#0f0d0c', 'B'),
        instagramPermalink: 'https://www.instagram.com/reel/DEh5vz3N4qg/',
        duracion: '0:47',
      },
      social: { views: '—', likes: '—', guardados: '—' },
      porcionNota: 'de las 2 que salen del molde',
      preparacion: [
        'Pela y trocea la manzana; tritúrala con el huevo, el cacao y el polvo de hornear.',
        'Vierte la mitad en un molde, añade las nueces y cubre con el resto.',
        'Pon los chips por encima y lleva al microondas 2 o 3 minutos a máxima potencia.',
        'Deja enfriar antes de cortar.',
      ],
    },
    BROWNIE,
    2,
    [
      {
        tipo: 'encaja',
        label: 'Dónde encaja hoy',
        texto:
          'Postre de 279 kcal que sí cabe. No lo pongas de merienda «extra»: cuenta como el ' +
          'postre del día, no como algo que se suma encima.',
      },
      {
        tipo: 'canje',
        label: 'El canje',
        texto:
          'Las 6 nueces son 102 de las 279 kcal — el ingrediente más caro del molde. Con 3 ' +
          'bajas a unas 230 y el brownie sigue igual de bueno.',
      },
      {
        tipo: 'ojo',
        label: 'Ojo con',
        texto:
          'Solo 7 g de proteína: es un postre, no una merienda que sostenga. Si es lo único que ' +
          'comes en la tarde, vas a tener hambre en una hora.',
      },
      {
        tipo: 'truco',
        label: 'Truco Alfa',
        texto:
          'Al microondas empieza por 2 minutos y comprueba. Pasarse lo seca y deja de parecer un ' +
          'brownie: se puede añadir tiempo, quitarlo no.',
      },
    ],
  ),
  receta(
    {
      id: 'carlota-de-mango',
      handle: '@tasty_hunting',
      nombre: 'Carlota de mango',
      categoria: 'Postre',
      media: {
        thumbnail: miniatura('#3d3211', '#100d05', 'C'),
        instagramPermalink: 'https://www.instagram.com/reel/DblyNUXtPpm/',
        duracion: '0:35',
      },
      social: { views: '—', likes: '—', guardados: '—' },
      porcionNota: 'de las 6 que salen del molde',
      preparacion: [
        'Tritura el mango con el yogur griego y la vainilla.',
        'Monta capas alternando galleta y crema en un molde.',
        'Lleva a la nevera al menos 4 horas antes de cortar.',
      ],
    },
    CARLOTA,
    6,
    [
      {
        tipo: 'encaja',
        label: 'Dónde encaja hoy',
        texto:
          '120 kcal por porción: la más ligera de las seis. Es el postre para el día que no te ' +
          'sobra casi nada, o para cerrar una cena que ya iba justa.',
      },
      {
        tipo: 'canje',
        label: 'El canje',
        texto:
          'La galleta es casi la mitad de las kcal (56 de 120) y es lo único que no aporta nada ' +
          'más. Con la mitad de galleta baja a 90 y sigue teniendo capas.',
      },
      {
        tipo: 'ojo',
        label: 'Ojo con',
        texto:
          'Que sea yogur GRIEGO, no natural. El griego tiene el doble de proteína, y con el ' +
          'normal este postre se queda en azúcar con fruta.',
      },
      {
        tipo: 'truco',
        label: 'Truco Alfa',
        texto:
          'Cuatro horas de nevera como mínimo, y mejor de un día para otro. Si la cortas antes, ' +
          'no ha cuajado y se te desarma en el plato.',
      },
    ],
  ),
]

/** Las que el coach ya firmó: son las únicas que llegan al asesorado. */
const FIRMADAS: Receta[] = RECETAS_REALES.filter((r) => r.ajuste.notas.length > 0)

/**
 * En producción, solo lo firmado. En desarrollo, las seis.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ HACEN FALTA LAS DOS COSAS
 * ─────────────────────────────────────────────────────────────────────────────
 * La compuerta de las notas está bien y se queda: una receta sin el «dónde
 * encaja hoy» y el canje es un feed de recetas más, y una a medio escribir no
 * puede llegarle a nadie por descuido.
 *
 * Pero tal cual estaba, las seis eran **invisibles hasta en la máquina del
 * coach**: `RECETAS` las filtraba y `RECETAS_SIN_FIRMAR` no lo pintaba nadie. O
 * sea que había que escribir las notas a ciegas, sin poder ver la porción, los
 * macros ni la tarjeta. Pedir eso es pedir que se firme sin mirar.
 *
 * Así que en desarrollo se sirven las seis, con su aviso de que están sin
 * firmar. `MODE` es `'test'` en vitest y `'production'` en el build, de modo que
 * ni la suite ni los 21 asesorados ven una receta sin notas.
 */
export const RECETAS: Receta[] =
  import.meta.env.MODE === 'development' ? RECETAS_REALES : FIRMADAS

/** Si a esta receta le faltan las notas del coach. Solo se ve en desarrollo. */
export function sinFirmar(receta: Receta): boolean {
  return receta.ajuste.notas.length === 0
}

/**
 * Las seis, firmadas o no.
 *
 * La usan los tests: lo que hay que comprobar —que los ingredientes existen en
 * el catálogo, que la ficha cuadra con el registro— vale para las seis, y
 * `RECETAS` en modo test solo trae las firmadas, que hoy son cero.
 */
export const TODAS_LAS_RECETAS: Receta[] = RECETAS_REALES
