import type { CuadroEnPantalla } from '../camara/dedoEnElCuerpo'

/**
 * EL CARTEL DE UNA ESTACIÓN NO SE DIBUJA ENCIMA DEL SUJETO.
 *
 * ## Lo que se midió, y por qué esto existe
 *
 * El 2026-09-10, con el instrumento `testigo/carteles-y-sujeto.mjs` —que resta capturas y
 * cuenta TINTA, no rectángulos—, las cuatro estaciones se comían entre el **9 % y el 37 %
 * de los píxeles que pinta el cuerpo**, en las trece posiciones de cámara medidas y con la
 * mediana en el 25 %. No es un ángulo malo: es todos. El kit lo prohíbe en su criterio 3
 * («ningún rótulo, cifra ni panel … se dibuja encima del sujeto o de otro texto») y Bryan
 * lo dijo antes con otras palabras: desaparecer las letras que tapen el salón.
 *
 * ## Se aparta por donde menos tenga que moverse, y los dos lados hacen falta
 *
 * Un cuerpo **de pie** es estrecho y altísimo: ocupa de la cabeza a los pies casi toda la
 * pantalla útil, así que por arriba y por abajo no cabe un cartel de 92 px —medido: se
 * queda con 36 px de aire sobre la cabeza y 42 bajo los pies—, pero a los lados sobra
 * sitio. Un cuerpo **tumbado** en un banco es lo contrario: una banda estrecha en mitad de
 * la pantalla que va de x=40 a x=350 de 390, sin un solo hueco horizontal y con toda la
 * holgura arriba y abajo.
 *
 * Por eso se calculan los dos desvíos y gana **el más corto que despeje de verdad y quepa
 * en la pantalla**. Un cartel que se sale del marco no tapa al sujeto y tampoco se lee: es
 * el mismo criterio 3 incumplido por el otro lado.
 *
 * ## Por qué se esquiva contra el cuerpo MEDIDO y no contra una altura fija
 *
 * El cartel se planta a una altura fija sobre el suelo (`POSTE + 4`), y el cuerpo no está
 * siempre en el mismo sitio: de pie ocupa de la cabeza a los pies, tumbado en un banco es
 * una banda estrecha en mitad de la pantalla, y sentado está a media altura. Una altura
 * fija acierta en un patrón y falla en los otros treinta. El salón YA mide el cuerpo en
 * píxeles en cada fotograma (`alMirar.cuerpo`, el mismo dato con el que el dedo sabe si
 * está sobre el sujeto): esto lo reutiliza en vez de inventar una segunda medida que se
 * separaría de la primera al primer ajuste. Es la misma regla que el encuadre:
 * **el cuadro se calcula contra el cuerpo**.
 */

