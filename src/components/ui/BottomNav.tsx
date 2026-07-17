import { NavLink } from 'react-router-dom'

const pestanas = [
  { ruta: '/', etiqueta: 'Hoy', icono: '⌂' },
  { ruta: '/entrenar', etiqueta: 'Entrenar', icono: '🏋' },
  { ruta: '/bienestar', etiqueta: 'Bienestar', icono: '♥' },
  { ruta: '/nutricion', etiqueta: 'Nutrición', icono: '🍽' },
  { ruta: '/chat', etiqueta: 'Chat', icono: '💬' },
]

export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-bg/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {pestanas.map((p) => (
          <NavLink
            key={p.ruta}
            to={p.ruta}
            end={p.ruta === '/'}
            className={({ isActive }) =>
              `flex min-w-16 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wide ${
                isActive ? 'text-rojo' : 'text-tenue'
              }`
            }
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {p.icono}
            </span>
            {p.etiqueta}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
