import { matchPath } from 'react-router-dom'
import type { Capacidad } from '../data/consola/capacidadesStaff'
import type { Rol } from '../domain/types'

/**
 * LA TABLA ÚNICA DE RUTAS (paso 0 del rediseño, `REDISENO-APP-20261021/14-FASE3`).
 *
 * Cada ruta que existe hoy en `router.tsx` (más las que solo citan los avisos push, `avisos-plan` y
 * los scripts) tiene aquí UNA fila: su padre (a dónde vuelve el «‹»), su título y su guarda.
 *
 * Esta tabla es la red de seguridad de todo lo que viene después:
 *
 *   · `rutas.acceso.test.tsx` monta el router de verdad con cada rol y compara, ruta por ruta, lo que
 *     pasa con lo que dice `resolverAcceso` («entra» o «redirige a …»). Si alguien cambia una puerta en
 *     `layouts.tsx` o en una pantalla sin cambiar esta tabla (o al revés), el test se pone en rojo.
 *   · `rutas.inventario.test.ts(x)` exige que toda ruta del router esté aquí, que toda ruta citada por
 *     un aviso push, por `avisos-plan` o por `scripts/firmar-revisiones` exista y llegue a una pantalla,
 *     y que ninguna acabe en blanco.
 *
 * HOY esta tabla DESCRIBE las puertas; no las ejecuta: las ejecutan `layouts.tsx` y las propias
 * pantallas, sin cambios. Los pasos siguientes mueven las pantallas y dejan la ruta vieja como
 * redirección: entonces la fila vieja se queda (con `redirigeA`) y se añade la nueva. NO se borran filas
 * (relevo-sin-perdidas): los avisos push que ya salieron siguen abriendo `/mi-plan` y `/coach/mi-plan`.
 *
 * Rutas desconocidas: decisión de Bryan (23-oct): toda dirección que la app no conoce muestra «Esta
 * página no existe» con un botón a Hoy (la fila `/*`, que es la última del router). Antes se pintaba en blanco.
 */

/** Quién monta la ruta. Define el orden de las puertas (ver `resolverAcceso`). */
export type Marco =
  /** `AsesoradoLayout`: barra de espacios, cabecera y las puertas de `layouts.tsx`. */
  | 'asesorado'
  /** `CoachLayout` (`/coach/...`): panel del coach, y consola/creadores/estrategias/administración por capacidad. */
  | 'coach'
  /** `TableroLayout` (`/tablero`): la consola a pantalla completa. */
  | 'tablero'
  /** Pantalla propia, fuera de los layouts, con su guarda en la pantalla (`puedeVerPraxis`). */
  | 'praxis'
  /** Se abre SIN sesión (`rutasPublicas.ts`); no pasa por el router de la app. */
  | 'publica'
  /** La ruta comodín (`*`): toda dirección que la app no conoce. Fuera de los layouts; la ve cualquiera con sesión. */
  | 'comodin'

export interface Guarda {
  marco: Marco
  /**
   * Marco `asesorado`: la cuenta con ROL coach (la de Alpha sin `solo_tablero`) solo abre las rutas
   * «propias del coach» (`esRutaPropiaDelCoach`); lo demás la manda a «/».
   */
  propiaDelCoach?: boolean
  /**
   * Marco `asesorado`: puerta de la propia pantalla. Solo el equipo (nutricionista o quien ocupa el
   * puesto de coach) la abre; el resto va a `destino`.
   */
  soloEquipo?: { destino: string }
  /**
   * Marcos `coach` y `tablero`: capacidades con las que entra el equipo que NO ocupa el puesto de
   * coach (basta UNA). Vacío o ausente: solo quien ocupa el puesto de coach.
   */
  capacidades?: readonly Capacidad[]
  /** Marco `coach`: el coach entra, pero sin esta capacidad ve «Sin permiso» en vez de la pantalla. */
  coachNecesita?: Capacidad
  /** La ruta no pinta pantalla: manda a esta otra (pasa por sus puertas). */
  redirigeA?: string
}

