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
import { BarraRegistro } from '../registro/BarraRegistro'
import { CuadroDePared } from './CuadroDePared'
import type { CamaraDelSalon as EstadoDeCamara } from './geometriaDeCuadro'
import { SITIOS, sitioEn } from './sitiosDeLaPared'

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
  /**
   * Dónde mira la cámara del salón AHORA MISMO, tal y como la deja la órbita.
   *
   * Es lo que convierte estos paneles en cuadros colgados de un muro en vez de tarjetas
   * pegadas al cristal. Si esta cámara y la que dibuja la escena no fueran la misma, los
   * cuadros flotarían: medio grado de desfase ya se nota, porque el ojo compara el cuadro
   * con el suelo que tiene detrás.
   */
  camara: EstadoDeCamara
  /** El lienzo en píxeles CSS. De él salen la distancia focal y el centro del cuadro. */
  lienzo: { ancho: number; alto: number }
  /** El ángulo desde el que se entra al salón, que es el que pone el patrón. */
  azimutDeEntrada: number
}

export function ParedesDelSalon({
  microciclo,
  sesion,
  ejercicio,
  contenido,
  ritmo,
  notas,
  camara,
  lienzo,
  azimutDeEntrada,
}: ParedesDelSalonProps) {
  const vienen = loQueViene(sesion, ejercicio)
  const donde = (sitio: (typeof SITIOS)[keyof typeof SITIOS]) => sitioEn(sitio, azimutDeEntrada)

  return (
    <div
      data-hueco="paredes"
      data-testigo="letras3D"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* LA CABECERA DE LA SESIÓN, alta y de frente: quién eres hoy y cuánto llevas.
          Van juntas y arriba porque es lo que se mira al levantar la vista de la barra. */}
      <CuadroDePared clave="dia" sitio={donde(SITIOS.dia)} camara={camara} lienzo={lienzo}>
        <RotuloDelDia microciclo={microciclo} sesion={sesion} enCuadro />
      </CuadroDePared>

      {sesion && (
        <CuadroDePared clave="cronometro" sitio={donde(SITIOS.cronometro)} camara={camara} lienzo={lienzo} interactivo>
          <RotuloCronometro sesionId={sesion.id} enCuadro />
        </CuadroDePared>
      )}

      {ritmo && (
        <CuadroDePared clave="ritmo" sitio={donde(SITIOS.ritmo)} camara={camara} lienzo={lienzo}>
          <RotuloDeRitmo linea={lineaDeRitmo(ritmo)} enCuadro />
          <Marquesina avisos={avisosDelSalon(ritmo, ejercicio, notas)} className="mt-[0.4em]" />
        </CuadroDePared>
      )}

      {/* EL CUADRO GRANDE: qué ejercicio, cómo se hace, cuántas series y hasta dónde.
          A la izquierda del muro de enfrente, que es donde cae la vista al entrar. */}
      {contenido && (
        <CuadroDePared clave="ejercicio" sitio={donde(SITIOS.ejercicio)} camara={camara} lienzo={lienzo}>
          <MuroDeCampos contenido={contenido} campos={MURO_IZQUIERDO} lado="izquierda" enCuadro />
        </CuadroDePared>
      )}

      {/* LO QUE YA SE LEVANTÓ, enfrente y a la derecha, como el marcador de un pabellón. */}
      {ejercicio && (
        <CuadroDePared clave="series" sitio={donde(SITIOS.series)} camara={camara} lienzo={lienzo}>
          <TablaDeSeries ejercicio={ejercicio} enCuadro />
        </CuadroDePared>
      )}

      {/* LA ESTACIÓN DE GRABACIÓN, colgada junto al trípode: se lee donde se usa. */}
      {contenido && ejercicio && (
        <CuadroDePared clave="camara" sitio={donde(SITIOS.camara)} camara={camara} lienzo={lienzo} interactivo>
          <CamaraDelSalon ejercicio={ejercicio} microcicloId={microciclo.id} enCuadro />
        </CuadroDePared>
      )}

      {/* REGISTRAR LA SERIE, colgado del muro de enfrente y a la altura de la mano.
          Bryan lo pidió el 2026-09-02 con el resto: «este también va explicado
          gráficamente en el esqueleto». Deja de ser una barra pegada al borde de abajo y
          pasa a ser lo que es —un mando del salón—, delante del sujeto y a 1,5 m, que es
          la altura a la que se apoya la mano en un gimnasio. Va con el puntero abierto: es
          lo único de las paredes con lo que se OPERA, no que se lee. */}
      {ejercicio && (
        <CuadroDePared clave="registro" sitio={donde(SITIOS.registro)} camara={camara} lienzo={lienzo} interactivo>
          <BarraRegistro microcicloId={microciclo.id} ejercicio={ejercicio} enCuadro />
        </CuadroDePared>
      )}

      {/* LO QUE VIENE DESPUÉS, en el muro de detrás: se consulta al terminar, no durante. */}
      <CuadroDePared clave="siguientes" sitio={donde(SITIOS.siguientes)} camara={camara} lienzo={lienzo}>
        <AContinuacion ejercicios={vienen} enCuadro />
      </CuadroDePared>
    </div>
  )
}
