/**
 * El Atajo de Apple de la Fase A de salud del celular. Lógica pura: sin React y sin I/O.
 *
 * Diseño: `vigia-codex/estilo-de-vida/COSTOS-APP-NATIVA-Y-SALUD.md` (§3, Fase 1). Cómo se
 * construye el atajo en el iPhone: `docs/salud-atajo/COMO-CREAR-EL-ATAJO.md`.
 */

/**
 * El enlace de iCloud del atajo, para que la persona lo abra desde su iPhone y toque
 * «Obtener atajo».
 *
 * VACÍO A PROPÓSITO hasta que Bryan cree el atajo en su iPhone y lo comparta («Compartir →
 * Copiar enlace de iCloud»; ver la guía). Mientras esté vacío la pantalla dice que todavía no
 * está publicado y no pinta ningún botón. Cuando lo pegue aquí, `esEnlaceDeIcloud` tiene que
 * darle el visto bueno: hay una prueba que lo exige.
 */
export const ENLACE_ATAJO_ICLOUD = ''

/**
 * ¿Es un enlace de atajo compartido de iCloud? Solo `https://www.icloud.com/shortcuts/<id>`,
 * sin otros parámetros ni otro dominio: es lo único que la pantalla se deja poner como
 * destino de un botón.
 */
export function esEnlaceDeIcloud(url: string): boolean {
  return /^https:\/\/www\.icloud\.com\/shortcuts\/[0-9a-zA-Z]{16,64}\/?$/.test(url)
}

export type Plataforma = 'ios' | 'android' | 'otra'

/**
 * En qué teléfono está la persona, para decidir qué se le enseña: el atajo solo existe en
 * iPhone (y iPad). En Android se anota a mano en el check-in (decisión de Bryan, 28-sep).
 *
 * Un iPad reciente se presenta como un Mac de escritorio; se distingue por la pantalla táctil.
 */
export function plataformaDe(userAgent: string, puntosTactiles = 0): Plataforma {
  if (/android/i.test(userAgent)) return 'android'
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios'
  if (/macintosh/i.test(userAgent) && puntosTactiles > 1) return 'ios'
  return 'otra'
}

/** Formato del código que genera la base: `sa_` y 40 hexadecimales (migración 0093). */
export function pareceCodigoDeAtajo(texto: string): boolean {
  return /^sa_[0-9a-f]{40}$/.test(texto)
}
