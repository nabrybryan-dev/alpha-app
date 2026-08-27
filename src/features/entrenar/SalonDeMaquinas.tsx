import { useState } from 'react'
import type { EjercicioPrescrito } from '../../domain/types'
import { salonDeMaquinas } from '../../domain/salonDeMaquinas'
import { temaDeEjercicio } from './slotThemes'

/**
 * La tira de máquinas de la sesión: cuáles ha abierto ya y cuáles le faltan.
 *
 * Cada ficha lleva el color y la fuente de SU máquina, así que la tira se lee
 * como el salón que va recorriendo y no como una barra de progreso genérica.
 * Apagada es una silueta; abierta se enciende con su acento.
 *
 * Se desbloquea registrando las series —nunca mirando—, y eso lo decide
 * `salonDeMaquinas`, no este componente.
 */
export function SalonDeMaquinas({ ejercicios }: { ejercicios: readonly EjercicioPrescrito[] }) {
  const salon = salonDeMaquinas(ejercicios)
  if (salon.total === 0) return null

  const abiertas = new Set(salon.abiertas)

  return (
    <div className="entrada flex items-center justify-between gap-3 rounded-[14px] border border-linea bg-surface-2 px-3 py-2">
      <div className="flex min-w-0 items-center gap-1.5">
        {ejercicios.map((ejercicio, i) => (
          <Ficha key={ejercicio.id} indice={i} abierta={abiertas.has(i)} />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {salon.completo ? (
          <Insignia ejercicios={ejercicios} />
        ) : (
          <span className="cifras text-[11px] font-bold text-silver-400">
            {salon.abiertas.length}/{salon.total} máquinas
          </span>
        )}
      </div>
    </div>
  )
}

/** Una máquina en miniatura: gabinete, ventana y palanca, con su color. */
function Ficha({ indice, abierta }: { indice: number; abierta: boolean }) {
  const tema = temaDeEjercicio(indice)
  return (
    <span
      title={tema.nombre}
      aria-label={`${tema.nombre}${abierta ? ', abierta' : ', pendiente'}`}
      // `transition-all` animaba las cuatro propiedades que se escriben justo
      // debajo, y tres son de pintado —el `boxShadow` es un halo que había que
      // re-rasterizar por ficha y por fotograma—. Además `all` mete en la
      // animación cualquier propiedad que alguien añada mañana sin decidirlo.
      // Se nombra solo la barata: la ficha se enciende al registrar series, o sea
      // decenas de veces por sesión, y en ese tramo el color puede cambiar seco.
      className="relative block h-[26px] w-[19px] shrink-0 rounded-[4px] border transition-opacity duration-toque ease-salida"
      style={{
        borderColor: abierta ? tema.acento : 'var(--linea)',
        background: abierta ? tema.cuerpo.fondo : 'transparent',
        opacity: abierta ? 1 : 0.45,
        boxShadow: abierta ? `0 0 8px -2px ${tema.acento}` : 'none',
      }}
    >
      {/* La ventana de carretes. */}
      <span
        className="absolute left-1/2 top-[6px] h-[9px] w-[13px] -translate-x-1/2 rounded-[2px]"
        style={{ background: abierta ? tema.ventana.fondo : 'var(--linea)' }}
      />
      {/* La palanca, al costado. */}
      <span
        className="absolute -right-[2px] top-[7px] h-[7px] w-[2px] rounded-full"
        style={{ background: abierta ? tema.acento : 'var(--linea)' }}
      />
    </span>
  )
}

/**
 * La insignia de salón completo, con la opción de compartirla.
 *
 * Compartir es SIEMPRE un toque de la persona y abre la hoja del sistema, donde
 * ella elige a dónde va y confirma. La app no publica nada por su cuenta ni
 * manda a ningún sitio: solo prepara el texto.
 */
function Insignia({ ejercicios }: { ejercicios: readonly EjercicioPrescrito[] }) {
  const [copiado, setCopiado] = useState(false)

  const texto = `Salón completo: ${ejercicios.length} de ${ejercicios.length} máquinas abiertas en Alfa Athletics.`

  const compartir = () => {
    // El nombre de los ejercicios NO viaja: es su programación. Va el recuento.
    if (navigator.share) {
      void navigator.share({ text: texto }).catch(() => {})
      return
    }
    void navigator.clipboard
      ?.writeText(texto)
      .then(() => {
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2200)
      })
      .catch(() => {})
  }

  return (
    <>
      <span
        className="insignia-salon cifras rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ background: 'var(--oro, #c8a24a)', color: '#1a1408' }}
      >
        Salón completo
      </span>
      <button
        type="button"
        onClick={compartir}
        aria-label="Compartir el salón completo"
        className="press grid shrink-0 place-items-center rounded-boton text-tenue"
        style={{ width: 44, height: 44 }}
      >
        {copiado ? (
          <span className="text-[10px] font-bold text-logrado">Copiado</span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
        )}
      </button>
    </>
  )
}
