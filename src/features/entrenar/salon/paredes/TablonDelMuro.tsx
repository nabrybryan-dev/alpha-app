import { useEffect, useState } from 'react'
import type { EjercicioPrescrito, ItemMarcable, Microciclo, Sesion } from '../../../../domain/types'
import type { RitmoSesion } from '../../../../domain/ritmoSesion'
import type { ContenidoDePared } from './contenidoPared'
import { MuroDeCampos } from './PanelPared'
import { EN_EL_ANUNCIO, EN_GEOMETRIA_DEL_MURO, EN_LO_VIVO } from './muros'
import { RotuloDelDia, RotuloCronometro, Marquesina } from './RotulosDelSalon'
import { avisosDelSalon, lineaDeRitmo } from './avisosDelSalon'

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
  microciclo: Microciclo
  sesion?: Sesion
  ejercicio?: EjercicioPrescrito
  ritmo?: RitmoSesion
  notas: readonly ItemMarcable[]
}

export function TablonDelMuro({
  contenido,
  microciclo,
  sesion,
  ejercicio,
  ritmo,
  notas,
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
  // La ranura del muro lleva SIEMPRE el ritmo como primera frase, y detrás los avisos
  // que haya. Se compone aquí y no en la vista para que el estado —el tinte de la
  // banda— y las frases salgan del mismo sitio y no puedan discrepar.
  const ranura = ritmo
    ? (() => {
        const avisos = avisosDelSalon(ritmo, ejercicio, notas)
        return { ...avisos, frases: [lineaDeRitmo(ritmo), ...avisos.frases] }
      })()
    : undefined

  return (
    // LA ESCENA DEL TABLÓN. `perspective` va AQUÍ y no más arriba porque alcanza solo a los
    // HIJOS DIRECTOS: puesta en un ancestro, el `translateZ` de las capas se aplicaría
    // igual y no escorzaría — se pagaría el coste sin ver el efecto y sin que nada se
    // pusiera en rojo. Es la misma trampa que documenta `MuroDeCampos`.
    <div className="muro-escena" data-tablon={estado}>
      {/* LA CABECERA, en los tres estados. De quién es la sesión y cuánto llevas: se leen
          juntas al levantar la vista, y son lo único que no se pliega. */}
      <div className="flex items-start justify-between gap-[0.8em]">
        <RotuloDelDia microciclo={microciclo} sesion={sesion} enCuadro />
        {sesion && <RotuloCronometro sesionId={sesion.id} enCuadro />}
      </div>

      <hr className="muro-junta my-[0.45em]" aria-hidden="true" />

      {anunciando && (
        // EL ANUNCIO. Entra palabra a palabra y se va de una pieza.
        //
        // El escalonado no se pone aquí: lo trae `PanelCampo`, que ya parte el titular en
        // palabras con `.muro-palabra` y su retardo por índice. Repetirlo en este nivel
        // sería una segunda cascada compitiendo con la que ya existe.
        <div className="muro-anuncio" data-saliendo={estado === 'relevo' ? '' : undefined}>
          <MuroDeCampos contenido={contenido} campos={EN_EL_ANUNCIO} lado="izquierda" enCuadro />
        </div>
      )}

      {estado !== 'anuncio' && (
        // EL DATO VIVO. Sube mientras el anuncio se retira.
        <div className="muro-vivo">
          {ejercicio && (
            <p className="muro-rotulo text-[0.58em]">
              Serie {ejercicio.series.length + 1} de {ejercicio.sets}
            </p>
          )}
          {/* LO QUE DICE EL MURO NO SE ESCRIBE AQUÍ.
              Series, repeticiones y RIR los escribe la sala en siete segmentos, a 62 px
              de alto y enfrente de quien entra. Estos nodos se montan y no se ven: son
              para el lector de pantalla y para la auditoría. */}
          <MuroDeCampos
            contenido={contenido}
            campos={EN_GEOMETRIA_DEL_MURO}
            lado="izquierda"
            enCuadro
            soloParaLector
          />

          {/* Y EN LETRA, solo lo que la geometría no puede escribir. La carga suele ser
              una frase —«SIN KILOS», «con la barra»— y siete segmentos no escriben eso. */}
          <MuroDeCampos contenido={contenido} campos={EN_LO_VIVO} lado="izquierda" enCuadro />
        </div>
      )}

      {/* LA RANURA DE ABAJO: UNA línea, y por ella pasa todo lo que cambia con el tiempo.
          Es lo que este muro decía que hacía y no hacía. El ritmo iba en un rótulo fijo y
          los avisos en una banda debajo: dos bloques apilados que dicen lo mismo —cómo
          vas—, y entre los dos se llevaban tres líneas del muro, porque «≈ 58m · Bloque de
          fuerza · Ejercicio 1/5» no cabe en 309 px y parte. Puestos en la misma pista, el
          ritmo es la primera frase y los avisos pasan detrás: una línea, y no se pierde
          ninguno. */}
      {estado === 'vivo' && ranura && (
        <div className="muro-ranura">
          <Marquesina avisos={ranura} />
        </div>
      )}

      {/* LAS CAPAS PLEGADAS. Tres puntos que laten muy despacio.
          No son un adorno: dicen que hay más y dónde —la ficha íntegra vive en el panel de
          abajo—. Sin ellos, plegar se lee como perder. */}
      {estado === 'vivo' && (
        <p className="muro-capas" aria-hidden="true">
          <span /> <span /> <span />
        </p>
      )}
    </div>
  )
}
