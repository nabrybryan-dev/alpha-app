import type { ReactNode } from 'react'

interface SheetProps {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

/**
 * LA HOJA SUBE, y hasta hoy se teletransportaba.
 *
 * `if (!abierto) return null` hacía que el atenuador y el panel aparecieran en
 * UN fotograma, sin nada que dijera de dónde salían. Y no era el caso de una
 * pantalla despistada: **once sitios usan esta hoja** —generar microciclo,
 * cuestionarios, la hoja de medición del encoder, las demos de la sesión y
 * cinco de nutrición— y ninguno tenía entrada, porque el primitivo no la tenía.
 * Sus dos hermanos que sí se mueven —el test post y el corte entre ejercicios—
 * la tenían escrita a mano cada uno por su lado.
 *
 * Las dos clases ya existían en `tokens.css` con su porqué: el atenuador funde
 * en 320 ms y la hoja sube 40 px en 420 con `--ease-cajon`, la curva que este
 * repo reserva para lo que llega con peso. Aquí solo se enchufan.
 *
 * ## Por qué es seguro incluso en la hoja de la cámara
 *
 * `HojaMedicion` es una de las once, o sea que esto mete 420 ms de `translate`
 * en el montaje del visor de captura. Es seguro por una razón concreta y no por
 * optimismo: el bucle de captura **no existe todavía** cuando la animación
 * termina. `bucle()` no se llama hasta que `getUserMedia` y las medidas del
 * vídeo resuelven, y eso tarda bastante más que 420 ms — hay permiso de cámara y
 * arranque de flujo por medio. Cuando el bucle empieza a pedir fotogramas, la
 * hoja lleva rato quieta.
 *
 * ## Lo que NO entra aquí
 *
 * La salida. Sigue siendo instantánea, y es deliberado: animarla exige estado
 * interno y retrasar el `onCerrar` unos 240 ms, y eso cambia el comportamiento
 * de los once consumidores a la vez — alguno guarda al cerrar. La entrada es
 * gratis; la salida hay que pensarla consumidor a consumidor.
 */
export function Sheet({ abierto, titulo, onCerrar, children }: SheetProps) {
  if (!abierto) return null
  return (
    // El `z-50` que había aquí no decía nada: era un número más alto que el resto
    // y ya. Ahora el atenuador y la hoja viven en capas con nombre, y se ve de un
    // vistazo que la hoja va por encima de su propio atenuador y los dos por
    // encima de la barra inferior.
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 'var(--z-hoja)' }}
      role="dialog"
      aria-label={titulo}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="scrim-entra absolute inset-0 bg-black/60"
        style={{ zIndex: 'var(--z-scrim)' }}
      />
      <div
        className="subir-hoja relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-linea bg-surface-1 p-5 pb-8"
        style={{ zIndex: 'var(--z-hoja)' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-3" aria-hidden="true" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-texto">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar panel"
            className="h-9 w-9 rounded-full border border-linea bg-surface-2 text-tenue"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