export interface RutaApp {
  /** Patrón de react-router, con parámetros (`/coach/asesorado/:usuarioId`). */
  patron: string
  /** Una dirección concreta que cae en este patrón; la usan las pruebas. */
  ejemplo: string
  /** A dónde vuelve el «‹». `null`: raíz de una pestaña (no lleva «‹»). Debe ser otra fila, sin parámetros. */
  padre: string | null
  /** Igual que `padre`, pero para el equipo (Manuela y Bryan), cuyas pestañas son otras. */
  padreEquipo?: string | null
  /** Nombre visible: cabecera y texto del «‹» de las pantallas que vuelven aquí. */
  titulo: string
  /** El nombre para el equipo, si cambia (`/` es «Hoy» para el asesorado y «Mi día» para el equipo). */
  tituloEquipo?: string
  guarda: Guarda
}

const ASESORADO: Guarda = { marco: 'asesorado' }
const PROPIA: Guarda = { marco: 'asesorado', propiaDelCoach: true }
const SOLO_EQUIPO_A_RAIZ: Guarda = { marco: 'asesorado', soloEquipo: { destino: '/' } }
/** Los espacios del equipo que también abren la cuenta con rol coach (Equipo, ficha, Bandeja, Empresa). */
const EQUIPO: Guarda = { marco: 'asesorado', propiaDelCoach: true, soloEquipo: { destino: '/' } }

