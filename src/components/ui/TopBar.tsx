import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useHistoriaInterna } from '../../app/historiaInternaContexto'
import { buscarRuta, padreDe, tituloDeRuta } from '../../app/rutas'
import { useSesion } from '../../app/SessionProvider'
import { useTema } from '../../app/ThemeProvider'
import { db, useDbVersion } from '../../data/dbInstance'
import { usePuestoCoach } from '../../features/coach/consola/usePuestoCoach'
import { MarcaAguila } from './MarcaAguila'

interface TopBarProps {
  titulo: string
}

function IconoSol() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function IconoLuna() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  )
}

function IconoAtras() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-[26px] w-[26px] shrink-0" aria-hidden="true">
      <path d="m15 5-7 7 7 7" />
    </svg>
  )
}

export function TopBar({ titulo }: TopBarProps) {
  const { usuario, cambiarUsuario, esNube, cerrarSesion } = useSesion()
  const { tema, alternar } = useTema()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { anterior } = useHistoriaInterna()
  const { esCoach, cargando, tiene } = usePuestoCoach(usuario.rol)
  useDbVersion()

  // El «‹» único (04 §3.5). Hasta saber quién mira no se pinta: «Hoy» o «Mi día», y la cuenta Alpha (`solo_tablero`),
  // que no tiene a dónde volver, dependen de los permisos. Si la pantalla anterior es de la app (la cuenta la
  // lleva `HistoriaInterna`) vuelve a ELLA y la etiqueta dice cuál es; si no, al padre declarado en `rutas.ts`,
  // sustituyendo la entrada, así que nunca saca de la app.
  const esEquipo = usuario.rol === 'nutricionista' || esCoach
  const padre = cargando || (esCoach && tiene('solo_tablero')) ? null : padreDe(pathname, esEquipo)
  const previa = padre && anterior && anterior !== pathname ? buscarRuta(anterior) : undefined
  const destino = previa ? { titulo: tituloDeRuta(previa.patron, esEquipo) ?? padre?.titulo ?? '', atras: true } : padre ? { titulo: padre.titulo, atras: false } : null
  const volver = () => {
    if (!padre || !destino) return
    if (destino.atras) navigate(-1)
    else navigate(padre.patron, { replace: true })
  }

  const noLeidos = db.mensajes.noLeidosPara(usuario.id)

  const elegirUsuario = (id: string) => {
    cambiarUsuario(id)
    setMenuAbierto(false)
    const elegido = db.usuarios.byId(id)
    navigate(elegido?.rol === 'coach' ? '/coach' : '/')
  }

  return (
    <header className="glass-blur sticky top-0 z-40 border-b border-hairline bg-bg/80">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {destino ? (
            <button
              type="button"
              onClick={volver}
              aria-label={`Volver a ${destino.titulo}`}
              className="press -ml-2 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-0.5 rounded-full pl-1 pr-3 font-bold text-rojo"
            >
              <IconoAtras />
              <span className="max-w-[5.5rem] truncate text-sm">{destino.titulo}</span>
            </button>
          ) : (
            <MarcaAguila className="h-8 w-8 text-texto" />
          )}
          <h1 className="truncate font-display text-base tracking-wide text-texto">{titulo}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={alternar}
            aria-label={tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            className="press glass grid h-11 w-11 place-items-center rounded-full text-texto"
          >
            {tema === 'dark' ? <IconoSol /> : <IconoLuna />}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label="Cambiar usuario"
              aria-expanded={menuAbierto}
              className="press glass relative grid h-11 w-11 place-items-center rounded-full text-xs font-bold text-texto"
            >
              {usuario.avatarIniciales}
              {noLeidos > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rojo px-1 text-xs font-bold text-white">
                  {noLeidos}
                </span>
              )}
            </button>
            {menuAbierto && esNube && (
              <div className="entrada glass glass-blur absolute right-0 top-12 w-56 rounded-panel p-2 shadow-xl">
                <p className="px-3 py-1 text-xs font-bold text-texto">{usuario.nombre}</p>
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="press mt-1 min-h-[44px] w-full rounded-xl px-3 py-2 text-left text-sm text-rojo active:bg-surface-2"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
            {menuAbierto && !esNube && (
              <div className="entrada glass glass-blur absolute right-0 top-12 w-56 rounded-panel p-2 shadow-xl">
                <p className="px-3 py-1 text-xs uppercase tracking-widest text-tenue">
                  Ver la app como
                </p>
                {db.usuarios.list().map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => elegirUsuario(u.id)}
                    className={`press flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                      u.id === usuario.id ? 'bg-rojo/10 text-rojo' : 'text-texto active:bg-surface-2'
                    }`}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-3 text-xs font-bold">
                      {u.avatarIniciales}
                    </span>
                    {u.nombre}
                    {u.rol === 'coach' && <span className="ml-auto text-xs uppercase text-tenue">Coach</span>}
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
