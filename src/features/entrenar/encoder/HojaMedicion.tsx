import { useState } from 'react'
import { Sheet } from '../../../components/ui/Sheet'
import { gLocal } from './nucleo/analisis'
import { anadirATanda, leerTanda, type Medicion } from './tanda'
import type { Ajustes } from './useCaptura'
import { Visor } from './Visor'

/**
 * Medir una serie desde dentro de la serie.
 *
 * Todo lo que la herramienta suelta te obliga a teclear —ejercicio, carga,
 * repeticiones— aquí ya lo sabe la sesión. No es comodidad: el criterio que
 * decide si el protocolo es viable son los **segundos que la medición le roba a
 * cada serie**, con el asesorado de pie esperando. Teclear cuatro campos entre
 * series es exactamente lo que hay que quitar.
 */

/** Diámetros de disco olímpico. Se elige por el tipo de disco que tienes en la
 *  mano; no hay que medir nada en el gimnasio. */
const DISCOS = [
  { mm: 450, etiqueta: 'Bumper · 20-25 kg' },
  { mm: 400, etiqueta: 'Olímpico 15 kg' },
  { mm: 325, etiqueta: 'Hierro 10 kg' },
] as const

const CLAVE_DIAMETRO = 'alpha-encoder-diametro'

interface HojaMedicionProps {
  abierto: boolean
  onCerrar: () => void
  ejercicio: string
  cargaKg: number
  reps: number
}

export function HojaMedicion({ abierto, onCerrar, ejercicio, cargaKg, reps }: HojaMedicionProps) {
  // El disco se recuerda entre series: en una sesión no cambias de disco cada
  // vez, y volver a elegirlo nueve veces es tiempo que cuenta en el criterio.
  const [diametroMm, setDiametroMm] = useState(
    () => Number(localStorage.getItem(CLAVE_DIAMETRO)) || 450,
  )
  const [guardadas, setGuardadas] = useState(() => leerTanda().length)
  const [ultimoAviso, setUltimoAviso] = useState<string | null>(null)

  const ajustes: Ajustes = {
    referencia: 'disco',
    dianaMm: [140, 220],
    sepMm: 400,
    diametroMm,
    tolTono: 22,
    sentido: 'subir',
    modo: 'serie',
    gRef: gLocal(4.534, 1480),
    ejercicio,
  }

  const elegirDisco = (mm: number) => {
    setDiametroMm(mm)
    localStorage.setItem(CLAVE_DIAMETRO, String(mm))
  }

  return (
    <Sheet abierto={abierto} titulo="Medir la barra" onCerrar={onCerrar}>
      <p className="mb-3 text-sm text-tenue">
        <b className="text-texto">{ejercicio}</b> · {cargaKg} kg · {reps} reps.{' '}
        Ya van puestos: no hay nada que teclear.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {DISCOS.map((d) => (
          <button
            key={d.mm}
            type="button"
            aria-pressed={diametroMm === d.mm}
            onClick={() => elegirDisco(d.mm)}
            className={`min-h-11 rounded-full border px-3 text-xs font-medium transition-colors ${
              diametroMm === d.mm
                ? 'border-rojo bg-rojo/15 text-rojo'
                : 'border-linea bg-surface-2 text-tenue'
            }`}
          >
            {d.etiqueta}
          </button>
        ))}
      </div>

      <Visor ajustes={ajustes}>
        {(captura) => {
          const r = captura.resultado
          if (!r || r.tipo !== 'serie') {
            return (
              <p className="mt-3 text-xs text-tenue">
                Apoya el teléfono de lado, toca el disco en la imagen y comprueba que sigue
                detectado <b className="text-texto">en todo el recorrido</b>, no solo con la
                barra abajo.
              </p>
            )
          }
          const s = r.datos
          if (!s.ok) {
            return (
              <p className="mt-3 text-sm text-rojo">
                No salió medición: {s.detalle ?? s.motivo}
                {s.fpsReal !== undefined && ` · ${s.fpsReal.toFixed(0)} fps`}
              </p>
            )
          }

          const guardar = () => {
            const { sAnadidos, sMaquina } = captura.cronometro()
            const fila: Medicion = {
              fecha: new Date().toISOString(),
              modo: 'serie',
              ejercicio,
              cargaKg,
              // Las que dijiste que ibas a hacer. Si hiciste otras, se corrige
              // en el CSV: forzarte a teclearlas aquí es el coste que se mide.
              repsReales: reps,
              repsDetectadas: s.reps.length,
              vPrimera: s.vPrimera,
              vUltima: s.vUltima,
              pvPct: s.pvPct,
              fpsReal: s.fpsReal,
              unidad: s.unidad,
              calidad: s.calidad.nivel,
              motivos: s.calidad.motivos.join('|'),
              romM: captura.revisionEscala?.romM,
              escalaDudosa: captura.revisionEscala ? !captura.revisionEscala.ok : undefined,
              sAnadidos,
              sMaquina,
              nota: '',
            }
            setGuardadas(anadirATanda(fila).length)
            setUltimoAviso(
              s.reps.length === reps
                ? `Guardada. ${s.reps.length} repeticiones, como dijiste.`
                : `Guardada, pero contó ${s.reps.length} y tú dijiste ${reps}. Eso es el dato.`,
            )
          }

          return (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <span className="flex items-baseline gap-2">
                  <b className="font-mono text-2xl tabular-nums text-texto">
                    {s.vPrimera.toFixed(3)}
                  </b>
                  <span className="text-xs text-tenue">v₁ {s.unidad}</span>
                </span>
                <span className="flex items-baseline gap-2">
                  <b className="font-mono text-2xl tabular-nums text-texto">
                    {s.pvPct.toFixed(1)}
                  </b>
                  <span className="text-xs text-tenue">%PV</span>
                </span>
                <span className="font-mono text-xs text-tenue">
                  {s.reps.length} reps · {s.fpsReal.toFixed(0)} fps ·{' '}
                  {(s.deteccion * 100).toFixed(0)} % detectado
                </span>
              </div>

              {s.calidad.motivos.length > 0 && (
                <p className="font-mono text-xs text-ambar">{s.calidad.motivos.join(' · ')}</p>
              )}

              <button
                type="button"
                onClick={guardar}
                className="min-h-12 rounded-xl bg-rojo px-4 text-sm font-bold text-white"
              >
                Guardar medición
              </button>

              {ultimoAviso && <p className="text-xs text-tenue">{ultimoAviso}</p>}
              <p className="text-xs text-tenue">
                {guardadas} en la tanda · se exportan desde{' '}
                <b className="text-texto">Entrenar → Encoder</b>.
              </p>
            </div>
          )
        }}
      </Visor>

      {/* No se puede cerrar a propósito: la prueba de gravedad todavía no ha
          aprobado, así que estas cifras juzgan la herramienta, no el entreno. */}
      <p className="mt-4 rounded-xl border border-ambar/40 bg-ambar/10 p-3 text-xs text-texto">
        <b className="text-ambar">Provisional.</b> Estos números sirven para ver si la
        herramienta funciona en el gimnasio. No entran en tu historial ni deciden cargas.
      </p>
    </Sheet>
  )
}
