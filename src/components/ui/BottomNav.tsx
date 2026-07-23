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

const pestanas = [
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
    ruta: '/bienestar',
    etiqueta: 'Bienestar',
    icono: (
      <Icono>
        <path d="M12 20.5S4 15 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5c0 5.5-8 11-8 11Z" />
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
  {
    ruta: '/chat',
    etiqueta: 'Chat',
    icono: (
      <Icono>
        <path d="M21 12a8 8 0 0 1-8 8c-1.4 0-2.8-.3-4-1l-5 1 1.3-4.4A8 8 0 1 1 21 12Z" />
      </Icono>
    ),
  },
]

export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 z-40 flex justify-center px-3"
      style={{ bottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}
    >
      <div className="glass glass-blur flex w-full max-w-[22rem] items-stretch gap-0.5 rounded-full px-1.5 py-1.5">
        {pestanas.map((p) => (
          <NavLink
            key={p.ruta}
            to={p.ruta}
            end={p.ruta === '/'}
            className={({ isActive }) =>
              `press relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-0.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] transition-colors duration-200 ease-salida ${
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