export const RUTAS: readonly RutaApp[] = [
  // ---- Marco del asesorado (`AsesoradoLayout`) ----
  { patron: '/', ejemplo: '/', padre: null, titulo: 'Hoy', tituloEquipo: 'Mi día', guarda: PROPIA },
  { patron: '/entrenar', ejemplo: '/entrenar', padre: null, padreEquipo: '/mi-entreno', titulo: 'Entrenar', guarda: PROPIA },
  { patron: '/entrenar/sesion/:sesionId', ejemplo: '/entrenar/sesion/s-1', padre: '/entrenar', titulo: 'Sesión', guarda: PROPIA },
  // La mesa del encoder es una herramienta de laboratorio del equipo (paso 2 del plan 14):
  // el asesorado mide DENTRO de la serie; esta pantalla no es suya.
  { patron: '/entrenar/encoder', ejemplo: '/entrenar/encoder', padre: '/entrenar', titulo: 'Encoder', guarda: { ...PROPIA, soloEquipo: { destino: '/entrenar' } } },
  { patron: '/bienestar', ejemplo: '/bienestar', padre: null, padreEquipo: '/', titulo: 'Bienestar', guarda: ASESORADO },
  { patron: '/semana', ejemplo: '/semana', padre: null, padreEquipo: '/', titulo: 'Semana', guarda: ASESORADO },
  { patron: '/progreso', ejemplo: '/progreso', padre: null, padreEquipo: '/', titulo: 'Progreso', guarda: ASESORADO },
  { patron: '/nutricion', ejemplo: '/nutricion', padre: null, padreEquipo: '/', titulo: 'Nutrición', guarda: ASESORADO },
  { patron: '/nutricion/plan', ejemplo: '/nutricion/plan', padre: '/nutricion', titulo: 'Mi plan de nutrición', guarda: ASESORADO },
  { patron: '/nutricion/al-dia', ejemplo: '/nutricion/al-dia', padre: '/nutricion', titulo: 'Al día', guarda: ASESORADO },
  { patron: '/chat', ejemplo: '/chat', padre: '/', titulo: 'Chat', guarda: ASESORADO },
  { patron: '/cuestionarios', ejemplo: '/cuestionarios', padre: '/', titulo: 'Cuestionarios', guarda: ASESORADO },
  { patron: '/contenidos', ejemplo: '/contenidos', padre: '/', titulo: 'Contenidos', guarda: ASESORADO },
  { patron: '/logros', ejemplo: '/logros', padre: '/', titulo: 'Logros', guarda: ASESORADO },
  // «Yo» (decisión de Bryan, 28-oct): avisos, buzón de comentarios y cambio de clave. Nada de salud. Se llega
  // desde el menú de cuenta de la cabecera. La cuenta con rol coach (la de Alpha, solo tablero) no entra.
  { patron: '/yo', ejemplo: '/yo', padre: '/', titulo: 'Yo', tituloEquipo: 'Mi cuenta', guarda: ASESORADO },
  { patron: '/marca', ejemplo: '/marca', padre: '/', titulo: 'Marca', guarda: { marco: 'asesorado', propiaDelCoach: true, soloEquipo: { destino: '/' } } },
  // Espacios del equipo (pestañas de su barra, sin «‹»): la propia pantalla manda al asesorado a su sitio.
  { patron: '/mi-entreno', ejemplo: '/mi-entreno', padre: null, titulo: 'Mi entreno', guarda: { marco: 'asesorado', propiaDelCoach: true, soloEquipo: { destino: '/entrenar' } } },
  { patron: '/equipo', ejemplo: '/equipo', padre: null, titulo: 'Equipo', guarda: EQUIPO },
  // La FICHA ÚNICA (paso 10): la misma pantalla para el coach y para Manuela. Lleva «‹» a Equipo.
  { patron: '/equipo/:usuarioId', ejemplo: '/equipo/u-valentina', padre: '/equipo', titulo: 'Ficha', guarda: EQUIPO },
  // La Bandeja (paso 9): tareas, mensajes y firmas de los tres sombreros. Es una pestaña de la
  // barra del equipo, así que es raíz y no lleva «‹».
  { patron: '/bandeja', ejemplo: '/bandeja', padre: null, titulo: 'Bandeja', guarda: EQUIPO },
  // Empresa (paso 11): las herramientas de los tres sombreros, según los permisos. También raíz.
  { patron: '/empresa', ejemplo: '/empresa', padre: null, titulo: 'Empresa', guarda: EQUIPO },
  { patron: '/equipo-nutricion', ejemplo: '/equipo-nutricion', padre: '/equipo', titulo: 'Nutrición del equipo', guarda: { marco: 'asesorado', propiaDelCoach: true, soloEquipo: { destino: '/' } } },
  { patron: '/equipo-nutricion/cifras', ejemplo: '/equipo-nutricion/cifras', padre: '/equipo-nutricion', titulo: 'Cifras', guarda: { marco: 'asesorado', propiaDelCoach: true, soloEquipo: { destino: '/' } } },
  // Mi plan de Manuela. Los avisos push de Manuela abren ESTA ruta: queda para siempre.
  { patron: '/mi-plan', ejemplo: '/mi-plan', padre: '/', titulo: 'Mi plan', guarda: SOLO_EQUIPO_A_RAIZ },

  // ---- Pantallas propias, fuera de los layouts (guarda en la pantalla) ----
  { patron: '/praxis', ejemplo: '/praxis', padre: '/', titulo: 'Praxis', guarda: { marco: 'praxis' } },
  { patron: '/praxis/ejemplo', ejemplo: '/praxis/ejemplo', padre: '/praxis', titulo: 'Praxis de ejemplo', guarda: { marco: 'praxis' } },
  { patron: '/praxis/ingreso-prueba', ejemplo: '/praxis/ingreso-prueba', padre: '/praxis', titulo: 'Prueba de ingreso', guarda: { marco: 'praxis' } },

  // ---- Tablero (`TableroLayout`) ----
  { patron: '/tablero', ejemplo: '/tablero', padre: '/', titulo: 'Tablero', guarda: { marco: 'tablero', capacidades: ['leer_entrenamiento'] } },

  // ---- Panel del coach (`CoachLayout`) ----
  // «/coach» no pinta nada: manda a «/» (la cuenta Alpha acaba en /tablero).
  { patron: '/coach', ejemplo: '/coach', padre: '/', titulo: 'Panel del coach', guarda: { marco: 'coach', redirigeA: '/' } },
  // La cartera vieja se retira como pantalla, no como dirección: `/coach/asesorados` redirige a
  // la cartera única `/equipo` (relevo-sin-perdidas). Sus avisos de datos y microciclos viven allí.
  { patron: '/coach/asesorados', ejemplo: '/coach/asesorados', padre: '/', titulo: 'Cartera de asesorados', guarda: { marco: 'coach', redirigeA: '/equipo' } },
  { patron: '/coach/asesorado/:usuarioId', ejemplo: '/coach/asesorado/u-valentina', padre: '/coach/asesorados', titulo: 'Asesorado', guarda: { marco: 'coach' } },
  { patron: '/coach/chat', ejemplo: '/coach/chat', padre: '/', titulo: 'Mensajes', guarda: { marco: 'coach' } },
  { patron: '/coach/consultas', ejemplo: '/coach/consultas', padre: '/', titulo: 'Consultas', guarda: { marco: 'coach' } },
  { patron: '/coach/consola', ejemplo: '/coach/consola', padre: '/', titulo: 'Consola', guarda: { marco: 'coach', capacidades: ['leer_entrenamiento'] } },
  // La firma de audios y vídeos. `scripts/firmar-revisiones` manda aquí: queda para siempre.
  { patron: '/coach/revisiones', ejemplo: '/coach/revisiones', padre: '/', titulo: 'Revisiones', guarda: { marco: 'coach' } },
  { patron: '/coach/creadores', ejemplo: '/coach/creadores', padre: '/', titulo: 'Creadores', guarda: { marco: 'coach', capacidades: ['revisar_creadores'] } },
  // Estrategias y Administración son herramientas del sombrero de Administración: Empresa las
  // agrupa y las enlaza, así que su «‹» vuelve allí. La barra del equipo sigue teniendo «Mi día»,
  // de modo que la salida de siempre no se pierde (zona 6 del plan 14).
  { patron: '/coach/estrategias', ejemplo: '/coach/estrategias', padre: '/empresa', titulo: 'Estrategias', guarda: { marco: 'coach', capacidades: ['responder_mercadeo', 'revisar_creadores'] } },
  {
    patron: '/coach/administracion',
    ejemplo: '/coach/administracion',
    padre: '/empresa',
    titulo: 'Administración',
    guarda: { marco: 'coach', capacidades: ['organizar_plan', 'decisiones_compartidas', 'ver_administracion'], coachNecesita: 'ver_administracion' },
  },
  // Mi plan de Bryan. Los avisos push de Bryan (`avisos-plan/decidir.ts`) abren ESTA ruta: queda para siempre.
  { patron: '/coach/mi-plan', ejemplo: '/coach/mi-plan', padre: '/', titulo: 'Mi plan', guarda: { marco: 'coach' } },

  // ---- Toda dirección que no existe ----
  { patron: '/*', ejemplo: '/esta-pagina-no-existe', padre: null, titulo: 'No encontrada', guarda: { marco: 'comodin' } },

  // ---- Sin sesión ----
  { patron: '/interesados', ejemplo: '/interesados', padre: null, titulo: 'Interesados', guarda: { marco: 'publica' } },
]

