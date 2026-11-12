/**
 * Los textos de la tarjeta de confirmación de «organizar la app hablando», en UNA tabla (decisión de Bryan, 11-nov-2026:
 * las cadenas no se dispersan por componentes).
 *
 * Fuente: `biblioteca-praxis/DISENO-TARJETA-CONFIRMACION-ORGANIZAR-20261111.md`, secciones 1, 2 y 8.
 *   · Tono MEZCLA: cálido (A) donde hay una razón que explicar (R1, R2, R4, R7, P2, P7) y en las demás confirmaciones;
 *     seco (B) en los avisos de un solo dato (R3, R5, R6, R8, I1, I3b).
 *   · Cada texto con «tu» tiene su versión de «usted» cambiando solo el trato, como el deshacer de registros.
 *   · Lo marcado «SIN APROBAR» no está en el diseño aprobado: lo completó quien construyó la tarjeta y espera a Bryan.
 *
 * Nunca se pinta un id ni un nombre técnico: solo `nombreHablado` de la pieza, entre comillas.
 */

export type TratoDeTarjeta = 'tu' | 'usted'

/** Una frase con sus dos tratos: [tú, usted]. */
type Par = readonly [string, string]
const de = (t: TratoDeTarjeta, p: Par): string => (t === 'usted' ? p[1] : p[0])
const q = (nombre: string): string => `«${nombre}»`

/** Cuánto dura el botón «Deshacer» tras aplicar: 10 a 15 s, como el correo (decisión 2 de Bryan). Después, solo por voz. */
export const VENTANA_DESHACER_MS = 12_000

export const BOTON = {
  esconder: 'Sí, esconder',
  dejarlo: 'No, dejarlo',
  fijar: 'Sí, fijar',
  subir: 'Sí, subir',
  bajar: 'Sí, bajar',
  devolver: 'Sí, devolver',
  restablecer: 'Sí, restablecer',
  llevame: 'Sí, llévame',
  no: 'No',
  ok: 'Ok',
  entendido: 'Entendido',
  muevelo: 'Muévelo',
  avisale: 'Sí, avísale',
  verLoEscondido: 'Ver lo escondido',
  traer: 'Sí, traer',
  verQueTrae: 'Ver qué trae',
  verOpciones: 'Ver opciones',
  unRegistro: 'Un registro',
  unaParte: 'Una parte de la pantalla',
  nada: 'Nada',
  ninguna: 'Ninguna',
  ninguno: 'Ninguno',
  deshacer: 'Deshacer',
  reintentar: 'Reintentar',
  cerrar: 'Cerrar',
  /** SIN APROBAR: los dos sentidos tras «Muévelo» (R1). */
  masArriba: 'Más arriba',
  masAbajo: 'Más abajo',
} as const

export const botonEsconderVarias = (n: number): string => `Sí, esconder ${n}`
/** En «solo lo importante», Deshacer devuelve todo de golpe: el botón dice cuántas para que no sorprenda (§4). */
export const botonDeshacerVarias = (n: number): string => (n > 1 ? `Deshacer (${n})` : BOTON.deshacer)

const cosas = (n: number): string => (n === 1 ? '1 cosa' : `${n} cosas`)

