import { LIENZO, trazarSalon } from './trazadoDelSalon'

/**
 * EL SALÓN, A PANTALLA COMPLETA: sus paredes y su luz, alrededor del sujeto.
 *
 * Es el punto 1 de los cinco del encargo —«el salón con sus paredes»— y la respuesta al
 * veredicto de Bryan sobre el iPhone: «sigue siendo un dashboard con un muñeco 3D dentro».
 * Un muñeco recortado en una franja no es un salón; un salón es una habitación que se ve
 * entera y dentro de la cual hay alguien.
 *
 * Se monta ENCIMA del lienzo del sujeto y por debajo de los rótulos. Todo lo que dibuja es
 * trazo fino y degradado: nada opaco, nada que tape. El lienzo sigue viéndose de borde a
 * borde por debajo — la habitación lo enmarca.
 *
 * ## El acabado, y qué parte de él es alcanzable
 *
 * El documento maestro pide entorno negro mate con acentos rojo profundo, iluminación de
 * tres puntos con contraluz que separe la silueta del fondo, claroscuro que esculpa el
 * volumen, profundidad de campo, grano y formato 9:16. Todo eso es composición y pintura,
 * y todo eso se hace aquí con capas de mezcla:
 *
 * - **negro mate** — el lienzo del visor limpia con el gris del estudio (`FONDO_ESTUDIO`),
 *   que no es negro. La capa de claroscuro va en `multiply` con un radial casi blanco en
 *   el centro y casi negro en los bordes: el centro se queda como está y el resto de la
 *   habitación cae a negro. Es el mismo resultado que rebajar el `clearColor` del motor,
 *   pero sin tocar el motor y sin apagar al sujeto.
 * - **contraluz** — una elipse de rojo profundo en `screen`, detrás de donde está la
 *   silueta. Es lo que la despega del fondo: sin ella, cuerpo oscuro sobre sala oscura.
 * - **clave y relleno** — las otras dos luces de las tres, en `soft-light`: la clave cae
 *   de arriba a la izquierda y el relleno, mucho más flojo, de abajo a la derecha. En
 *   `soft-light` y no en `screen` a propósito: aclaran sin lavar el negro.
 * - **profundidad de campo** — dos velos de bruma en los extremos alto y bajo del cuadro.
 *   Es DOF SIMULADA y se dice así: desenfocar de verdad lo que hay detrás del sujeto
 *   pediría separar sujeto y fondo en dos pasadas dentro del motor, y el motor no se
 *   toca. Un `backdrop-filter` sobre el lienzo tampoco vale: remuestrearía la región en
 *   cada fotograma de la animación, que es justo lo que la regla del repo prohíbe.
 * - **grano** — ruido de `feTurbulence` en `overlay`, muy flojo. Es una textura estática:
 *   un grano animado obligaría a repintar la pantalla entera sesenta veces por segundo.
 *
 * Lo que **no** se promete, porque en un iPhone dentro de Safari no existe: trazado de
 * rayos, DLSS y núcleos tensoriales. Lo alcanzable es la parte cinematográfica, y es la
 * que está aquí.
 *
 * ## Nada de esto lleva puntero ni texto
 *
 * Toda la capa es `pointer-events-none`: el gesto de orbitar y el del eje W nacen sobre el
 * sujeto, y una habitación que capturase el dedo se comería los dos. Y no tiene un solo
 * nodo de texto, que es lo que le permite vivir dentro del hueco `centro` sin romper la
 * regla dura de la vista inicial.
 */

/** La habitación se traza al cargar el módulo: es una constante, no un cálculo. */
const SALON = trazarSalon()

/**
 * El grano, como textura y no como animación.
 *
 * `feTurbulence` con una frecuencia alta da ruido fino de grano de película. Va embebido
 * como `data:` porque es un recurso de nueve líneas: pedirlo por red sería una petición
 * más en el arranque de la pantalla que más importa.
 */
const GRANO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)' opacity='0.55'/%3E%3C/svg%3E\")"

export interface ArquitecturaSalaProps {
  /**
   * Qué hay debajo, que decide qué capas hacen falta.
   *
   * - `conSujeto` — debajo está el lienzo del visor, que limpia con el gris del estudio.
   *   Se pinta todo: el claroscuro que lo hunde a negro mate y la habitación en trazo.
   * - `salaVacia` — debajo está la sala dibujada de los días sin sujeto, que ya es casi
   *   negra y ya trae su propio muro. Ahí sobran las dos capas que dependen de que haya
   *   algo claro que oscurecer: el claroscuro multiplicando sobre negro no hace nada, y
   *   una segunda habitación encima de la primera son dos salas discutiendo. Se quedan
   *   las que sí trabajan: el contraluz, las luces y el grano.
   *
   * Es la misma pieza en los dos casos a propósito: el acabado del salón no puede
   * depender de si hoy toca cardio. Lo que cambia es qué capas sobran, no el criterio.
   */
  variante?: 'conSujeto' | 'salaVacia'
}

