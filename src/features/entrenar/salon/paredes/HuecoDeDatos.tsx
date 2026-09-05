import type { EjercicioPrescrito, Sesion } from '../../../../domain/types'
import { RotuloCronometro } from './RotulosDelSalon'
import { CuentaAtrasDelMuro } from '../mando/CuentaAtrasDelMuro'
import type { AnclasDelReloj, ModoDelReloj } from '../mando/relojDelMuro'

/**
 * EL HUECO DE LA DERECHA DEL MURO: un sitio, dos contenidos, nunca los dos.
 *
 * ## Por qué es UN hueco y no dos bloques
 *
 * Entre el rótulo del ejercicio y el borde de arriba del cuadro queda una banda estrecha
 * de muro. El reloj y la carga apilados no caben ahí, y apilarlos igual tiene una forma
 * concreta de fallar: no se sale nada —el cuadro crece hacia abajo—, así que el asentado
 * lo baja por el muro y acaba cayendo sobre el marcador de siete segmentos. Se lee como
 * un texto encima de otro y ninguna prueba lo dice.
 *
 * Así que comparten sitio y se turnan. Y van como HERMANOS del rótulo dentro de la fila,
 * no como un bloque suelto centrado: centrado en la columna del rótulo, el hueco acaba
 * sobre el sujeto o cortado por el borde pase lo que pase con su desplazamiento.
 *
 * ## Quién decide el turno
 *
 * El mismo reloj que ya gobierna el muro: mientras el tablón ANUNCIA el ejercicio, el
 * hueco enseña la CARGA; cuando el anuncio se retira, vuelve el cronómetro y se queda.
 *
 * No es un turno decorativo: es el orden en que se usa. La carga se necesita una vez y en
 * un momento exacto —al llegar a la máquina o a la barra, antes de la primera serie— y a
 * partir de ahí lo que corre es el tiempo. Enseñar los kilos los cuarenta minutos
 * siguientes es ocupar el único hueco que cambia con un dato que ya no cambia.
 *
 * ## Los dos kilos, y por qué el de abajo puede faltar
 *
 * «Carga a usar» es prescripción y sale del ejercicio. «La semana pasada» es un HECHO y
 * sale del microciclo anterior (`cargaAnterior`). Cuando no hay con qué comparar —primer
 * microciclo, ejercicio nuevo, una semana sin registrar— la línea no se pinta. Un 0 kg
 * ahí sería una carga que nadie levantó, y encima se compararía con la de hoy.
 *
 * ## Y cuando la carga no es un número
 *
 * Hay prescripciones sin kilos: peso corporal, porcentajes, tiempo. `ContenidoDePared` ya
 * las resuelve en una frase —«SIN KILOS», «con la barra»— y esa frase se escribe tal cual,
 * en el cuerpo pequeño. Un rótulo de kilos gigante diciendo una frase no es un marcador:
 * es un titular.
 */

export interface HuecoDeDatosProps {
  /** Qué toca ahora. Lo decide el estado del tablón, no este componente. */
  muestra: 'carga' | 'reloj'
  sesion?: Sesion
  ejercicio?: EjercicioPrescrito
  /** La frase de carga ya compuesta, para las prescripciones que no llevan kilos. */
  textoDeCarga: string
  /** Con cuánto levantó la última vez. Ausente = no hay con qué comparar. */
  cargaPrevia?: number
  /**
   * QUÉ ESTÁ CONTANDO EL RELOJ. Lo decide el mando, y se lee aquí — nunca sobre el mando.
   *
   * En `sesion` es el cronómetro de siempre, el mismo que corre en la pantalla de sesión:
   * se monta, no se reescribe. En los otros dos es una cuenta atrás contra un instante.
   */
  modo: ModoDelReloj
  anclas: AnclasDelReloj
  /** Se llama cuando la cuenta atrás cruza el cero. */
  alTerminarLaCuenta: () => void
}

export function HuecoDeDatos({
  muestra,
  sesion,
  ejercicio,
  textoDeCarga,
  cargaPrevia,
  modo,
  anclas,
  alTerminarLaCuenta,
}: HuecoDeDatosProps) {
  if (muestra === 'reloj') {
    return (
      <div className="muro-hueco" data-hueco-muro="reloj" data-modo={modo}>
        {modo === 'sesion' ? (
          sesion && <RotuloCronometro sesionId={sesion.id} enCuadro />
        ) : (
          <CuentaAtrasDelMuro modo={modo} anclas={anclas} alTerminar={alTerminarLaCuenta} />
        )}
      </div>
    )
  }

  const kilos = ejercicio?.cargaKg

  return (
    <div className="muro-hueco muro-hueco-entra" data-hueco-muro="carga">
      <p className="muro-rotulo muro-rotulo-vivo text-[0.5em]">Carga a usar</p>
      {kilos === undefined ? (
        <p className="muro-dato mt-[0.2em] text-[0.72em] leading-none">{textoDeCarga}</p>
      ) : (
        <p className="muro-kilos mt-[0.16em]">
          {cifra(kilos)}
          <span className="muro-kilos-unidad"> KG</span>
        </p>
      )}
      <span className="muro-filete" aria-hidden="true" />
      {/* «LA SEMANA PASADA» SOLO CUANDO HAY DOS CIFRAS QUE COMPARAR.
          Se vio en la pantalla y no en un test: un goblet prescrito sin kilos enseñaba
          «Sin kilos» y justo debajo «La semana pasada · 20 KG». Los dos datos eran
          ciertos y juntos decían una cosa falsa —que hoy se baja de 20 a nada—, cuando
          lo que pasa es que la prescripción de hoy no se mide en kilos.
          Una comparación necesita dos cosas de la misma naturaleza. */}
      {kilos !== undefined && cargaPrevia !== undefined && (
        <>
          <p className="muro-rotulo mt-[0.34em] text-[0.44em]">La semana pasada</p>
          <p className="muro-kilos muro-kilos-previo mt-[0.1em]">
            {cifra(cargaPrevia)}
            <span className="muro-kilos-unidad"> KG</span>
          </p>
        </>
      )}
    </div>
  )
}

/** Sin decimales cuando son redondos: «80 KG», no «80,0 KG». */
function cifra(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace('.', ',')
}
