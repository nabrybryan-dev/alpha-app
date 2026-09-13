import type { AdherenciaNutricional, CheckinDiario, Sesion } from '../types'
import { porcentajeAdherencia } from '../nutricion/adherencia'
import { esLunes } from '../video/publicacion'
import { resumenSemanal, type ResumenSemanal } from './calcular'
import { guionSemanal, type GuionSemanal } from './guion'

/**
 * EL PUENTE, y solo la mitad que decide.
 *
 * Estaban la cuenta (`calcular.ts`), la plantilla del guion (`guion.ts`), la voz
 * (fuera del repo, en Python) y el publicador (`scripts/publicar-video.mjs`) —y
 * nadie los ataba—. Esto es lo que los ata: dada la tanda entera de personas,
 * dice **a quién se le hace revisión esta semana, qué dice exactamente la suya y
 * a quién se salta y por qué**.
 *
 * No lee la base, no escribe archivos y no llama a nadie: es una función pura y
 * se prueba en frío. Quien mueve datos es `scripts/revision-semanal.mjs`. La
 * división es la misma que ya tienen `publicacion.ts` y el publicador, y por la
 * misma razón: lo que puede hacer daño es lo que se decide, y decidir no
 * necesita clave de servicio.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL NÚMERO DE LA COMIDA ES EL MISMO QUE EL DE LA TARJETA, A PROPÓSITO
 * ─────────────────────────────────────────────────────────────────────────────
 * El vídeo se ve **pegado encima** de la tarjeta de la semana. Si el vídeo dijera
 * la adherencia de los últimos siete días y la tarjeta la de siempre, el
 * asesorado oiría un número y leería otro a dos centímetros. Por eso aquí se
 * calcula con **todas** las adherencias registradas, igual que `HoyPage`.
 *
 * Es una decisión, no un descuido: si algún día la adherencia pasa a ser de la
 * semana, tiene que cambiar **en los dos sitios a la vez** o la contradicción
 * sale en pantalla.
 */

export interface PersonaDeLaTanda {
  usuarioId: string
  /** Como lo saluda el guion. Sin nombre, el guion dice «atleta». */
  nombre: string
  /** Las sesiones del microciclo vigente. Vacío si no tiene ninguno activo. */
  sesiones: Sesion[]
  checkins: CheckinDiario[]
  adherencias: AdherenciaNutricional[]
}

export type MotivoDeSalto =
  /** No tiene ni sesiones, ni comida registrada, ni una sola noche: el guion se quedaría en hola y adiós. */
  | 'nada-que-decir'
  /** Llegó sin id. Nunca debería pasar, pero un encargo sin dueño no se publica. */
  | 'sin-usuario'
  /**
   * El coach la dejó fuera: está en la lista de `fuera`. Existe porque la tanda sale de
   * quien tiene microciclo ACTIVO, y hay quien lo tiene y ya no entrena. Sin esto, el
   * jueves por la noche su vídeo volvía a salir aunque se hubiera quitado a mano.
   */
  | 'fuera-por-el-coach'

export interface Encargo {
  usuarioId: string
  nombre: string
  /** El LUNES de la semana, que es como la tabla la guarda. */
  semana: string
  resumen: ResumenSemanal
  guion: GuionSemanal
}

export interface Salto {
  usuarioId: string
  nombre: string
  motivo: MotivoDeSalto
}

export interface Tanda {
  semana: string
  encargos: Encargo[]
  saltos: Salto[]
}

/**
 * Si esta persona tiene algo que oír.
 *
 * Un guion siempre trae saludo y despedida —esas dos filas no dependen de ningún
 * dato—, así que un vídeo puede salir diciendo «hola Ana, esta es tu revisión de
 * la semana… nos vemos en la próxima sesión» y **ni un solo número**. Eso no es
 * una revisión: es ruido con la voz del coach, y encima suena a error.
 *
 * Tener algo que decir es tener al menos una de las tres: sesiones pautadas,
 * adherencia registrada, o una noche con sus dos horas.
 */
function hayAlgoQueDecir(resumen: ResumenSemanal): boolean {
  return (
    resumen.sesionesPautadas > 0 ||
    resumen.adherenciaPct !== undefined ||
    resumen.regularidad.nochesConDato > 0
  )
}

/** El lunes de la semana en la que cae esa fecha. Sirve para no tener que contarlo a mano. */
export function lunesDeLaSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new Error(`«${iso}» no es una fecha`)
  // getUTCDay: domingo es 0. La semana es la ISO, de lunes a domingo: el viernes en que
  // sale la revisión cae DENTRO de la semana que se está revisando, y el domingo es su
  // último día, no el primero de la siguiente.
  const dia = d.getUTCDay()
  const atras = dia === 0 ? 6 : dia - 1
  d.setUTCDate(d.getUTCDate() - atras)
  return d.toISOString().slice(0, 10)
}

/**
 * Un nombre de la lista del coach contra el de la app: sin mayúsculas ni espacios de más,
 * y con las tildes en la misma forma Unicode (una lista escrita a mano puede traer la «é»
 * descompuesta y la base guardarla precompuesta: a la vista son iguales y no casan).
 */
