import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Stepper } from '../../components/ui/Stepper'
import { etiquetaDeSerie } from '../../domain/calendario'
import { seriePrescrita } from '../../domain/ondulacion'
import { rirDeTabla } from '../../domain/objetivoDeIntensidad'
import { cargaSugerida } from '../../domain/prescripcion'
import type { EjercicioPrescrito, SerieRegistrada } from '../../domain/types'
import { borrarClave, escribirJSON, leerJSON } from '../../lib/persistencia'
import { IconoCamara } from '../../components/ui/Icono'
import { HojaMedicion } from './encoder/HojaMedicion'
import { marcarCamaraAbierta } from './camaraAbierta'

interface RegistroSerieProps {
  ejercicio: EjercicioPrescrito
  orden: number
  /** Identifica el borrador de esta serie en curso (microciclo + ejercicio + orden). */
  borradorId: string
  /** Muestra el botón interno "Guardar serie". Si es false, el guardado se
   *  dispara desde fuera vía el ref (CTA fijo inferior). */
  mostrarBoton?: boolean
  onGuardar: (serie: SerieRegistrada) => void
}

export interface RegistroSerieHandle {
  guardar: () => void
}

interface Borrador {
  cargaKg: number
  reps: number
  rir: number
}

/** Cuando no hay nada de dónde deducir la carga, el stepper arranca aquí. */
const CARGA_POR_DEFECTO_KG = 20

function cargaInicial(ejercicio: EjercicioPrescrito, orden: number): number {
  return cargaSugerida(ejercicio, seriePrescrita(ejercicio, orden)) ?? CARGA_POR_DEFECTO_KG
}

export const RegistroSerie = forwardRef<RegistroSerieHandle, RegistroSerieProps>(function RegistroSerie(
  { ejercicio, orden, borradorId, mostrarBoton = true, onGuardar },
  ref,
) {
  const clave = `alpha-serie-${borradorId}`
  const prescrita = seriePrescrita(ejercicio, orden)
  const [borrador, setBorrador] = useState<Borrador>(() =>
    leerJSON<Borrador>(clave, {
      cargaKg: cargaInicial(ejercicio, orden),
      reps: prescrita?.reps ?? ejercicio.repsDiana,
      // Con el objetivo en `FALLO` el stepper arranca en 0, y es lo correcto: la
      // parte contada de una serie al fallo termina en la última repetición
      // COMPLETA, que es RIR 0. La parcial que viene después no es una
      // repetición en reserva y no cabe en este campo — su sitio es `extra`.
      rir: prescrita?.rir ?? rirDeTabla(ejercicio.rirObjetivo),
    }),
  )

  // Cada cambio se guarda solo (como una hoja de Excel): si el asesorado se sale
  // a cambiar la música o cierra la app, la serie a medio llenar sigue ahí.
  useEffect(() => {
    escribirJSON(clave, borrador)
  }, [clave, borrador])

  const cambiar = (parche: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...parche }))

  const guardar = () => {
    onGuardar({ orden, cargaKg: borrador.cargaKg, reps: borrador.reps, rir: borrador.rir })
    borrarClave(clave) // ya quedó en la base; el borrador deja de hacer falta
  }

  // Permite disparar el guardado desde el CTA fijo inferior.
  useImperativeHandle(ref, () => ({ guardar }))

  const etiqueta = etiquetaDeSerie(ejercicio, orden)
  const [midiendo, setMidiendo] = useState(false)

  // Que la camara este abierta es un hecho GLOBAL, no una prop de esta tarjeta:
  // le importa al gabinete de al lado, a la profundidad de toda la pantalla y a
  // cualquier cosa que se mueva mientras se captura a 50 fps. Publicarlo como
  // atributo evita cablearlo por seis componentes y deja que lo lea el CSS —la
  // puerta vive en `tokens.css`, que es donde se puede auditar de un vistazo.
  useEffect(() => {
    if (!midiendo) return
    return marcarCamaraAbierta()
  }, [midiendo])

  return (
    <div
      className="rounded-bloque border border-accion/35 bg-ink-700 p-3.5"
      style={{ boxShadow: '0 0 0 3px rgba(255, 30, 30, 0.09)' }}
    >
      {/* EL MARCO NO ENTRA EN LA ESCENA, y es innegociable: `HojaMedicion` es
          `fixed inset-0` y cuelga de aqui dentro. Un `perspective` o un
          `transform` en el marco lo convertiria en bloque contenedor y la hoja
          de la camara se encerraria dentro de una tarjeta de 350 px en vez de
          ocupar la pantalla. La perspectiva vive en este envoltorio interior, y
          la hoja se queda FUERA de el, como hermana posterior. */}
      <div className="escena-prof">
        <div className="consola-asienta">
      {/* `preserve-3d` en el párrafo, que faltaba: la etiqueta de dentro lleva
          `tecla-3d`, y sin este eslabón el `<p>` aplana a sus hijos y ese
          `translateZ` no producía escorzo ninguno. Se veía la sombra —eso sí se
          pinta— así que parecía en relieve sin estarlo: coste sin efecto. */}
      <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-accion [transform-style:preserve-3d]">
        Serie {orden} de {ejercicio.sets}
        {etiqueta && (
          <span className="tecla-3d ml-2 inline-block rounded-tag bg-accion/15 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-accion">
            {etiqueta}
          </span>
        )}
      </p>

      {prescrita && (
        <p className="-mt-1.5 mb-3 text-center text-[11px] text-tenue">
          Objetivo:{' '}
          <span className="font-semibold text-texto">
            {prescrita.reps} reps × {prescrita.cargaKg} kg
          </span>{' '}
          · RIR {prescrita.rir}
        </p>
      )}

      {/* Carga a lo ancho (dato principal); Reps y RIR debajo en dos columnas.
          Así nada se sale de la pantalla en móvil y la jerarquía queda clara. */}
      <Stepper etiqueta="Carga" valor={borrador.cargaKg} paso={1} sufijo="kg" decimal grande profundidad onCambiar={(v) => cambiar({ cargaKg: v })} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stepper etiqueta="Reps" valor={borrador.reps} paso={1} minimo={1} maximo={50} profundidad onCambiar={(v) => cambiar({ reps: v })} />
        <Stepper etiqueta="RIR" valor={borrador.rir} paso={1} minimo={0} maximo={5} profundidad onCambiar={(v) => cambiar({ rir: v })} />
      </div>

      {/* Medir va ANTES de guardar, y no es un detalle de orden: se mide la
          serie que acabas de hacer, y al guardar la serie desaparece este
          bloque. Debajo del botón de guardar nadie lo vería a tiempo. */}
      <button
        type="button"
        onClick={() => setMidiendo(true)}
        className="tecla-3d mt-3 flex w-full items-center justify-center gap-2 rounded-boton border border-white/15 bg-white/5 py-3 text-sm font-bold uppercase tracking-wide text-texto"
      >
        <IconoCamara className="h-[18px] w-[18px] shrink-0" />
        Medir con la cámara
      </button>

        </div>
      </div>

      <HojaMedicion
        abierto={midiendo}
        onCerrar={() => setMidiendo(false)}
        ejercicio={ejercicio.nombre}
        cargaKg={borrador.cargaKg}
        reps={borrador.reps}
      />

      {mostrarBoton && (
        <button
          type="button"
          onClick={guardar}
          className="press mt-3.5 w-full rounded-boton bg-accion py-3.5 font-display text-base uppercase tracking-wide text-white"
          style={{ boxShadow: 'var(--glow-accion)' }}
        >
          Guardar serie {orden}
        </button>
      )}
    </div>
  )
})
