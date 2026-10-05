import { forwardRef, useEffect, useId, useImperativeHandle, useState } from 'react'
import { SelectorRir } from '../../components/ui/SelectorRir'
import { Stepper } from '../../components/ui/Stepper'
import { etiquetaDeSerie } from '../../domain/calendario'
import {
  confirmacionTrasCambio,
  sePuedeGuardar,
  type ConfirmacionDeBorrador,
} from '../../domain/confirmacionSerie'
import { seriePrescrita } from '../../domain/ondulacion'
import { cargaSugerida } from '../../domain/prescripcion'
import type { EjercicioPrescrito, SerieRegistrada } from '../../domain/types'
import { borrarClave, escribirJSON, leerJSON } from '../../lib/persistencia'
import { IconoCamara } from '../../components/ui/Icono'
import { HojaMedicion } from './encoder/HojaMedicion'
import { marcarCamaraAbierta } from './camaraAbierta'
import { HechoTalCual, MotivoSinConfirmar } from './HechoTalCual'

interface RegistroSerieProps {
  ejercicio: EjercicioPrescrito
  orden: number
  /** Identifica el borrador de esta serie en curso (microciclo + ejercicio + orden). */
  borradorId: string
  /** Muestra el botón interno "Guardar serie". Si es false, el guardado se
   *  dispara desde fuera vía el ref (CTA fijo inferior). */
  mostrarBoton?: boolean
  onGuardar: (serie: SerieRegistrada) => void
  /** Avisa a quien pinta el botón de guardar de fuera si ya se puede guardar. */
  onPuedeGuardar?: (puede: boolean) => void
}

export interface RegistroSerieHandle {
  /** Guarda por el camino de «Guardar»: no hace nada si la persona aún no ha cambiado un número. */
  guardar: () => void
}

interface Borrador {
  cargaKg: number
  reps: number
  /** Vacío hasta que la persona lo elige: ver `SelectorRir`. */
  rir?: number
  /** `editada` en cuanto la persona cambia la carga o las reps. Sin esto, la pauta es solo sugerencia. */
  confirmada?: ConfirmacionDeBorrador
}

/** Cuando no hay nada de dónde deducir la carga, el stepper arranca aquí. */
const CARGA_POR_DEFECTO_KG = 20

function cargaInicial(ejercicio: EjercicioPrescrito, orden: number): number {
  return cargaSugerida(ejercicio, seriePrescrita(ejercicio, orden)) ?? CARGA_POR_DEFECTO_KG
}

export const RegistroSerie = forwardRef<RegistroSerieHandle, RegistroSerieProps>(function RegistroSerie(
  { ejercicio, orden, borradorId, mostrarBoton = true, onGuardar, onPuedeGuardar },
  ref,
) {
  const clave = `alpha-serie-${borradorId}`
  const prescrita = seriePrescrita(ejercicio, orden)
  // La pauta: lo que se SUGIERE. Solo cuenta como hecho si la persona lo firma.
  const pautaCarga = cargaInicial(ejercicio, orden)
  const pautaReps = prescrita?.reps ?? ejercicio.repsDiana
  const [borrador, setBorrador] = useState<Borrador>(() =>
    leerJSON<Borrador>(clave, {
      cargaKg: pautaCarga,
      reps: pautaReps,
      // SIN `rir`. Aquí arrancaba en el RIR objetivo, y quien no tocaba el mando
      // guardaba el objetivo como si fuera lo que sintió: una asesorada con objetivo
      // RIR 5 quedaba con RIR 5 en todas sus series. El objetivo se muestra arriba
      // («Objetivo: … · RIR n»); el RIR REAL lo pone la persona o no existe.
    }),
  )

  // Cada cambio se guarda solo (como una hoja de Excel): si el asesorado se sale
  // a cambiar la música o cierra la app, la serie a medio llenar sigue ahí.
  useEffect(() => {
    escribirJSON(clave, borrador)
  }, [clave, borrador])

  const cambiar = (parche: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...parche }))

  // Cambiar un número ES confirmar la serie (`editada`); repetir el mismo valor no cuenta.
  const cambiarNumero = (campo: 'cargaKg' | 'reps', valor: number) =>
    setBorrador((b) => ({
      ...b,
      [campo]: valor,
      confirmada: confirmacionTrasCambio(b.confirmada, b[campo], valor),
    }))

  const puedeGuardar = sePuedeGuardar(borrador.confirmada)
  useEffect(() => {
    onPuedeGuardar?.(puedeGuardar)
  }, [onPuedeGuardar, puedeGuardar])

  const rirElegido = borrador.rir !== undefined ? { rir: borrador.rir } : {}

  /** «Hecho tal cual»: se guarda la PAUTA (no lo que haya en el borrador) y se firma. */
  const hechoTalCual = () => {
    onGuardar({ orden, cargaKg: pautaCarga, reps: pautaReps, ...rirElegido, confirmada: 'tal_cual' })
    borrarClave(clave)
  }

  /** «Guardar»: solo después de cambiar un número. Sin confirmar no guarda NADA. */
  const guardar = () => {
    if (!sePuedeGuardar(borrador.confirmada)) return
    onGuardar({ orden, cargaKg: borrador.cargaKg, reps: borrador.reps, ...rirElegido, confirmada: 'editada' })
    borrarClave(clave) // ya quedó en la base; el borrador deja de hacer falta
  }

  // Permite disparar el guardado desde el CTA fijo inferior.
  useImperativeHandle(ref, () => ({ guardar }))
  const idMotivo = useId()

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

      {/* Carga a lo ancho (dato principal); Reps y RIR debajo, uno por fila (los seis botones del RIR no caben en media columna).
          Así nada se sale de la pantalla en móvil y la jerarquía queda clara. */}
      <Stepper etiqueta="Carga" valor={borrador.cargaKg} paso={1} sufijo="kg" decimal grande profundidad cifraViva sugerido={!puedeGuardar} onCambiar={(v) => cambiarNumero('cargaKg', v)} />
      <div className="mt-2 flex flex-col gap-2">
        <Stepper etiqueta="Reps" valor={borrador.reps} paso={1} minimo={1} maximo={50} profundidad cifraViva sugerido={!puedeGuardar} onCambiar={(v) => cambiarNumero('reps', v)} />
        <SelectorRir valor={borrador.rir} onCambiar={(v) => cambiar({ rir: v })} />
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

      {/* UN TOQUE para lo normal: la pauta tal cual. Si ya cambió un número, ese botón
          sobra (lo que hay en pantalla ya no es la pauta) y manda «Guardar». */}
      {!puedeGuardar && (
        <div className="mt-3.5">
          <HechoTalCual cargaKg={pautaCarga} reps={pautaReps} onConfirmar={hechoTalCual} />
        </div>
      )}

      {mostrarBoton && (
        <>
          <button
            type="button"
            onClick={guardar}
            disabled={!puedeGuardar}
            aria-describedby={puedeGuardar ? undefined : idMotivo}
            className="press mt-3 w-full rounded-boton bg-accion py-3.5 font-display text-base uppercase tracking-wide text-white disabled:opacity-40 disabled:shadow-none"
            style={puedeGuardar ? { boxShadow: 'var(--glow-accion)' } : undefined}
          >
            Guardar serie {orden}
          </button>
          {!puedeGuardar && <MotivoSinConfirmar id={idMotivo} className="mt-1.5" />}
        </>
      )}
    </div>
  )
})
