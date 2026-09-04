import { useEffect, useState } from 'react'
import type { EjercicioPrescrito, Sesion } from '../../../../domain/types'
import type { ContenidoDePared } from './contenidoPared'
import { MuroDeCampos } from './PanelPared'
import { TOPE_PARED } from '../huecos'
import { EN_OTRO_SITIO } from './muros'
import { RotuloDelDia } from './RotulosDelSalon'
import { RotuloEnTrazo } from './RotuloEnTrazo'
import { HuecoDeDatos } from './HuecoDeDatos'
import type { AnclasDelReloj, ModoDelReloj } from '../mando/relojDelMuro'

/**
 * EL TABLÓN DEL MURO DE ENFRENTE: lo mismo, pero no a la vez.
 *
 * ## De qué se queja esto
 *
 * El tablón era UNA caja con siete bandas de texto apiladas —día y cronómetro, nombre,
 * técnica en prosa, tres cifras en fila, ritmo, marquesina— ocupando 218 px de 844. Bryan
 * lo dijo el 2026-09-03 mirándolo: «no me gusta cómo están agrupados, la jerarquía visual
 * está muy cargada». Y la causa es de fondo: **todo era texto plano sobre un panel**, así
 * que lo único que ordenaba era el cuerpo de letra. Ordenar por tamaño de letra es el
 * recurso de una página web, y por eso se leía como una página web colgada de un muro.
 *
 * ## La decisión: manda el TIEMPO, no el tamaño
 *
 * De las tres salidas que se le pusieron delante —agrupar por materia, por tiempo o por
 * profundidad— Bryan eligió el tiempo. Así que el muro deja de enseñarlo todo siempre y
 * pasa a enseñar **lo de ahora**, con lo demás plegado:
 *
 * - **ANUNCIO** — al abrir el salón y cada vez que cambia el ejercicio. El muro dice qué
 *   toca: el nombre grande y la primera indicación técnica. Es el momento en que se lee.
 * - **RELEVO** — el anuncio se retira mientras el dato vivo sube. Los dos coexisten 420 ms
 *   y por eso hay un estado para ello: sin él, el anuncio desaparecería de golpe y el
 *   cambio se leería como un parpadeo, no como un relevo.
 * - **VIVO** — el estado de reposo, y el que se ve el 95 % del tiempo: la serie en curso y
 *   su prescripción. Nada más.
 *
 * No es un recorte de información: es la misma. Los cinco campos del muro siguen siendo
 * cinco —lo comprueba `salon.test.tsx`— y la ficha íntegra sigue estando en el panel de
 * abajo, que es lo que garantiza la invariante de `contenidoPared()`. Lo que cambia es
 * CUÁNDO se enseña cada uno, y eso sale de cómo se entrena: durante la serie no se lee,
 * se levanta; entre series sí se lee.
 *
 * ## Por qué el anuncio se retira solo y no con un gesto
 *
 * Porque el gesto ya está cogido. El arrastre horizontal orbita la cámara y el vertical es
 * el eje W —los cinco escalones de la anatomía—, así que un tercer gesto para plegar el
 * anuncio competiría con los dos que ya existen. Y un botón sería un mando más en una
 * pared que ya tiene dos. El tiempo es el único disparador libre, y además es el correcto:
 * el anuncio no es algo que se cierra, es algo que pasa.
 *
 * ## Lo que NO se toca
 *
 * El cronómetro y el día se quedan en los tres estados, arriba y finos. Son el único dato
 * que corre siempre y el encargo los pone en la lista amarilla; plegarlos sería quitar de
 * la pared la única cifra que cambia sola.
 */

/** Cuánto dura el anuncio antes de retirarse, en milisegundos. */
const ANUNCIO_MS = 5500

/**
 * Cuánto dura el relevo. Es el mismo `--dur-lento` de `tokens.css` escrito en número
 * porque un `setTimeout` no lee variables de CSS; si allí cambia, aquí también.
 */
const RELEVO_MS = 420

export type EstadoDelTablon = 'anuncio' | 'relevo' | 'vivo'

export interface TablonDelMuroProps {
  contenido: ContenidoDePared
  sesion?: Sesion
  ejercicio?: EjercicioPrescrito
  /**
   * Con cuánto levantó este ejercicio la última vez. Ausente = no hay con qué comparar, y
   * entonces la línea no se pinta: un 0 kg ahí sería una carga que nadie levantó.
   */
  cargaPrevia?: number
  /** Qué cuenta el reloj de la pared. Lo pone el mando; el muro solo lo enseña. */
  modo: ModoDelReloj
  anclas: AnclasDelReloj
  alTerminarLaCuenta: () => void
  /**
   * Si el mando ha pedido la carga.
   *
   * Se suma a la que sale sola durante el anuncio: son las dos formas de preguntar «¿con
   * cuánto?», una automática al llegar y otra a voluntad. La pared no distingue de dónde
   * viene la petición, y no debe: el hueco enseña carga o enseña reloj.
   */
  cargaEnLaPared?: boolean
}

