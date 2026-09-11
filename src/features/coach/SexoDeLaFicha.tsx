import { Card } from '../../components/ui/Card'
import { db } from '../../data/dbInstance'
import { SEXOS_DE_FICHA } from '../../domain/sexoDeFicha'
import type { SexoDeFicha } from '../../domain/types'

interface Props {
  usuarioId: string
  sexo: SexoDeFicha | undefined
}

/**
 * Lo que se lee en cada botón. Con palabras y no con ♂/♀ a propósito: un
 * símbolo lo dibuja el sistema operativo, distinto en cada teléfono, y el
 * guardián de `emojis-como-iconos.test.ts` no lo deja pasar.
 */
const ETIQUETA: Record<SexoDeFicha, string> = { hombre: 'Hombre', mujer: 'Mujer' }
const SIN_INDICAR = 'Sin indicar'

/**
 * El sexo de la ficha, que rellena el coach.
 *
 * Decide con qué huesos se dibuja el cuerpo de esta persona en el salón y en
 * el estudio del cuerpo (`juegoDeHuesos.ts`). Se guarda al tocar, sin botón de
 * guardar: son tres opciones y la que está pulsada es la que vale. «Sin
 * indicar» es una opción de verdad y no la ausencia de las otras dos, para que
 * quitarlo sea tan fácil como ponerlo; con ella el sujeto vuelve al neutro.
 *
 * Va por el mismo camino que el resto de la ficha (`db.perfiles`), así que
 * sube a la nube con la misma cola y con el mismo trigger detrás.
 */
export function SexoDeLaFicha({ usuarioId, sexo }: Props) {
  const opciones: (SexoDeFicha | undefined)[] = [...SEXOS_DE_FICHA, undefined]

  return (
    <Card>
      <p className="kicker">Sexo</p>
      <p className="mt-1 text-xs text-tenue">
        Con qué huesos se dibuja su cuerpo en el salón y en el estudio del cuerpo. Sin
        indicar, se dibuja como hasta ahora.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Sexo de la ficha">
        {opciones.map((opcion) => {
          const activa = sexo === opcion
          return (
            <button
              key={opcion ?? 'sin-indicar'}
              type="button"
              aria-pressed={activa}
              onClick={() => db.perfiles.guardarSexo(usuarioId, opcion)}
              className={`press rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                activa ? 'border-rojo bg-rojo text-white' : 'border-linea bg-surface-2 text-texto'
              }`}
            >
              {opcion ? ETIQUETA[opcion] : SIN_INDICAR}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
