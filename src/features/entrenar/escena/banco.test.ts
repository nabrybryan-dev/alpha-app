import { describe, expect, it } from 'vitest'
import { PATRONES, PATRON_POR_ID, type Patron } from '../../../domain/patrones/catalogo'
import { esqueletoEnFase } from '../../../domain/patrones/escena'
import { puntoDeHueso } from '../../../domain/patrones/esqueleto'
import { PLANTA_NEUTRA } from '../../../domain/patrones/huesosNeutros'
import { Malla } from '../../../domain/patrones/malla'
import { construirBanco, type ApoyoDelCuerpo } from './banco'
import { implementosDeEscena } from './implementos'
import { partirImplementos } from './oclusionDelAparato'

/**
 * EL MUEBLE QUE SOSTIENE AL SUJETO, contado y medido.
 *
 * El salón ya dibujaba lo que el sujeto lleva en las manos, pero no lo que hay debajo: un
 * press de banca tumbado sobre nada, un hip thrust con los hombros en el vacío. Medido antes
 * de tocar: once patrones dejaban al sujeto sin nada, y ocho ni siquiera recibían una
 * máquina que disimulara.
 *
 * Lo que se comprueba aquí es de dos clases, y la segunda es la que importa:
 *
 *  1. QUIÉN recibe mueble, clavado por nombre. La regla se lee de la prosa de
 *     `ModeloDePalanca.anclaje`, así que un anclaje reescrito puede llevarse un banco por
 *     delante sin romper nada más. Este recuento es la contrapartida de leer prosa.
 *  2. DÓNDE queda, medido contra el esqueleto: por debajo del cuerpo y no atravesándolo, y
 *     con las patas llegando al suelo. Un banco mal colocado no falla — se ve mal, que es
 *     peor.
 */

const primerEjemplo = (p: Patron): string => p.ejemplos.split('·')[0].trim()

const bancoDe = (p: Patron): ApoyoDelCuerpo | undefined =>
  implementosDeEscena(p.categoria, primerEjemplo(p)).piezas.find((x) => x.pieza === 'banco')?.apoyo