/** Confirmaciones (P1-P8, T2, Q1). */
export const TEXTO = {
  ocultar: (t: TratoDeTarjeta, n: string) => de(t, [
    `¿Escondo ${q(n)} de tu pantalla? Lo puedes volver a traer cuando quieras.`,
    `¿Escondo ${q(n)} de su pantalla? Lo puede volver a traer cuando quiera.`,
  ]),
  avisoCoachPesoOMedidas: (t: TratoDeTarjeta) => de(t, [
    'Tu coach verá que lo escondiste, sin ver lo que dijiste.',
    'Su coach verá que lo escondió, sin ver lo que dijo.',
  ]),
  ocultarEnVezDeBorrar: (t: TratoDeTarjeta, n: string) => de(t, [
    `Puedo esconder ${q(n)}, pero no borrarlo: tus datos quedan guardados. ¿Lo escondo?`,
    `Puedo esconder ${q(n)}, pero no borrarlo: sus datos quedan guardados. ¿Lo escondo?`,
  ]),
  fijar: (_t: TratoDeTarjeta, n: string) => `¿Dejo ${q(n)} siempre a la vista, en su sitio?`,
  subir: (t: TratoDeTarjeta, n: string) => de(t, [`¿Subo ${q(n)} un lugar en tu pantalla?`, `¿Subo ${q(n)} un lugar en su pantalla?`]),
  bajar: (t: TratoDeTarjeta, n: string) => de(t, [`¿Bajo ${q(n)} un lugar en tu pantalla?`, `¿Bajo ${q(n)} un lugar en su pantalla?`]),
  deshacerUltimo: (t: TratoDeTarjeta) => de(t, [
    '¿Devuelvo tu pantalla a como estaba antes del último cambio?',
    '¿Devuelvo su pantalla a como estaba antes del último cambio?',
  ]),
  restablecer: (t: TratoDeTarjeta) => de(t, [
    '¿Vuelvo tu pantalla a como viene de fábrica? Se borran tus cambios de orden, no tus datos.',
    '¿Vuelvo su pantalla a como viene de fábrica? Se borran sus cambios de orden, no sus datos.',
  ]),
  /** Decisión 5: solo el número, nunca redondeado (`esconderia.length`). */
  soloLoImportante: (_t: TratoDeTarjeta, n: number) => `Esto esconde ${cosas(n)} y deja solo lo esencial. ¿Seguimos?`,
  soloLoImportanteVacio: 'Ya está todo lo que se puede esconder. No hay nada más que quitar.',
  traerConfirmar: (t: TratoDeTarjeta, n: string) => de(t, [`¿Te llevo a ${q(n)}?`, `¿Lo llevo a ${q(n)}?`]),
  /** SIN APROBAR en lo genérico: el diseño trae el ejemplo «el álbum te aburre»; aquí no se repite la queja. */
  queja: (t: TratoDeTarjeta, n: string) => de(t, [`Entiendo. ¿Escondo ${q(n)} de tu pantalla?`, `Entiendo. ¿Escondo ${q(n)} de su pantalla?`]),
} as const

/** Preguntas (Q2, Q3, Q3b) e información (I1-I3b). */
export const PREGUNTA = {
  queQuitar: '¿Quitar qué: un registro que anoté o una parte de la pantalla?',
  cual: (nombres: readonly string[]) => `¿Cuál de estas: ${enumerar(nombres.map(q), 'o')}?`,
  cualHayMas: (t: TratoDeTarjeta) => de(t, [
    'Hay más de tres con ese nombre. ¿Es alguna de estas? Si no, dime otro nombre.',
    'Hay más de tres con ese nombre. ¿Es alguna de estas? Si no, dígame otro nombre.',
  ]),
  /** SIN APROBAR: tras «Una parte de la pantalla» (Q2) el diseño dice «Dime cuál». */
  dimeCual: (t: TratoDeTarjeta) => de(t, ['Dime cuál parte de la pantalla.', 'Dígame cuál parte de la pantalla.']),
  /** SIN APROBAR: tras «Muévelo» (R1). */
  haciaDonde: (n: string) => `¿Hacia dónde muevo ${q(n)}?`,
} as const

const MAXIMO_EN_LISTA = 6

export const AVISO = {
  nadaQueDeshacer: 'No hay cambios que deshacer.',
  lista: (t: TratoDeTarjeta, nombres: readonly string[]) => `${de(t, ['Esto puedes esconder', 'Esto puede esconder'])}: ${conPunto(listaCorta(nombres))}`,
  ocultas: (t: TratoDeTarjeta, nombres: readonly string[]) => `${de(t, ['Tienes escondido', 'Tiene escondido'])}: ${conPunto(listaCorta(nombres))} ¿Traigo alguno?`,
  ocultasVacia: 'Nada escondido.',
} as const

