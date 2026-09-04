import { useEffect, useImperativeHandle, useState, type Ref } from 'react'
import { Stepper } from '../../../../components/ui/Stepper'
import { db } from '../../../../data/dbInstance'
import { etiquetaDeSerie } from '../../../../domain/calendario'
import type { EjercicioPrescrito, SerieRegistrada } from '../../../../domain/types'
import { borrarClave, escribirJSON } from '../../../../lib/persistencia'
import { claveDeBorrador, leerBorrador, type BorradorDeSerie } from './borrador'

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

/** Lo que la barra del suelo necesita poder hacer desde fuera: guardar. */
export interface RegistroSerieSalonHandle {
  guardar: () => void
}

export interface RegistroSerieSalonProps {
  /** El microciclo al que pertenece la serie. Va a `registrarSerie` tal cual. */
  microcicloId: string
  ejercicio: EjercicioPrescrito
  /** Se llama DESPUÉS de escribir, con la serie que se acaba de guardar. */
  onGuardado?: (serie: SerieRegistrada) => void
  /**
   * Si pinta su propio botón de guardar.
   *
   * En el salón la acción vive en la barra del suelo, que está siempre a la vista aunque
   * los mandos estén plegados: dos botones «Guardar serie 3» en la misma pantalla serían
   * dos formas de hacer lo mismo y ninguna de las dos diría cuál manda. Por defecto va
   * puesto, que es como lo monta cualquiera que use esta pieza suelta.
   */
  mostrarBoton?: boolean
  /** Mando desde fuera: lo usa la barra del suelo para guardar sin abrir los mandos. */
  ref?: Ref<RegistroSerieSalonHandle>
}

export function RegistroSerieSalon({
  microcicloId,
  ejercicio,
  onGuardado,
  mostrarBoton = true,
  ref,
}: RegistroSerieSalonProps) {
  // La serie que toca es la siguiente a las ya registradas. Misma cuenta que la tarjeta
  // de la sesión: `series.length + 1`, no un contador propio que pueda desincronizarse.
  const orden = ejercicio.series.length + 1
  const completo = orden > ejercicio.sets
  // La clave y los valores de partida los pone `registro/borrador.ts`, que es de donde los
  // leen también la barra del suelo y el módulo de la cámara. Escritos aquí, cada uno de
  // los tres tendría su plantilla y se separarían sin que nada se pusiera rojo.
  const clave = claveDeBorrador(microcicloId, ejercicio.id, orden)
  const [borrador, setBorrador] = useState<BorradorDeSerie>(() =>
    leerBorrador(microcicloId, ejercicio, orden),
  )

  // El borrador se remonta cuando cambia la serie: el estado inicial de `useState` solo
  // corre en el primer montaje, así que sin esto la serie 2 arrancaría con lo tecleado
  // en la 1. Quien monta este componente le pone `key` por ejercicio y orden; el efecto
  // es la red por debajo, no el mecanismo principal.
  useEffect(() => {
    escribirJSON(clave, borrador)
  }, [clave, borrador])

  const cambiar = (parche: Partial<BorradorDeSerie>) => setBorrador((b) => ({ ...b, ...parche }))

  const guardar = () => {
    // LA MEDIDA SE RELEE DEL BORRADOR PERSISTIDO, no del estado. La cámara la anota
    // después de que este componente leyera el borrador al montarse, así que el estado
    // no la tiene: la tiene la clave. Si no hay medida, la serie sale sin `velocidad`,
    // que es lo normal —hoy casi nadie graba.
    const velocidad = leerBorrador(microcicloId, ejercicio, orden).velocidad ?? borrador.velocidad
    const serie: SerieRegistrada = {
      orden,
      cargaKg: borrador.cargaKg,
      reps: borrador.reps,
      rir: borrador.rir,
      ...(velocidad ? { velocidad } : {}),
    }
    // LA MISMA LLAMADA QUE LA SESIÓN. Ver la cabecera del archivo.
    db.microciclos.registrarSerie(microcicloId, ejercicio.id, serie)
    borrarClave(clave) // ya quedó en la base; el borrador deja de hacer falta
    onGuardado?.(serie)
  }

  // El mando de fuera va DESPUÉS de definir `guardar` y antes del retorno temprano: un
  // hook detrás de un `return` es lo que prohíbe la regla de los hooks, y con el ejercicio
  // completo este componente sí retorna antes.
  useImperativeHandle(ref, () => ({ guardar }))

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
    // SIN CAJA. La tenía —borde rojo, fondo de tinta y esquinas de 14 px— porque vivía
    // suelta sobre el lienzo del sujeto y necesitaba respaldo propio. Desde que la ficha
    // es un cajón, el respaldo lo pone el cajón: dejar la caja aquí dentro era una tarjeta
    // dentro de otra, que es lo que este salón lleva quitando desde el 2026-09-02.
    <div>
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
      {/* LOS TRES, UNO DEBAJO DE OTRO. Reps y RIR iban en dos columnas, que cabían en la
          barra ancha de antes y NO caben en los 232 px del cajón: cada mando quedaba en
          110 px, los dos botones de 44 se comían el sitio y la cifra —lo único que importa
          de un mando— desaparecía. Se vio en la foto; en el DOM estaba y medía cero. */}
      <div className="mt-2 flex flex-col gap-2">
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

      {mostrarBoton && (
        <button
          type="button"
          onClick={guardar}
          className="press mt-2.5 w-full rounded-boton bg-accion py-3 font-display text-sm uppercase tracking-wide text-white"
          style={{ boxShadow: 'var(--glow-accion)' }}
        >
          Guardar serie {orden}
        </button>
      )}
    </div>
  )
}
