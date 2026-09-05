/**
 * LAS DOS REGLAS DE ESCRITURA DEL RÓTULO DEL MURO: dónde parte y a qué cuerpo.
 *
 * Viven aquí y no junto al componente por una regla del linter que en este repo es dura:
 * un archivo que exporta un componente **y** funciones se lleva un aviso de
 * `react-refresh/only-export-components`, y aquí no se deja ni un aviso más de los que
 * había. Es la misma razón por la que `muros.ts` está separado de `PanelPared.tsx`.
 *
 * Y separadas se pueden probar sin montar nada, que es lo que importa: lo que decide si un
 * nombre cabe en la pared es aritmética, no maquetación.
 */

/**
 * EL CUERPO DE LETRA, EN `em` DEL CUADRO.
 *
 * Sale de la proporción de la maqueta —cuerpo = 470 px sobre un muro de 560— traducida a
 * este cuadro: allí el cuerpo era el 84 % del ancho del muro dividido por las letras de la
 * línea más larga, y aquí 1 em son el 5,2 % del ancho del cuadro. De ahí el 16,1, y de ahí
 * los dos topes: los 40 y 110 px de la maqueta son 1,37 y 3,77 em de este cuadro.
 */
export function cuerpoDelRotulo(lineas: readonly string[]): number {
  const masLarga = Math.max(1, ...lineas.map((l) => l.length))
  // El techo por ANCHO: que la línea más larga quepa de lado a lado.
  const porAncho = 16.1 / masLarga
  // Y el techo por ALTO, que es el que faltaba y se vio midiendo.
  //
  // El cuadro del muro promete 0,85 m de alto y de esa promesa sale a qué altura se
  // cuelga. Con el rótulo dentro, el bloque en reposo mide 132 px de 138: cabe. Pero el
  // cuerpo lo decide la línea MÁS LARGA, así que un nombre de dos palabras CORTAS —«PESO
  // MUERTO», seis letras la mayor— sale a 2,68 em y en dos líneas suma 72 px donde
  // «SENTADILLA GOBLET» suma 43. Ese sí se salía, y el cálculo habría seguido diciendo
  // que cabe: el tope declarado no lo mide nadie más que el testigo, y solo con el
  // ejercicio que tenga delante ese día.
  //
  // El presupuesto son 3,9 em de alto para el rótulo entero, repartidos entre sus líneas.
  // Es lo que un rotulista hace con una pared: el cartel tiene un alto, y el número de
  // renglones decide el cuerpo, no al revés.
  const porAlto = 3.9 / Math.max(1, lineas.length)
  return Math.max(1.37, Math.min(3.77, porAncho, porAlto))
}

/**
 * CÓMO SE PARTE UN NOMBRE EN LÍNEAS.
 *
 * Dos palabras van en dos líneas, y de tres en adelante las dos primeras se juntan arriba.
 * No es arbitrario: el nombre de un ejercicio empieza por el gesto —«Press», «Peso
 * muerto», «Remo»— y sigue con el matiz —«con barra», «rumano», «inclinado»—. Partiendo
 * así, la línea de arriba es el ejercicio y la de abajo el detalle, que es como se nombran
 * en una pizarra de gimnasio.
 */
export function lineasDelRotulo(nombre: string): string[] {
  const palabras = nombre.trim().toUpperCase().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return []
  if (palabras.length === 1) return [palabras[0]]
  if (palabras.length === 2) return palabras
  return [palabras.slice(0, 2).join(' '), palabras.slice(2).join(' ')]
}
