/**
 * Geometría ósea del visor.
 *
 * Se construye UNA vez, en el espacio local de cada hueso, y después el shader
 * la mueve con la matriz correspondiente. Por eso el esqueleto no cuesta nada
 * aunque la pose cambie sesenta veces por segundo.
 */

import { entre, grados, M4, type Vec3 } from './algebra'
import { COLOR_HUESO, COLOR_HUESO_OSCURO, INDICE_HUESO, LADO, type Lado } from './esqueleto'
import { curva, elipsoide, huesoLargo, Malla, tubo } from './malla'

export function construirHuesos(): Malla {
  const m = new Malla()
  const H = (n: string): number => INDICE_HUESO[n]
  const lados: Lado[] = ['D', 'I']

  // --- Pelvis: palas ilíacas, sacro y ramas isquiopubianas -----------------
  const bp = H('pelvis')
  for (const k of [-1, 1]) {
    elipsoide(m, [k * 0.085, 0.035, -0.012], [0.062, 0.075, 0.032], {
      hueso: bp,
      color: COLOR_HUESO,
      su: 12,
      sv: 8,
      giro: M4.multiplicar(M4.girarZ(k * grados(14)), M4.girarY(k * grados(-26))),
    })
    // Isquion: el punto sobre el que el sujeto se sienta. Es la referencia
    // visual que hace legible la bisagra de cadera.
    elipsoide(m, [k * 0.062, -0.062, -0.018], [0.028, 0.03, 0.026], {
      hueso: bp,
      color: COLOR_HUESO_OSCURO,
      su: 10,
      sv: 7,
    })
    tubo(
      m,
      curva([[k * 0.055, -0.055, -0.01], [k * 0.048, -0.058, 0.03], [k * 0.012, -0.04, 0.052]], 8),
      () => 0.011,
      { hueso: bp, color: COLOR_HUESO, radial: 7 },
    )
  }
  // Sacro: cinco vértebras soldadas en una cuña. Es ancho arriba, donde recibe
  // el peso de la columna, y estrecho abajo: esa forma de triángulo es lo que le
  // permite meterse entre las dos palas ilíacas como una cuña.
  tubo(
    m,
    curva([[0, 0.05, -0.05], [0, 0.005, -0.054], [0, -0.045, -0.046]], 7),
    (u) => entre(0.034, 0.013, u),
    { hueso: bp, color: COLOR_HUESO, radial: 8, aplanar: 0.62 },
  )
  // --- Columna: vértebras, el hueso IRREGULAR por excelencia ---------------
  //
  // Una vértebra no tiene una forma sencilla porque hace tres cosas a la vez:
  // el cuerpo soporta el peso, el arco protege la médula y las apófisis son
  // palancas donde tiran los músculos. Esos salientes en varias direcciones son
  // lo que define a un hueso irregular.
  const tramoColumna = (
    hueso: string,
    n: number,
    largo: number,
    r0: number,
    r1: number,
    atras: number,
    /** Cuánto salen las transversas a cada lado. Las torácicas son las mayores:
     *  ahí se apoyan las costillas. */
    transversa: number,
  ) => {
    const b = H(hueso)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const y = t * largo
      const r = entre(r0, r1, t)
      const alto = (largo / n) * 0.36
      // Cuerpo vertebral: el cilindro que soporta la carga.
      elipsoide(m, [0, y, -0.008], [r, alto, r * 0.86], {
        hueso: b,
        color: COLOR_HUESO,
        su: 10,
        sv: 6,
      })
      // Apófisis espinosa: la que se palpa por la espalda, y de donde tiran
      // trapecio, romboides y dorsal.
      tubo(
        m,
        curva([[0, y, -0.02], [0, y - (largo / n) * 0.25, -0.02 - atras]], 5),
        (u) => 0.01 * (1 - u * 0.45),
        { hueso: b, color: COLOR_HUESO_OSCURO, radial: 6 },
      )
      // Apófisis transversas: salen a los lados, y son las que las fichas
      // nombran como origen del longísimo, del iliocostal y de los escalenos.
      // Sin ellas esos músculos nacían del aire.
      for (const lado2 of [1, -1]) {
        tubo(
          m,
          curva(
            [
              [lado2 * r * 0.7, y, -0.014],
              [lado2 * (r + transversa), y + alto * 0.15, -0.016],
            ],
            4,
          ),
          (u) => 0.0062 * (1 - u * 0.4),
          { hueso: b, color: COLOR_HUESO_OSCURO, radial: 5 },
        )
      }
    }
  }
  tramoColumna('lumbar', 5, 0.17, 0.026, 0.023, 0.03, 0.019)
  // Las torácicas llevan las transversas más largas: sobre ellas se apoyan las
  // costillas, y por eso la caja puede girar sobre la columna.
  tramoColumna('torax', 12, 0.27, 0.022, 0.017, 0.026, 0.022)
  tramoColumna('cuello', 7, 0.08, 0.015, 0.013, 0.014, 0.013)

  // --- Caja torácica: doce pares de costillas y esternón -------------------
  const bt = H('torax')
  for (let i = 0; i < 12; i++) {
    const t = i / 11
    const y = 0.245 - t * 0.215
    // El tórax alcanza su mayor anchura hacia la séptima costilla y se cierra
    // abajo; las dos últimas quedan flotantes.
    const apertura = Math.sin((0.3 + t * 0.62) * Math.PI)
    const w = 0.055 + apertura * 0.088
    const p = 0.042 + apertura * 0.055
    const caida = 0.03 + t * 0.055
    const flotante = i >= 10
    for (const k of [-1, 1]) {
      const trazado: Vec3[] = [
        [k * 0.02, y, -0.03],
        [k * w * 0.75, y - caida * 0.18, -p * 0.72],
        [k * w, y - caida * 0.52, 0],
        [k * w * (flotante ? 0.72 : 0.56), y - caida * 0.86, p * 0.62],
        flotante ? [k * w * 0.5, y - caida * 1.02, p * 0.8] : [k * 0.019, y - caida, p * 0.9],
      ]
      tubo(m, curva(trazado, 16), (u) => 0.0088 * (1 - u * 0.22), {
        hueso: bt,
        color: COLOR_HUESO,
        radial: 6,
        aplanar: 0.62,
      })
    }
  }
  tubo(
    m,
    curva([[0, 0.238, 0.082], [0, 0.185, 0.094], [0, 0.11, 0.092], [0, 0.055, 0.079]], 10),
    (u) => entre(0.02, 0.011, u),
    { hueso: bt, color: COLOR_HUESO, radial: 8, aplanar: 0.42 },
  )

  // --- Cráneo y mandíbula --------------------------------------------------
  const bc = H('craneo')
  elipsoide(m, [0, 0.082, -0.008], [0.072, 0.088, 0.079], { hueso: bc, color: COLOR_HUESO, su: 16, sv: 12 })
  elipsoide(m, [0, 0.055, 0.032], [0.052, 0.052, 0.05], { hueso: bc, color: COLOR_HUESO, su: 12, sv: 9 })
  tubo(
    m,
    curva(
      [
        [-0.044, 0.052, 0.002],
        [-0.038, 0.016, 0.042],
        [0, 0.01, 0.062],
        [0.038, 0.016, 0.042],
        [0.044, 0.052, 0.002],
      ],
      14,
    ),
    () => 0.01,
    { hueso: bc, color: COLOR_HUESO_OSCURO, radial: 6 },
  )

  // --- Cintura escapular ---------------------------------------------------
  for (const s of lados) {
    huesoLargo(m, [0, 0.012, 0], [0, 0.155, 0], 0.0105, {
      hueso: H('clavicula' + s),
      color: COLOR_HUESO,
      epifisisA: 1.5,
      epifisisB: 1.7,
      arqueo: 0.016,
    })
    const be = H('escapula' + s)
    // La escápula es un hueso PLANO: una lámina que se desliza sobre las
    // costillas, y por eso no tiene una articulación de verdad con el tórax sino
    // que la sujetan los músculos.
    //
    // Va como elipsoide achatado y no como tubo achatado, que es como estaba: el
    // tubo lleva la sección girando al seguir la curva, así que la «lámina» se
    // retorcía y acababa ocupando tanto fondo como ancho. Medida, daba una caja
    // de 9 × 12 × 8 cm para algo que debería tener dos centímetros de grosor.
    elipsoide(m, [0.006, 0.066, -0.004], [0.046, 0.062, 0.0068], {
      hueso: be,
      color: COLOR_HUESO,
      su: 12,
      sv: 10,
      giro: M4.multiplicar(M4.girarZ(grados(-6)), M4.girarY(grados(7))),
    })
    tubo(m, curva([[-0.03, 0.03, -0.01], [0.006, 0.048, -0.014], [0.038, 0.052, -0.01]], 8), () => 0.011, {
      hueso: be,
      color: COLOR_HUESO_OSCURO,
      radial: 6,
      aplanar: 0.4,
    })
    // Acromion: el techo del hombro y el tope que topa cuando el brazo sube sin
    // que la escápula rote. Es donde acaba la espina, y donde ancla el deltoides.
    elipsoide(m, [0.046, 0.048, -0.01], [0.016, 0.009, 0.013], {
      hueso: be,
      color: COLOR_HUESO_OSCURO,
      su: 9,
      sv: 7,
    })
    // Coracoides: el gancho de delante. De aquí tiran la cabeza corta del bíceps,
    // el coracobraquial y el pectoral menor, y por eso los tres se mueven juntos.
    elipsoide(m, [0.028, 0.043, 0.022], [0.011, 0.008, 0.013], {
      hueso: be,
      color: COLOR_HUESO_OSCURO,
      su: 8,
      sv: 6,
    })
  }

  // --- Miembro superior ----------------------------------------------------
  for (const s of lados) {
    const k = LADO[s]
    huesoLargo(m, [0, 0.005, 0], [0, 0.31, 0], 0.0155, {
      hueso: H('brazo' + s),
      color: COLOR_HUESO,
      epifisisA: 1.9,
      epifisisB: 1.7,
    })
    // Cabeza humeral: la esfera que hace legible el hombro al orbitar.
    elipsoide(m, [0, 0.008, -0.004], [0.028, 0.028, 0.027], {
      hueso: H('brazo' + s),
      color: COLOR_HUESO,
      su: 12,
      sv: 9,
    })
    // Tubérculo mayor: el relieve lateral donde acaban supraespinoso,
    // infraespinoso y redondo menor. Es lo que roza bajo el acromion cuando el
    // hombro se pinza.
    elipsoide(m, [k * 0.023, 0.006, -0.002], [0.012, 0.014, 0.012], {
      hueso: H('brazo' + s),
      color: COLOR_HUESO_OSCURO,
      su: 8,
      sv: 6,
    })
    // Tubérculo menor: delante, para el subescapular. Entre los dos corre el
    // tendón de la cabeza larga del bíceps.
    elipsoide(m, [k * 0.004, 0.008, 0.021], [0.009, 0.012, 0.009], {
      hueso: H('brazo' + s),
      color: COLOR_HUESO_OSCURO,
      su: 8,
      sv: 6,
    })
    // Tuberosidad deltoidea: la cresta de media diáfisis donde acaba el
    // deltoides. Sin ella el músculo más grande del hombro parecía morir en un
    // tubo liso.
    elipsoide(m, [k * 0.016, 0.135, 0.002], [0.008, 0.03, 0.009], {
      hueso: H('brazo' + s),
      color: COLOR_HUESO_OSCURO,
      su: 7,
      sv: 8,
    })
    // Epicóndilos: los dos bultos del codo. De ellos nacen los flexores y los
    // extensores del carpo, y son lo que se palpa al buscar un codo de tenista.
    for (const lado2 of [1, -1]) {
      elipsoide(m, [k * lado2 * 0.019, 0.3, 0], [0.011, 0.011, 0.012], {
        hueso: H('brazo' + s),
        color: COLOR_HUESO_OSCURO,
        su: 8,
        sv: 6,
      })
    }
    // Radio y cúbito por separado: así se ve la pronosupinación.
    huesoLargo(m, [k * 0.013, 0.004, 0], [k * 0.007, 0.26, 0.004], 0.0105, {
      hueso: H('antebrazo' + s),
      color: COLOR_HUESO,
      epifisisA: 1.9,
      epifisisB: 1.5,
    })
    huesoLargo(m, [-k * 0.013, 0.006, -0.004], [-k * 0.009, 0.255, 0], 0.0098, {
      hueso: H('antebrazo' + s),
      color: COLOR_HUESO,
      epifisisA: 1.5,
      epifisisB: 1.8,
    })
    // Olécranon: el pico del codo. Es el que topa con su fosa y detiene la
    // extensión en cero, que es hueso contra hueso y no músculo — el catálogo
    // articular lo dice con esas palabras, así que tiene que verse.
    elipsoide(m, [-k * 0.013, 0.002, -0.016], [0.012, 0.016, 0.013], {
      hueso: H('antebrazo' + s),
      color: COLOR_HUESO_OSCURO,
      su: 9,
      sv: 7,
    })
    // Tuberosidad del radio: donde tira el bíceps. Está en la cara interna, y de
    // ahí que supinar cambie tanto la palanca del músculo.
    elipsoide(m, [k * 0.014, 0.042, 0.007], [0.008, 0.013, 0.008], {
      hueso: H('antebrazo' + s),
      color: COLOR_HUESO_OSCURO,
      su: 7,
      sv: 6,
    })
    const bm = H('mano' + s)
    // El carpo son ocho huesos CORTOS en dos filas, no un bulto: un hueso corto
    // mide casi lo mismo en las tres direcciones, y son sus caras planas
    // deslizando unas sobre otras las que dan a la muñeca el recorrido que
    // tiene. Dibujado como un solo elipsoide, la muñeca parecía una bisagra.
    for (const fila of [0, 1]) {
      const cuantos = fila === 0 ? 4 : 4
      for (let c = 0; c < cuantos; c++) {
        const x = (c - (cuantos - 1) / 2) * 0.0132
        elipsoide(
          m,
          [x, 0.011 + fila * 0.0125, -0.002 + Math.abs(x) * 0.15],
          [0.0058, 0.0056, 0.0055],
          { hueso: bm, color: fila === 0 ? COLOR_HUESO : COLOR_HUESO_OSCURO, su: 7, sv: 5 },
        )
      }
    }
    for (let f = 0; f < 4; f++) {
      const x = (f - 1.5) * 0.013
      // Los dedos rectos y en abanico son de lo que más delata a un maniquí. En
      // reposo la mano los tiene curvados, y el meñique más que el índice.
      const cierre = 0.55 + f * 0.16
      tubo(
        m,
        curva(
          [
            [x, 0.034, 0],
            [x * 1.06, 0.07, 0.01 + cierre * 0.014],
            [x * 1.08, 0.096, 0.008 + cierre * 0.038],
            [x * 1.06, 0.108, -0.004 + cierre * 0.05],
          ],
          10,
        ),
        (u) => entre(0.0062, 0.004, u),
        { hueso: bm, color: COLOR_HUESO, radial: 5 },
      )
    }
    tubo(
      m,
      curva([[-k * 0.022, 0.026, 0.012], [-k * 0.038, 0.048, 0.032], [-k * 0.036, 0.066, 0.048]], 8),
      (u) => entre(0.0066, 0.0046, u),
      { hueso: bm, color: COLOR_HUESO, radial: 5 },
    )
  }

  // --- Miembro inferior ----------------------------------------------------
  for (const s of lados) {
    const k = LADO[s]
    const bmu = H('muslo' + s)
    // Cuello femoral: sale del eje, y por eso la cadera se lee como bisagra.
    elipsoide(m, [k * 0.03, -0.005, 0], [0.03, 0.03, 0.029], { hueso: bmu, color: COLOR_HUESO, su: 12, sv: 9 })
    tubo(m, curva([[k * 0.028, -0.004, 0], [k * 0.012, 0.03, -0.002], [0, 0.062, 0]], 7), (u) => entre(0.02, 0.017, u), {
      hueso: bmu,
      color: COLOR_HUESO,
      radial: 8,
    })
    huesoLargo(m, [0, 0.055, 0], [0, 0.45, 0], 0.019, {
      hueso: bmu,
      color: COLOR_HUESO,
      epifisisA: 1.25,
      epifisisB: 2.0,
      arqueo: 0.01,
    })
    // Trocánter mayor: el bulto que se palpa en la cadera. Ahí acaban glúteo
    // medio y menor, y de ahí nace el vasto lateral. Es el accidente óseo que
    // más veces nombran las fichas después de la cresta ilíaca.
    elipsoide(m, [-k * 0.035, 0.028, -0.004], [0.019, 0.026, 0.018], {
      hueso: bmu,
      color: COLOR_HUESO_OSCURO,
      su: 10,
      sv: 8,
    })
    // Trocánter menor: hacia dentro y atrás, donde acaba el psoas ilíaco. Es lo
    // que explica que el psoas flexione la cadera y además la rote.
    elipsoide(m, [k * 0.016, 0.072, -0.014], [0.011, 0.013, 0.011], {
      hueso: bmu,
      color: COLOR_HUESO_OSCURO,
      su: 8,
      sv: 6,
    })
    // Línea áspera: la cresta de la cara posterior. No es un bulto sino un
    // reborde a lo largo, y es de donde tiran los vastos y los aductores.
    tubo(
      m,
      curva([[0, 0.11, -0.017], [0, 0.25, -0.021], [0, 0.39, -0.016]], 7),
      (u) => entre(0.005, 0.0035, u),
      { hueso: bmu, color: COLOR_HUESO_OSCURO, radial: 5, aplanar: 0.5 },
    )
    // Cóndilos femorales: los dos apoyos de la rodilla, y el origen de los dos
    // gemelos. Con un extremo liso no se entendia de donde salen.
    for (const lado2 of [1, -1]) {
      elipsoide(m, [lado2 * 0.019, 0.443, -0.006], [0.017, 0.02, 0.021], {
        hueso: bmu,
        color: COLOR_HUESO_OSCURO,
        su: 9,
        sv: 7,
      })
    }
    const bti = H('tibia' + s)
    huesoLargo(m, [k * 0.01, 0.006, 0], [k * 0.006, 0.425, 0], 0.0165, {
      hueso: bti,
      color: COLOR_HUESO,
      epifisisA: 2.1,
      epifisisB: 1.7,
    })
    huesoLargo(m, [-k * 0.026, 0.02, -0.006], [-k * 0.026, 0.418, -0.004], 0.0082, {
      hueso: bti,
      color: COLOR_HUESO,
      epifisisA: 1.5,
      epifisisB: 1.9,
    })
    // Tuberosidad tibial: donde acaba el tendón rotuliano y, con él, todo el
    // cuádriceps. Es el punto por el que la rodilla se estira.
    elipsoide(m, [k * 0.008, 0.045, 0.019], [0.011, 0.015, 0.009], {
      hueso: bti,
      color: COLOR_HUESO_OSCURO,
      su: 8,
      sv: 6,
    })
    // Maléolos: los dos bultos del tobillo. El de dentro es más alto que el de
    // fuera, y esa diferencia es la que hace que el tobillo se tuerza siempre
    // hacia el mismo lado.
    elipsoide(m, [k * 0.014, 0.417, 0], [0.01, 0.016, 0.011], {
      hueso: bti,
      color: COLOR_HUESO_OSCURO,
      su: 8,
      sv: 6,
    })
    elipsoide(m, [-k * 0.026, 0.428, -0.004], [0.009, 0.017, 0.01], {
      hueso: bti,
      color: COLOR_HUESO_OSCURO,
      su: 8,
      sv: 6,
    })
    // Rótula: marca la extensión de rodilla de un vistazo.
    elipsoide(m, [0, 0.012, 0.03], [0.022, 0.026, 0.012], { hueso: bti, color: COLOR_HUESO_OSCURO, su: 10, sv: 7 })
    const bpi = H('pie' + s)
    // El tarso son siete huesos cortos. El astrágalo recibe todo el peso de la
    // pierna y lo reparte hacia el talón y hacia delante, y por eso el tobillo
    // aguanta lo que aguanta sin ser una bisagra simple.
    elipsoide(m, [0, 0.014, -0.014], [0.016, 0.014, 0.017], {
      hueso: bpi,
      color: COLOR_HUESO,
      su: 9,
      sv: 7,
    })
    elipsoide(m, [0, 0.026, -0.034], [0.019, 0.017, 0.022], {
      hueso: bpi,
      color: COLOR_HUESO,
      su: 9,
      sv: 7,
    })
    for (let c = 0; c < 3; c++) {
      const x = (c - 1) * 0.0125
      elipsoide(m, [x, 0.03, 0.006], [0.0068, 0.0072, 0.0082], {
        hueso: bpi,
        color: COLOR_HUESO_OSCURO,
        su: 7,
        sv: 5,
      })
    }
    // Tuberosidad del calcáneo: el talón propiamente dicho, donde acaba el
    // tendón de Aquiles. Cuanto más sale hacia atrás, más palanca tiene el
    // tríceps sural para levantar el cuerpo.
    elipsoide(m, [0, 0.03, -0.052], [0.018, 0.019, 0.014], {
      hueso: bpi,
      color: COLOR_HUESO_OSCURO,
      su: 9,
      sv: 7,
    })
    for (let f = 0; f < 5; f++) {
      const x = (f - 2) * 0.014
      tubo(
        m,
        curva([[x * 0.55, 0.04, -0.012], [x, 0.115, -0.026], [x * 1.15, 0.185, -0.03]], 8),
        (u) => entre(0.0085, 0.0058, u),
        { hueso: bpi, color: COLOR_HUESO, radial: 5 },
      )
    }
  }
  return m
}
