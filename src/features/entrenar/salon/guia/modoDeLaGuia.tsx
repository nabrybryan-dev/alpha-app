import { useState } from 'react'

/**
 * SIMPLE O TÉCNICO en la guía de zonas. Es una preferencia del dispositivo (no de la persona en la
 * base): se recuerda en localStorage y, si el navegador no deja guardar, la guía se dibuja igual.
 * Por defecto es TÉCNICO, para que nadie vea un cambio sin pedirlo. No depende de
 * `perfil.vistaSimple`: quien la tiene no ve el salón.
 */
export type ModoDeLaGuia = 'simple' | 'tecnico'

export const LLAVE_MODO_DE_LA_GUIA = 'alpha-guia-modo'

function leerModo(): ModoDeLaGuia {
  try {
    return localStorage.getItem(LLAVE_MODO_DE_LA_GUIA) === 'simple' ? 'simple' : 'tecnico'
  } catch {
    return 'tecnico'
  }
}

export function useModoDeLaGuia(): [ModoDeLaGuia, (modo: ModoDeLaGuia) => void] {
  const [modo, setModo] = useState<ModoDeLaGuia>(leerModo)
  const elegir = (nuevo: ModoDeLaGuia) => {
    setModo(nuevo)
    try {
      localStorage.setItem(LLAVE_MODO_DE_LA_GUIA, nuevo)
    } catch {
      // Sin almacenamiento el modo vale solo mientras la guía esté abierta.
    }
  }
  return [modo, elegir]
}

const OPCIONES: readonly { id: ModoDeLaGuia; texto: string }[] = [
  { id: 'simple', texto: 'Simple' },
  { id: 'tecnico', texto: 'Técnico' },
]

/** Dos botones de al menos 44 px; el estado se dice con texto («Se ve así») y con aria-pressed, no solo con el aro. */
export function InterruptorSimpleTecnico({ modo, alElegir }: { modo: ModoDeLaGuia; alElegir: (m: ModoDeLaGuia) => void }) {
  return (
    <div role="group" aria-label="Cómo leer esta zona" className="mb-3 flex items-center gap-2">
      {OPCIONES.map((o) => {
        const activa = modo === o.id
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={activa}
            onClick={() => alElegir(o.id)}
            className="press min-h-[44px] min-w-[44px] rounded-xl border border-linea px-3 text-sm font-semibold"
            style={{
              color: activa ? 'var(--texto)' : 'var(--tenue)',
              boxShadow: activa ? 'inset 0 0 0 1.5px var(--texto)' : undefined,
            }}
          >
            {o.texto}
          </button>
        )
      })}
      <span className="text-[11px] text-tenue">{modo === 'simple' ? 'Palabras de todos los días' : 'Con nombres técnicos'}</span>
    </div>
  )
}
