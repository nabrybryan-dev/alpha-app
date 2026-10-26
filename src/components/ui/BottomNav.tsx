import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[22px] w-[22px]"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const pestanasAsesorado = [
  {
    ruta: '/',
    etiqueta: 'Hoy',
    icono: (
      <Icono>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </Icono>
    ),
  },
  {
    ruta: '/entrenar',
    etiqueta: 'Entrenar',
    icono: (
      <Icono>
        <path d="M6.5 6.5v11M17.5 6.5v11" />
        <path d="M3.5 9v6M20.5 9v6" />
        <path d="M6.5 12h11" />
      </Icono>
    ),
  },
  {
    // Bienestar salió de la barra y su contenido se repartió: el check-in está en Hoy,
    // el historial y las medidas en Progreso, y lo semanal en Semana (paso 6). La ruta
    // `/bienestar` sigue viva como detalle, pero ya no ocupa una pestaña.
    ruta: '/semana',
    etiqueta: 'Semana',
    icono: (
      <Icono>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </Icono>
    ),
  },
  {
    ruta: '/nutricion',
    etiqueta: 'Nutrición',
    icono: (
      <Icono>
        <path d="M5 3v7a2.5 2.5 0 0 0 5 0V3" />
        <path d="M7.5 3v18" />
        <path d="M16.5 3c-1.7 1.2-2.5 3.4-2.5 6 0 2 1 3 2.5 3V21" />
      </Icono>
    ),
  },
  // Progreso ocupa el sitio que tenía el chat: al coach se llega desde la
  // tarjeta de su último mensaje en Hoy, que además enseña lo que escribió.
  {
    ruta: '/progreso',
    etiqueta: 'Progreso',
    icono: (
      <Icono>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </Icono>
    ),
  },
]

/**
 * Los cinco ESPACIOS del staff (maqueta 7, pasos 9-11), en el orden de la barra del equipo:
 *
 *   · Mi día (/): su Hoy con la banda de trabajo de los tres sombreros.
 *   · Equipo (/equipo): la cartera única y su ficha.
 *   · Bandeja (/bandeja): tareas, mensajes y firmas.
 *   · Empresa (/empresa): las herramientas de los tres sombreros, según sus permisos
 *     (dentro siguen vivas Estrategias y Administración, que antes eran pestañas propias).
 *   · Yo (/mi-entreno): su propio entreno. Se conserva con el nombre de la maqueta.
 *
 * Bienestar, Nutrición (la suya) y Progreso siguen existiendo: se llega desde Mi día.
 */
const pestanasStaff = [
  { ...pestanasAsesorado[0], etiqueta: 'Mi día' },
  {
    ruta: '/equipo',
    etiqueta: 'Equipo',
    icono: (
      <Icono>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 20c0-2.2 1.3-4 3.5-4.6" />
      </Icono>
    ),
  },
  {
    ruta: '/bandeja',
    etiqueta: 'Bandeja',
    icono: (
      <Icono>
        <path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="M3 13h5l1 3h6l1-3h5" />
      </Icono>
    ),
  },
  {
    ruta: '/empresa',
    etiqueta: 'Empresa',
    icono: (
      <Icono>
        <rect x="4" y="3" width="12" height="18" rx="1.5" />
        <path d="M16 9h4v12h-4M8 7h4M8 11h4M8 15h4" />
      </Icono>
    ),
  },
  {
    ruta: '/mi-entreno',
    etiqueta: 'Yo',
    icono: (
      <Icono>
        <circle cx="12" cy="7" r="3.5" />
        <path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      </Icono>
    ),
  },
]

export type EspaciosNav = 'asesorado' | 'staff'

export function BottomNav({
  espacios = 'asesorado',
}: { espacios?: EspaciosNav } = {}) {
  const pestanas = espacios === 'staff' ? pestanasStaff : pestanasAsesorado
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 flex justify-center px-3"
      // El `z-40` que estaba aquí a pelo pasa a nombrarse. Es el mismo número:
      // `--z-nav` se definió con 40 justamente para no mover esta barra.
      style={{ bottom: 'var(--hueco-nav)', zIndex: 'var(--z-nav)' }}
    >
      {/* El relieve va en las PESTAÑAS y no en el cristal. Un `transform` sobre una
          superficie con `backdrop-filter` le rompe el desenfoque —en tema claro la barra
          se quedaba en un pegote gris con las etiquetas lavadas—, y esa es la misma
          frontera que ya vigila `blur-solo-en-superficies-fijas`. Puesto en cada pestaña
          la profundidad se nota donde se toca, que es donde sirve. */}
      <div className="glass glass-blur flex w-full max-w-[24rem] items-stretch gap-0.5 rounded-full px-1.5 py-1.5">
        {pestanas.map((p) => (
          <NavLink
            key={p.ruta}
            to={p.ruta}
            end={p.ruta === '/'}
            // Cambiar de pestaña deja de ser un corte seco. Con la View
            // Transitions API la pieza cinemática que comparten Entrenar y
            // Progreso se transforma en vez de desaparecer y reaparecer, y las
            // pantallas que no la llevan cruzan con la misma curva y duración que
            // el resto de la app. Donde no esté soportada, navega igual.
            viewTransition
            className={({ isActive }) =>
              `relieve relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-0 py-1.5 text-[11px] font-bold uppercase tracking-[0.02em] ${
                isActive ? 'text-rojo' : 'text-tenue'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {p.icono}
                <span className="max-w-full truncate">{p.etiqueta}</span>
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-0.5 h-1 w-1 rounded-full bg-rojo transition-all duration-200 ease-salida ${
                    isActive ? 'opacity-100' : 'scale-50 opacity-0'
                  }`}
                />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
