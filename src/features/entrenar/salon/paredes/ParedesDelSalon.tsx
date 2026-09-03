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
import { asentarEnLaBanda, type CamaraDelSalon as EstadoDeCamara } from './geometriaDeCuadro'
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
 * Los paneles siguen estando —los cinco de ejecutar en el muro izquierdo y los cuatro
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
  /** Los nueve campos cortos, cuando hay ejercicio del que sacarlos. */
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
  /**
   * DÓNDE CUELGA CADA CUADRO, ya asentado en la banda que la cámara alcanza.
   *
   * `sitioEn` resuelve el azimut contra el ángulo de entrada y `asentarEnLaBanda` baja el
   * cuadro por su muro lo justo para que no se salga por arriba. Lo segundo hace falta
   * porque las alturas de `sitiosDeLaPared.ts` se midieron con la cámara a 6°, y la
   * elevación la pone cada patrón: va de 2° a 56° en el catálogo, porque un ejercicio
   * tumbado se estudia desde arriba. Sin asentar, un press inclinado abría el salón con
   * los tres cuadros entre 629 y 861 px POR ENCIMA de la pantalla — medido el 2026-09-03.
   */
  const donde = (sitio: (typeof SITIOS)[keyof typeof SITIOS]) =>
    asentarEnLaBanda(sitioEn(sitio, azimutDeEntrada), camara, lienzo.ancho, lienzo.alto).sitio

  return (
    <div
      data-hueco="paredes"
      data-testigo="letras3D"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      // `isolation: isolate` — Y NO SOBRA.
      //
      // Cada cuadro lleva un `z-index` que sale de su PROFUNDIDAD en la sala, para que
      // lo lejano quede detrás: `1000 - z * 20`, o sea valores de hasta ~800. Eso ordena
      // bien los cuadros entre ellos y es un desastre fuera, porque la escala de la app
      // llega a `--z-elevado: 20`. Medido el 2026-09-03 abriendo el panel: el tablón del
      // muro se pintaba ENCIMA de la hoja, con su texto cruzado sobre el del panel.
      //
      // Aislando aquí, esos números vuelven a significar lo que significan —el orden de
      // los cuadros entre sí— y no compiten con nada de fuera. La capa entera se coloca
      // con `--z-contenido`, que es el escalón que le toca.
      style={{ isolation: 'isolate', zIndex: 'var(--z-contenido)' }}
    >
      {/* EL TABLÓN DEL MURO DE ENFRENTE — una sola composición, no cuatro fragmentos.
          =================================================================================

          Aquí colgaban cuatro cuadros distintos: la cabecera del día, el cronómetro, el
          ritmo con su marquesina y la ficha del ejercicio. Cada uno con su caja, y tres de
          ellos a ±34° y 42° del ángulo de entrada — o sea, a varias pantallas de distancia
          de lo que se ve al abrir. Bryan lo describió el 2026-09-03 como «partes extraídas
          de la aplicación y pegadas literal en las paredes», y tenía razón: eran
          componentes de app re-colgados de un muro, sin composición entre ellos.

          Medido el mismo día: la ventana horizontal de un 390×844 son 12,18°, que a los
          11,1 m del muro de enfrente son **2,37 m de pared**. Ahí no caben cuatro cuadros.
          Cabe uno.

          Así que es UNO, con jerarquía dentro y en el orden en que se mira: de quién es
          hoy la sesión y cuánto llevas → qué toca ahora → con qué cifras → qué avisa. Es
          lo que hace el marcador de un pabellón, y es lo que pedía el documento de
          referencia: «in the visual language of a stadium scoreboard». */}
      {contenido && (
        <CuadroDePared clave="ejercicio" sitio={donde(SITIOS.ejercicio)} camara={camara} lienzo={lienzo}>
          {/* La cabecera, en una línea: a la izquierda quién eres hoy, a la derecha
              cuánto llevas. Van juntas porque se leen juntas al levantar la vista. */}
          <div className="flex items-start justify-between gap-[0.8em]">
            <RotuloDelDia microciclo={microciclo} sesion={sesion} enCuadro />
            {sesion && <RotuloCronometro sesionId={sesion.id} enCuadro />}
          </div>
          <hr className="muro-junta my-[0.45em]" aria-hidden="true" />
          <MuroDeCampos contenido={contenido} campos={MURO_IZQUIERDO} lado="izquierda" enCuadro />
          {/* LA RANURA DE ABAJO: una sola línea con lo que cambia con el tiempo.
              El ritmo y los avisos eran dos bloques con su título cada uno —cuatro líneas
              de muro— y dicen lo mismo: cómo vas. Aquí el ritmo es la primera frase y los
              avisos pasan detrás, por la misma ranura. */}
          {ritmo && (
            <div className="mt-[0.45em]">
              <RotuloDeRitmo linea={lineaDeRitmo(ritmo)} enCuadro />
              <Marquesina avisos={avisosDelSalon(ritmo, ejercicio, notas)} className="mt-[0.3em]" />
            </div>
          )}
        </CuadroDePared>
      )}

      {/* LO QUE YA SE LEVANTÓ. Fuera de la ventana de entrada, a un giro corto: es la
          memoria de la sesión y se consulta en el descanso, no durante la repetición. */}
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