/** Rechazos (R1-R9). Nunca desvían en silencio. */
export const RECHAZO = {
  fija: (t: TratoDeTarjeta, n: string) => de(t, [
    `${q(n)} no se esconde: es parte de tu cuidado. Sí lo puedo mover.`,
    `${q(n)} no se esconde: es parte de su cuidado. Sí lo puedo mover.`,
  ]),
  asignada: (t: TratoDeTarjeta) => de(t, ['Eso lo pone tu coach, así que lo cambia él. ¿Le aviso?', 'Eso lo pone su coach, así que lo cambia él. ¿Le aviso?']),
  nucleo: 'Hoy y Praxis no se mueven.',
  tope: (t: TratoDeTarjeta, tope: number) => de(t, [
    `Ya tienes ${tope} cosas escondidas, que es el máximo. ¿Traigo alguna para esconder esta?`,
    `Ya tiene ${tope} cosas escondidas, que es el máximo. ¿Traigo alguna para esconder esta?`,
  ]),
  yaOculta: 'Ya está escondido. ¿Traerlo?',
  equipo: 'Eso es del equipo; no se organiza aquí.',
  contieneProtegidas: (t: TratoDeTarjeta) => de(t, [
    'Esa pantalla lleva dentro cosas de tu coach o de tu cuidado, así que no la escondo entera.',
    'Esa pantalla lleva dentro cosas de su coach o de su cuidado, así que no la escondo entera.',
  ]),
  sinAcceso: (t: TratoDeTarjeta) => de(t, ['Pantalla no disponible para tu cuenta.', 'Pantalla no disponible para su cuenta.']),
  noExiste: (t: TratoDeTarjeta, nombres: readonly string[]) => (nombres.length > 0
    ? `No encontré esa parte. ${de(t, ['Esto sí puedo mostrarte', 'Esto sí puedo mostrarle'])}: ${conPunto(listaCorta(nombres))}`
    : 'No encontré esa parte.'),
} as const

/** Lo que pasa después del toque (estados de la §4). */
export const RESULTADO = {
  aplicando: 'Un momento…',
  /** Aprobado «Listo, lo escondí.»; los demás verbos son SIN APROBAR (mismo molde). */
  aplicada: { ocultar: 'Listo, lo escondí.', fijar: 'Listo, lo fijé.', mover_arriba: 'Listo, lo subí.', mover_abajo: 'Listo, lo bajé.', deshacer: 'Listo, lo devolví.', restablecer: 'Listo, la dejé como viene de fábrica.', solo_lo_importante: 'Listo, lo escondí.' },
  noCambio: 'Listo, no cambié nada.',
  noCambioQueja: 'Listo, lo dejo.',
  deshecha: 'Listo, lo devolví.',
  error: 'No pude hacerlo ahora y no cambié nada.',
  choque: (t: TratoDeTarjeta) => de(t, [
    'Tu pantalla cambió en otro aparato, así que no toqué nada. Pídemelo de nuevo.',
    'Su pantalla cambió en otro aparato, así que no toqué nada. Pídamelo de nuevo.',
  ]),
  /** SIN APROBAR: el aviso al coach (R2) no está construido; se dice la verdad. */
  avisoNoDisponible: 'Todavía no puedo avisarle desde aquí. No cambié nada.',
  avisoDejado: 'Listo, le dejé el aviso.',
  /** Tras «Ver»: cuando no hay ninguna pieza para enseñar. */
  sinOpciones: 'No hay nada que mostrar aquí.',
} as const

function enumerar(xs: readonly string[], y: 'y' | 'o'): string {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} ${y} ${xs[xs.length - 1]}`
}

/** Una lista cortada ya termina en «…»: no se le pone otro punto. */
const conPunto = (x: string): string => (x.endsWith('…') ? x : `${x}.`)

function listaCorta(nombres: readonly string[]): string {
  const vistos = [...new Set(nombres)]
  const corta = vistos.slice(0, MAXIMO_EN_LISTA).join(', ')
  return vistos.length > MAXIMO_EN_LISTA ? `${corta}…` : corta
}
