import { useEffect, useState } from 'react'
import { Stepper } from '../../../../components/ui/Stepper'
import { db } from '../../../../data/dbInstance'
import { etiquetaDeSerie } from '../../../../domain/calendario'
import { rirDeTabla } from '../../../../domain/objetivoDeIntensidad'
import { seriePrescrita } from '../../../../domain/ondulacion'
import { cargaSugerida } from '../../../../domain/prescripcion'
import type { EjercicioPrescrito, SerieRegistrada } from '../../../../domain/types'
import { borrarClave, escribirJSON, leerJSON } from '../../../../lib/persistencia'

/**
 * EL REGISTRO EN EL SUELO DEL SALÓN.
 *
 * Es el hueco `registro` de `huecos.ts`, y va al SUELO y no a una pared porque es la
 * única acción del salón: se alcanza con el pulgar sin girar la cámara ni abrir nada, y
 * está disponible en todas las capas del eje W — quien acaba de levantar no debería tener
 * que volver a la piel para apuntar sus repeticiones.
 *
 * ## Esto es un ENVOLTORIO, no un registro nuevo
 *
 * Los tres steppers, los topes y el camino de escritura son los que ya funcionan en
 * `RegistroSerie` dentro de la sesión:
 *
 * - carga 0-999, reps 1-50, RIR 0-5, exactamente los mismos números;
 * - los valores de arranque salen de las mismas funciones de dominio —`seriePrescrita`,
 *   `cargaSugerida`, `rirDeTabla`—, así que la ondulación del microciclo manda igual;
 * - se guarda con `db.microciclos.registrarSerie`, que es la MISMA llamada que hace
 *   `SesionPage`. No hay un segundo camino de escritura, ni una tabla, ni un RPC: si la
 *   escritura cambia, cambia en un sitio y esto la sigue.
 *
 * El borrador comparte incluso la clave (`alpha-serie-<microciclo>-<ejercicio>-<orden>`),
 * así que una serie empezada en la sesión aparece a medio llenar aquí y al revés. Dos
 * claves distintas para la misma serie serían dos borradores que se pisan sin avisar.
 *
 * ## Lo que este archivo NO puede tener
 *
 * Ni el nombre del proveedor de la nube ni el de ningún RPC — la comprobación es literal
 * y busca esas cadenas, así que aquí no se escriben ni para explicarlas. La interfaz no
 * habla con la nube:
 * habla con `db`, y `db` decide si eso además sube. Meter aquí una llamada directa sería
 * abrir un segundo camino de escritura que el resto de la app no ve.
 */

/** Cuando no hay nada de dónde deducir la carga, el stepper arranca aquí. */
const CARGA_POR_DEFECTO_KG = 20

interface Borrador {
  cargaKg: number
  reps: number
  rir: number
}

export interface RegistroSerieSalonProps {
  /** El microciclo al que pertenece la serie. Va a `registrarSerie` tal cual. */
  microcicloId: string
  ejercicio: EjercicioPrescrito
  /** Se llama DESPUÉS de escribir, con la serie que se acaba de guardar. */
  onGuardado?: (serie: SerieRegistrada) => void
}

export function RegistroSerieSalon({
  microcicloId,
  ejercicio,
  onGuardado,
}: RegistroSerieSalonProps) {
  // La serie que toca es la siguiente a las ya registradas. Misma cuenta que la tarjeta
  // de la sesión: `series.length + 1`, no un contador propio que pueda desincronizarse.
  const orden = ejercicio.series.length + 1
  const completo = orden > ejercicio.sets
  const prescrita = seriePrescrita(ejercicio, orden)
  const clave = `alpha-serie-${microcicloId}-${ejercicio.id}-${orden}`

  const [borrador, setBorrador] = useState<Borrador>(() =>
    leerJSON<Borrador>(clave, {
      cargaKg: cargaSugerida(ejercicio, prescrita) ?? CARGA_POR_DEFECTO_KG,
      reps: prescrita?.reps ?? ejercicio.repsDiana,
      // Con el objetivo en `FALLO` el stepper arranca en 0, y es lo correcto: la parte
      // contada de una serie al fallo termina en la última repetición COMPLETA, que es
      // RIR 0. La parcial que viene después no es una repetición en reserva.
      rir: prescrita?.rir ?? rirDeTabla(ejercicio.rirObjetivo),
    }),
  )

  // El borrador se remonta cuando cambia la serie: el estado inicial de `useState` solo
  // corre en el primer montaje, así que sin esto la serie 2 arrancaría con lo tecleado
  // en la 1. Quien monta este componente le pone `key` por ejercicio y orden; el efecto
  // es la red por debajo, no el mecanismo principal.
  useEffect(() => {
    escribirJSON(clave, borrador)
  }, [clave, borrador])

  const cambiar = (parche: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...parche }))

  const guardar = () => {
    const serie: SerieRegistrada = {
      orden,
      cargaKg: borrador.cargaKg,
      reps: borrador.reps,
      rir: borrador.rir,
    }
    // LA MISMA LLAMADA QUE LA SESIÓN. Ver la cabecera del archivo.
    db.microciclos.registrarSerie(microcicloId, ejercicio.id, serie)
    borrarClave(clave) // ya quedó en la base; el borrador deja de hacer falta
    onGuardado?.(serie)
  }

  if (completo) {
    return (
      <div className="rounded-[14px] border border-white/10 bg-ink-900 px-3.5 py-3 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-logrado">
          {ejercicio.sets} series registradas
        </p>
      </div>
    )
  }

  const etiqueta = etiquetaDeSerie(ejercicio, orden)

  return (
    // Sin desenfoque y con el fondo opaco, por lo mismo que las paredes: el suelo se
    // pinta sobre el lienzo del sujeto, que se mueve mientras se registra la serie.
    <div className="rounded-[14px] border border-accion/35 bg-ink-900 px-3 py-2.5">
      <p className="mb-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accion">
        <span>
          Serie {orden} de {ejercicio.sets}
        </span>
        {etiqueta && (
          <span className="rounded-tag bg-accion/15 px-2 py-0.5 text-[9px] tracking-[0.12em]">
            {etiqueta}
          </span>
        )}
      </p>

      {/* Los tres mandos, con los topes de siempre: carga 0-999, reps 1-50, RIR 0-5.
          `profundidad` y `cifraViva` van puestos porque esto vive dentro de una escena
          con perspectiva y porque los kilos que vas a levantar son el estado de un mando
          — un mando que no acusa el cambio se siente muerto. */}
      <Stepper
        etiqueta="Carga"
        valor={borrador.cargaKg}
        paso={1}
        minimo={0}
        maximo={999}
        sufijo="kg"
        decimal
        profundidad
        cifraViva
        onCambiar={(v) => cambiar({ cargaKg: v })}
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stepper
          etiqueta="Reps"
          valor={borrador.reps}
          paso={1}
          minimo={1}
          maximo={50}
          profundidad
          cifraViva
          onCambiar={(v) => cambiar({ reps: v })}
        />
        <Stepper
          etiqueta="RIR"
          valor={borrador.rir}
          paso={1}
          minimo={0}
          maximo={5}
          profundidad
          cifraViva
          onCambiar={(v) => cambiar({ rir: v })}
        />
      </div>

      <button
        type="button"
        onClick={guardar}
        className="press mt-2.5 w-full rounded-boton bg-accion py-3 font-display text-sm uppercase tracking-wide text-white"
        style={{ boxShadow: 'var(--glow-accion)' }}
      >
        Guardar serie {orden}
      </button>
    </div>
  )
}
