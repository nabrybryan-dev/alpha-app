import { useEffect } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { BottomNav, type EspaciosNav } from '../components/ui/BottomNav'
import { TopBar } from '../components/ui/TopBar'
import { db, hoyIso } from '../data/dbInstance'
import { revisarRecordatorioBienestar } from '../features/bienestar/recordatorio'
import { useCapacidades } from '../features/coach/consola/useCapacidades'
import { BannerPlanHoy } from '../features/plan/BannerPlanHoy'
import { useSesion } from './SessionProvider'

const titulos: Record<string, string> = {
  '/': 'Hoy',
  '/entrenar': 'Entrenar',
  '/bienestar': 'Bienestar',
  '/nutricion': 'Nutrición',
  '/progreso': 'Progreso',
  '/chat': 'Chat',
  '/logros': 'Logros',
  '/contenidos': 'Contenidos',
  '/cuestionarios': 'Cuestionarios',
  '/marca': 'Marca',
  '/equipo': 'Equipo',
  '/mi-entreno': 'Mi entreno',
  '/equipo-nutricion': 'Nutrición',
  '/mi-plan': 'Mi plan',
}

function tituloDe(ruta: string, esStaff = false): string {
  const base = `/${ruta.split('/')[1] ?? ''}`
  if (esStaff && base === '/') return 'Mi día'
  return titulos[base] ?? 'Alpha'
}

/** El staff que también entrena (Manuela) navega por sus cinco espacios; Bryan, por los suyos. */
function espaciosDe(rol: string): EspaciosNav {
  return rol === 'nutricionista' || rol === 'coach' ? 'staff' : 'asesorado'
}

/**
 * Lo que abre el coach de la app «de asesorado»: sus espacios del teléfono —Mi día, Mi entreno
 * (con el salón, que cuelga de él), Equipo y la nutrición del equipo—. Todo lo demás —su
 * progreso, el chat de asesorado…— es de quien es asesorado, y el coach vuelve a su panel.
 */
function esRutaPropiaDelCoach(ruta: string): boolean {
  return (
    ruta === '/' ||
    ruta === '/mi-entreno' ||
    ruta === '/equipo' ||
    ruta === '/equipo-nutricion' ||
    ruta === '/entrenar' ||
    ruta.startsWith('/entrenar/')
  )
}

type Tiene = ReturnType<typeof useCapacidades>['tiene']

function puedeEstrategia(tiene: Tiene): boolean {
  return tiene('revisar_creadores') || tiene('responder_mercadeo') || tiene('decisiones_compartidas')
}

/** La barra de Bryan es la de Manuela; Estrategias y Administración siguen a SUS capacidades. */
function BottomNavCoach() {
  const { cargando, tiene } = useCapacidades()
  return (
    <BottomNav
      espacios="staff"
      opcionesCoach={{
        estrategias: !cargando && puedeEstrategia(tiene),
        administracion: !cargando && tiene('ver_administracion'),
      }}
    />
  )
}

/**
 * Las rutas que SON la pantalla entera y por eso no llevan cabecera.
 *
 * `/entrenar` es el salón: se monta `fixed inset-0` y ocupa todo. La `TopBar` es
 * `sticky top-0 z-40` y el salón vive en `--z-elevado` (20), así que la cabecera
 * quedaba apilada POR ENCIMA del sujeto y escribía sobre él el «Entrenar», las
 * iniciales del asesorado y el número de mensajes sin leer. Es justo lo que la
 * regla de la vista inicial prohibe: arriba no hay texto suelto.
 *
 * Se oculta la cabecera en vez de subir el salón porque el salón NO puede subir:
 * `--z-nav` (40) tiene que seguir por encima —una pantalla que se come la
 * navegación deja al asesorado sin salida— y ahí es donde vive la `BottomNav`,
 * que es la que da la salida de esta ruta. Ocultarla además ahorra el
 * `backdrop-filter` de su cristal, que se seguiría pagando debajo de un salón
 * opaco, y deja de haber botones enfocables con el tabulador detrás del salón.
 */
const RUTAS_SIN_CABECERA: readonly string[] = ['/entrenar']

function llevaCabecera(ruta: string): boolean {
  return !RUTAS_SIN_CABECERA.includes(ruta)
}

