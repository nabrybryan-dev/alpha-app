import { useRef, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { guardarHuellaArticular } from './huellasArticulares'
import { importarMedida, origenDe } from './importarMedida'
import { importarPista } from './importarPista'
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

/**
 * @param ejercicio el que está escrito en el encoder. Una PISTA de pose se guarda como
 *   huella articular de ese ejercicio: sin nombre no hay dónde colgarla, y se dice.
 */
export function PanelPalancas({ ejercicio = '' }: { ejercicio?: string } = {}) {
  const [medida, setMedida] = useState<MedidaDePalancas | null>(null)
  const [huellaGuardada, setHuellaGuardada] = useState<string | null>(null)
  const [origen, setOrigen] = useState<{ video?: string; ejercicio?: string }>()
  const [problema, setProblema] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return
    setProblema(null)
    setHuellaGuardada(null)
    const texto = await archivo.text()
    // Dos archivos pueden entrar por aquí: la medida de `exportar-medida.mjs` y la pista
    // de `articulaciones.py`. La pista se reconoce por su forma y no pinta palancas: se
    // guarda como la huella articular del ejercicio, que es lo que el salón enseña.
    const pista = importarPista(texto)
    if (pista.ok) {
      const nombre = ejercicio.trim()
      if (!nombre) {
        setProblema('Eso es una pista de pose. Escribe arriba el ejercicio al que pertenece y vuelve a abrirla: se guarda por ejercicio.')
        return
      }
      guardarHuellaArticular(nombre, pista.huella)
      setHuellaGuardada(
        `Huella articular guardada para «${nombre}»: la última repetición de la pista, ${pista.huella.duracionSeg.toFixed(1)} s` +
          (pista.video ? ` (vídeo ${pista.video})` : '') +
          '. En el salón, el fantasma hace esa repetición.',
      )
      return
    }
    if (!pista.ok && pista.esPista) {
      setMedida(null)
      setProblema(pista.problema)
      return
    }
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
              <code className="font-mono">exportar-medida.mjs</code>. Aquí se abre. Una pista de{' '}
              <code className="font-mono">articulaciones.py</code> se guarda como huella del ejercicio.
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
          // Es el UNICO feedback del importador, y aparecia de golpe empujando
          // lo de abajo. Sube 8 px en 160 ms — no se usa `.aviso-registro`, que
          // hace este mismo gesto, porque sus 180 ms no estan en la escala y su
          // curva no es ninguna de las tres del sistema.
          <p
            style={{ animation: 'avisoSube var(--dur-toque) var(--ease-salida) both' }}
            className="border-l-[3px] border-l-[var(--placa-muerta)] pl-3 text-[12.5px] leading-snug text-tenue"
          >
            {problema}
          </p>
        )}
        {huellaGuardada && (
          <p
            style={{ animation: 'avisoSube var(--dur-toque) var(--ease-salida) both' }}
            className="border-l-[3px] border-l-[var(--acento)] pl-3 text-[12.5px] leading-snug text-tenue"
          >
            {huellaGuardada}
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
