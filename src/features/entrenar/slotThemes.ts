/**
 * Los cinco gabinetes de la sala de máquinas.
 *
 * El ejercicio determina cuál sale: `THEMES[index % 5]`. No se aleatoriza — el
 * asesorado tiene que poder reconocer «la del ejercicio 3».
 *
 * Todo lo temático vive DENTRO del marco. Fuera de ese rectángulo la pantalla
 * es Alfa Athletics puro: la línea superior, los datos de la serie y el resto
 * de la sesión conservan la tipografía y los colores del sistema.
 *
 * DECISIÓN PENDIENTE: el encargo dice que los paths de los símbolos se copien
 * de la constante `P` del prototipo «Tragamonedas por ejercicio.dc.html». Ese
 * archivo no existe en el disco — se buscó por nombre en todo el usuario. Los
 * trazos de abajo están dibujados a mano siguiendo la descripción de cada
 * máquina; si aparece el prototipo, se sustituyen sin tocar nada más.
 */

/** Trazo de un símbolo: se pinta con `currentColor`, relleno o línea. */
export interface Simbolo {
  path: string
  relleno?: boolean
}

/**
 * Los veinte símbolos. Van en un registro plano para que cada tema elija seis
 * por clave y no haya paths duplicados.
 */
export const SIMBOLOS: Record<string, Simbolo> = {
  campana: { path: 'M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5Zm0 16a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 19Z', relleno: true },
  herradura: { path: 'M7 20V12a5 5 0 0 1 10 0v8M7 20h2.6M14.4 20H17', relleno: false },
  corazon: { path: 'M12 20S3.5 14.6 3.5 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8.5 2.2C20.5 14.6 12 20 12 20Z', relleno: true },
  pica: { path: 'M12 3c3 4.4 6.5 6.3 6.5 9.6A3.4 3.4 0 0 1 12 14a3.4 3.4 0 0 1-6.5-1.4C5.5 9.3 9 7.4 12 3Zm-1.6 12.4h3.2L14 21h-4Z', relleno: true },
  diamante: { path: 'M12 3 20 12l-8 9-8-9Z', relleno: true },
  estrella: { path: 'm12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.6l6.3-.8Z', relleno: true },
  cereza: { path: 'M13 4c-1.5 3-5 4.5-6.5 7M13 4c1.5 3 3.5 3.5 5 5M6.5 15.5a2.8 2.8 0 1 0 0 .1ZM17 12.5a2.6 2.6 0 1 0 0 .1Z', relleno: false },
  limon: { path: 'M12 5c4 0 7 3 7 7s-3 7-7 7-7-3-7-7 3-7 7-7Zm0 0v14M5 12h14', relleno: false },
  uva: { path: 'M12 4v3M9 9a2 2 0 1 0 .1 0Zm6 0a2 2 0 1 0 .1 0Zm-3 4a2 2 0 1 0 .1 0Zm-3 4a2 2 0 1 0 .1 0Zm6 0a2 2 0 1 0 .1 0Z', relleno: false },
  sandia: { path: 'M3.5 8h17a8.5 8.5 0 0 1-17 0Zm2.6 0a5.9 5.9 0 0 0 11.8 0M11 11.5h.01M14 13h.01M9 13h.01', relleno: false },
  bar: { path: 'M3 6h18v4H3Zm0 8h18v4H3Z', relleno: true },
  siete: { path: 'M6 4h12l-7 16H7l6-13H6Z', relleno: true },
  trebol: { path: 'M12 21v-5m0 0a3 3 0 1 1 2.2-5 3 3 0 1 1-2.2-4.9A3 3 0 1 1 9.8 11 3 3 0 1 1 12 16Z', relleno: false },
  gema: { path: 'M7 4h10l4 5-9 11L3 9Zm0 0-2 5m12-5 2 5M7 4l5 5 5-5M5 9h14', relleno: false },
  corona: { path: 'M4 18h16l1-10-5 3.5L12 5 8 11.5 3 8Z', relleno: true },
  ficha: { path: 'M12 3a9 9 0 1 0 .1 0Zm0 4a5 5 0 1 0 .1 0ZM12 3v4m0 10v4M3 12h4m10 0h4', relleno: false },
  moneda: { path: 'M12 3a9 9 0 1 0 .1 0Zm0 3.5v11m2.5-8.5H10.6a1.9 1.9 0 0 0 0 3.8h2.8a1.9 1.9 0 0 1 0 3.8H9.5', relleno: false },
  billete: { path: 'M2 6h20v12H2Zm3 3h.01M19 15h.01M12 8.5a3.5 3.5 0 1 0 .1 0Z', relleno: false },
  bolsa: { path: 'M9 3h6l-1.5 3h-3ZM7.5 6h9c2 2.5 3.5 5.5 3.5 8.5A4.5 4.5 0 0 1 15.5 21h-7A4.5 4.5 0 0 1 4 14.5C4 11.5 5.5 8.5 7.5 6Zm6.5 4.5h-3.4a1.6 1.6 0 0 0 0 3.2h1.8a1.6 1.6 0 0 1 0 3.2H9', relleno: false },
  cajafuerte: { path: 'M3 4h18v16H3Zm3 16v1m12-1v1M13 12a3 3 0 1 0 .1 0Zm0-3v3m0 0 2.2 2.2M6.5 8v8', relleno: false },
}

