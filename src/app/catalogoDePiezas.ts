import { normalizarNombre } from '../domain/praxis/ordenes/normalizarNombre'
import { destinosPara, esEquipo } from './destinosPraxis'
import { buscarRuta, resolverAcceso, type PerfilAcceso } from './rutas'

/**
 * EL CATÁLOGO DE PIEZAS (fase O1 del diseño `docs/specs/2026-11-09-praxis-interactiva-organiza-la-app-diseno.md`).
 *
 * Qué se puede traer o mostrar hablando con Praxis, con el nombre con que lo diría una persona y el nivel de
 * cada pieza. SOLO describe: no navega, no guarda ninguna organización ni cambia ninguna pantalla. Nada lo
 * llama todavía (apagado por construcción). La organización de cada persona (ocultar, mover) es la fase O4 y
 * llega con su propia migración.
 *
 * No es una lista más de lugares:
 *   · las PANTALLAS salen de `destinosPara` (que sale de `RUTAS` y de `resolverAcceso`): si alguien cambia una
 *     puerta o añade una ruta, el catálogo la sigue sin tocar este archivo. Aquí solo se añaden sus
 *     sinónimos hablados y su nivel;
 *   · las TARJETAS no tenían identificador. Hoy se registran las de Hoy del asesorado, una vez cada una, con
 *     la clave con que `HoyPage.tsx` las compone. `catalogoDePiezas.test.ts` lee `HoyPage.tsx` y se pone en
 *     rojo si aparece una tarjeta sin nombre hablado o si una registrada ya no existe.
 *
 * Los niveles son PROPUESTAS que Bryan aceptó el 9-nov para el mapa del diseño (anexo A); las tarjetas de
 * Hoy que ese mapa no traía (avisos, permisos, pendientes, carteles) quedan marcadas «por confirmar».
 *
 *   fija      no se oculta ni desaparece, PERO SE PUEDE MOVER; sus notificaciones siguen llegando esté donde esté
 *   asignada  la puso el coach: se mueve, no se oculta
 *   libre     se trae, se mueve y se oculta
 *   equipo    solo coach y nutricionista; un asesorado no la recibe ni por nombre
 */

export type NivelDePieza = 'fija' | 'asignada' | 'libre' | 'equipo'

export interface PiezaDeLaApp {
  /** Estable, en minúsculas: `pantalla:/semana`, `hoy.checkin`. Es la clave de toda organización guardada. */
  id: string
  tipo: 'pantalla' | 'tarjeta'
  /** El patrón de `RUTAS` de la pantalla (o de la pantalla donde vive la tarjeta). */
  pantalla: string
  /** Como lo diría una persona: «el check-in del día». */
  nombreHablado: string
  sinonimos: readonly string[]
  nivel: NivelDePieza
  /** Solo tarjetas de Hoy: la clave con que `HoyPage.tsx` la compone (para el inventario). */
  enCodigo?: string
  /** El nivel no lo firmó Bryan todavía. */
  porConfirmar?: boolean
}

/** Cómo se dicen las pantallas además de su título. Cada clave tiene que ser un destino real (lo prueba el test). */
export const SINONIMOS_DE_PANTALLA: Readonly<Record<string, readonly string[]>> = {
  '/': ['hoy', 'mi dia', 'inicio'],
  '/entrenar': ['mi entreno', 'mi ruta de entreno', 'mi plan de entreno'],
  '/semana': ['mi semana'],
  '/progreso': ['mi progreso', 'como voy'],
  '/nutricion': ['mi nutricion', 'mi diario de comidas'],
  '/nutricion/plan': ['mi plan de comida'],
  '/bienestar': ['mi bienestar', 'mi check in diario'],
  '/chat': ['mi equipo', 'mensajes'],
  '/cuestionarios': ['mis cuestionarios', 'mis encuestas'],
  '/contenidos': ['mis videos', 'mis lecturas'],
  '/logros': ['mis logros', 'mis medallas'],
  '/yo': ['mi cuenta', 'mis avisos'],
  '/yo/derechos': ['mis datos', 'mis derechos'],
}

/** Pantallas que no se ocultan por ser de cuidado o de ley. Lo demás que un asesorado abre es `libre`. */
const PANTALLAS_FIJAS: ReadonlySet<string> = new Set(['/', '/yo', '/yo/derechos', '/chat', '/bienestar'])

/** Un asesorado cualquiera: el oráculo para saber si una pantalla es del equipo. */
const ASESORADO_DE_REFERENCIA: PerfilAcceso = { rol: 'asesorado', capacidades: new Set() }

function nivelDePantalla(patron: string): NivelDePieza {
  const fila = buscarRuta(patron)
  if (fila && resolverAcceso(fila, ASESORADO_DE_REFERENCIA).tipo !== 'entra') return 'equipo'
  return PANTALLAS_FIJAS.has(patron) ? 'fija' : 'libre'
}

