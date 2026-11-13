import { ID_DE_LA_CAPA } from './CapaPraxis'
import { alternarCapa, useCapaAbierta } from './estadoCapa'
import { TEXTOS_PENDIENTES as P } from './textos'

/**
 * El botón de Praxis de la barra con la bandera encendida: el agujero negro. En vez de navegar a `/praxis`,
 * abre o cierra la capa con UN toque. Ocupa el sitio y la forma de una pestaña de `BottomNav` (mismas clases),
 * así que la barra no cambia de medidas. Solo se monta con `PRAXIS_UN_TOQUE_ACTIVO`.
 */
export function BotonPraxisUnToque({ etiqueta, piel }: { etiqueta: string; piel?: 'maqueta' }) {
  const abierta = useCapaAbierta()
  // Piel de «Praxis a un toque» (maqueta del 11-nov, `.hoyo`): disco de 62 px que sobresale 24 de la barra,
  // borde rojo, anillos que giran (`.agujero-gira`, quieto con movimiento reducido) y el rótulo debajo.
  if (piel === 'maqueta') {
    return (
      <button
        type="button"
        data-piel="maqueta"
        onClick={alternarCapa}
        aria-expanded={abierta}
        aria-controls={ID_DE_LA_CAPA}
        aria-label={abierta ? P.botonAbierto : P.botonCerrado}
        className="relative flex w-[78px] flex-none flex-col items-center text-[11px] font-bold text-tenue"
      >
        <span
          data-hoyo
          className="-mt-6 grid h-[62px] w-[62px] place-items-center rounded-full border-[1.5px] border-rojo bg-[#0b0b10] text-rojo shadow-[0_6px_18px_rgba(0,0,0,.35)] transition-transform duration-300 active:scale-[.94]"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className="h-[42px] w-[42px]">
            <circle cx="12" cy="12" r="4.6" fill="#05050a" stroke="#a8a8ad" strokeWidth="0.9" />
            <g className="agujero-gira">
              <ellipse cx="12" cy="12" rx="10" ry="3.9" transform="rotate(-22 12 12)" />
              <ellipse cx="12" cy="12" rx="7" ry="2.5" transform="rotate(68 12 12)" opacity="0.5" />
            </g>
          </svg>
        </span>
        <span className="absolute inset-x-0 bottom-1 text-center">{etiqueta}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={alternarCapa}
      aria-expanded={abierta}
      aria-controls={ID_DE_LA_CAPA}
      aria-label={abierta ? P.botonAbierto : P.botonCerrado}
      className={`relieve relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-0 py-1.5 text-[11px] font-bold uppercase tracking-[0.02em] ${abierta ? 'text-rojo' : 'text-tenue'}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[22px] w-[22px]">
        <circle cx="12" cy="12" r="10" fill="#0b0b10" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.2" fill="#05050a" stroke="#a8a8ad" strokeWidth="0.9" />
        <path d="M12 4.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="max-w-full truncate">{etiqueta}</span>
    </button>
  )
}
