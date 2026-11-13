import { ID_DE_LA_CAPA } from './CapaPraxis'
import { alternarCapa, useCapaAbierta } from './estadoCapa'
import { TEXTOS_PENDIENTES as P } from './textos'

/**
 * El botón de Praxis de la barra con la bandera encendida: el agujero negro. En vez de navegar a `/praxis`,
 * abre o cierra la capa con UN toque. Ocupa el sitio y la forma de una pestaña de `BottomNav` (mismas clases),
 * así que la barra no cambia de medidas. Solo se monta con `PRAXIS_UN_TOQUE_ACTIVO`.
 */
export function BotonPraxisUnToque({ etiqueta }: { etiqueta: string }) {
  const abierta = useCapaAbierta()
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
