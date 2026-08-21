import { useRef } from 'react'
import { useCaptura, type Ajustes } from './useCaptura'

/**
 * El instrumento: la imagen de la cámara, sus lecturas en vivo y el botón de
 * grabar. Vive aparte porque lo usan dos sitios —la hoja que se abre dentro de
 * una serie y la pantalla suelta— y un instrumento duplicado se arregla en un
 * sitio y se queda roto en el otro.
 *
 * Va oscuro siempre, como la pantalla de Entreno: es el aparato que miras a
 * tres metros con el teléfono apoyado en el suelo, no una tarjeta más.
 */

/**
 * Una lectura. Tipografía tabular: si los números bailan de ancho al cambiar de
 * cifra no se leen de reojo, y así es como se leen aquí.
 *
 * `principal` marca las tres que deciden si la toma sirve —fps, marcas y
 * ángulo—. Al mismo tamaño que las demás se perdían entre ellas.
 */
function Medida({
  nombre,
  valorRef,
  inicial = '—',
  principal = false,
}: {
  nombre: string
  valorRef: React.RefObject<HTMLElement | null>
  inicial?: string
  principal?: boolean
}) {
  return (
    <span className={`flex flex-col ${principal ? 'gap-0.5' : 'gap-0'}`}>
      <span
        className={`uppercase tracking-[0.14em] text-white/40 ${
          principal ? 'text-[9px]' : 'text-[8px]'
        }`}
      >
        {nombre}
      </span>
      <b
        ref={valorRef as React.RefObject<HTMLSpanElement>}
        className={`font-mono tabular-nums leading-none text-white ${
          principal ? 'text-lg' : 'text-xs font-normal text-white/70'
        }`}
      >
        {inicial}
      </b>
    </span>
  )
}

export type CapturaDelVisor = ReturnType<typeof useCaptura>

interface VisorProps {
  ajustes: Ajustes
  /** Recibe el mando de la captura para que quien lo pinta pueda leer el
   *  resultado y saber cuántos segundos costó la medición. */
  children?: (captura: CapturaDelVisor) => React.ReactNode
}

export function Visor({ ajustes, children }: VisorProps) {
  // Los nodos vivos son de quien los pinta. El bucle solo los escribe.
  const videoRef = useRef<HTMLVideoElement>(null)
  const capaRef = useRef<HTMLCanvasElement>(null)
  const fpsRef = useRef<HTMLElement>(null)
  const pixelesRef = useRef<HTMLElement>(null)
  const marcasRef = useRef<HTMLElement>(null)
  const escalaRef = useRef<HTMLElement>(null)
  const anguloRef = useRef<HTMLElement>(null)
  const muestrasRef = useRef<HTMLElement>(null)
  const relojRef = useRef<HTMLElement>(null)

  const captura = useCaptura(ajustes, {
    video: videoRef,
    capa: capaRef,
    medidas: {
      fps: fpsRef,
      pixeles: pixelesRef,
      marcas: marcasRef,
      separacion: escalaRef,
      angulo: anguloRef,
      muestras: muestrasRef,
      reloj: relojRef,
    },
  })

  function alTocar(ev: React.MouseEvent<HTMLCanvasElement>) {
    const capa = ev.currentTarget
    // El lienzo se procesa a 640 px pero se ve al ancho que sea: sin esta regla
    // de tres, tocar la marca fijaría el color de otro sitio de la imagen.
    const r = capa.getBoundingClientRect()
    const x = Math.round(((ev.clientX - r.left) / r.width) * capa.width)
    const y = Math.round(((ev.clientY - r.top) / r.height) * capa.height)
    captura.fijarEn(x, y)
  }

  return (
    <>
      <section className="overflow-hidden rounded-panel border border-white/10 bg-[#0a0a0a] shadow-lg">
        <div className="relative bg-black" style={{ aspectRatio: '4 / 3' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-contain"
          />
          <canvas
            ref={capaRef}
            onClick={alTocar}
            className="absolute inset-0 h-full w-full"
          />
          {!captura.camaraAbierta && (
            <div className="absolute inset-0 grid place-items-center">
              <p className="px-8 text-center text-sm text-white/50">
                Abre la cámara y toca el disco de la barra para fijarlo.
              </p>
            </div>
          )}
          {captura.grabando && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rojo" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-white">
                grabando
              </span>
            </div>
          )}
        </div>

        {/* Se escriben por textContent desde el bucle: 60 renders por segundo
            hundirían los fps, y los fps son uno de los criterios. */}
        <div className="flex items-end gap-5 border-t border-white/10 px-4 pt-3">
          <Medida nombre="fps" valorRef={fpsRef} principal />
          <Medida nombre="marcas" valorRef={marcasRef} principal />
          <Medida nombre="ángulo" valorRef={anguloRef} principal />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 pb-3 pt-2">
          <Medida nombre="escala" valorRef={escalaRef} />
          <Medida nombre="píxeles" valorRef={pixelesRef} />
          <Medida nombre="muestras" valorRef={muestrasRef} inicial="0" />
          <Medida nombre="reloj" valorRef={relojRef} />
        </div>

        {captura.aviso && (
          <p className="border-t border-white/10 px-4 py-3 text-sm text-white/70">
            {captura.aviso}
          </p>
        )}

        <div className="border-t border-white/10 p-3">
          {!captura.camaraAbierta ? (
            <button
              type="button"
              onClick={captura.abrirCamara}
              className="min-h-14 w-full rounded-xl bg-rojo px-4 text-base font-bold text-white active:opacity-90"
            >
              Abrir cámara
            </button>
          ) : (
            <button
              type="button"
              disabled={!captura.listoParaGrabar}
              onClick={() => (captura.grabando ? captura.parar() : captura.empezar())}
              className={`min-h-14 w-full rounded-xl px-4 text-base font-bold transition-colors disabled:opacity-40 ${
                captura.grabando
                  ? 'bg-rojo text-white'
                  : 'border border-white/15 bg-white/10 text-white'
              }`}
            >
              {captura.grabando ? 'Parar y analizar' : 'Grabar'}
            </button>
          )}
        </div>
      </section>
      {children?.(captura)}
    </>
  )
}