export function AsesoradoLayout() {
  const { usuario } = useSesion()
  const { pathname } = useLocation()
  const { cargando, tiene } = useCapacidades()

  // Recordatorio de las 6 pm: al abrir la app, al volver a ella y cada 10 min
  // mientras esté abierta. Solo dispara si falta el check-in de hoy.
  useEffect(() => {
    if (usuario.rol === 'coach') return
    const revisar = () => {
      const hoy = hoyIso()
      const hecho = db.bienestar.byUsuario(usuario.id).some((c) => c.fecha === hoy)
      void revisarRecordatorioBienestar(hecho, hoy)
    }
    revisar()
    const alVolver = () => {
      if (document.visibilityState === 'visible') revisar()
    }
    document.addEventListener('visibilitychange', alVolver)
    const id = window.setInterval(revisar, 10 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.clearInterval(id)
    }
  }, [usuario.id, usuario.rol])

  // Bryan (cuenta personal): «/» es Mi día y Mi entreno es suyo; cualquier otra pantalla de asesorado lo
  // devuelve a su inicio. La cuenta «Alpha» (capacidad `solo_tablero`) no tiene espacios: solo el tablero.
  const esCoach = usuario.rol === 'coach'
  if (esCoach && cargando) return <ComprobandoAcceso />
  if (esCoach && tiene('solo_tablero')) return <Navigate to="/tablero" replace />
  if (esCoach && !esRutaPropiaDelCoach(pathname)) return <Navigate to="/" replace />
  const esStaff = usuario.rol === 'nutricionista' || esCoach

  return (
    <div className="min-h-dvh bg-bg">
      {llevaCabecera(pathname) && <TopBar titulo={tituloDe(pathname, esStaff)} />}
      {esStaff && llevaCabecera(pathname) && <BannerPlanHoy />}
      {/* overflow-x-clip: ningún pseudo-elemento o borde debe generar scroll
          horizontal; el TopBar (sticky) y la BottomNav (fija) van fuera de main. */}
      <main className="mx-auto max-w-lg overflow-x-clip px-4 pb-28 pt-4">
        <Outlet />
      </main>
      {esCoach ? <BottomNavCoach /> : <BottomNav espacios={espaciosDe(usuario.rol)} />}
    </div>
  )
}

function ComprobandoAcceso({ texto = 'Comprobando tu acceso…' }: { texto?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg text-sm text-tenue" aria-busy="true">
      {texto}
    </div>
  )
}

/**
 * «/tablero»: la consola del coach en pantalla completa, para la cuenta «Alpha» (capacidad `solo_tablero`),
 * en los dos computadores. Sin barra de espacios ni enlaces de panel. Lo abre el coach o quien tenga
 * `leer_entrenamiento` (la misma regla de la consola); cualquier otra persona vuelve a su inicio. Va tras
 * el login como todo lo demás: sin sesión no hay datos de salud a la vista.
 */
export function TableroLayout() {
  const { usuario } = useSesion()
  const { cargando, tiene } = useCapacidades()
  const esCoach = usuario.rol === 'coach'
  if (!esCoach && cargando) return <ComprobandoAcceso texto="Comprobando tu acceso al tablero…" />
  if (!esCoach && !tiene('leer_entrenamiento')) return <Navigate to="/" replace />
  // La cuenta Alpha no tiene a dónde volver; la personal sí.
  const puedeVolver = esCoach && !cargando && !tiene('solo_tablero')
  return (
    <div className="min-h-dvh bg-bg">
      <TopBar titulo="Alpha · Tablero" />
      <main className="mx-auto max-w-[1600px] overflow-x-clip px-4 pb-8 pt-4">
        {puedeVolver && (
          <Link to="/" className="mb-2 inline-flex min-h-[44px] items-center underline">
            Volver a mis espacios
          </Link>
        )}
        <Outlet />
      </main>
    </div>
  )
}