function comparable(texto: string): string {
  return texto.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

/**
 * El reparto de la tanda: quién oye qué este viernes.
 *
 * @param semana El LUNES de la semana. Cualquier otro día se rechaza aquí y no
 *   tres pasos después, cuando ya se hubieran generado veintitrés audios que el
 *   publicador va a devolver uno por uno.
 */
export function repartoSemanal(
  personas: readonly PersonaDeLaTanda[],
  semana: string,
  fuera: readonly string[] = [],
): Tanda {
  if (!esLunes(semana)) {
    throw new Error(
      `«${semana}» no es un lunes en AAAA-MM-DD, y la semana se guarda por su lunes. ` +
        'Se para aquí a propósito: más adelante costaría veintitrés audios.',
    )
  }

  const encargos: Encargo[] = []
  const saltos: Salto[] = []
  const quienesFuera = new Set(fuera.map(comparable).filter(Boolean))

  for (const persona of personas) {
    const nombre = (persona.nombre ?? '').trim()

    if (!persona.usuarioId?.trim()) {
      saltos.push({ usuarioId: persona.usuarioId ?? '', nombre, motivo: 'sin-usuario' })
      continue
    }

    if (quienesFuera.has(comparable(nombre)) || quienesFuera.has(comparable(persona.usuarioId))) {
      saltos.push({ usuarioId: persona.usuarioId, nombre, motivo: 'fuera-por-el-coach' })
      continue
    }

    const adherencias = persona.adherencias ?? []
    const resumen = resumenSemanal({
      sesiones: persona.sesiones ?? [],
      checkins: persona.checkins ?? [],
      adherenciaPct: adherencias.length > 0 ? porcentajeAdherencia(adherencias) : undefined,
    })

    if (!hayAlgoQueDecir(resumen)) {
      saltos.push({ usuarioId: persona.usuarioId, nombre, motivo: 'nada-que-decir' })
      continue
    }

    encargos.push({
      usuarioId: persona.usuarioId,
      nombre,
      semana,
      resumen,
      guion: guionSemanal(resumen, nombre),
    })
  }

  return { semana, encargos, saltos }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DE LAS FILAS DE LA BASE A LAS PERSONAS DE LA TANDA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Esto vive aquí, y no dentro del script que lee la base, porque es donde se
 * equivoca uno: las columnas van en `usuario_id` y el dominio en `usuarioId`, y
 * un nombre mal copiado no da error — deja a esa persona con cero sesiones y le
 * dice en voz alta que no entrenó. Aquí se puede probar en frío.
 */
export interface FilasDeLaBase {
  /** `usuarios_app`, ya filtrada a los asesorados. */
  usuarios: readonly { id: string; nombre?: string | null }[]
  /** `microciclos`, ya filtrada a los ACTIVOS. El microciclo entero va en `datos`. */
  microciclos: readonly { usuario_id: string; datos?: { sesiones?: Sesion[] } | null }[]
  /** `checkins`. El check-in entero va en `datos`, en camelCase. */
  checkins: readonly { usuario_id: string; datos?: CheckinDiario | null }[]
  /** `adherencias`, columna a columna. */
  adherencias: readonly {
    id: string
    usuario_id: string
    fecha: string
    estado: AdherenciaNutricional['estado']
    comentario?: string | null
  }[]
}

function agruparPorUsuario<T extends { usuario_id: string }>(filas: readonly T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>()
  for (const fila of filas) {
    const lista = mapa.get(fila.usuario_id)
    if (lista) lista.push(fila)
    else mapa.set(fila.usuario_id, [fila])
  }
  return mapa
}

/**
 * Quién entra en la tanda y con qué datos.
 *
 * **La tanda la define el microciclo activo**, no la lista de asesorados: parte de la
 * cartera está inactiva a propósito —una pausa, un viaje, un alta que aún no empieza— y a
 * esa gente no se le manda el viernes la revisión de una semana que no tenía que entrenar.
 *
 * @param soloUno Si se da, solo esa persona. Para probar con uno antes que con veintitrés.
 */
export function personasDeLaTanda(filas: FilasDeLaBase, soloUno?: string): PersonaDeLaTanda[] {
  const nombres = new Map(filas.usuarios.map((u) => [u.id, (u.nombre ?? '').trim()]))
  const checkins = agruparPorUsuario(filas.checkins)
  const adherencias = agruparPorUsuario(filas.adherencias)

  const personas: PersonaDeLaTanda[] = []

  for (const microciclo of filas.microciclos) {
    const usuarioId = microciclo.usuario_id
    // Quien no está en la lista de asesorados no entra: son los microciclos del propio
    // staff, que los usan para probar, y una revisión suya no va a ninguna parte.
    if (!nombres.has(usuarioId)) continue
    if (soloUno && usuarioId !== soloUno) continue

    personas.push({
      usuarioId,
      nombre: nombres.get(usuarioId) ?? '',
      sesiones: microciclo.datos?.sesiones ?? [],
      checkins: (checkins.get(usuarioId) ?? [])
        .map((c) => c.datos)
        .filter((c): c is CheckinDiario => Boolean(c)),
      adherencias: (adherencias.get(usuarioId) ?? []).map((a) => ({
        id: a.id,
        usuarioId: a.usuario_id,
        fecha: a.fecha,
        estado: a.estado,
        comentario: a.comentario ?? undefined,
      })),
    })
  }

  return personas
}
