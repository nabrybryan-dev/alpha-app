import type { EjercicioPrescrito, ItemMarcable, Microciclo, Sesion } from '../../../../domain/types'
import type { RitmoSesion } from '../../../../domain/ritmoSesion'
import { avisosDelSalon, lineaDeRitmo, loQueViene } from './avisosDelSalon'
import { MuroDeCampos } from './PanelPared'
import { MURO_IZQUIERDO } from './muros'
import type { ContenidoDePared } from './contenidoPared'
import {
  AContinuacion,
  Marquesina,
  RotuloCronometro,
  RotuloDeRitmo,
  RotuloDelDia,
  TablaDeSeries,
} from './RotulosDelSalon'
import { CamaraDelSalon } from '../camara/CamaraDelSalon'
import { ImplementosDelSalon } from '../implementos/ImplementosDelSalon'
import { implementosDeSesion } from '../implementos/implementosDeSesion'

/**
 * LAS PAREDES DEL SALÓN: todo lo que cuelga del muro, colocado.
 *
 * Es el hueco `paredes` de `huecos.ts` montado entero, y la respuesta al reparto que Bryan
 * marcó en amarillo: microciclo y nombre del día, cronómetro de sesión, duración estimada
 * con bloque y ejercicio n de N, la marquesina de avisos, la tabla de series ya
 * registradas, «medir con la cámara» y «a continuación» con lo que falta. La serie en curso
 * y «guardar serie» no están aquí: viven en la barra del suelo, que es donde se alcanzan
 * con el pulgar sin soltar la barra.
 *
 * ## LA REGLA DE LA COLOCACIÓN: el centro no se toca
 *
 * Todo cuelga de un borde y nada cruza el centro del cuadro. Las dos columnas laterales no
 * pasan del 33 % del ancho cada una, así que queda un tercio central libre de arriba abajo,
 * que es donde está el cuerpo. Y entre el final de las columnas y el mobiliario del suelo
 * hay una franja entera sin nada: es la que deja ver el gesto completo, de la cabeza a los
 * pies.
 *
 * Es exactamente lo contrario de lo que Bryan fotografió: «el sujeto ocupaba una franja
 * estrecha arriba, cortado por el borde, con ocho paneles encajonándolo por los dos lados».
 * Los ocho paneles siguen estando —los cuatro de ejecutar en el muro izquierdo y los cuatro
 * de medir dentro del módulo de la cámara— pero ya no encajonan: bordean.
 *
 * ## Y por qué esta capa no recibe el puntero
 *
 * `pointer-events-none` en el contenedor y `pointer-events-auto` solo en las dos piezas que
 * de verdad se tocan: el cronómetro, que se pausa, y el módulo de la cámara, que abre la
 * hoja de medición. Todo lo demás se lee mientras el dedo orbita sobre el sujeto, y un
 * rótulo que capturase el arrastre se lo comería justo en el borde, que es donde el pulgar
 * empieza el gesto.
 */

/**
 * LAS ALTURAS DEL SUELO, CONTADAS DESDE ENCIMA DE LA BARRA DE NAVEGACIÓN.
 *
 * Todas llevan `var(--tope-nav)` dentro, y no es una precaución: es una corrección de algo
 * que estaba mal y no se veía. El marco que envolvía esta capa llevaba un `padding-bottom`
 * del alto de la barra con la idea de que `bottom: 0` significara «justo encima de la nav»,
 * y **no lo significa**: el bloque contenedor de un hijo absoluto es la caja de RELLENO,
 * que incluye el relleno, así que ese `padding` no descontaba nada. Medido en el navegador
 * a 430 px: el material de la sesión aterrizaba encima de la barra, tapado por ella.
 *
 * Así que la barra se suma explícitamente, una vez por pieza, y el marco con relleno se
 * retira para que nadie vuelva a confiar en él.
 */
const SUELO = {
  /**
   * El material, los días sin ejercicio: pegado al borde, con la sala estirada encima.
   *
   * Cae justo debajo del suelo de la sala. `SUELO_DEL_SALON.sinRegistro` deja la
   * habitación a `--tope-nav + 3.5rem` del borde y la fila de material mide 1.5rem, así
   * que 1.75rem la deja rozando el bordillo sin montarse encima. Medido en el navegador a
   * 430 px: con un cuarto de rem más, la fila se comía la esquina del suelo.
   */
  borde: 'calc(var(--tope-nav) + 1.75rem)',
  /** La tira de «a continuación», justo encima de la barra del registro. */
  cola: 'calc(var(--tope-nav) + 6.5rem)',
  /** La cámara y el material, apoyados sobre el rodapié. */
  mobiliario: 'calc(var(--tope-nav) + 8.5rem)',
} as const

export interface ParedesDelSalonProps {
  microciclo: Microciclo
  sesion: Sesion | undefined
  /** El ejercicio del que habla el salón. Sin él no hay tabla, ni cámara, ni campos. */
  ejercicio: EjercicioPrescrito | undefined
  /** Los ocho campos cortos, cuando hay ejercicio del que sacarlos. */
  contenido: ContenidoDePared | undefined
  /** El ritmo ya calculado por el dominio, con el tiempo del cronómetro dentro. */
  ritmo: RitmoSesion | undefined
  /** Las notas de la semana del coach: pasan por la marquesina con su título literal. */
  notas: readonly ItemMarcable[]
}