/** Las tarjetas de Hoy del asesorado, en el orden en que `HoyPage.tsx` las compone. */
export const PIEZAS_DE_HOY: readonly PiezaDeLaApp[] = [
  { id: 'hoy.encabezado', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el encabezado de hoy', sinonimos: ['el saludo'], nivel: 'fija', enCodigo: 'encabezado', porConfirmar: true },
  { id: 'hoy.aviso-sincronizacion', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el aviso de sincronización', sinonimos: ['lo que no se ha subido'], nivel: 'fija', enCodigo: 'avisoSync', porConfirmar: true },
  { id: 'hoy.permiso-avisos', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el permiso de avisos', sinonimos: ['activar las notificaciones'], nivel: 'fija', enCodigo: 'permiso', porConfirmar: true },
  { id: 'hoy.cuestionario-de-salud', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el cuestionario de salud', sinonimos: ['mi ficha de salud'], nivel: 'fija', enCodigo: 'cribado' },
  { id: 'hoy.sesion', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'la sesión de hoy', sinonimos: ['mi sesion', 'mi entreno de hoy'], nivel: 'asignada', enCodigo: 'tarjetaSesion' },
  { id: 'hoy.carteles', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'los carteles del día', sinonimos: ['los avisos de mi semana'], nivel: 'libre', enCodigo: 'carteles', porConfirmar: true },
  { id: 'hoy.pregunta-del-dia', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'la pregunta del día', sinonimos: ['lo que me pregunto la cadena'], nivel: 'asignada', enCodigo: 'preguntaDeLaCadena' },
  { id: 'hoy.checkin', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el check-in del día', sinonimos: ['mi check in', 'como amanecí'], nivel: 'fija', enCodigo: 'checkinDelAsesorado' },
  { id: 'hoy.nutricion', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'la nutrición de hoy', sinonimos: ['mi comida de hoy', 'lo que como hoy'], nivel: 'asignada', enCodigo: 'MiNutricionDeHoy' },
  { id: 'hoy.pendientes', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'los pendientes de hoy', sinonimos: ['lo que me falta hoy'], nivel: 'asignada', enCodigo: 'listaPendientes', porConfirmar: true },
  { id: 'hoy.semana', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'la revisión de la semana', sinonimos: ['la tarjeta de la semana', 'mi semana en hoy'], nivel: 'libre', enCodigo: 'revision' },
  { id: 'hoy.escribir-al-coach', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'escribirle al coach', sinonimos: ['la barra del coach', 'hablar con mi coach'], nivel: 'fija', enCodigo: 'barraCoach' },
  { id: 'hoy.actualizar-salud', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'actualizar mi salud', sinonimos: ['cambio en mi salud'], nivel: 'fija', enCodigo: 'volverAContarSalud', porConfirmar: true },
  { id: 'hoy.cifras', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'mis cifras', sinonimos: ['mi racha', 'racha peso y adherencia'], nivel: 'libre', enCodigo: 'cifras' },
  { id: 'hoy.bloque', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'mi bloque', sinonimos: ['el bloque actual'], nivel: 'libre', enCodigo: 'bloqueActual' },
  { id: 'hoy.album', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el álbum', sinonimos: ['mis stickers'], nivel: 'libre', enCodigo: 'album' },
  { id: 'hoy.radar', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el radar', sinonimos: ['las noticias de alpha'], nivel: 'libre', enCodigo: 'radar' },
  { id: 'hoy.contenidos', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'los contenidos de hoy', sinonimos: ['tecnica y educacion'], nivel: 'libre', enCodigo: 'contenidos' },
]

/** Las pantallas que esta persona puede abrir, con su nombre hablado. Salen de `destinosPara`, no de otra lista. */
export function piezasDePantallas(perfil: PerfilAcceso): PiezaDeLaApp[] {
  return destinosPara(perfil).map((d) => ({
    id: `pantalla:${d.patron}`,
    tipo: 'pantalla' as const,
    pantalla: d.patron,
    nombreHablado: d.titulo,
    sinonimos: SINONIMOS_DE_PANTALLA[d.patron] ?? [],
    nivel: nivelDePantalla(d.patron),
  }))
}

/** Todo lo que esta persona puede traer o mostrar. Un asesorado no recibe nada del equipo, ni por nombre. */
export function piezasPara(perfil: PerfilAcceso): PiezaDeLaApp[] {
  const pantallas = piezasDePantallas(perfil)
  return esEquipo(perfil) ? pantallas : [...pantallas, ...PIEZAS_DE_HOY]
}

/** Solo artículos: «mi» y «mis» se conservan, porque «mi día» sin «mi» sería «día», que está en cualquier frase. */
const ARTICULO = /^(el|la|los|las|lo que)\s+/

/** Sin acentos ni signos («check-in» y «check in» son lo mismo) y con los espacios en uno. */
function limpiar(texto: string): string {
  return normalizarNombre(texto).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function clavesDe(p: PiezaDeLaApp): string[] {
  return [p.nombreHablado, ...p.sinonimos].map((n) => limpiar(n).replace(ARTICULO, '')).filter((n) => n.length > 2)
}

function normalizarFrase(frase: string): string {
  return ` ${limpiar(frase)} `
}

/**
 * Qué piezas nombra una frase. Una pieza cuyo nombre queda DENTRO del de otra que también se nombró se descarta
 * («la nutrición de hoy» gana a «Nutrición»). Si queda más de una, quien llama pregunta cuál (máximo 3), no elige.
 * No decide nada más: no interpreta verbos ni mira riesgo; eso es de la gramática de organización (fase O2).
 */
export function buscarPiezas(frase: string, perfil: PerfilAcceso): PiezaDeLaApp[] {
  const q = normalizarFrase(frase)
  const nombradas = piezasPara(perfil).filter((p) => clavesDe(p).some((c) => q.includes(` ${c} `)))
  const nombre = (p: PiezaDeLaApp) => limpiar(p.nombreHablado).replace(ARTICULO, '')
  return nombradas.filter((p) => !nombradas.some((o) => o !== p && nombre(o).length > nombre(p).length && nombre(o).includes(nombre(p))))
}
