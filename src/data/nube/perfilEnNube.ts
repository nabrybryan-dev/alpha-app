import { esSexoDeFicha } from '../../domain/sexoDeFicha'
import type { Perfil, SexoDeFicha } from '../../domain/types'

/**
 * CÓMO VIAJA LA FICHA (`perfiles`) ENTRE LA APP Y LA NUBE.
 *
 * La fila tiene dos partes: el blob `datos` —la ficha entera, en JSONB— y, desde
 * la migración 0056, la columna `sexo`. Está FUERA del blob a propósito: queda
 * consultable en SQL, el `check` de la base fija su vocabulario, y un móvil
 * que suba el blob viejo (hidrató antes de que el coach la rellenara) no la
 * puede pisar, porque su envío no la nombra.
 *
 * EL NOMBRE DE LA COLUMNA SALE DE AQUÍ Y DE NINGÚN OTRO SITIO. Un `.select()`
 * con una columna que no existe no avisa: ni `tsc` ni los tests lo ven, y
 * `hidratarDesdeNube` se traga el error y deja la app con la instantánea
 * local sin sincronizar. Por eso `perfilEnNube.test.ts` comprueba esta
 * constante contra el SQL de la migración, y las dos filas que suben llevan
 * `satisfies` con los tipos de abajo: si el nombre cambiara aquí, dejarían de
 * compilar en vez de subir una clave que la base no conoce.
 */
export const TABLA_PERFILES = 'perfiles'
export const COLUMNA_SEXO = 'sexo'
/** Lo que pide `hidratar.ts`: el blob y la columna, nada más. */
export const SELECCION_PERFILES = `datos,${COLUMNA_SEXO}`

/** La fila tal como baja (`select datos,sexo`), o como espera en la cola. */
export interface FilaPerfil {
  datos: unknown
  [COLUMNA_SEXO]?: unknown
}

/** El blob que va a `datos`: la ficha SIN el sexo, que viaja en su columna. */
export type DatosDePerfil = Omit<Perfil, 'sexo'>

/**
 * La fila que sube el COACH: el blob y la columna, siempre las dos.
 *
 * Siempre, porque la cola funde los upserts de la misma fila (`integrarEnCola`):
 * si fijar el sexo y guardar una valoración sin red dejaran dos envíos, el
 * segundo reemplazaría al primero, y sin la columna el sexo moriría en la cola.
 */
export type FilaPerfilDelCoach = {
  usuario_id: string
  datos: DatosDePerfil
  [COLUMNA_SEXO]: SexoDeFicha | null
}

/*
 * EL ASESORADO NO SUBE FILA (desde la 0057). Hasta el 2026-09-06 subía `{usuario_id, datos}`
 * sin nombrar la columna —su copia del sexo podía ser vieja—, y ese blob entero era
 * justamente lo que `proteger_perfil` rechazaba a quien no tenía ficha. Su medida viaja
 * ahora en una llamada (`registrar_medida`, ver `subirMedida` en sync.ts) que no lleva ni
 * la columna ni la fila: el servidor estrena la ficha o mete la medida en la que hay.
 */

/** La ficha sin el sexo dentro: lo que va en `datos`. */
export function datosDePerfil(perfil: Perfil): DatosDePerfil {
  const datos: Perfil = { ...perfil }
  delete datos.sexo
  return datos
}

function sexoDeFila(fila: FilaPerfil): SexoDeFicha | undefined {
  const valor = fila[COLUMNA_SEXO]
  return esSexoDeFicha(valor) ? valor : undefined
}

function usuarioIdDe(fila: FilaPerfil): string | undefined {
  const datos = fila.datos
  if (!datos || typeof datos !== 'object') return undefined
  const id = (datos as { usuarioId?: unknown }).usuarioId
  return typeof id === 'string' ? id : undefined
}

/**
 * Las fichas a partir de las filas. LA COLUMNA MANDA: si el blob trajera un
 * `sexo` dentro —una carga por SQL, un cliente viejo—, se ignora.
 *
 * `filas` son las que se van a convertir: lo que bajó del servidor con las
 * escrituras pendientes de este dispositivo puestas encima (`conPendientes`).
 * `servidor` son las mismas filas ANTES de esa fusión. Hacen falta las dos por
 * un detalle de la fusión: un upsert pendiente reemplaza la fila entera, y el
 * del asesorado no nombra la columna. Sin este respaldo, registrar una medida
 * sin red haría que el salón olvidara el sexo hasta la siguiente descarga: el
 * servidor lo tendría, la pantalla no. Se distingue por la CLAVE, no por el
 * valor: `null` con la clave es el coach quitándolo, y eso sí tiene que ganar.
 */
export function perfilesDe(filas: readonly FilaPerfil[], servidor: readonly FilaPerfil[] = filas): Perfil[] {
  const sexoEnServidor = new Map<string, SexoDeFicha | undefined>()
  for (const fila of servidor) {
    const id = usuarioIdDe(fila)
    if (id) sexoEnServidor.set(id, sexoDeFila(fila))
  }

  return filas.map((fila) => {
    const perfil: Perfil = { ...(fila.datos as Perfil) }
    const sexo = COLUMNA_SEXO in fila ? sexoDeFila(fila) : sexoEnServidor.get(perfil.usuarioId)
    if (sexo) perfil.sexo = sexo
    else delete perfil.sexo
    return perfil
  })
}