export function TablonDelMuro({
  contenido,
  sesion,
  ejercicio,
  cargaPrevia,
  modo,
  anclas,
  alTerminarLaCuenta,
  cargaEnLaPared = false,
}: TablonDelMuroProps) {
  const [estado, setEstado] = useState<EstadoDelTablon>('anuncio')

  // EL ANUNCIO SE REARMA CON EL EJERCICIO — y lo hace REMONTANDO, no reseteando.
  //
  // La primera versión ponía `setEstado('anuncio')` dentro del efecto y ESLint la paró:
  // `react-hooks/set-state-in-effect` es error en este repo, y con motivo —un `setState`
  // síncrono en un efecto es un repintado en cascada—. La salida no es silenciarla: quien
  // decide que esto es un tablón NUEVO es quien sabe que cambió el ejercicio, así que
  // `ParedesDelSalon` lo monta con `key={ejercicio.id}`. React tira el estado viejo y este
  // componente vuelve a nacer anunciando, que es exactamente lo que se quería.
  //
  // Aquí queda solo lo que sí es un efecto: dos relojes y su limpieza.
  useEffect(() => {
    const aRelevo = setTimeout(() => setEstado('relevo'), ANUNCIO_MS)
    const aVivo = setTimeout(() => setEstado('vivo'), ANUNCIO_MS + RELEVO_MS)
    return () => {
      clearTimeout(aRelevo)
      clearTimeout(aVivo)
    }
  }, [])

  const anunciando = estado === 'anuncio' || estado === 'relevo'
  const conCarga = anunciando || cargaEnLaPared
  return (
    // LA ESCENA DEL TABLÓN. `perspective` va AQUÍ y no más arriba porque alcanza solo a los
    // HIJOS DIRECTOS: puesta en un ancestro, el `translateZ` de las capas se aplicaría
    // igual y no escorzaría — se pagaría el coste sin ver el efecto y sin que nada se
    // pusiera en rojo. Es la misma trampa que documenta `MuroDeCampos`.
    <div className="muro-escena" data-tablon={estado}>
      {/* LA FILA DEL MURO: UNA fila, DOS columnas, y las dos apoyadas en la misma línea.
          =================================================================================

          A la izquierda, la identidad de dónde estás: de quién es la sesión —el «código de
          sala»— y encima el nombre del ejercicio en trazo, que es lo que hace que la
          pared diga algo aunque no la mires. A la derecha, el ÚNICO hueco del muro que
          cambia de contenido: el cronómetro casi siempre, la carga mientras se anuncia.

          `flex-end` alinea las dos columnas por su BASE. Con `center`, un nombre que pasa
          de una línea a dos movía el hueco de la derecha media línea hacia abajo, y el
          cronómetro —lo único que corre— daba un salto al cambiar de ejercicio. */}
      <div className="muro-fila">
        <div className="min-w-0">
          <RotuloDelDia numeroDeSala={sesion?.orden ?? 1} enCuadro />
          {/* EL NOMBRE SIGUE SIENDO UN CAMPO DEL MURO, y por eso lleva su marca.
              La auditoría de «no se perdió nada» cuenta `data-campo`: sin estos dos
              atributos, mudar el nombre del anuncio al rótulo se leería desde fuera
              exactamente igual que haberlo borrado. */}
          <div data-campo="nombre" data-tope={TOPE_PARED}>
            <RotuloEnTrazo nombre={contenido.nombre} />
          </div>
        </div>
        <div data-campo={conCarga ? 'carga' : undefined} data-tope={conCarga ? TOPE_PARED : undefined}>
          <HuecoDeDatos
            muestra={conCarga ? 'carga' : 'reloj'}
            sesion={sesion}
            ejercicio={ejercicio}
            textoDeCarga={contenido.carga}
            cargaPrevia={cargaPrevia}
            modo={modo}
            anclas={anclas}
            alTerminarLaCuenta={alTerminarLaCuenta}
          />
        </div>
      </div>

      <hr className="muro-junta my-[0.45em]" aria-hidden="true" />

      {/* LOS TRES QUE SE FUERON, montados y sin ver. Una malla no la lee un lector de
          pantalla, y un cartel que se retira a los 3,7 s tampoco está siempre: estos nodos
          existen para las dos cosas que no son mirar —oír y contar—. La auditoría de «no
          se perdió nada» cuenta `data-campo`, así que sin ellos mudar un campo se leería
          desde fuera exactamente igual que haberlo borrado. */}
      <MuroDeCampos
        contenido={contenido}
        campos={EN_OTRO_SITIO}
        lado="izquierda"
        enCuadro
        soloParaLector
      />

      {/* Y NADA MÁS. El muro tenía debajo tres capas más —el anuncio con la técnica, el
          dato vivo, y una ranura corrida con el ritmo y los avisos— más tres puntos que
          decían que había algo plegado. Siete bandas de texto en 218 px.

          Se han ido las tres, y cada una a su sitio:

          - LA TÉCNICA baja a la lectura larga, bajo «cómo se hace». Es un párrafo que se
            lee una vez y entero, y en el muro salía recortado a 42 caracteres con puntos
            suspensivos: la pared enseñaba un trozo y obligaba a bajar igual.
          - EL RITMO Y LOS AVISOS bajan al panel. Son de cómo va la sesión, no de la serie
            que estás a punto de hacer, y una marquesina corrida en la pared es lo único
            del salón que se movía sin que nadie lo pidiera.
          - LAS CIFRAS ya las dicen las cuatro estaciones alrededor del cuerpo, y las dicen
            solo cuando hay que leerlas.

          Lo que queda en el muro es lo que el diseño de la sala pone en él y nada más: el
          código de sala, el nombre del ejercicio en trazo, y el hueco que se turnan el
          cronómetro y la carga. Un muro con dos cosas escritas deja ver la sala; uno con
          siete es una página web colgada de una pared. */}
    </div>
  )
}