export type ClaveSimbolo = keyof typeof SIMBOLOS

export type Disposicion = 'liberty' | 'fruit' | 'sevens' | 'diamond' | 'bonanza'
export type Marquesina = 'bombillas' | 'banderin' | 'neon' | 'led'
export type FormaPunto = 'circulo' | 'pastilla' | 'rombo'

export interface SlotTheme {
  id: Disposicion
  nombre: string
  anio: string
  /** Color de acento del gabinete. Solo se usa dentro del marco. */
  acento: string
  /** Color del texto de los valores. */
  tono: string
  /** Familia tipográfica del interior. Nunca sale del gabinete. */
  fuente: string
  carretes: boolean
  marquesina: Marquesina
  marco: { fondo: string; padding: number; radius: string }
  cuerpo: { fondo: string; radius: string; borde: string; padding: number }
  ventana: { alto: number; radius: string; fondo: string; borde: string; sombra?: string }
  simbolos: ClaveSimbolo[]
  palanca: {
    pomo: string
    pomoTam: number
    /** El pomo del salón es un rombo. */
    rombo?: boolean
    vastago: string
    vastagoAncho: number
    grados: number
    baja: number
    vuelta: string
    etiqueta: string
  }
  /** Milisegundos por paso del carrete central. */
  step: number
  /** Cuándo frena el carrete central. Los laterales paran al 50 % y al 76 %. */
  brake: number
  punto: FormaPunto
  bandeja: { simbolos: ClaveSimbolo[]; leyenda: string }
  /** Bote inicial de la marquesina LED. Solo temas 4 y 5. */
  bote?: number
}

/** Las familias del interior. Se cargan en `tokens.css`, al final. */
const PLAYFAIR = "'Playfair Display', Georgia, serif"
const ALFA_SLAB = "'Alfa Slab One', Georgia, serif"
const ANTON = "'Anton', Impact, sans-serif"
const CINZEL = "'Cinzel', Georgia, serif"
const BUNGEE = "'Bungee', Impact, sans-serif"