describe('quién recibe mueble', () => {
  it('los nueve que lo necesitan, y ni uno más', () => {
    const conMueble = PATRONES.filter((p) => bancoDe(p)).map((p) => p.id)
    expect(conMueble.sort()).toEqual(
      [
        // Declarado por el propio patrón en `apoyosExtra`: hombros en el banco, pie de
        // atrás en el cajón.
        'extension_cadera',
        'sentadilla_unilateral',
        // Declarado en la prosa del anclaje.
        'empuje_horizontal',
        'empuje_inclinado',
        'extension_lumbar',
        'flexion_muneca',
        'extension_muneca',
        // Y por geometría: tumbado y sin apoyo en el suelo, aunque su anclaje no nombre
        // ningún mueble.
        'apertura_pecho',
        // El noveno entra el 2026-09-06 y es el único que va tumbado EN UNA MÁQUINA: el
        // curl femoral. Hasta ese día la regla «donde hay máquina no hay mueble» se lo
        // quitaba, y el sujeto salía boca abajo flotando a 32 cm del suelo.
        'flexion_rodilla',
      ].sort(),
    )
  })

  it('quien pisa el suelo no lleva banco, aunque su anclaje nombre uno', () => {
    // La regla que vale por media tabla. El curl de bíceps se hace DE PIE y su anclaje dice
    // «el húmero, contra el torso o el atril»: hay palabra de mueble, y en la primera
    // versión le salió un banco a lo largo de todo el tronco. El anclaje describe contra qué
    // se estabiliza el segmento que trabaja, no sobre qué se tumba el cuerpo.
    expect(bancoDe(PATRON_POR_ID.flexion_codo)).toBeUndefined()
    expect(bancoDe(PATRON_POR_ID.empuje_vertical)).toBeUndefined()
    expect(bancoDe(PATRON_POR_ID.bisagra_cadera)).toBeUndefined()
  })

  it('quien apoya en el SUELO tampoco: una plancha no lleva banco, lleva suelo', () => {
    expect(bancoDe(PATRON_POR_ID.antiextension)).toBeUndefined()
    expect(bancoDe(PATRON_POR_ID.movilidad_toracica)).toBeUndefined()
    expect(bancoDe(PATRON_POR_ID.rotacion_cadera)).toBeUndefined()
  })

  it('donde ya hay máquina no se pone banco: se atravesarían — salvo si va tumbado', () => {
    // `construirMaquina` ya dibuja asiento y respaldo. Es la frontera del módulo, y se
    // comprueba sobre los patrones que de verdad reciben máquina en el catálogo.
    //
    // LA EXCEPCIÓN LA MANDÓ BRYAN EL 2026-09-06, con una foto del iPhone: el curl femoral
    // tumbado salía con el sujeto boca abajo FLOTANDO a 32 cm del suelo, sin nada debajo.
    // Y era correcto según esta regla —hay máquina, luego no hay mueble—, solo que el
    // asiento y el respaldo de una máquina de placas sostienen a quien se SIENTA, y a quien
    // se tumba no le sostienen nada. Los treinta centímetros de respaldo le quedaban a la
    // altura de la rodilla.
    const conMaquina = PATRONES.filter((p) =>
      implementosDeEscena(p.categoria, primerEjemplo(p)).piezas.some((x) => x.pieza === 'maquina'),
    )
    expect(conMaquina.length).toBeGreaterThan(8)
    const tumbados = ['flexion_rodilla']
    for (const p of conMaquina) {
      if (tumbados.includes(p.id)) {
        const camilla = bancoDe(p)!
        expect(camilla, `${p.id} entrena tumbado en la máquina y no tiene camilla`).toBeDefined()
        // De la mitad del tórax a la mitad del muslo: el tronco y los fémures, con la
        // rodilla en el borde. Es lo que apoya en un curl femoral.
        expect(camilla.desde[0]).toBe('torax')
        expect(camilla.hasta[0]).toBe('musloD')
        continue
      }
      expect(bancoDe(p), `${p.id} lleva máquina Y banco`).toBeUndefined()
    }
  })

  it('y de pie doblado por la cadera NO es tumbado, aunque el tronco esté horizontal', () => {
    // La apertura inversa declara 60° de giro y el remo en máquina deja el tronco a 27° de
    // la horizontal, y los dos se hacen DE PIE. Una camilla debajo sería un mueble en el
    // aire. Lo que los separa no es el ángulo del tronco sino el pie en el suelo.
    expect(bancoDe(PATRON_POR_ID.abduccion_horizontal)).toBeUndefined()
    expect(bancoDe(PATRON_POR_ID.traccion_horizontal)).toBeUndefined()
    expect(PATRON_POR_ID.abduccion_horizontal.apoyo).toBe('suelo')
    expect(PATRON_POR_ID.traccion_horizontal.apoyo).toBe('suelo')
  })

  it('el hip thrust apoya los HOMBROS, no el tronco entero', () => {
    // Si se le diera el banco del torso completo, el hip thrust se leería como un press de
    // banca con la cadera levantada. El patrón ya declara qué hueso apoya, y de ahí sale.
    const apoyo = bancoDe(PATRON_POR_ID.extension_cadera)!
    expect(apoyo.desde[0]).toBe('torax')
    expect(apoyo.hasta[0]).toBe('torax')
    expect(apoyo.porQue).toContain('torax')
  })
})

