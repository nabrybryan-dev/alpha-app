import { describe, expect, it } from 'vitest'
import { PATRONES, PATRON_POR_ID } from '../../../domain/patrones/catalogo'
import { implementosDeEscena } from './implementos'
import {
  ALFA_DEL_APARATO_QUE_TAPA,
  aparatoTapaAlCuerpo,
  parteDelCuerpoTapada,
  partirImplementos,
  UMBRAL_DE_OCLUSION,
} from './oclusionDelAparato'

/**
 * EL GUARDIÁN DE LA OCLUSIÓN.
 *
 * Con el press de pecho en máquina por fin dentro del cuadro (2026-09-05), lo que se veía
 * era una plancha gris con dos manos asomando: la máquina tapaba el 36 % de la persona. Se
 * midió sobre los 24 ejemplos con aparato, en la peor de tres fases, y salieron dos grupos
 * —36, 24, 19, 14 y 10 por un lado; 5, 2 y ceros por el otro—. El tope va en el hueco.
 */

const aparatoDe = (id: string, nombre: string) =>
  partirImplementos(implementosDeEscena(PATRON_POR_ID[id].categoria, nombre)).aparato

describe('el aparato que tapa a la persona', () => {
  /**
   * EL CASO QUE LO EMPEZÓ TODO, y que el 2026-09-07 dejó de ocurrir. El press de pecho en
   * máquina tapaba el 36 % de la persona (21 % desde que la máquina tiene un brazo por mano)
   * y por eso existe la translucidez. Ese día el press se recolocó —codos recogidos, antebrazo
   * al techo— y la máquina, que se coloca contra el recorrido de las manos, se fue con ellos:
   * ahora tapa 0 %. No se borra el caso, se le da la vuelta y se deja escrito, porque el
   * número de antes era el que justificaba la función entera.
   */
  it('el press de pecho en máquina ya no se planta delante de la persona', () => {
    const tapado = parteDelCuerpoTapada(PATRON_POR_ID.empuje_horizontal, aparatoDe('empuje_horizontal', 'Press de pecho en máquina'))
    expect(tapado).toBeLessThan(UMBRAL_DE_OCLUSION)
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.empuje_horizontal, aparatoDe('empuje_horizontal', 'Press de pecho en máquina'))).toBe(false)
  })

  /**
   * Y quien lleva ahora el caso grande es la APERTURA INVERSA EN MÁQUINA: 38,1 %, casi cinco
   * veces el tope. Tiene sentido que sea ella: la pec deck inversa se mira de frente y sus dos
   * brazos barren justo por delante del pecho. Es el caso que justifica la translucidez ahora
   * que el press de banca dejó de taparse.
   */
  it('en la apertura inversa en máquina la máquina tapa mucho más del umbral', () => {
    const tapado = parteDelCuerpoTapada(PATRON_POR_ID.apertura_inversa_maquina, aparatoDe('apertura_inversa_maquina', 'Apertura inversa en máquina'))
    expect(tapado).toBeGreaterThan(UMBRAL_DE_OCLUSION * 2)
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.apertura_inversa_maquina, aparatoDe('apertura_inversa_maquina', 'Apertura inversa en máquina'))).toBe(true)
  })

  /**
   * LA ELEVACIÓN LATERAL SALIÓ DE ESTA LISTA EL 2026-09-07 y se queda escrito: su columna de
   * polea tapaba el hombro porque el brazo subía por el plano frontal puro, con la polea
   * plantada justo en la línea de la cámara. Ahora sube por el plano escapular —el codo
   * adelantado 30°, que es lo que pide su propia clave— y la polea se coloca contra ESE
   * recorrido, así que se le va de en medio: 4,8 %. Quien lleva el caso es la de arriba.
   */
  it('la elevación lateral en polea ya no tiene la columna delante del hombro', () => {
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.abduccion_hombro, aparatoDe('abduccion_hombro', 'Elevación lateral en polea'))).toBe(false)
  })

  /**
   * LA REGLA NO ES POR TIPO DE MÁQUINA. El remo en máquina lleva la misma máquina de
   * placas que el press y no tapa nada: desde su ángulo la pila queda detrás. Si alguien
   * la volviera «placas → translúcida siempre», esto se pone rojo.
   */
  it('la misma máquina de placas NO tapa en el remo ni en la elevación de talones: no se vuelve translúcida', () => {
    // EL REMO PASÓ DE 0 A 7,1 % el 2026-09-06, y no es un empeoramiento: es que la máquina
    // se movió al sitio que le toca. Hasta ese día la de placas se plantaba SIEMPRE detrás
    // del sujeto con un número escrito a mano, y por eso desde el ángulo del remo no tapaba
    // nada: estaba a la espalda del que rema, tirando en la misma dirección en la que él
    // tiraba. Ahora se coloca contra el gesto —delante de quien rema, que es donde está la
    // pila de un remo de verdad— y desde ahí se le cruza por delante un 7,1 % del cuerpo.
    //
    // Sigue por debajo del 8 % del umbral, así que la regla que este test protege se
    // mantiene entera: **no es «placas → translúcida siempre»**. Pero va justo: si alguien
    // toca la colocación y esto se pone rojo, lo que hay que mirar es si el aparato empezó a
    // taparle la cara al sujeto, no si el umbral se quedó corto.
    expect(
      parteDelCuerpoTapada(PATRON_POR_ID.traccion_horizontal, aparatoDe('traccion_horizontal', 'Remo en máquina')),
    ).toBeLessThan(UMBRAL_DE_OCLUSION)
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.traccion_horizontal, aparatoDe('traccion_horizontal', 'Remo en máquina'))).toBe(false)
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.flexion_plantar, aparatoDe('flexion_plantar', 'Elevación de talones en máquina'))).toBe(false)
  })

  /**
   * SE MIRA LA PEOR FASE, NO UNA — y el press de hombro es donde se ve, porque el aparato
   * tapa distinto en cada punto del recorrido.
   *
   * EL PRESS DEJÓ DE ESTAR TAPADO EL 2026-09-07, y no por tocar la oclusión: por la ficha.
   * Hasta ese día el press subía en cruz por el plano frontal y los dos brazos de la máquina
   * —uno por mano, con el eje detrás del hombro— cruzaban por delante de la cabeza: 24 %
   * arriba, 0 % a media repetición. Ahora sube por el plano escapular, con el codo adelantado
   * unos 45°, así que los brazos pasan a los LADOS de la cabeza: 4,8 % arriba, 4,8 % abajo,
   * 2,4 % en medio. Por debajo del 8 % del umbral, así que ya no se vuelve translúcida, y
   * está bien: lo que hay entre la cámara y la persona es aire.
   *
   * Lo que este caso sigue protegiendo es la REGLA, no el número: el peor punto del
   * recorrido manda. Si alguien volviera a medir una sola fase y le tocara la de en medio,
   * la cuenta bajaría a 2,4 % y esto se pondría rojo.
   */
  it('mide el press de hombro en su peor fase, que no es la de en medio', () => {
    const patron = PATRON_POR_ID.empuje_vertical
    const aparato = aparatoDe('empuje_vertical', 'Press de hombro en máquina')
    const soloEnMedio = { ...patron, inicio: patron.medio!, fin: patron.medio!, medio: undefined }
    const peor = parteDelCuerpoTapada(patron, aparato)
    expect(peor).toBeGreaterThan(parteDelCuerpoTapada(soloEnMedio, aparato))
    // Y sí se le cruza a la cámara: 9,5 % en la peor fase contra 2,4 % en la de en medio.
    expect(peor).toBeGreaterThan(UMBRAL_DE_OCLUSION)
    expect(aparatoTapaAlCuerpo(patron, aparato)).toBe(true)
  })

  /** Y la caja de pantalla engaña: el Smith flanquea al cuerpo, lo «solapa» entero y no lo tapa. */
  it('el Smith flanquea al cuerpo y no lo tapa', () => {
    expect(parteDelCuerpoTapada(PATRON_POR_ID.sentadilla, aparatoDe('sentadilla', 'Sentadilla en Smith'))).toBe(0)
  })

  it('el tope está en el hueco medido: entre el 5 % que roza y el 10 % que tapa', () => {
    expect(UMBRAL_DE_OCLUSION).toBeGreaterThan(0.05)
    expect(UMBRAL_DE_OCLUSION).toBeLessThan(0.1)
  })

  it('lo que va en las manos nunca es aparato: la barra y las mancuernas quedan opacas', () => {
    const { hierro, aparato } = partirImplementos(implementosDeEscena(PATRON_POR_ID.empuje_horizontal.categoria, 'Press de pecho con barra'))
    expect(hierro.piezas.map((p) => p.pieza)).toContain('barra')
    expect(aparato.piezas.map((p) => p.pieza)).not.toContain('barra')
    expect(aparato.piezas.map((p) => p.pieza)).not.toContain('mancuerna')
  })

  it('Y EL MUEBLE QUE SOSTIENE TAMPOCO: un banco translúcido dice que no hay banco', () => {
    // Esto se dio la vuelta el 2026-09-06, ese mismo día, y la vuelta la dio una medida
    // contra la frase que estaba escrita. Decía que «un banco visto de lado tapa medio
    // tronco». Medido pieza a pieza sobre el catálogo entero: un banco NO PASA DEL 2 %
    // —búlgara 2, press inclinado 2, banco romano 2, el resto 0—, porque un mueble que
    // sostiene queda debajo del cuerpo y no entre el cuerpo y la cámara.
    //
    // Y estando en el grupo del aparato hacía daño, porque la decisión se toma para el grupo
    // entero: en el curl femoral la máquina tapa el 36 % y arrastraba a la camilla, así que
    // la camilla salía translúcida y el sujeto volvía a parecer que flotaba — el defecto que
    // la camilla venía a arreglar. Lo vio asus-f4 en la captura que mandó Bryan.
    const conCamilla = implementosDeEscena(PATRON_POR_ID.flexion_rodilla.categoria, 'Flexión de rodilla tumbado en máquina')
    expect(conCamilla.piezas.map((p) => p.pieza)).toContain('banco')
    const { hierro, aparato } = partirImplementos(conCamilla)
    expect(hierro.piezas.map((p) => p.pieza), 'la camilla tiene que ir con lo opaco').toContain('banco')
    expect(aparato.piezas.map((p) => p.pieza)).not.toContain('banco')
    // Y la máquina de ese mismo patrón sí tapa, para que se vea que no se ha desactivado
    // la regla entera: lo que se ha sacado del grupo es el mueble, no el aparato.
    expect(aparatoTapaAlCuerpo(PATRON_POR_ID.flexion_rodilla, aparato)).toBe(true)
  })

  it('y ningún mueble del catálogo llegaba al umbral por su cuenta', () => {
    // La medida que sostiene la decisión de arriba. Si algún día un mueble sí tapara, esto
    // se pone rojo y habrá que decidir otra vez —con el dato delante, no con la frase.
    for (const p of PATRONES) {
      const escena = implementosDeEscena(p.categoria, p.ejemplos.split('·')[0].trim())
      const muebles = escena.piezas.filter((x) => x.pieza === 'banco')
      if (muebles.length === 0) continue
      const tapa = parteDelCuerpoTapada(p, { ...escena, piezas: muebles })
      expect(tapa, `${p.id}: su mueble tapa el ${(tapa * 100).toFixed(0)} %`).toBeLessThan(0.05)
    }
  })

  it('translúcido no es invisible: el aparato sigue diciendo dónde está', () => {
    expect(ALFA_DEL_APARATO_QUE_TAPA).toBeGreaterThan(0.15)
    expect(ALFA_DEL_APARATO_QUE_TAPA).toBeLessThan(0.5)
  })

  it('sin aparato no hay nada que tape', () => {
    expect(parteDelCuerpoTapada(PATRON_POR_ID.bisagra_cadera, { piezas: [] } as never)).toBe(0)
  })
})