export const THEMES: SlotTheme[] = [
  {
    id: 'liberty',
    nombre: 'LIBERTY BELL',
    anio: '1899',
    acento: '#e3c477',
    tono: '#f0e4c8',
    fuente: PLAYFAIR,
    carretes: true,
    marquesina: 'bombillas',
    marco: { fondo: 'linear-gradient(155deg,#6b5730,#241e14 30%,#a98c4c 50%,#1c1810 70%,#5a4a2a)', padding: 4, radius: '8px' },
    cuerpo: { fondo: 'linear-gradient(180deg,#191510,#0f0c09)', radius: '5px', borde: '1px solid #3a3020', padding: 15 },
    ventana: {
      alto: 126,
      radius: '4px',
      fondo: 'radial-gradient(ellipse at 50% 0%, #16120d, #090807)',
      borde: '3px double #8a733f',
      sombra: 'inset 0 3px 10px rgba(0,0,0,.85)',
    },
    simbolos: ['campana', 'herradura', 'corazon', 'pica', 'diamante', 'estrella'],
    palanca: {
      pomo: 'radial-gradient(circle at 33% 28%, #f28c82, #8d1f16)',
      pomoTam: 26,
      vastago: 'linear-gradient(90deg,#5a4a2a,#c9a961,#5a4a2a)',
      vastagoAncho: 8,
      grados: 36,
      baja: 5,
      vuelta: '.46s cubic-bezier(.18,.86,.24,1)',
      etiqueta: 'TIRAR',
    },
    step: 74,
    brake: 1080,
    punto: 'circulo',
    bandeja: { simbolos: ['campana', 'campana', 'campana'], leyenda: 'Tres campanas · pago máximo' },
  },
  {
    id: 'fruit',
    nombre: 'FRUIT MACHINE',
    anio: '1910',
    acento: '#e2564a',
    tono: '#ffeccf',
    fuente: ALFA_SLAB,
    carretes: true,
    marquesina: 'banderin',
    marco: { fondo: 'linear-gradient(150deg,#fff8ea,#c2ae87 38%,#fffdf7 52%,#a8956f 72%,#efe2c6)', padding: 4, radius: '22px 22px 14px 14px' },
    cuerpo: { fondo: 'linear-gradient(180deg,#1d1712,#120e0b)', radius: '19px 19px 11px 11px', borde: '1px solid #3d3125', padding: 14 },
    ventana: { alto: 112, radius: '13px', fondo: '#100c09', borde: '3px solid #d9c9a6' },
    simbolos: ['cereza', 'limon', 'uva', 'sandia', 'bar', 'campana'],
    palanca: {
      pomo: 'radial-gradient(circle at 34% 28%, #ffffff, #d8cfc0)',
      pomoTam: 24,
      vastago: 'linear-gradient(90deg,#8f9499,#e6ebee,#8f9499)',
      vastagoAncho: 7,
      grados: 20,
      baja: 2,
      vuelta: '.14s cubic-bezier(.2,1.5,.3,1)',
      etiqueta: '¡JALA!',
    },
    step: 50,
    brake: 720,
    punto: 'pastilla',
    bandeja: { simbolos: ['cereza', 'cereza', 'cereza'], leyenda: '3 CEREZAS · PREMIO' },
  },
  {
    id: 'sevens',
    nombre: 'SEVENS & BARS',
    anio: '1960',
    acento: '#c8ff1e',
    tono: '#f4f6f7',
    fuente: ANTON,
    carretes: true,
    marquesina: 'neon',
    marco: { fondo: 'linear-gradient(160deg,#f2f6f8,#6b7378 34%,#ffffff 50%,#565e63 68%,#d3dade)', padding: 2.5, radius: '22px' },
    cuerpo: { fondo: 'linear-gradient(180deg,#12161a,#0a0c0e)', radius: '20px', borde: '1px solid #262e33', padding: 14 },
    ventana: { alto: 104, radius: '14px', fondo: '#08090a', borde: '1.5px solid rgba(200,255,30,.38)' },
    simbolos: ['siete', 'bar', 'estrella', 'campana', 'ficha', 'trebol'],
    palanca: {
      pomo: 'radial-gradient(circle at 34% 28%, #eaffb0, #8fbf12)',
      pomoTam: 23,
      vastago: 'linear-gradient(90deg,#6b7378,#eef2f4,#6b7378)',
      vastagoAncho: 6,
      grados: 26,
      baja: 3,
      vuelta: '.24s cubic-bezier(.2,1.1,.3,1)',
      etiqueta: 'TIRAR',
    },
    step: 62,
    brake: 900,
    punto: 'pastilla',
    bandeja: { simbolos: ['siete', 'siete', 'siete'], leyenda: '777 · JACKPOT' },
  },
  {
    id: 'diamond',
    nombre: 'DIAMOND SALON',
    anio: '1985',
    acento: '#9fd8ef',
    tono: '#e6f4fb',
    fuente: CINZEL,
    carretes: false,
    marquesina: 'led',
    marco: { fondo: 'linear-gradient(145deg,#4e6373,#0b1013 34%,#a9cfe1 50%,#080c0f 66%,#33454f)', padding: 2, radius: '2px' },
    cuerpo: { fondo: 'linear-gradient(180deg,#0c1114,#06090b)', radius: '1px', borde: '1px solid #1e2b32', padding: 14 },
    ventana: {
      alto: 120,
      radius: '1px',
      fondo: 'linear-gradient(160deg,#070b0e,#0b1418 60%,#060a0c)',
      borde: '1px solid rgba(159,216,239,.4)',
      sombra: 'inset 0 0 28px rgba(159,216,239,.1)',
    },
    simbolos: ['gema', 'diamante', 'corona', 'estrella', 'ficha', 'corazon'],
    palanca: {
      pomo: 'linear-gradient(135deg,#f2fbff,#5f92aa)',
      pomoTam: 23,
      rombo: true,
      vastago: 'linear-gradient(90deg,#33454f,#a9cfe1,#33454f)',
      vastagoAncho: 5,
      grados: 32,
      baja: 6,
      vuelta: '.38s cubic-bezier(.18,.9,.24,1)',
      etiqueta: 'APOSTAR',
    },
    step: 46,
    brake: 1120,
    punto: 'rombo',
    bandeja: { simbolos: ['gema', 'gema', 'gema'], leyenda: 'TRES GEMAS · PROGRESIVO' },
    bote: 12480,
  },
  {
    id: 'bonanza',
    nombre: 'CASH BONANZA',
    anio: '1998',
    acento: '#7fc98d',
    tono: '#e8f6ec',
    fuente: BUNGEE,
    carretes: false,
    marquesina: 'led',
    marco: { fondo: 'linear-gradient(150deg,#a3801f,#2f2510 34%,#f0d68f 52%,#241c0c 70%,#8a6b2e)', padding: 4, radius: '15px' },
    cuerpo: { fondo: 'linear-gradient(180deg,#0f1712,#0a100c)', radius: '12px', borde: '1px solid #24322a', padding: 14 },
    ventana: { alto: 118, radius: '9px', fondo: 'linear-gradient(180deg,#0b130e,#070c09)', borde: '3px solid #8a6b2e' },
    simbolos: ['billete', 'moneda', 'bolsa', 'cajafuerte', 'ficha', 'trebol'],
    palanca: {
      pomo: 'radial-gradient(circle at 32% 28%, #ffeaa8, #7a5f28)',
      pomoTam: 26,
      vastago: 'linear-gradient(90deg,#5a4a1c,#e8cd85,#5a4a1c)',
      vastagoAncho: 8,
      grados: 30,
      baja: 8,
      vuelta: '.32s cubic-bezier(.34,.66,.18,1)',
      etiqueta: 'COBRAR',
    },
    step: 56,
    brake: 860,
    punto: 'pastilla',
    bandeja: { simbolos: ['billete', 'moneda', 'bolsa'], leyenda: 'LÍNEA COMPLETA · BOTE' },
    bote: 3900,
  },
]

/** El tema que le toca a un ejercicio. Cicla cada cinco. */
export function temaDeEjercicio(index: number): SlotTheme {
  return THEMES[((index % THEMES.length) + THEMES.length) % THEMES.length]
}