export function ParedesDelSalon({
  microciclo,
  sesion,
  ejercicio,
  contenido,
  ritmo,
  notas,
}: ParedesDelSalonProps) {
  const material = implementosDeSesion(sesion)
  const vienen = loQueViene(sesion, ejercicio)
  // A QUÉ ALTURA SE APOYA EL MOBILIARIO DEL SUELO.
  //
  // Con ejercicio, abajo hay tres cosas apiladas —la barra del registro, la tira de «a
  // continuación» y el módulo de la cámara—, así que el material sube por encima de todas.
  // Sin ejercicio no hay ni barra ni cámara: el material baja al borde y la habitación se
  // queda con esos ciento cincuenta píxeles, que es lo que había que ganar. Medido en el
  // navegador a 430 px: con la altura de siempre quedaba una franja negra entre el suelo de
  // la sala y el material.
  const alturaDelSuelo = ejercicio ? SUELO.mobiliario : SUELO.borde

  return (
    <div
      data-hueco="paredes"
      data-testigo="letras3D"
      className="pointer-events-none absolute inset-0"
    >
      {/* ------------------------------------------------------- la banda de arriba */}
      {/* El muro del fondo, a la altura de la mirada: quién eres hoy, cuánto llevas y por
          dónde vas. Los tres datos que se buscan al levantar la vista de la barra. */}
      <div className="absolute inset-x-0 top-0 flex flex-col gap-1 px-2 pt-2">
        <div className="flex items-start justify-between gap-2">
          <RotuloDelDia microciclo={microciclo} sesion={sesion} className="max-w-[54%]" />
          {sesion && (
            <RotuloCronometro sesionId={sesion.id} className="pointer-events-auto max-w-[42%]" />
          )}
        </div>

        {ritmo && <RotuloDeRitmo linea={lineaDeRitmo(ritmo)} className="max-w-[78%]" />}

        {/* LA MARQUESINA, cruzando el muro de lado a lado. Es lo único de las paredes que
            ocupa el ancho entero, y por eso funciona: una banda no encajona, separa. */}
        {ritmo && <Marquesina avisos={avisosDelSalon(ritmo, ejercicio, notas)} className="mt-0.5" />}
      </div>

      {/* ------------------------------------------------------------ muro izquierdo */}
      {/* Los cuatro campos de EJECUTAR: qué ejercicio, cómo se hace, cuántas series y
          hasta dónde. Un tercio del ancho, pegados al borde y escorzados hacia dentro. */}
      {contenido && (
        <MuroDeCampos
          contenido={contenido}
          campos={MURO_IZQUIERDO}
          lado="izquierda"
          className="absolute left-2 top-[9.5rem] w-[33%]"
        />
      )}

      {/* -------------------------------------------------------------- muro derecho */}
      {/* La memoria de la sesión: lo que ya se levantó y lo que falta por levantar. */}
      {ejercicio && (
        <TablaDeSeries ejercicio={ejercicio} className="absolute right-2 top-[9.5rem] w-[33%]" />
      )}

      {/* --------------------------------------------------------- el suelo del salón */}
      {/* La cámara a un lado y el material al otro, los dos apoyados sobre el rodapié que
          traza la arquitectura de la sala. Es mobiliario, así que va abajo y no a la
          altura de la mirada: en un gimnasio el trípode y los discos están en el suelo. */}
      {contenido && ejercicio && (
        <CamaraDelSalon
          contenido={contenido}
          ejercicio={ejercicio}
          microcicloId={microciclo.id}
          className="absolute left-2 w-[46%]"
          style={{ bottom: SUELO.mobiliario }}
        />
      )}

      {/* EL ESTANTE DEL MATERIAL, arrimado al muro derecho y creciendo hacia arriba desde
          el rodapié. Dos medidas y las dos son de colocación, que es lo que decide esta
          capa:

          - `right-10` y no `right-2`, que es donde estaba. El carril del borde derecho ya
            tiene dueño: la escalera del eje W, cinco botones de 28 px centrados al 46 % de
            la altura (`SalonEntrenar`), que ocupan de 382 a 410 px en una pantalla de 414.
            Mientras el material era una tira de 24 px al pie no se rozaban; apilado en
            columna sí, y una sesión con cuatro implementos habría subido justo por debajo
            de los peldaños. Dejarle el carril libre a la escalera cuesta 40 px de margen y
            evita que dos piezas se peleen por el mismo sitio el día que el material crece.
          - `max-w-[52%]`, que es el tope de la regla de colocación —ninguna columna lateral
            pasa del tercio y pico— y a la vez el ancho con el que envuelven los nombres
            largos del dominio («máquina guiada vertical (Smith)»). El ancho real lo pone el
            `w-fit` del propio estante: esto es un techo, no una medida. */}
      <ImplementosDelSalon
        material={material}
        className="absolute right-10 max-w-[52%]"
        style={{ bottom: alturaDelSuelo }}
      />

      {/* ------------------------------------------------------------ a continuación */}
      <AContinuacion
        ejercicios={vienen}
        className="absolute inset-x-2"
        style={{ bottom: SUELO.cola }}
      />
    </div>
  )
}