export function ArquitecturaSala({ variante = 'conSujeto' }: ArquitecturaSalaProps) {
  const conHabitacion = variante === 'conSujeto'
  return (
    <div
      // La marca del testigo va con la habitación: en la variante sin sujeto la sala es
      // `SalaVacia`, y es su contenedor el que la lleva. Dos elementos con la misma marca
      // harían que contar salas diera dos donde hay una.
      data-testigo={conHabitacion ? 'sala' : undefined}
      data-sala="salon"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* EL CLAROSCURO. Va el primero porque es el que pone el negro mate: multiplica
          sobre el lienzo, deja el centro intacto y hunde los bordes. Lo que queda es una
          habitación oscura con una zona de luz donde está el cuerpo, que es exactamente
          lo que hace el claroscuro: esculpir con lo que se apaga. */}
      {conHabitacion && (
        <div
          className="absolute inset-0"
          style={{
            // SIN `mix-blend-mode`, y esto no es una preferencia: es el fallo que Bryan
            // vio en su iPhone el 2026-09-02.
            //
            // Esta capa era un radial BLANCO en `multiply`: en Chrome multiplica sobre el
            // lienzo, deja el centro intacto y hunde los bordes a negro. En Safari de iOS,
            // blendear sobre un `<canvas>` que cuelga de un contenedor `position: fixed`
            // no compone — y entonces el radial blanco se pinta OPACO encima de todo. La
            // pantalla entera era una mancha blanca con el sujeto, el hierro y los cuadros
            // detrás. No es que se viera mal: no se veía nada.
            //
            // El mismo efecto sin depender de blendear: una viñeta OSCURA en composición
            // normal. El centro se deja transparente —el lienzo se ve tal cual— y los
            // bordes caen a negro con alfa. Es lo que hace el claroscuro, dicho al derecho
            // en vez de al revés, y no hay modo de composición que pueda fallar.
            background:
              'radial-gradient(64% 46% at 50% 41%, rgba(5,7,10,0) 0%, rgba(5,7,10,0.12) 30%, rgba(5,7,10,0.45) 56%, rgba(5,7,10,0.8) 78%, rgba(5,7,10,0.96) 100%)',
          }}
        />
      )}

      {/* EL CONTRALUZ, en rojo profundo. Detrás de la silueta y solo ahí: una elipse
          ancha y baja a la altura del torso. En `screen` levanta el fondo justo alrededor
          del cuerpo, así que el borde del sujeto queda recortado contra una luz y deja de
          fundirse con la pared. Es el acento rojo del documento maestro, y está en el
          único sitio donde un acento hace trabajo. */}
      <div
        className="absolute inset-0"
        style={{
          // Por el mismo motivo que el claroscuro: sin `screen`. Un rojo en `screen`
          // ACLARA lo que hay debajo; el mismo rojo con alfa lo TIÑE. Sobre un fondo casi
          // negro las dos cosas se parecen mucho, y una de las dos no depende de que el
          // navegador sepa componer capas encima de un lienzo.
          background:
            'radial-gradient(46% 30% at 50% 38%, rgb(var(--rojo-rgb) / 0.3) 0%, rgb(var(--rojo-rgb) / 0.11) 45%, transparent 74%)',
        }}
      />

      {/* LA CLAVE Y EL RELLENO, las otras dos luces. La clave entra alta por la
          izquierda; el relleno, la mitad de fuerte, por abajo a la derecha, para que el
          lado en sombra no se cierre del todo. Las dos en un solo elemento: son dos
          degradados de la misma capa y no hay motivo para pagar dos composiciones. */}
      <div
        className="absolute inset-0"
        style={{
          // Sin `soft-light`. En composición normal un blanco al 85 % lavaría la sala,
          // así que baja a alfas de una cifra: la clave y el relleno siguen estando y ya
          // no pueden convertirse en dos manchas si el modo de composición no se aplica.
          background:
            'radial-gradient(40% 34% at 22% 16%, rgba(255,255,255,0.07) 0%, transparent 70%), radial-gradient(46% 40% at 82% 88%, rgba(190,205,225,0.05) 0%, transparent 72%)',
        }}
      />

      {/* LA LÁMPARA DEL MURO, que va y viene muy despacio. Es la clase del sistema, la
          misma que respira en la sala de los días sin sujeto: con movimiento reducido se
          queda quieta y mientras el encoder graba se pausa sola. */}
      <div className="sala-luz" />

      {/* LA HABITACIÓN. `slice` en vez de `meet`: el trazado está hecho en 9:16 y en una
          pantalla más ancha se recorta por los lados en vez de destaparse por arriba —lo
          que se pierde son centímetros de muro lateral, que es de lo que sobra. */}
      {conHabitacion && (
        <svg
          viewBox={`0 0 ${LIENZO.ancho} ${LIENZO.alto}`}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          role="presentation"
        >
          <defs>
            {/* La profundidad de cada plano. Un muro de un tono plano se lee como fondo;
                con el degradado cayendo hacia la arista se lee como pared que se aleja. */}
            <linearGradient id="salon-muro-izq" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#05070a" stopOpacity="0.72" />
              <stop offset="1" stopColor="#05070a" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="salon-muro-der" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stopColor="#05070a" stopOpacity="0.72" />
              <stop offset="1" stopColor="#05070a" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="salon-suelo" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#05070a" stopOpacity="0.78" />
              <stop offset="1" stopColor="#05070a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="salon-techo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#05070a" stopOpacity="0.85" />
              <stop offset="1" stopColor="#05070a" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="salon-apoyo" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#000000" stopOpacity="0.62" />
              <stop offset="1" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Los cuatro planos, en degradado y nunca opacos: el sujeto del lienzo se sigue
              viendo por debajo de todos ellos. */}
          <path d={SALON.techo} fill="url(#salon-techo)" />
          <path d={SALON.muroIzquierdo} fill="url(#salon-muro-izq)" />
          <path d={SALON.muroDerecho} fill="url(#salon-muro-der)" />
          <path d={SALON.suelo} fill="url(#salon-suelo)" />

          {/* LA SOMBRA DE APOYO. Sin ella la silueta flota sobre la retícula; con ella
              pisa. Es la pieza más barata de todo el archivo y la que más sujeta la
              escena. */}
          <ellipse
            cx={SALON.apoyo.cx}
            cy={SALON.apoyo.cy}
            rx={SALON.apoyo.rx}
            ry={SALON.apoyo.ry}
            fill="url(#salon-apoyo)"
          />

          {/* La retícula del suelo: la profundidad medible. Los cuadros se aprietan según
              se alejan, y eso es lo que dice «esto tiene fondo». */}
          <path d={SALON.reticula} fill="none" strokeWidth="0.5" className="stroke-silver-500/20" />

          {/* Los tres horizontes del muro: remate, riel y rodapié. El riel es del que
              cuelgan los rótulos, y por eso es el más marcado de los tres. */}
          <path d={SALON.remate} fill="none" strokeWidth="0.7" className="stroke-silver-500/15" />
          <path d={SALON.riel} fill="none" strokeWidth="1" className="stroke-silver-500/25" />
          <path d={SALON.rodapie} fill="none" strokeWidth="1.1" className="stroke-silver-500/20" />

          {/* Las cuatro aristas de la caja. Son las últimas y las más claras: son las que
              hacen que los cuatro planos se lean como una habitación. */}
          <path d={SALON.aristas} fill="none" strokeWidth="0.9" className="stroke-silver-500/30" />
        </svg>
      )}

      {/* LA PROFUNDIDAD DE CAMPO, simulada. Bruma que se cierra en el borde alto y en el
          bajo del cuadro y deja limpio el tercio central, que es donde está el sujeto.
          No desenfoca: oscurece y difumina el contraste, que es lo que el ojo lee como
          «esto está fuera del plano de foco». Dicho como lo que es. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgb(var(--ink-1000-rgb) / 0.72) 0%, transparent 22%, transparent 68%, rgb(var(--ink-1000-rgb) / 0.62) 100%)',
        }}
      />

      {/* EL GRANO. Última capa y la más floja: en `overlay` se mete en los medios tonos y
          deja los negros negros, que es como se comporta el grano de película. */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        // Sin `overlay`, y con la opacidad bajada para compensar: en composición normal
        // el ruido se suma en vez de meterse en los medios tonos, así que al 7 % se vería
        // como una gasa gris. Al 3,5 % hace de grano y no de velo.
        style={{ backgroundImage: GRANO, backgroundSize: '140px 140px' }}
      />
    </div>
  )
}