describe('dónde queda el mueble', () => {
  it('el acolchado va POR DEBAJO del cuerpo, nunca atravesándolo', () => {
    // El hueso pasa por dentro de la carne: un banco a la altura de la columna sale
    // atravesando la espalda.
    //
    // Se mide contra la LÍNEA que une los dos huesos, no contra el más bajo de los dos.
    // La primera versión de esta prueba comparaba el vértice más alto del mueble con el
    // hueso más bajo, y la puso roja el press inclinado — con razón suya y no del código:
    // en un banco inclinado la cabecera está legítimamente por encima de la cadera. Lo que
    // hay que exigir es que en CADA punto a lo largo del mueble, el mueble quede por debajo
    // del cuerpo que sostiene.
    for (const p of PATRONES) {
      const apoyo = bancoDe(p)
      if (!apoyo) continue
      for (const fase of [0, 0.5, 1]) {
        const esq = esqueletoEnFase(p, fase)
        const a = puntoDeHueso(esq, apoyo.desde[0], apoyo.desde[1])
        const b = puntoDeHueso(esq, apoyo.hasta[0], apoyo.hasta[1])
        const eje = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const
        const largo2 = eje[0] ** 2 + eje[1] ** 2 + eje[2] ** 2
        const malla = new Malla(512)
        construirBanco(malla, apoyo, esq, [0, 0, 0], [0, 0, 0])
        for (let i = 0; i < malla.vertices; i++) {
          const v = [malla.posicion[i * 3], malla.posicion[i * 3 + 1], malla.posicion[i * 3 + 2]]
          // Dónde cae este vértice a lo largo del eje del cuerpo, y qué altura tiene el
          // cuerpo justo ahí. Fuera del tramo se toma el extremo, que es lo que hace que
          // las patas —que salen por debajo de los extremos— no cuenten como intrusas.
          const t =
            largo2 === 0
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    1,
                    ((v[0] - a[0]) * eje[0] + (v[1] - a[1]) * eje[1] + (v[2] - a[2]) * eje[2]) /
                      largo2,
                  ),
                )
          const alturaDelCuerpo = a[1] + eje[1] * t
          expect(
            v[1],
            `${p.id} en fase ${fase}: el mueble atraviesa el cuerpo`,
          ).toBeLessThan(alturaDelCuerpo + 0.02)
        }
      }
    }
  })

  it('el acolchado sigue el eje del cuerpo, así que un inclinado sale inclinado', () => {
    // La inclinación NO se declara en ningún sitio: la pone el cuerpo, porque el acolchado
    // va de un punto del esqueleto a otro. Es lo que hace que el mismo código dé un banco
    // plano, uno inclinado y un banco romano.
    const inclinacion = (p: Patron): number => {
      const apoyo = bancoDe(p)!
      const esq = esqueletoEnFase(p, 0.5)
      const a = puntoDeHueso(esq, apoyo.desde[0], apoyo.desde[1])
      const b = puntoDeHueso(esq, apoyo.hasta[0], apoyo.hasta[1])
      return (Math.abs(Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2]))) * 180) / Math.PI
    }
    // Banca: plano. Inclinado: inclinado de verdad. Banco romano: casi vertical.
    expect(inclinacion(PATRON_POR_ID.empuje_horizontal)).toBeLessThan(10)
    expect(inclinacion(PATRON_POR_ID.apertura_pecho)).toBeLessThan(10)
    expect(inclinacion(PATRON_POR_ID.empuje_inclinado)).toBeGreaterThan(25)
    expect(inclinacion(PATRON_POR_ID.extension_lumbar)).toBeGreaterThan(50)
  })

  it('el asiento de un sujeto sentado sale horizontal, no clavado como un poste', () => {
    // La primera versión llevaba el acolchado de pelvis a pelvis, y la pelvis de alguien
    // sentado está de pie: salía un tubo vertical. Va de la pelvis hacia el muslo.
    const apoyo = bancoDe(PATRON_POR_ID.flexion_muneca)!
    expect(apoyo.desde[0]).toBe('pelvis')
    expect(apoyo.hasta[0]).toBe('musloD')
  })

  it('el mueble tiene el alto de un mueble, no el de un taburete de bar', () => {
    // Las patas van ACOTADAS, y el porqué no es de dibujo: los patrones sin apoyo plantar
    // viven a la altura que diga su `raizInicio`, que en el catálogo es un desplazamiento
    // sobre la altura de pie y no una cota real —un sujeto sentado sale a 1,46 m—. Sin tope,
    // el asiento del curl de muñeca salía con patas de metro y medio.
    //
    // Lo que se exige entonces no es que toque el suelo, sino que **mida lo que mide un
    // mueble**: un banco de gimnasio son 45 cm y un banco romano llega a 90 por su parte
    // alta. Y donde el sujeto sí está a su altura real, el mueble llega al suelo solo.
    for (const p of PATRONES) {
      const apoyo = bancoDe(p)
      if (!apoyo?.conPatas) continue
      const malla = new Malla(512)
      construirBanco(malla, apoyo, esqueletoEnFase(p, 0.5), [0, 0, 0], [0, 0, 0])
      expect(malla.vertices, `${p.id} no dibuja nada`).toBeGreaterThan(20)
      let masBajo = Infinity
      let masAlto = -Infinity
      for (let i = 0; i < malla.vertices; i++) {
        masBajo = Math.min(masBajo, malla.posicion[i * 3 + 1])
        masAlto = Math.max(masAlto, malla.posicion[i * 3 + 1])
      }
      expect(masAlto - masBajo, `${p.id}: el mueble mide ${(masAlto - masBajo).toFixed(2)} m`).toBeLessThan(1.15)
    }
    // Y los que están a su altura real llegan al suelo, que es la mitad que importa: si el
    // tope se comiera también estos, el banco de la banca quedaría flotando.
    for (const id of ['empuje_horizontal', 'apertura_pecho', 'extension_cadera', 'sentadilla_unilateral']) {
      const p = PATRON_POR_ID[id]
      const malla = new Malla(512)
      construirBanco(malla, bancoDe(p)!, esqueletoEnFase(p, 0.5), [0, 0, 0], [0, 0, 0])
      let masBajo = Infinity
      for (let i = 0; i < malla.vertices; i++) masBajo = Math.min(masBajo, malla.posicion[i * 3 + 1])
      expect(masBajo, `${id}: el mueble no llega al suelo`).toBeLessThan(0.08)
    }
  })
})

