import { destinoDeLaVuelta, etiquetaDeLaVuelta } from '../camara/vueltaDelCuerpo'

/**
 * «DAR LA VUELTA» (maqueta 7, `.sl-vuelta`): tecla redonda de 48 px, solo con su icono. Su nombre accesible dice qué se ve ahora y a dónde lleva. Sin mando
 * (`alDarLaVuelta`) no se pinta.
 */
export function BotonDarLaVuelta({
  azimut = 0,
  alDarLaVuelta,
}: {
  azimut?: number
  alDarLaVuelta?: (azimut: number) => void
}) {
  if (!alDarLaVuelta) return null
  return (
    <button
      type="button"
      aria-label={etiquetaDeLaVuelta(azimut)}
      onClick={() => alDarLaVuelta(destinoDeLaVuelta(azimut))}
      className="press tecla-2 !h-12 !min-h-12 !w-12 justify-self-center !rounded-full !p-0"
      style={{ color: 'var(--texto)' }}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-[22px] w-[22px] fill-none stroke-current"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" />
      </svg>
    </button>
  )
}
