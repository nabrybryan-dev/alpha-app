import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { useTema } from '../../app/ThemeProvider'
import { db, useDbVersion } from '../../data/dbInstance'

interface TopBarProps {
  titulo: string
}

export function TopBar({ titulo }: TopBarProps) {
  const { usuario, cambiarUsuario, esNube, cerrarSesion } = useSesion()
  const { tema, alternar } = useTema()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const navigate = useNavigate()
  useDbVersion()

  const noLeidos = db.mensajes.noLeidosPara(usuario.id)

  const elegirUsuario = (id: string) => {
    cambiarUsuario(id)
    setMenuAbierto(false)
    const elegido = db.usuarios.byId(id)
    navigate(elegido?.rol === 'coach' ? '/coach' : '/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-linea bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-lg border-2 border-rojo font-display text-sm text-rojo"
          >
            A
          </span>
          <h1 className="font-display text-base tracking-wide text-texto">{titulo}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={alternar}
            aria-label={tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            className="grid h-10 w-10 place-items-center rounded-full border border-linea bg-surface-2 text-base"
          >
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label="Cambiar usuario"
              aria-expanded={menuAbierto}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-linea bg-surface-2 text-xs font-bold text-texto"
            >
              {usuario.avatarIniciales}
              {noLeidos > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rojo px-1 text-[10px] font-bold text-white">
                  {noLeidos}
                </span>
              )}
            </button>
            {menuAbierto && esNube && (
              <div className="absolute right-0 top-12 w-56 rounded-2xl border border-linea bg-surface-1 p-2 shadow-xl">
                <p className="px-3 py-1 text-xs font-bold text-texto">{usuario.nombre}</p>
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-rojo active:bg-surface-2"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
            {menuAbierto && !esNube && (
              <div className="absolute right-0 top-12 w-56 rounded-2xl border border-linea bg-surface-1 p-2 shadow-xl">
                <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-tenue">
                  Ver la app como
                </p>
                {db.usuarios.list().map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => elegirUsuario(u.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                      u.id === usuario.id ? 'bg-rojo/10 text-rojo' : 'text-texto active:bg-surface-2'
                    }`}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-3 text-[10px] font-bold">
                      {u.avatarIniciales}
                    </span>
                    {u.nombre}
                    {u.rol === 'coach' && <span className="ml-auto text-[10px] uppercase text-tenue">Coach</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
