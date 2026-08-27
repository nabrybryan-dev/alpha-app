import { useRef, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { importarMedida, origenDe } from './importarMedida'
import { Palancas } from './Palancas'
import type { MedidaDePalancas } from './medidaDePalancas'

/**
 * Cargar una medida de palancas y verla.
 *
 * Vive en el laboratorio y no en la hoja de medición porque **hoy la medida no
 * se produce aquí**: sale de `exportar-medida.mjs`, en el repo de herramientas,
 * que necesita ONNX y cerca de un minuto de CPU por vídeo. Ponerlo en la hoja
 * prometería al asesorado un botón que no existe.
 *
 * ## Qué NO guarda
 *
 * Nada. La medida vive en memoria mientras la pantalla está abierta y se va al
 * cerrarla. No es descuido: **son medidas de una persona concreta** —el brazo de
 * momento de su cadera, fotograma a fotograma— y este repo tiene una regla clara
 * sobre dónde no van los datos de asesorados. Guardarlas en `localStorage` las
 * dejaría en el dispositivo sin que nadie hubiera decidido que se quedaran, y
 * además no caben: cada medida pesa entre 350 KB y 1,3 MB.
 */

export function PanelPalancas() {
  const [medida, setMedida] = useState<MedidaDePalancas | null>(null)
  const [origen, setOrigen] = useState<{ video?: string; ejercicio?: string }>()
  const [problema, setProblema] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return
    setProblema(null)
    const texto = await archivo.text()
    const r = importarMedida(texto)
    if (!r.ok) {
      setMedida(null)
      setProblema(r.problema)
      return
    }
    setMedida(r.medida)
    setOrigen(origenDe(texto))
  }

  return (
    <div className="space-y-3">
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <b className="text-sm">Palancas</b>
            <p className="mt-0.5 text-[11.5px] leading-snug text-tenue">
              La medida se produce fuera, con{' '}
              <code className="font-mono">exportar-medida.mjs</code>. Aquí se abre.
            </p>
          </div>
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            className="press min-h-11 shrink-0 rounded-full border border-linea px-4 text-[12.5px] font-bold text-texto"
          >
            {medida ? 'Abrir otra' : 'Abrir medida'}
          </button>
        </div>
        <input
          ref={entrada}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Abrir medida de palancas"
          onChange={(e) => {
            void alElegir(e.target.files?.[0])
            // Permite volver a elegir el mismo archivo después de un fallo.
            e.target.value = ''
          }}
        />
        {problema && (
          <p className="border-l-[3px] border-l-[var(--placa-muerta)] pl-3 text-[12.5px] leading-snug text-tenue">
            {problema}
          </p>
        )}
        {origen?.ejercicio && (
          <p className="font-mono text-[11px] text-tenue">
            {origen.ejercicio}
            {origen.video && ` · vídeo ${origen.video}`}
          </p>
        )}
      </Card>

      {medida && <Palancas medida={medida} />}
    </div>
  )
}
