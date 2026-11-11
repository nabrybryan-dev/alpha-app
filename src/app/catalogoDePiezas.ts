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
  /** Tarjetas de Hoy: la clave con que `HoyPage.tsx` la compone. Otras pantallas: el texto literal que la marca en `fuente`. */
  enCodigo?: string
  /** Otras pantallas: el archivo donde vive la pieza (para el inventario). */
  fuente?: string
  /** El nivel no lo firmó Bryan todavía. */
  porConfirmar?: boolean
}

/** Cómo se dicen las pantallas además de su título. Cada clave tiene que ser un destino real (lo prueba el test). */
export const SINONIMOS_DE_PANTALLA: Readonly<Record<string, readonly string[]>> = {
  '/': ['hoy', 'mi dia', 'inicio'],
  '/entrenar': ['mi entreno', 'mi ruta de entreno', 'mi plan de entreno'],
  '/semana': ['mi semana'],
  '/progreso': ['mi progreso', 'como voy', 'mi avance', 'que tanto he avanzado'],
  '/nutricion': ['mi nutricion', 'mi diario de comidas'],
  '/nutricion/plan': ['mi plan de comida', 'el plan de comida'],
  '/bienestar': ['mi bienestar', 'mi check in diario'],
  '/chat': ['mi equipo', 'mensajes'],
  '/cuestionarios': ['mis cuestionarios', 'mis encuestas'],
  '/contenidos': ['mis videos', 'mis lecturas'],
  '/logros': ['mis logros'],
  '/yo': ['mi cuenta'],
  '/yo/derechos': ['mis datos', 'mis derechos'],
}

/** Pantallas que no se ocultan por ser de cuidado o de ley. Lo demás que un asesorado abre es `libre`. */
const PANTALLAS_FIJAS: ReadonlySet<string> = new Set(['/', '/yo', '/yo/derechos', '/chat', '/bienestar', '/nutricion/al-dia'])
/** Pantallas que arma o asigna el equipo (microciclo, plan de nutrición, cuestionarios): se mueven, no se ocultan. */
const PANTALLAS_ASIGNADAS: ReadonlySet<string> = new Set(['/entrenar', '/nutricion', '/nutricion/plan', '/cuestionarios'])

/** Un asesorado cualquiera: el oráculo para saber si una pantalla es del equipo. */
const ASESORADO_DE_REFERENCIA: PerfilAcceso = { rol: 'asesorado', capacidades: new Set() }

function nivelDePantalla(patron: string): NivelDePieza {
  const fila = buscarRuta(patron)
  if (fila && resolverAcceso(fila, ASESORADO_DE_REFERENCIA).tipo !== 'entra') return 'equipo'
  if (PANTALLAS_FIJAS.has(patron)) return 'fija'
  return PANTALLAS_ASIGNADAS.has(patron) ? 'asignada' : 'libre'
}

