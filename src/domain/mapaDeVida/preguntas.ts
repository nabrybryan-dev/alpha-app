/**
 * El mapa de vida: la encuesta que le pregunta a cada asesorado CÓMO VIVE,
 * para poder hablarle cuando le sirve a él en vez de a la hora que nos venga
 * bien a nosotros.
 *
 * Ver `contrato.md` para el detalle de cada campo y para lo que NO entra
 * todavía (la segunda mitad del mapa, y el disparo real de los mensajes).
 *
 * LA REGLA QUE ESTE ARCHIVO HACE CUMPLIR EN EL TIPO: una pregunta sin
 * `mensajeQueDispara` no compila. No es un detalle de estilo — es la mitad del
 * propósito de la encuesta. Una pregunta que no dispara ningún mensaje es pura
 * curiosidad: se contesta y no le cambia nada a la persona que la contestó.
 * Por eso `mensajeQueDispara` y `horaBase` son obligatorios en
 * `PreguntaMapaDeVida`, no opcionales — quítalos y `tsc -b` se rompe antes de
 * que el código llegue a ningún lado (compruébalo borrando el campo de la
 * interfaz y volviéndolo a poner).
 *
 * Que el campo esté presente y no vacío en TIEMPO DE EJECUCIÓN —un `''` pasa
 * el tipo— lo vigila `preguntas.test.ts`.
 */

/** Cómo se responde cada pregunta. Decide qué control pinta `EncuestaMapa`. */
export type TipoPreguntaMapa = 'si_no' | 'hora' | 'opcion_multiple' | 'escala_1_5'

export interface PreguntaMapaDeVida {
  /** Único y estable: es la clave con la que se guarda y se lee la respuesta. */
  id: string
  /** La pregunta tal como la lee el asesorado. */
  texto: string
  tipo: TipoPreguntaMapa
  /** Solo para `tipo: 'opcion_multiple'`. Ignorado en el resto. */
  opciones?: readonly string[]
  /**
   * QUÉ RECADO habilita esta respuesta. No es el texto del mensaje —eso vive
   * donde se redacte la voz de Alpha (fuera de esta tarea)— es el
   * identificador del recado que esta pregunta hace posible. Obligatorio: sin
   * él, la pregunta no tiene razón de estar en la encuesta.
   */
  mensajeQueDispara: string
  /**
   * La hora del día, en `HH:MM` y hora local del asesorado, alrededor de la
   * cual tiene sentido mandar ese recado — INDEPENDIENTE de lo que la persona
   * responda. El aviso sobre la última comida se manda de noche sin importar
   * a qué hora dijo que cena: es el ancla del recado, no un cálculo sobre la
   * respuesta (eso, si llega a existir, es trabajo de otra pieza, no de esta
   * lista).
   */
  horaBase: string
}

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/

/** `true` si `hora` tiene forma `HH:MM` con valores de reloj real. */
export function horaBaseValida(hora: string): boolean {
  return HORA_VALIDA.test(hora)
}

/**
 * La primera mitad del mapa de vida: las palancas circadianas que no
 * necesitan aparato y ya no cubre el check-in de Bienestar (que pregunta
 * cuántas horas se durmió y a qué hora se acostó/levantó — eso NO se repite
 * aquí).
 *
 * Lo que falta —trabajo, pantallas, viajes, la segunda mitad— queda fuera a
 * propósito: "Qué NO entra en esta obra" en
 * `docs/specs/2026-09-10-revision-semanal-en-video.md`.
 */
export const PREGUNTAS_MAPA_DE_VIDA: readonly PreguntaMapaDeVida[] = [
  {
    id: 'sol_de_la_manana',
    texto: '¿Sales a que te dé el sol dentro de la primera hora después de despertarte?',
    tipo: 'si_no',
    mensajeQueDispara: 'recado-sol-de-la-manana',
    horaBase: '07:30',
  },
  {
    id: 'primera_comida',
    texto: '¿A qué hora sueles hacer tu primera comida del día?',
    tipo: 'hora',
    mensajeQueDispara: 'recado-primera-comida',
    horaBase: '08:00',
  },
  {
    id: 'ultima_comida',
    texto: '¿A qué hora sueles hacer tu última comida del día?',
    tipo: 'hora',
    mensajeQueDispara: 'recado-ultima-comida',
    horaBase: '21:00',
  },
  {
    id: 'hora_de_entrenar',
    texto: '¿A qué hora del día entrenas casi siempre?',
    tipo: 'hora',
    mensajeQueDispara: 'recado-antes-de-entrenar',
    horaBase: '17:00',
  },
  {
    id: 'cafeina',
    texto: '¿Cuántas bebidas con cafeína tomas al día (café, té, energizantes)?',
    tipo: 'opcion_multiple',
    opciones: ['Ninguna', '1', '2', '3 o más'],
    mensajeQueDispara: 'recado-cafeina-y-sueno',
    horaBase: '14:00',
  },
  {
    id: 'estres_general',
    texto: '¿Cómo describirías tu nivel de estrés en un día normal?',
    tipo: 'escala_1_5',
    mensajeQueDispara: 'recado-manejo-del-estres',
    horaBase: '20:00',
  },
]

/**
 * El tipo obliga a que `horaBase` esté presente, pero no a que tenga forma de
 * hora real: un `'25:99'` pasa `tsc -b` igual que pasaría un `mensajeQueDispara`
 * vacío. Esto lo cierra en tiempo de módulo, no solo en el test: si algún día
 * se añade una pregunta con la hora mal escrita, la app no arranca con un dato
 * roto en silencio.
 */
for (const pregunta of PREGUNTAS_MAPA_DE_VIDA) {
  if (!horaBaseValida(pregunta.horaBase)) {
    throw new Error(`La pregunta "${pregunta.id}" trae una horaBase inválida: "${pregunta.horaBase}"`)
  }
}