describe('el mueble y la oclusión', () => {
  it('el banco va con lo OPACO: un mueble translúcido dice que no hay mueble', () => {
    // Esto estaba al revés, con esta frase: «un banco bajo un sujeto tumbado, visto de lado,
    // le tapa medio tronco». La medida la desmintió el 2026-09-06 —ningún mueble del
    // catálogo pasa del 2 %, porque lo que sostiene queda DEBAJO del cuerpo y no entre el
    // cuerpo y la cámara— y el efecto de tenerlo en el grupo del aparato se vio en una
    // captura de Bryan: la decisión de translucidez se toma para el grupo entero, así que la
    // máquina del curl femoral —que tapa el 36 %— arrastraba a la camilla, y el sujeto
    // volvía a parecer que flotaba. El porqué, con los números, en `oclusionDelAparato.ts`.
    const escena = implementosDeEscena(
      PATRON_POR_ID.empuje_horizontal.categoria,
      primerEjemplo(PATRON_POR_ID.empuje_horizontal),
    )
    const { hierro, aparato } = partirImplementos(escena)
    expect(hierro.piezas.map((p) => p.pieza)).toContain('banco')
    expect(aparato.piezas.map((p) => p.pieza)).not.toContain('banco')
  })
})

describe('el sujeto y el suelo', () => {
  /** El punto más bajo del cuerpo a lo largo del ciclo, en metros. */
  /**
   * El punto mas bajo del cuerpo, con la sonda buena.
   *
   * Los pies se miden DOS VECES —el hueso y la planta, 7,5 cm por su +Z local— y se toma el
   * menor: con el pie horizontal manda la planta y con el pie de puntillas manda la punta
   * del hueso. Medir solo el hueso, como hacia esta funcion hasta el 2026-09-06, deja al
   * que esta sentado en el suelo con el tobillo a 7,5 cm y parece que flota.
   */
  function loMasBajo(p: Patron): number {
    let mn = Infinity
    for (let i = 0; i <= 20; i++) {
      const esq = esqueletoEnFase(p, i / 20)
      for (const hueso of Object.keys(esq.mundo)) {
        const esPie = hueso.startsWith('pie')
        for (const t of [0, 1]) {
          mn = Math.min(mn, puntoDeHueso(esq, hueso, t)[1])
          if (esPie) mn = Math.min(mn, puntoDeHueso(esq, hueso, t, [0, 0, PLANTA_NEUTRA])[1])
        }
      }
    }
    return mn
  }

  it('nadie se hunde en el suelo más que el grosor de una suela', () => {
    // La plancha estaba TRES CENTÍMETROS por debajo. Poco, pero es un cuerpo atravesando el
    // suelo, y una vez que hay mueble debajo se ve. Corregido.
    //
    // El tope no es cero y conviene decir por qué: la sentadilla baja 8,5 mm, y eso NO es de
    // esta tanda. `apoyarPies` planta la PLANTA en el suelo, y el punto que se mide aquí es
    // el extremo del hueso del pie, que queda un poco por debajo de ella al bascular. Es del
    // orden de una suela, no se ve, y arreglarlo es tocar el apoyo plantar de los 36
    // patrones. Queda medido para que no crezca.
    //
    // Y hay una excepción de verdad, medida y NO arreglada: la búlgara mete 7,5 cm. Es el
    // pie de atrás, que va sobre un banco y cuyo extremo del hueso queda por debajo del
    // apoyo; `apoyarPies` solo planta el de delante. Se ve poco porque el pie trasero está
    // detrás del cuerpo, pero es de verdad y arreglarlo es tocar esa ficha. Queda escrito
    // con su número para que no crezca.
    const HUNDIMIENTO: Record<string, number> = { sentadilla_unilateral: 0.08 }
    for (const p of PATRONES) {
      expect(loMasBajo(p), `${p.id} se hunde en el suelo`).toBeGreaterThan(
        -(HUNDIMIENTO[p.id] ?? 0.01),
      )
    }
  })

  it('quien no se apoya en un mueble toca el suelo, y quien sí, no', () => {
    // EL DEFECTO QUE EL MUEBLE DESTAPÓ, y que hasta el 2026-09-06 escondía el encuadre: los
    // patrones sin apoyo plantar viven donde diga su `raizInicio`, y en el catálogo eso era
    // un desplazamiento sobre la altura de pie, no una cota. Resultado: **siete patrones
    // flotaban entre 0,80 y 1,10 m**, y tres de ellos estaban un metro por encima de su
    // PROPIA máquina, que sí se dibuja a ras de suelo.
    //
    // La corrección no fue de ojo: a cada uno se le restó exactamente lo que flotaba, para
    // que su punto más bajo —el pie del que está sentado, la rodilla del que se arrodilla—
    // quede en el suelo.
    //
    // Y aquí van los DOS grupos, porque la mitad interesante es la segunda: quien se tumba
    // en un banco o cuelga de una barra NO toca el suelo, y bajarlo sería el error contrario.
    // La primera versión de esta tanda iba a bajarlos a todos.
    const enElSuelo = [
      'antiextension',
      // El gato-camello vuelve a esta lista el 2026-09-07: estuvo en la de deuda un día,
      // flotando 4,7 cm, hasta que se reescribió su pose a cuatro patas de verdad.
      'movilidad_toracica',
      'rotacion_cadera',
      'flexion_tronco',
      'extension_rodilla',
      'traccion_vertical',
      'flexion_muneca',
      'extension_muneca',
      'empuje_inclinado',
    ]
    // DOS CENTIMETROS, no siete. El margen de antes tapaba media suela porque la sonda de
    // este archivo medía solo el HUESO del pie, y la planta va 7,5 cm por debajo: alguien
    // sentado en el suelo daba 7,2 y parecía que flotaba. Con la sonda buena —el menor
    // entre el hueso y la planta— los ocho de arriba caen en el suelo con holgura.
    for (const id of enElSuelo) {
      expect(loMasBajo(PATRON_POR_ID[id]), `${id} no llega al suelo`).toBeLessThan(0.02)
    }
    // Y UNO QUE ESTABA EN ESA LISTA Y NO DEBÍA ESTAR: `flexion_rodilla` es un curl femoral
    // TUMBADO EN SU MÁQUINA, y sus 6,3 cm son la camilla, no un fallo. Estaba en el grupo
    // equivocado desde que se escribió la lista; salió al afinar la sonda el 2026-09-06.
    //
    // Aquí estuvo también el gato-camello, un día, como deuda medida (4,7 cm flotando, con
    // el hombro 15 cm por debajo de la cadera). Se pagó el 2026-09-07 reescribiendo la pose,
    // y el trinquete de abajo fue el que pidió sacarlo de aquí. Para eso está.
    const noTocanElSuelo: Record<string, number> = { flexion_rodilla: 0.08 }
    for (const [id, techo] of Object.entries(noTocanElSuelo)) {
      const y = loMasBajo(PATRON_POR_ID[id])
      expect(y, `${id} cambió de altura: ${(y * 100).toFixed(1)} cm`).toBeLessThan(techo)
      expect(y, `${id} ya toca el suelo: quítalo de la lista de deuda`).toBeGreaterThan(0.02)
    }
    // Y los que descansan sobre algo se quedan a su altura: el banco de la banca, el
    // acolchado del banco romano, y la barra de la que uno cuelga.
    // Diez centímetros, no quince: con la sonda buena el que cuelga de la barra pasa de 15,3
    // a 12,8 —los 7,5 cm de planta que antes no se contaban, con el pie en punta—. Sigue sin
    // tocar el suelo por un palmo, que es lo que esta línea afirma.
    const sobreUnMueble = ['empuje_horizontal', 'extension_lumbar', 'suspension', 'apertura_pecho']
    for (const id of sobreUnMueble) {
      expect(loMasBajo(PATRON_POR_ID[id]), `${id} se cayó al suelo`).toBeGreaterThan(0.1)
    }
  })
})
