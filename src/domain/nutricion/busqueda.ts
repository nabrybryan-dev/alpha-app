/**
 * Búsqueda de alimentos en el catálogo, tolerante a tildes.
 *
 * POR QUÉ SIN TILDES. Nadie escribe "plátano" con tilde en el buscador del
 * móvil, y menos con una mano y la otra sujetando una pesa. Si "platano" no
 * encuentra "Plátano", el asesorado concluye que el alimento no está y deja de
 * registrar. La tolerancia no es un detalle de comodidad: es lo que sostiene la
 * adherencia, que en la jerarquía del método va justo detrás de la seguridad.
 *
 * AQUÍ SÍ SE BUSCA POR TROZOS, y es correcto: quien escribe "pla" quiere ver
 * "plátano". Eso NO contradice la regla de `estado.familia()`, que compara por
 * palabra entera —ahí un trozo confunde "lengua" con "lenguado", y agrupar mal
 * dos alimentos distintos es un error silencioso. Buscar de más solo cuesta un
 * resultado que el asesorado descarta de un vistazo; agrupar de más le cambia
 * las kcal sin que se entere.
 */

export interface AlimentoIndice {
  id: string
  nombre: string
  sinonimos?: string
  grupo: string
  estado: string
  confianza: string
  fuente: string
  /**
   * Solo lo que la app necesita sin conexión: los cuatro que se pintan al
   * buscar y los tres micros del panel del día. `null` significa "no se midió",
   * nunca "no contiene" -la TCAC no publica vitamina C para las carnes, y
   * escribir 0 ahí afirmaría algo que ninguna fuente dice-.
   */
  por100g: {
    kcal: number | null
    proteina_g: number | null
    carbos_g: number | null
    grasa_g: number | null
    hierro_mg?: number | null
    vitamina_c_mg?: number | null
    potasio_mg?: number | null
  }
  medidas?: { nombre: string; gramos: number }[]
}

/**
 * Minúsculas y sin diacríticos. `NFD` separa cada letra de su tilde y
 * `\p{Diacritic}` borra las tildes ya sueltas.
 *
 * La ñ también pierde la virgulilla, y está bien: quien escribe "name" quiere
 * encontrar "Ñame". Es el mismo motivo por el que se quitan las tildes.
 *
 * Se usa la propiedad Unicode y no el rango U+0300–U+036F escrito a mano para
 * no dejar caracteres combinantes sueltos en el código: son invisibles en el
 * editor y cualquier recodificación del archivo los rompe sin avisar.
 */
export function sinTildes(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/**
 * Cuánto encaja un alimento con lo buscado. Más alto es mejor; 0 = no encaja.
 *
 * El orden importa más de lo que parece: la lista se ve en un móvil y casi nadie
 * baja del quinto resultado. Un alimento cuyo NOMBRE empieza por lo escrito va
 * antes que uno que solo lo lleva en medio, y el nombre va antes que el sinónimo
 * —quien escribe "arroz" espera "Arroz blanco", no "Bollo de arroz"—.
 */
export function puntuar(alimento: AlimentoIndice, consulta: string): number {
  const buscado = sinTildes(consulta).trim()
  if (!buscado) return 0

  const nombre = sinTildes(alimento.nombre)
  if (nombre === buscado) return 100
  if (nombre.startsWith(buscado)) return 80
  // Principio de cualquier palabra del nombre: "blanco" encuentra "Arroz blanco".
  if (nombre.split(/\s+/).some((palabra) => palabra.startsWith(buscado))) return 60
  if (nombre.includes(buscado)) return 40

  const sinonimos = sinTildes(alimento.sinonimos ?? '')
  if (sinonimos.includes(buscado)) return 20

  return 0
}

export interface FiltroBusqueda {
  /** Grupo del catálogo. Sin definir = todos. */
  grupo?: string
  /** Deja fuera lo estimado. Los planes del coach solo usan lo verificado. */
  soloVerificados?: boolean
}

/**
 * Los alimentos que encajan, del que más al que menos.
 *
 * A igualdad de puntuación gana lo verificado sobre lo estimado, y después el
 * orden alfabético —que es arbitrario, pero estable: una lista que se reordena
 * sola entre pulsaciones hace que se toque el alimento equivocado.
 */
export function buscar(
  alimentos: readonly AlimentoIndice[],
  consulta: string,
  filtro: FiltroBusqueda = {},
  tope = 50,
): AlimentoIndice[] {
  const candidatos = alimentos.filter(
    (a) =>
      (!filtro.grupo || a.grupo === filtro.grupo) &&
      (!filtro.soloVerificados || a.confianza === 'verificado'),
  )

  // Sin consulta se devuelve el grupo entero, que es lo que espera quien solo
  // toca un chip de filtro sin escribir nada.
  if (!sinTildes(consulta).trim()) {
    return [...candidatos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).slice(0, tope)
  }

  return candidatos
    .map((alimento) => ({ alimento, punto: puntuar(alimento, consulta) }))
    .filter((c) => c.punto > 0)
    .sort(
      (a, b) =>
        b.punto - a.punto ||
        Number(b.alimento.confianza === 'verificado') -
          Number(a.alimento.confianza === 'verificado') ||
        a.alimento.nombre.localeCompare(b.alimento.nombre, 'es'),
    )
    .slice(0, tope)
    .map((c) => c.alimento)
}
