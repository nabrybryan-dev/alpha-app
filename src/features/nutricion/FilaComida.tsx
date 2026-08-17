import type { RegistroComida } from '../../domain/types'

/**
 * Una comida del día en el diario.
 *
 * Enseña lo REGISTRADO. El plan de Alpha fija los macros del día entero, no de
 * cada comida, así que no hay un "de X kcal" por comida que sea verdad: se deja
 * fuera en vez de repartir el total a partes iguales, que sería inventarse una
 * precisión que el plan no tiene.
 */

const NOMBRES: Record<RegistroComida['comida'], string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  cena: 'Cena',
  snack: 'Snack',
}

interface FilaComidaProps {
  comida: RegistroComida
  kcal: number
  /** Los nombres de lo que metió, para el resumen de una línea. */
  resumen: string
  /**
   * Si se enseña el total de la comida.
   *
   * Apagar el contador de arriba y dejar estas cuatro cifras no protege a nadie:
   * sumarlas de cabeza es justo el gesto que el interruptor quiere evitar. La
   * fila sigue diciendo qué comió y si está registrada — se va el número, no el
   * diario.
   */
  verKcal: boolean
  onAbrir: () => void
}

const hora = (momentoIso: string) => momentoIso.slice(11, 16)

export function FilaComida({ comida, kcal, resumen, verKcal, onAbrir }: FilaComidaProps) {
  const vacia = comida.items.length === 0
  const estado = vacia ? 'sin registrar' : verKcal ? `${kcal} kcal` : 'registrado'

  return (
    <button
      type="button"
      onClick={onAbrir}
      // Sin esto la fila entera sale sin nombre en el arbol de accesibilidad:
      // todo su contenido son <span> anidados, y un lector de pantalla anuncia
      // cuatro botones indistinguibles.
      aria-label={`${NOMBRES[comida.comida]}, ${estado}`}
      className="press flex w-full items-center gap-3 rounded-2xl border border-linea bg-surface-1 p-3 text-left transition-colors hover:border-accion/40"
    >
      <span className="cifras w-11 shrink-0 text-xs text-tenue">{hora(comida.momentoIso)}</span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-texto">{NOMBRES[comida.comida]}</span>
        <span className="block truncate text-[11px] text-tenue">
          {vacia ? 'Sin nada anotado todavía' : resumen}
        </span>
      </span>

      {verKcal && (
        <span className="shrink-0 text-right">
          <span className="cifras block text-sm font-bold text-texto">
            {vacia ? '—' : kcal.toLocaleString('es-CO')}
          </span>
          <span className="block text-[9px] uppercase tracking-wide text-tenue">kcal</span>
        </span>
      )}

      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${vacia ? 'bg-surface-3' : 'bg-logrado'}`}
      />
      <span className="sr-only">{vacia ? 'pendiente' : 'registrada'}</span>
    </button>
  )
}