export function CoachLayout() {
  const { usuario } = useSesion()
  const { pathname } = useLocation()
  const { cargando, tiene } = useCapacidades()
  const esCoach = usuario.rol === 'coach'
  const enConsola = pathname.startsWith('/coach/consola')
  const enCreadores = pathname.startsWith('/coach/creadores')
  const enEstrategias = pathname.startsWith('/coach/estrategias')
  const enAdmin = pathname.startsWith('/coach/administracion')

  // La cuenta «Alpha» (`solo_tablero`) no tiene panel: todo lo que cuelga de /coach la lleva al tablero.
  // Mientras se consulta la capacidad no se pinta nada del panel (ni se echa a quien no toca).
  if (esCoach && cargando) return <ComprobandoAcceso />
  if (esCoach && tiene('solo_tablero')) return <Navigate to="/tablero" replace />

  // Administración del COACH también va por capacidad: sin `ver_administracion` no la ve (ni en la
  // barra ni en el marco) y, si llega por la URL, se le dice «sin permiso» en vez de la pantalla.
  if (esCoach && enAdmin) {
    if (!tiene('ver_administracion')) {
      return (
        <div className="min-h-dvh bg-bg">
          <TopBar titulo="Administración" />
          <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
            <p role="alert" className="rounded-tarjeta border border-dashed border-linea p-4 text-sm text-tenue">
              Sin permiso: la administración se abre con el permiso de ver la administración, y todavía no lo tienes.
            </p>
            <Link to="/coach" className="mt-3 inline-flex min-h-[44px] items-center underline">Volver</Link>
          </main>
          <BottomNavCoach />
        </div>
      )
    }
  }

  // La CONSOLA se abre por capacidad, no por rol (decisión de Bryan, 26-sep): el staff con
  // `leer_entrenamiento` (Manuela) entra a /coach/consola; el resto del panel del coach
  // sigue siendo solo del coach. Mientras la capacidad se consulta no se decide nada —ni
  // se abre «por si acaso» ni se echa a quien sí la tiene—; sin ella, a la portada.
  // El tablero de CREADORES (0090) sigue la misma regla con su propia capacidad:
  // `revisar_creadores`, no `leer_entrenamiento`.
  if (!esCoach) {
    if (!enConsola && !enCreadores && !enAdmin && !enEstrategias) return <Navigate to="/" replace />
    if (cargando) {
      return (
        <div className="grid min-h-dvh place-items-center bg-bg text-sm text-tenue" aria-busy="true">
          Comprobando tu acceso a la consola…
        </div>
      )
    }
    if (enConsola && !tiene('leer_entrenamiento')) return <Navigate to="/" replace />
    if (enCreadores && !tiene('revisar_creadores')) return <Navigate to="/" replace />
    // Cada espacio de Manuela tiene su propia puerta, con capacidades que ya existen en la base
    // (Manuela ya tiene también `ver_administracion`): Estrategias con el buzón de mercadeo o el
    // tablero de creadores; Administración con el plan, las decisiones o `ver_administracion`. El
    // tablero de la 0102 se pide dentro de la pantalla: sin el permiso dice «sin permiso»; con él
    // pero sin la tabla (0102 sin aplicar), «pendiente de activar».
    if (enEstrategias && !tiene('responder_mercadeo') && !tiene('revisar_creadores')) return <Navigate to="/" replace />
    if (enAdmin && !tiene('organizar_plan') && !tiene('decisiones_compartidas') && !tiene('ver_administracion')) {
      return <Navigate to="/" replace />
    }
  }

  // La consola necesita más ancho que el resto del panel: cartera lateral +
  // siete pestañas de contenido no caben en 3xl sin apretarse en escritorio.
  // El resto del panel del coach se queda como estaba.
  // A 1440/1280 px la rejilla de 12 columnas tiene que llenar el ancho: con 6xl (1152 px)
  // quedaban dos franjas vacías a los lados y las gráficas se apretaban.
  const anchoContenedor = pathname.startsWith('/coach/consola') ? 'max-w-[1600px]' : 'max-w-3xl'

  return (
    <div className="min-h-dvh bg-bg">
      <TopBar titulo={tituloCoachLayout(esCoach, { enConsola, enEstrategias, enCreadores, enAdmin })} />
      <nav className="mx-auto flex max-w-3xl flex-wrap gap-x-4 px-4 pt-3">
        {esCoach ? (
          <>
            <Link className="inline-flex min-h-[44px] items-center underline" to="/coach/revisiones">Revisar audios y vídeos</Link>
            <Link className="inline-flex min-h-[44px] items-center underline" to="/coach/asesorados">Cartera de asesorados</Link>
            <Link className="inline-flex min-h-[44px] items-center underline" to="/tablero">Tablero</Link>
            <Link className="inline-flex min-h-[44px] items-center underline" to="/coach/creadores">Creadores</Link>
            <Link className="inline-flex min-h-[44px] items-center underline" to="/coach/mi-plan">Mi plan</Link>
            <Link className="inline-flex min-h-[44px] items-center underline" to="/praxis">Praxis (solo equipo)</Link>
          </>
        ) : (
          <>
            <Link className="inline-flex min-h-[44px] items-center underline" to="/">Volver a mi app</Link>
            <Link className="inline-flex min-h-[44px] items-center underline" to="/praxis">Praxis (solo equipo)</Link>
          </>
        )}
      </nav>
      {(esCoach || enCreadores || enAdmin || enEstrategias) && <BannerPlanHoy />}
      {/* El staff (Manuela) conserva sus cinco espacios también dentro de la consola y del
          tablero de creadores: sin la barra, Equipo y Estrategia serían callejones. */}
      <main className={`mx-auto overflow-x-clip px-4 pb-28 pt-4 ${anchoContenedor}`}>
        <Outlet />
      </main>
      {/* Bryan (cuenta personal): la misma barra de cinco espacios que Manuela, en celular y en escritorio. */}
      {esCoach ? (
        <BottomNavCoach />
      ) : (
        <BottomNav espacios={espaciosDe(usuario.rol)} />
      )}
    </div>
  )
}

function tituloCoachLayout(
  esCoach: boolean,
  en: { enConsola: boolean; enEstrategias: boolean; enCreadores: boolean; enAdmin: boolean },
): string {
  if (esCoach) {
    if (en.enConsola) return 'Alpha · Asesorados'
    if (en.enEstrategias || en.enCreadores) return 'Estrategia'
    if (en.enAdmin) return 'Administración'
    return 'Panel del coach'
  }
  if (en.enEstrategias) return 'Estrategias'
  if (en.enAdmin) return 'Área administrativa'
  if (en.enCreadores) return 'Creadores'
  return 'Consola del equipo'
}