/** La fila de una dirección concreta (sin la búsqueda ni el ancla), o `undefined` si la app no la conoce. */
export function buscarRuta(pathname: string): RutaApp | undefined {
  const limpio = pathname.split(/[?#]/)[0] || '/'
  // El comodín encaja con todo: no cuenta como «la app conoce esta dirección».
  return RUTAS.find((r) => r.guarda.marco !== 'comodin' && matchPath({ path: r.patron, end: true }, limpio) !== null)
}

function filaPorPatron(patron: string): RutaApp | undefined {
  return RUTAS.find((r) => r.patron === patron)
}

export function tituloDeRuta(patron: string, esEquipo = false): string | undefined {
  const fila = filaPorPatron(patron)
  if (!fila) return undefined
  return esEquipo && fila.tituloEquipo ? fila.tituloEquipo : fila.titulo
}

/**
 * A dónde vuelve el «‹» desde una dirección: el padre declarado y su nombre. `null` si la dirección es la
 * raíz de una pestaña o la app no la conoce (sin «‹»).
 */
export function padreDe(pathname: string, esEquipo = false): { patron: string; titulo: string } | null {
  const fila = buscarRuta(pathname)
  if (!fila) return null
  const patron = esEquipo && fila.padreEquipo !== undefined ? fila.padreEquipo : fila.padre
  if (patron === null) return null
  const titulo = tituloDeRuta(patron, esEquipo)
  return titulo === undefined ? null : { patron, titulo }
}

// ---------------------------------------------------------------------------------------------
// El oráculo de las puertas: qué le pasa a quién en cada ruta. Lo contrasta el test con el router real.
// ---------------------------------------------------------------------------------------------

export interface PerfilAcceso {
  rol: Rol
  capacidades: ReadonlySet<Capacidad>
}

export type ResultadoAcceso =
  | { tipo: 'entra' }
  /** Entra al marco pero la pantalla dice «Sin permiso» (la Administración del coach sin `ver_administracion`). */
  | { tipo: 'sin_permiso' }
  /** Acaba en otra dirección (la FINAL, después de encadenar redirecciones). */
  | { tipo: 'redirige'; a: string }

const ENTRA: ResultadoAcceso = { tipo: 'entra' }

/** `usePuestoCoach`: el rol coach, o un asesorado con la capacidad `puesto_de_coach` (la cuenta personal de Bryan). */
export function ocupaElPuesto(p: PerfilAcceso): boolean {
  return p.rol === 'coach' || (p.rol === 'asesorado' && p.capacidades.has('puesto_de_coach'))
}

export function resolverAcceso(ruta: RutaApp, p: PerfilAcceso): ResultadoAcceso {
  const g = ruta.guarda
  const esCoach = ocupaElPuesto(p)
  const tiene = (c: Capacidad) => p.capacidades.has(c)
  const sigue = (destino: string): ResultadoAcceso => {
    const fila = buscarRuta(destino)
    return fila ? resolverAcceso(fila, p) : { tipo: 'redirige', a: destino }
  }
  // Redirigir = ir a otra dirección y ver qué le pasa ALLÁ; si allá entra, el destino es la dirección final.
  const redirigir = (destino: string): ResultadoAcceso => {
    const alla = sigue(destino)
    return alla.tipo === 'entra' ? { tipo: 'redirige', a: destino } : alla
  }

  switch (g.marco) {
    case 'publica':
    case 'comodin':
      return ENTRA

    case 'praxis':
      // `puedeVerPraxis`: el equipo por ROL (coach o nutricionista) y, desde la decisión de Bryan del 23-oct,
      // quien ocupa el PUESTO de coach (su cuenta personal es `asesorado` + `puesto_de_coach`). Los
      // asesorados siguen sin entrar.
      return p.rol === 'coach' || p.rol === 'nutricionista' || esCoach ? ENTRA : redirigir('/')

    case 'tablero':
      if (!esCoach && !g.capacidades?.some(tiene)) return redirigir('/')
      return ENTRA

    case 'asesorado': {
      if (esCoach && tiene('solo_tablero')) return redirigir('/tablero')
      if (p.rol === 'coach' && !g.propiaDelCoach) return redirigir('/')
      if (g.soloEquipo && p.rol !== 'nutricionista' && !esCoach) return redirigir(g.soloEquipo.destino)
      return ENTRA
    }

    case 'coach': {
      if (esCoach && tiene('solo_tablero')) return redirigir('/tablero')
      if (esCoach) {
        if (g.coachNecesita && !tiene(g.coachNecesita)) return { tipo: 'sin_permiso' }
      } else if (!g.capacidades?.some(tiene)) {
        return redirigir('/')
      }
      return g.redirigeA ? redirigir(g.redirigeA) : ENTRA
    }
  }
}