/** Las tarjetas de Hoy del asesorado, en el orden en que `HoyPage.tsx` las compone. */
export const PIEZAS_DE_HOY: readonly PiezaDeLaApp[] = [
  { id: 'hoy.encabezado', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el encabezado de hoy', sinonimos: ['el saludo'], nivel: 'fija', enCodigo: 'encabezado', porConfirmar: true },
  { id: 'hoy.aviso-sincronizacion', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el aviso de sincronización', sinonimos: ['lo que no se ha subido'], nivel: 'fija', enCodigo: 'avisoSync', porConfirmar: true },
  { id: 'hoy.permiso-avisos', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el permiso de avisos', sinonimos: ['activar las notificaciones'], nivel: 'fija', enCodigo: 'permiso', porConfirmar: true },
  { id: 'hoy.cuestionario-de-salud', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el cuestionario de salud', sinonimos: ['mi ficha de salud'], nivel: 'fija', enCodigo: 'cribado' },
  { id: 'hoy.sesion', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'la sesión de hoy', sinonimos: ['mi sesion', 'mi entreno de hoy', 'el entreno de hoy', 'la seccion de entreno de hoy'], nivel: 'asignada', enCodigo: 'tarjetaSesion' },
  { id: 'hoy.carteles', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'los carteles del día', sinonimos: ['los avisos de mi semana'], nivel: 'libre', enCodigo: 'carteles', porConfirmar: true },
  { id: 'hoy.pregunta-del-dia', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'la pregunta del día', sinonimos: ['lo que me pregunto la cadena'], nivel: 'asignada', enCodigo: 'preguntaDeLaCadena' },
  { id: 'hoy.checkin', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el check-in del día', sinonimos: ['mi check in', 'el check in', 'como amanecí'], nivel: 'fija', enCodigo: 'checkinDelAsesorado' },
  { id: 'hoy.nutricion', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'la nutrición de hoy', sinonimos: ['mi comida de hoy', 'lo que como hoy'], nivel: 'asignada', enCodigo: 'MiNutricionDeHoy' },
  { id: 'hoy.pendientes', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'los pendientes de hoy', sinonimos: ['lo que me falta hoy'], nivel: 'asignada', enCodigo: 'listaPendientes', porConfirmar: true },
  { id: 'hoy.semana', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'la revisión de la semana', sinonimos: ['la tarjeta de la semana', 'mi semana en hoy'], nivel: 'libre', enCodigo: 'revision' },
  { id: 'hoy.escribir-al-coach', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'escribirle al coach', sinonimos: ['la barra del coach', 'hablar con mi coach'], nivel: 'fija', enCodigo: 'barraCoach' },
  { id: 'hoy.actualizar-salud', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'actualizar mi salud', sinonimos: ['cambio en mi salud'], nivel: 'fija', enCodigo: 'volverAContarSalud', porConfirmar: true },
  { id: 'hoy.cifras', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'mis cifras', sinonimos: ['mi racha', 'racha peso y adherencia'], nivel: 'libre', enCodigo: 'cifras' },
  { id: 'hoy.bloque', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'mi bloque', sinonimos: ['el bloque actual'], nivel: 'libre', enCodigo: 'bloqueActual' },
  { id: 'hoy.album', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el álbum', sinonimos: ['mis stickers', 'el album de fichas', 'las fichas'], nivel: 'libre', enCodigo: 'album' },
  { id: 'hoy.radar', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'el radar', sinonimos: ['las noticias de alpha'], nivel: 'libre', enCodigo: 'radar' },
  { id: 'hoy.contenidos', tipo: 'tarjeta', pantalla: '/', nombreHablado: 'los contenidos de hoy', sinonimos: ['tecnica y educacion'], nivel: 'libre', enCodigo: 'contenidos' },
]

const SEMANA = 'src/features/semana/SemanaPage.tsx'
const PROGRESO = 'src/features/progreso/ProgresoPage.tsx'
const DIARIO = 'src/features/nutricion/DiarioDia.tsx'
const PLAN = 'src/features/nutricion/MiPlan.tsx'
const SALON = 'src/features/entrenar/salon/SalonEntrenar.tsx'
const BIENESTAR = 'src/features/bienestar/BienestarPage.tsx'
const YO = 'src/features/yo/YoPage.tsx'
const CHAT = 'src/features/chat/ChatPage.tsx'
const CUESTIONARIOS = 'src/features/cuestionarios/CuestionariosPage.tsx'
const CONTENIDOS = 'src/features/contenidos/ContenidosPage.tsx'
const LOGROS = 'src/features/logros/LogrosPage.tsx'

/**
 * Las piezas de Entrenar, Nutrición, Semana, Progreso (O1b), Bienestar, Yo, Chat, Cuestionarios, Contenidos y Logros (O1c). Cada una dice en qué archivo vive y con qué texto
 * literal se marca; las de Semana y Progreso llevan `data-bloque="…"`, la costumbre de la app para nombrar un
 * bloque, y la prueba exige que TODO `data-bloque` de esas pantallas tenga su pieza.
 *
 * Entrenar es el salón 3D: solo se registran los paneles que se ven como pieza propia (la hoja, el tambor de la
 * semana y la cámara). Los demás elementos del salón (barra de sesión, puntos, cajón de serie, estaciones) forman
 * parte de la escena y no se reordenan; si algún día se quiere, se registran aquí.
 */
export const PIEZAS_DE_OTRAS_PANTALLAS: readonly PiezaDeLaApp[] = [
  // ---- Entrenar ----
  { id: 'entrenar.salon', tipo: 'tarjeta', pantalla: '/entrenar', nombreHablado: 'el salón', sinonimos: ['el cuerpo 3d', 'el salon 3d', 'el sujeto'], nivel: 'fija', fuente: SALON, enCodigo: 'export function SalonEntrenar' },
  { id: 'entrenar.tambor', tipo: 'tarjeta', pantalla: '/entrenar', nombreHablado: 'el tambor de la semana', sinonimos: ['mis dias de entreno', 'el tambor'], nivel: 'libre', fuente: SALON, enCodigo: '<TamborDeLaSemana', porConfirmar: true },
  { id: 'entrenar.camara', tipo: 'tarjeta', pantalla: '/entrenar', nombreHablado: 'la cámara del salón', sinonimos: ['la camara del encuadre'], nivel: 'libre', fuente: SALON, enCodigo: '<CamaraDelSalon', porConfirmar: true },
  // ---- Nutrición: el diario ----
  { id: 'nutricion.tira-semana', tipo: 'tarjeta', pantalla: '/nutricion', nombreHablado: 'la tira de la semana de comidas', sinonimos: ['mi semana de comidas'], nivel: 'libre', fuente: DIARIO, enCodigo: '<TiraSemana', porConfirmar: true },
  { id: 'nutricion.resumen', tipo: 'tarjeta', pantalla: '/nutricion', nombreHablado: 'el resumen del día', sinonimos: ['mis calorias', 'mis macros'], nivel: 'libre', fuente: DIARIO, enCodigo: '<ResumenDia' },
  { id: 'nutricion.recetas', tipo: 'tarjeta', pantalla: '/nutricion', nombreHablado: 'las recetas', sinonimos: ['mis recetas'], nivel: 'libre', fuente: DIARIO, enCodigo: '<RecetasCarousel' },
  { id: 'nutricion.comidas', tipo: 'tarjeta', pantalla: '/nutricion', nombreHablado: 'las comidas del día', sinonimos: ['mi diario', 'mis comidas'], nivel: 'asignada', fuente: DIARIO, enCodigo: '<FilaComida' },
  { id: 'nutricion.micros', tipo: 'tarjeta', pantalla: '/nutricion', nombreHablado: 'los micronutrientes', sinonimos: ['mis micros', 'mis vitaminas'], nivel: 'libre', fuente: DIARIO, enCodigo: '<PanelMicros' },
  { id: 'nutricion.calibracion', tipo: 'tarjeta', pantalla: '/nutricion', nombreHablado: 'la calibración', sinonimos: ['mi calibracion'], nivel: 'libre', fuente: DIARIO, enCodigo: '<PanelCalibracion' },
  { id: 'nutricion.agua', tipo: 'tarjeta', pantalla: '/nutricion', nombreHablado: 'el agua', sinonimos: ['mi agua', 'la hidratacion'], nivel: 'libre', fuente: DIARIO, enCodigo: '<Hidratacion' },
  { id: 'nutricion.adherencia', tipo: 'tarjeta', pantalla: '/nutricion', nombreHablado: 'mi adherencia del día', sinonimos: ['como cumpli hoy con la comida'], nivel: 'libre', fuente: DIARIO, enCodigo: '<AdherenciaDia', porConfirmar: true },
  // ---- Nutrición: el plan (las siete secciones que arma el nutricionista) ----
  { id: 'plan.perfil', tipo: 'tarjeta', pantalla: '/nutricion/plan', nombreHablado: 'mi perfil de nutrición', sinonimos: ['mi perfil alimentario'], nivel: 'asignada', fuente: PLAN, enCodigo: "'Mi perfil'", porConfirmar: true },
  { id: 'plan.contexto', tipo: 'tarjeta', pantalla: '/nutricion/plan', nombreHablado: 'el contexto del plan', sinonimos: ['por que este plan'], nivel: 'asignada', fuente: PLAN, enCodigo: "'Contexto'", porConfirmar: true },
  { id: 'plan.ondulacion', tipo: 'tarjeta', pantalla: '/nutricion/plan', nombreHablado: 'la ondulación', sinonimos: ['por que las calorias ondulan'], nivel: 'asignada', fuente: PLAN, enCodigo: "'Ondulación'", porConfirmar: true },
  { id: 'plan.menus', tipo: 'tarjeta', pantalla: '/nutricion/plan', nombreHablado: 'los menús', sinonimos: ['mis menus', 'el menu del dia'], nivel: 'asignada', fuente: PLAN, enCodigo: "'Menús'", porConfirmar: true },
  { id: 'plan.intercambios', tipo: 'tarjeta', pantalla: '/nutricion/plan', nombreHablado: 'los intercambios', sinonimos: ['mis cambios de comida', 'lo que puedo cambiar'], nivel: 'asignada', fuente: PLAN, enCodigo: "'Intercambios'", porConfirmar: true },
  { id: 'plan.mercado', tipo: 'tarjeta', pantalla: '/nutricion/plan', nombreHablado: 'el mercado de 15 días', sinonimos: ['la lista del mercado'], nivel: 'asignada', fuente: PLAN, enCodigo: "'Mercado'", porConfirmar: true },
  { id: 'plan.suplementos', tipo: 'tarjeta', pantalla: '/nutricion/plan', nombreHablado: 'los suplementos', sinonimos: ['mis suplementos'], nivel: 'asignada', fuente: PLAN, enCodigo: "'Suplementos'", porConfirmar: true },
  // ---- Semana ----
  { id: 'semana.resumen', tipo: 'tarjeta', pantalla: '/semana', nombreHablado: 'el resumen de la semana', sinonimos: ['mi resumen'], nivel: 'libre', fuente: SEMANA, enCodigo: 'data-bloque="resumen"' },
  { id: 'semana.revision', tipo: 'tarjeta', pantalla: '/semana', nombreHablado: 'la revisión de la semana', sinonimos: ['la tarjeta de la semana'], nivel: 'libre', fuente: SEMANA, enCodigo: '<CabeceraSemanal', porConfirmar: true },
  { id: 'semana.notas', tipo: 'tarjeta', pantalla: '/semana', nombreHablado: 'las notas de la semana', sinonimos: ['notas de mi semana'], nivel: 'libre', fuente: SEMANA, enCodigo: 'aria-label="Notas de la semana"' },
  { id: 'semana.responder', tipo: 'tarjeta', pantalla: '/semana', nombreHablado: 'lo que me toca responder', sinonimos: ['mis pendientes'], nivel: 'asignada', fuente: SEMANA, enCodigo: 'data-bloque="responder"' },
  { id: 'semana.vida', tipo: 'tarjeta', pantalla: '/semana', nombreHablado: 'mi estilo de vida', sinonimos: ['mis habitos'], nivel: 'libre', fuente: SEMANA, enCodigo: '<TarjetaVidaCard', porConfirmar: true },
  { id: 'semana.mensajes-vida', tipo: 'tarjeta', pantalla: '/semana', nombreHablado: 'los mensajes de estilo de vida', sinonimos: ['mis mensajes de habitos'], nivel: 'libre', fuente: SEMANA, enCodigo: '<MensajesVidaBandeja', porConfirmar: true },
  { id: 'semana.chat', tipo: 'tarjeta', pantalla: '/semana', nombreHablado: 'el chat con mi equipo', sinonimos: ['mensajes con mi coach'], nivel: 'fija', fuente: SEMANA, enCodigo: 'data-bloque="chat"' },
  { id: 'semana.dias', tipo: 'tarjeta', pantalla: '/semana', nombreHablado: 'mi semana día por día', sinonimos: ['los dias de la semana'], nivel: 'libre', fuente: SEMANA, enCodigo: 'aria-label="Tu semana, día por día"' },
  // ---- Progreso ----
  { id: 'progreso.evolucion', tipo: 'tarjeta', pantalla: '/progreso', nombreHablado: 'mi evolución', sinonimos: ['como he cambiado'], nivel: 'libre', fuente: PROGRESO, enCodigo: '<ProgresoEvolucion', porConfirmar: true },
  { id: 'progreso.checkins', tipo: 'tarjeta', pantalla: '/progreso', nombreHablado: 'el historial de check-ins', sinonimos: ['mis check ins anteriores'], nivel: 'libre', fuente: PROGRESO, enCodigo: 'data-bloque="checkins"', porConfirmar: true },
  { id: 'progreso.medidas', tipo: 'tarjeta', pantalla: '/progreso', nombreHablado: 'mis medidas y peso', sinonimos: ['mi peso', 'mis medidas', 'las medidas'], nivel: 'libre', fuente: PROGRESO, enCodigo: 'data-bloque="medidas"' },
  { id: 'progreso.logros', tipo: 'tarjeta', pantalla: '/progreso', nombreHablado: 'mis logros y nivel', sinonimos: ['mis medallas', 'mi nivel', 'mi racha'], nivel: 'libre', fuente: PROGRESO, enCodigo: 'data-bloque="logros"' },
  { id: 'progreso.competencias', tipo: 'tarjeta', pantalla: '/progreso', nombreHablado: 'mis competencias', sinonimos: ['mis competencias evaluadas'], nivel: 'libre', fuente: PROGRESO, enCodigo: 'data-bloque="competencias"', porConfirmar: true },
  { id: 'progreso.escala', tipo: 'tarjeta', pantalla: '/progreso', nombreHablado: 'la escala alfa', sinonimos: ['mis niveles de alfa'], nivel: 'libre', fuente: PROGRESO, enCodigo: 'data-bloque="escala-alfa"', porConfirmar: true },
  { id: 'progreso.fatiga', tipo: 'tarjeta', pantalla: '/progreso', nombreHablado: 'la fatiga por grupo muscular', sinonimos: ['mi fatiga', 'mi cansancio muscular'], nivel: 'libre', fuente: PROGRESO, enCodigo: 'data-bloque="fatiga"' },
  { id: 'progreso.velocidad', tipo: 'tarjeta', pantalla: '/progreso', nombreHablado: 'mi velocidad', sinonimos: ['mi historial de velocidad'], nivel: 'libre', fuente: PROGRESO, enCodigo: '<HistorialDeVelocidad', porConfirmar: true },
  // ---- Bienestar ----
  { id: 'bienestar.recordatorio', tipo: 'tarjeta', pantalla: '/bienestar', nombreHablado: 'el recordatorio de las 6 pm', sinonimos: ['el aviso de las seis'], nivel: 'fija', fuente: BIENESTAR, enCodigo: 'Recordatorio de las 6 pm', porConfirmar: true },
  { id: 'bienestar.checkin', tipo: 'tarjeta', pantalla: '/bienestar', nombreHablado: 'el formulario de check-in', sinonimos: ['mi check in diario', 'el check in'], nivel: 'fija', fuente: BIENESTAR, enCodigo: '<CheckinForm' },
  { id: 'bienestar.medidas', tipo: 'tarjeta', pantalla: '/bienestar', nombreHablado: 'mis medidas y peso', sinonimos: ['mi peso', 'mis medidas', 'las medidas'], nivel: 'libre', fuente: BIENESTAR, enCodigo: '<MedidasCard' },
  { id: 'bienestar.mensajes-vida', tipo: 'tarjeta', pantalla: '/bienestar', nombreHablado: 'los mensajes de estilo de vida', sinonimos: ['mis mensajes de habitos'], nivel: 'libre', fuente: BIENESTAR, enCodigo: '<MensajesVidaBandeja', porConfirmar: true },
  { id: 'bienestar.vida', tipo: 'tarjeta', pantalla: '/bienestar', nombreHablado: 'mi estilo de vida', sinonimos: ['mis habitos'], nivel: 'libre', fuente: BIENESTAR, enCodigo: '<TarjetaVidaCard' },
  { id: 'bienestar.historial', tipo: 'tarjeta', pantalla: '/bienestar', nombreHablado: 'el historial de check-ins', sinonimos: ['mis check ins anteriores'], nivel: 'libre', fuente: BIENESTAR, enCodigo: '<HistorialDeCheckins', porConfirmar: true },
  // ---- Yo ----
  { id: 'yo.avisos', tipo: 'tarjeta', pantalla: '/yo', nombreHablado: 'mis avisos', sinonimos: ['mis notificaciones'], nivel: 'fija', fuente: YO, enCodigo: '<AvisosYo' },
  { id: 'yo.buzon', tipo: 'tarjeta', pantalla: '/yo', nombreHablado: 'el buzón de comentarios', sinonimos: ['mis comentarios sobre la app'], nivel: 'libre', fuente: YO, enCodigo: '<BuzonComentarios', porConfirmar: true },
  { id: 'yo.clave', tipo: 'tarjeta', pantalla: '/yo', nombreHablado: 'cambiar la clave', sinonimos: ['mi contrasena', 'mi clave'], nivel: 'fija', fuente: YO, enCodigo: '<CambiarClave' },
  { id: 'yo.derechos', tipo: 'tarjeta', pantalla: '/yo', nombreHablado: 'el enlace a mis datos y derechos', sinonimos: [], nivel: 'fija', fuente: YO, enCodigo: 'to="/yo/derechos"' },
  // ---- Chat ----
  { id: 'chat.remitente', tipo: 'tarjeta', pantalla: '/chat', nombreHablado: 'el selector de a quién escribo', sinonimos: ['elegir coach o nutricionista'], nivel: 'fija', fuente: CHAT, enCodigo: '<SelectorRemitente', porConfirmar: true },
  { id: 'chat.conversacion', tipo: 'tarjeta', pantalla: '/chat', nombreHablado: 'la conversación', sinonimos: ['mis mensajes'], nivel: 'fija', fuente: CHAT, enCodigo: '<Conversacion', porConfirmar: true },
  // ---- Cuestionarios ----
  { id: 'cuestionarios.pendientes', tipo: 'tarjeta', pantalla: '/cuestionarios', nombreHablado: 'los cuestionarios por responder', sinonimos: ['mis cuestionarios pendientes'], nivel: 'asignada', fuente: CUESTIONARIOS, enCodigo: 'No tienes cuestionarios pendientes.', porConfirmar: true },
  { id: 'cuestionarios.enviados', tipo: 'tarjeta', pantalla: '/cuestionarios', nombreHablado: 'los cuestionarios enviados', sinonimos: ['los que ya respondi'], nivel: 'libre', fuente: CUESTIONARIOS, enCodigo: '✓ Enviado', porConfirmar: true },
  // ---- Contenidos ----
  { id: 'contenidos.lista', tipo: 'tarjeta', pantalla: '/contenidos', nombreHablado: 'la lista de contenidos', sinonimos: ['mis videos y lecturas'], nivel: 'libre', fuente: CONTENIDOS, enCodigo: '<FilaContenido', porConfirmar: true },
  // ---- Logros ----
  { id: 'logros.nivel', tipo: 'tarjeta', pantalla: '/logros', nombreHablado: 'mi nivel y mis puntos', sinonimos: ['mis xp', 'mi progreso de nivel'], nivel: 'libre', fuente: LOGROS, enCodigo: 'XP acumulados', porConfirmar: true },
  { id: 'logros.rachas', tipo: 'tarjeta', pantalla: '/logros', nombreHablado: 'mis rachas', sinonimos: ['mi racha'], nivel: 'libre', fuente: LOGROS, enCodigo: '<TiraDeRachas', porConfirmar: true },
  { id: 'logros.ranking', tipo: 'tarjeta', pantalla: '/logros', nombreHablado: 'el ranking del equipo', sinonimos: ['el ranking', 'la tabla de posiciones'], nivel: 'libre', fuente: LOGROS, enCodigo: '<RankingEquipo', porConfirmar: true },
  { id: 'logros.album', tipo: 'tarjeta', pantalla: '/logros', nombreHablado: 'mi álbum de fichas', sinonimos: ['el album de fichas', 'mis fichas panini', 'mis stickers', 'las fichas'], nivel: 'libre', fuente: LOGROS, enCodigo: '<FichaPanini', porConfirmar: true },
  { id: 'logros.medallas', tipo: 'tarjeta', pantalla: '/logros', nombreHablado: 'mis medallas', sinonimos: ['mis logros desbloqueados'], nivel: 'libre', fuente: LOGROS, enCodigo: '<Medalla', porConfirmar: true },
  { id: 'logros.premios', tipo: 'tarjeta', pantalla: '/logros', nombreHablado: 'mis premios', sinonimos: ['lo que he ganado'], nivel: 'libre', fuente: LOGROS, enCodigo: 'premio.titulo', porConfirmar: true },
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
  return esEquipo(perfil) ? pantallas : [...pantallas, ...PIEZAS_DE_HOY, ...PIEZAS_DE_OTRAS_PANTALLAS]
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

/** ¿Las dos palabras difieren en una sola letra (de más, de menos, cambiada o dos seguidas intercambiadas)? */
function aUnaLetra(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const ra = a.slice(i)
  const rb = b.slice(i)
  if (ra.length === rb.length) return ra.slice(1) === rb.slice(1) || (ra.length > 1 && ra[0] === rb[1] && ra[1] === rb[0] && ra.slice(2) === rb.slice(2))
  return ra.length > rb.length ? ra.slice(1) === rb : rb.slice(1) === ra
}

function corregirDictado(frase: string, piezas: PiezaDeLaApp[]): string {
  const vocabulario = new Set(piezas.flatMap((p) => clavesDe(p).flatMap((c) => c.split(' '))).filter((w) => w.length >= 5))
  return limpiar(frase)
    .split(' ')
    .map((w) => {
      if (w.length < 5 || vocabulario.has(w)) return w
      const sola = w.replace(/(.)\1+/g, '$1') // «hidrataccion» -> «hidratacion»
      const candidatas = [...vocabulario].filter((v) => aUnaLetra(w, v) || aUnaLetra(sola, v) || sola === v)
      return candidatas.length === 1 ? candidatas[0]! : w
    })
    .join(' ')
}

function normalizarFrase(frase: string): string {
  return ` ${limpiar(frase)} `
}

/**
 * Qué piezas nombra una frase. Una pieza se descarta si lo que la nombró queda DENTRO de lo que nombró a otra
 * («la nutrición de hoy» gana a «Nutrición»; «el check-in del día» gana a «el check-in»; «el álbum de fichas»
 * gana a «el álbum»). Si queda más de una, quien llama pregunta cuál (máximo 3), no elige.
 * No decide nada más: no interpreta verbos ni mira riesgo; eso es de la gramática de organización (fase O2).
 */
export function buscarPiezas(frase: string, perfil: PerfilAcceso): PiezaDeLaApp[] {
  const piezas = piezasPara(perfil)
  const nombrarCon = (q: string) =>
    piezas.map((pieza) => ({ pieza, claves: clavesDe(pieza).filter((c) => q.includes(` ${c} `)) })).filter((n) => n.claves.length > 0)
  // Dictado con una letra de más, de menos o cambiada («albun», «hidracion», «cestionarios»): solo se tocan las palabras
  // que el catálogo no conoce, y solo hacia una palabra del catálogo que sea la ÚNICA a esa distancia.
  const nombradas = nombrarCon(normalizarFrase(corregirDictado(frase, piezas)))
  const masLarga = (claves: string[]) => claves.reduce((a, b) => (b.length > a.length ? b : a), '')
  // «de hoy» no nombra la pantalla Hoy cuando la frase ya nombra una tarjeta («el agua de hoy»): «hoy» suelto es un
  // complemento de tiempo, no un destino (hallazgo de la revisión adversarial, 10-nov).
  const hayTarjeta = nombradas.some((n) => n.pieza.tipo === 'tarjeta')
  return nombradas
    .filter((n) => !(hayTarjeta && n.pieza.tipo === 'pantalla' && n.claves.every((c) => c === 'hoy')))
    .filter((n) => {
      const mia = masLarga(n.claves)
      return !nombradas.some((o) => o !== n && o.claves.some((c) => c.length > mia.length && c.includes(mia)))
    })
    .map((n) => n.pieza)
}