export interface Recuadro {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * El aire que se le deja al cuerpo por encima y por debajo del cartel, en píxeles.
 *
 * Diez y no cero: pegar el cartel al píxel exacto del contorno deja el número tocando la
 * silueta, y basta que el sujeto se mueva medio dedo dentro de la repetición para volver a
 * pisarlo. Tampoco más: cada píxel de holgura empuja el cartel hacia el borde de la
 * pantalla, y salirse del marco es el mismo criterio 3 incumplido por el otro lado.
 */
export const HOLGURA_DEL_CARTEL = 10

/**
 * DÓNDE EMPIEZA EL SITIO LIBRE POR ARRIBA, en píxeles desde el borde de la pantalla.
 *
 * Ochenta y cuatro: por debajo de la banda de la sesión —«SESIÓN UPPER B · JUEVES»—, que
 * en el salón emulado a 390×844 termina en el 64 y es TEXTO. El criterio 3 del kit prohíbe
 * pisar al sujeto y a otro texto con las mismas palabras, así que el cartel que sube tiene
 * el mismo tope que si bajara.
 */
export const BANDA_DE_SESION = 84

/**
 * CUÁNTO SE COME EL MOBILIARIO DE ABAJO, contado desde el borde inferior.
 *
 * Ciento cuarenta y cuatro, medidos en el mismo salón: la barra de navegación ocupa de 766
 * a 830 (`--tope-nav` = 78), y por encima viven el tirador del panel y la tira de puntos
 * de los ejercicios. Un cartel metido ahí no taparía al sujeto y tampoco se leería.
 */
export const SUELO_DE_LOS_CARTELES = 144

/** Si dos recuadros comparten un solo píxel. */
function sePisan(a: Recuadro, b: Recuadro): boolean {
  return a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1
}

/** Cuánto se aparta un cartel de su sitio natural, en píxeles de pantalla. */
export interface DesvioDelCartel {
  dx: number
  dy: number
}

const QUIETO: DesvioDelCartel = { dx: 0, dy: 0 }

/**
 * Cuánto hay que mover el cartel para que deje de pisar al cuerpo.
 *
 * `{0, 0}` es que no se toca, y es el caso normal: una estación de lado no pisa nada. Si
 * pisa, se prueban los cuatro escapes —izquierda, derecha, arriba, abajo—, se descartan los
 * que se salgan del marco y gana el más corto. Si ninguno cabe —un cuerpo que llena la
 * pantalla— se baja o se sube lo que se pueda, hasta el borde: es peor que despejar y mejor
 * que quedarse en mitad del pecho.
 *
 * @param cartel Dónde caería el cartel SIN desvío, en píxeles de la pantalla.
 * @param cuerpo El cuerpo tal y como lo avisa el visor. Sin él no se mueve nada: no se
 *               esquiva lo que no se ha medido.
 * @param marco  Dónde puede vivir el cartel: `arriba` y `abajo` en vertical (ya descontados
 *               la banda de la sesión y el mobiliario de abajo) y `ancho` de la pantalla.
 */
export function desvioDelCartel(
  cartel: Recuadro,
  cuerpo: CuadroEnPantalla | undefined,
  marco: { arriba: number; abajo: number; ancho: number },
): DesvioDelCartel {
  if (!cuerpo) return QUIETO

  const obstaculo = cuerpo
  if (!sePisan(cartel, obstaculo)) return QUIETO

  const subir = obstaculo.y0 - HOLGURA_DEL_CARTEL - cartel.y1
  const bajar = obstaculo.y1 + HOLGURA_DEL_CARTEL - cartel.y0

  const salidas = escapesDelCartel(cartel, obstaculo, marco)
  if (salidas.length > 0) return salidas[0]

  // Ninguna salida cabe. Se va hacia donde quede menos cartel sobre el cuerpo, acotado al
  // marco: no despeja, pero saca el número del centro del cuerpo.
  const haciaArriba = Math.max(marco.arriba - cartel.y0, subir)
  const haciaAbajo = Math.min(marco.abajo - cartel.y1, bajar)
  const solapeCon = (dy: number) =>
    Math.max(0, Math.min(cartel.y1 + dy, cuerpo.y1) - Math.max(cartel.y0 + dy, cuerpo.y0))
  return { dx: 0, dy: solapeCon(haciaArriba) <= solapeCon(haciaAbajo) ? haciaArriba : haciaAbajo }
}

/**
 * Los cuatro escapes de un obstáculo, del más corto al más largo y sin los que se salen.
 *
 * Se separa de `desvioDelCartel` porque el obstáculo no siempre es el cuerpo: cuando los
 * cuatro carteles se reparten el hueco, el obstáculo de uno es otro cartel. La regla de
 * salida es la misma para los dos casos y tiene que seguir siéndolo — un cartel que
 * esquiva al vecino por una regla distinta de la que usa para esquivar al sujeto acaba
 * decidiendo cosas contradictorias en el mismo fotograma.
 */
function escapesDelCartel(
  cartel: Recuadro,
  obstaculo: Recuadro,
  marco: { arriba: number; abajo: number; ancho: number },
): DesvioDelCartel[] {
  const izquierda = obstaculo.x0 - HOLGURA_DEL_CARTEL - cartel.x1
  const derecha = obstaculo.x1 + HOLGURA_DEL_CARTEL - cartel.x0
  const subir = obstaculo.y0 - HOLGURA_DEL_CARTEL - cartel.y1
  const bajar = obstaculo.y1 + HOLGURA_DEL_CARTEL - cartel.y0

  const salidas: DesvioDelCartel[] = []
  if (cartel.x0 + izquierda >= 0) salidas.push({ dx: izquierda, dy: 0 })
  if (cartel.x1 + derecha <= marco.ancho) salidas.push({ dx: derecha, dy: 0 })
  if (cartel.y0 + subir >= marco.arriba) salidas.push({ dx: 0, dy: subir })
  if (cartel.y1 + bajar <= marco.abajo) salidas.push({ dx: 0, dy: bajar })

  return salidas.sort((a, b) => largoDelDesvio(a) - largoDelDesvio(b))
}

const largoDelDesvio = (d: DesvioDelCartel) => Math.abs(d.dx) + Math.abs(d.dy)

const conDesvio = (r: Recuadro, d: DesvioDelCartel): Recuadro => ({
  x0: r.x0 + d.dx,
  x1: r.x1 + d.dx,
  y0: r.y0 + d.dy,
  y1: r.y1 + d.dy,
})

/** Un cartel que pide sitio: su estación y dónde caería sin desviarse. */
export interface CartelQuePideSitio {
  clave: string
  natural: Recuadro
}

/**
 * Cuántos pases se dan buscando hueco. Cuatro: uno por cada vecino que puede estorbar.
 */
const PASES = 4

/**
 * EL HUECO SE REPARTE ENTRE TODOS, Y NO LO BUSCA CADA UNO POR SU CUENTA.
 *
 * ## Qué se rompió, y cómo se vio
 *
 * `desvioDelCartel` aparta un cartel mirando SOLO a un estorbo. Con los cuatro a la vez
 * eso tiene una consecuencia que no se ve leyendo el código y sí en una foto: un cuerpo de
 * pie deja libres los dos costados, los cuatro carteles calculan por separado que el escape
 * más corto es el mismo costado, y **aterrizan unos sobre otros**. El 2026-09-11, en el
 * salón real y en seis muestras a lo largo de cuatro segundos y medio, siempre había al
 * menos una pareja pisándose y en cuatro de las seis una cifra quedaba ENTERA dentro de
 * otra. Apagando el esquivador se colocaban en cruz y se rozaban como mucho un 17-25 %:
 * **el amontonamiento lo causaba el propio arreglo de no tapar al sujeto**.
 *
 * Leer «REPETICIONES 12» escrito encima de «DESCANSO 2» no es leer la prescripción. Y el
 * criterio 3 del kit prohíbe con las mismas palabras pisar al sujeto y pisar otro texto,
 * así que aquello incumplía la mitad del criterio que vino a cumplir.
 *
 * ## Los estorbos son una LISTA, y por eso el tablón entra
 *
 * La misma foto enseñó la otra mitad: un cartel que escapaba hacia arriba se subía encima
 * del tablón del muro, que desde el 2026-09-06 lleva ahí las cuatro cifras grandes. Nadie
 * se lo había dicho, porque el esquivador solo conocía «el cuerpo». Pasando los estorbos
 * como lista, el tablón es uno más y no hace falta una segunda regla que se separaría de
 * la primera al primer ajuste. Quien llama decide qué no se puede pisar.
 *
 * ## La regla
 *
 * Se colocan en orden y cada uno respeta a los ya colocados: **primero los que no tienen
 * que moverse** —los que su poste ya deja en sitio limpio— y después los demás. Así el que
 * ya estaba bien no lo empuja el que llega, que es lo contrario de lo que pasaba. El
 * desempate es por clave para que dos fotogramas iguales den el mismo reparto: un orden
 * que dependa del recorrido del DOM hace que el cartel salte de sitio sin que nada se haya
 * movido.
 *
 * Un candidato solo vale si despeja al estorbo y **no se mete en ningún otro**. Si ninguno
 * vale se queda donde estaba: apilado es malo, pero encima del sujeto es peor y es lo que
 * se arregló el 10-sep.
 */
export function desviosDeLosCarteles(
  carteles: readonly CartelQuePideSitio[],
  estorbos: readonly Recuadro[],
  marco: { arriba: number; abajo: number; ancho: number },
): Map<string, DesvioDelCartel> {
  const reparto = new Map<string, DesvioDelCartel>()
  const colocados: Recuadro[] = []

  // Primero los que nacen limpios: un cartel que no estorba a nadie no se mueve, y al no
  // moverse deja de ser el que empuja a los demás.
  const enOrden = carteles
    .map((c) => ({
      ...c,
      choca: estorbos.some((e) => sePisan(c.natural, e)),
    }))
    .sort((a, b) => Number(a.choca) - Number(b.choca) || (a.clave < b.clave ? -1 : 1))

  for (const cartel of enOrden) {
    const todos = [...estorbos, ...colocados]
    // Se ARRANCA apartándose del estorbo de verdad —el cuerpo, el tablón—, porque
    // `desvioDelCartel` garantiza salir de él aunque no quepa ningún escape limpio: se va
    // al borde del marco. El reparto de abajo solo sabe mejorar, y sin esta salida un
    // cartel encerrado se quedaría en mitad del pecho, que es justo lo que se arregló el
    // 10-sep. Los vecinos se resuelven después, que sí admiten «no puedo, me quedo».
    const encima = estorbos.find((e) => sePisan(cartel.natural, e))
    let desvio: DesvioDelCartel = encima
      ? desvioDelCartel(cartel.natural, encima, marco)
      : { dx: 0, dy: 0 }
    for (let pase = 0; pase < PASES; pase++) {
      const sitio = conDesvio(cartel.natural, desvio)
      const choques = todos.filter((otro) => sePisan(sitio, otro))
      if (choques.length === 0) break

      // Se prueban las salidas de TODOS los que estorban, no solo las del primero: el
      // escape más corto del vecino de la izquierda puede meterte de lleno en el de
      // arriba, y entonces el pase siguiente deshace lo que este hizo y el cartel oscila.
      //
      // Y TAMBIÉN LAS ESQUINAS —una salida horizontal de uno con una vertical de otro—,
      // porque con un cuerpo de pie el hueco bueno no está ni al lado ni arriba sino en la
      // columna que queda entre el costado del cuerpo y el borde de la pantalla, y a esa
      // solo se llega moviéndose en los dos ejes. Medido el 2026-09-11: sin las esquinas,
      // cuatro carteles con el cuerpo de pie y el tablón puesto se quedaban con una pareja
      // al 100 % porque ninguna salida de un solo eje mejoraba y el bucle se rendía.
      const salidas = choques.flatMap((estorbo) => escapesDelCartel(sitio, estorbo, marco))
      const enX = salidas.filter((s) => s.dx !== 0)
      const enY = salidas.filter((s) => s.dy !== 0)
      const esquinas = enX.flatMap((h) => enY.map((v) => ({ dx: h.dx, dy: v.dy })))
      const candidatos = [...salidas, ...esquinas]
        .map((salida) => ({ dx: desvio.dx + salida.dx, dy: desvio.dy + salida.dy }))
        .filter((prueba) => {
          const donde = conDesvio(cartel.natural, prueba)
          return (
            donde.x0 >= 0 &&
            donde.x1 <= marco.ancho &&
            donde.y0 >= marco.arriba &&
            donde.y1 <= marco.abajo
          )
        })
      if (candidatos.length === 0) break

      const puntuar = (prueba: DesvioDelCartel) => {
        const donde = conDesvio(cartel.natural, prueba)
        return {
          choques: todos.filter((otro) => sePisan(donde, otro)).length,
          largo: largoDelDesvio(prueba),
        }
      }
      const mejor = candidatos
        .map((prueba) => ({ prueba, nota: puntuar(prueba) }))
        .sort((a, b) => a.nota.choques - b.nota.choques || a.nota.largo - b.nota.largo)[0]

      // Solo se acepta lo que MEJORA: si el mejor candidato no despeja más de lo que ya
      // hay, moverse es cambiar un problema por otro y encima gastar recorrido.
      if (mejor.nota.choques >= choques.length) break
      desvio = mejor.prueba
    }
    colocados.push(conDesvio(cartel.natural, desvio))
    reparto.set(cartel.clave, desvio)
  }

  return reparto
}
