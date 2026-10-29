import type { MotivoCerrada, VeredictoDeLaPuerta } from '../../domain/aprobacion/puerta'

const EXPLICACION: Record<MotivoCerrada, (n: number) => string> = {
  'sin-historial': () => 'Todavía no hay ninguna semana con borradores delante.',
  'faltan-semanas': (n) => `Llevas ${n} de 4 semanas seguidas sin corregir nada.`,
  'hubo-correccion': () => 'Corregiste algo la última semana, así que la cuenta empieza de nuevo.',
  'semana-floja': () =>
    'La última semana tuvo tan pocos borradores que no cuenta como prueba de nada.',
  'quedaron-sin-mirar': () =>
    'La última semana quedaron borradores sin abrir, y lo que nadie miró no está aprobado.',
}

/**
 * El estado de la puerta con su motivo. Solo pinta: el veredicto lo calcula `domain/aprobacion/puerta.ts`.
 * `nota` sustituye la frase de «puerta abierta» cuando la pantalla no puede prometer que algo salga solo.
 */
export function EstadoDeLaPuerta({ veredicto, nota }: { veredicto: VeredictoDeLaPuerta; nota?: string }) {
  return (
  <div
        data-puerta={veredicto.abierta ? 'abierta' : 'cerrada'}
        className="rounded-tarjeta border border-linea bg-ink-900 px-4 py-3"
      >
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">Salida automática</p>
        {veredicto.abierta ? (
          <>
            <p className="mt-1 text-sm font-semibold text-texto">
              Abierta desde la semana del {veredicto.desde}
            </p>
            {/* Se dice que se puede cerrar, y cómo. Una puerta que se abrió sola y de la que
                no se sabe salir es peor que no tenerla. */}
            <p className="mt-1 text-[11px] leading-snug text-tenue">
              {nota
                ? 'Cumple las cuatro semanas limpias. Corregir una revisión vuelve a cerrarla.'
                : 'Los borradores pueden salir sin que los mires. Corrige uno y vuelve a cerrarse.'}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm font-semibold text-texto">Cerrada</p>
            <p className="mt-1 text-[11px] leading-snug text-tenue">
              {EXPLICACION[veredicto.motivo](veredicto.semanasLimpias)}
            </p>
          </>
        )}
        {nota && <p className="mt-2 text-[11px] font-semibold leading-snug text-texto">{nota}</p>}
      </div>
  )
}
