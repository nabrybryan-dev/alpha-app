/**
 * QUÉ SE PUBLICA, DÓNDE Y CUÁNDO SE NIEGA — sin tocar la base.
 *
 * El domingo salen veintitrés revisiones, una por persona, con la voz clonada de Bryan —y
 * con su cara cuando eso sea posible; la primera tanda es **solo audio**, que es lo que la
 * máquina de Bryan puede producir hoy. Entre el archivo renderizado y la app no había nada: **hoy nadie escribe en
 * `videos_semanales`**, medido sobre todas las ramas. Esto es esa pieza, y aquí vive solo
 * la parte que DECIDE; el script que sube y escribe (`scripts/publicar-video.mjs`) es una
 * tubería fina encima.
 *
 * Se parte así porque las decisiones de abajo son las que pueden hacer daño, y ninguna
 * necesita una clave de servicio para probarse.
 *
 * ## Las tres cosas que este módulo impide
 *
 * 1. **PUBLICAR NO ES APROBAR.** El publicador no firma nunca. Lo aprobado lo decide la
 *    bandeja —o la puerta, cuando lleve cuatro domingos limpios— y ese es el único camino.
 *    Un publicador que además aprobara convertiría la firma en un trámite que se salta solo
 *    con volver a subir el archivo.
 * 2. **No se pisa un vídeo ya aprobado.** Volver a publicar sobre una semana firmada
 *    cambiaría el archivo por debajo de una aprobación que ya se dio: alguien firmó un
 *    vídeo y se emite otro. Eso se niega, y para forzarlo hay que decirlo a propósito.
 * 3. **La persona se identifica por su id, nunca por su nombre.** Ya costó una carga: dos
 *    personas que comparten nombre. Aquí el nombre no entra ni como atajo.
 */

/** Lo que hace falta para publicar el vídeo de una persona en una semana. */
export interface EncargoDePublicacion {
  /** El id de la persona (uuid de `auth.users`). Nunca su nombre. */
  usuarioId: string
  /** El LUNES de la semana a la que pertenece, en `AAAA-MM-DD`. */
  semana: string
  /** Bytes del vídeo ya renderizado. */
  tamanoBytes: number
  /** La extensión del archivo, sin punto. */
  extension: string
  /** Lo que el vídeo dice, palabra por palabra. Es lo que permite auditarlo después. */
  guion: string
}

/** Lo que ya hay guardado de esa persona y esa semana, si hay algo. */
export interface VideoYaPublicado {
  path: string
  /** Cuándo se firmó. `null` o ausente = todavía no lo ha firmado nadie. */
  aprobadoEn?: string | null
}

export type MotivoDeNegarse =
  | 'sin-usuario'
  | 'semana-no-es-lunes'
  | 'archivo-vacio'
  | 'archivo-enorme'
  | 'extension-no-admitida'
  | 'sin-guion'
  | 'ya-aprobado'

export type DecisionDePublicar =
  | { publica: true; path: string; reemplaza: boolean }
  | { publica: false; motivo: MotivoDeNegarse }

/**
 * Tope de tamaño, en bytes. Cuarenta megas.
 *
 * No es una regla de calidad: es el suelo por debajo del cual un archivo no puede ser un
 * vídeo vertical de menos de un minuto, y el techo por encima del cual algo ha salido mal
 * en el renderizado. Subir 400 MB a veintitrés personas es una factura, no un domingo.
 */
export const TOPE_BYTES = 40 * 1024 * 1024

/** Vídeo con cara, o solo voz. La primera revisión que sale es de AUDIO. */
export type TipoDeMedio = 'video' | 'audio'

/**
 * LA ÚNICA TABLA: qué se admite, cómo se sube y qué se escribe.
 *
 * De aquí salen las tres cosas —la lista de extensiones, el `Content-Type` del archivo y el
 * `tipo` de la fila—, y salen de aquí **a propósito**. Cuando el script tenía su propio mapa
 * de `Content-Type`, añadir una extensión pedía acordarse de dos sitios; el segundo es
 * justo el que no se toca.
 *
 * Y el `tipo` lo decide **la extensión**, no un parámetro aparte. Un parámetro permitiría
 * que la fila dijera «audio» mientras los bytes son un mp4: dos fuentes que pueden
 * contradecirse, y la que gana es la que nadie miró. La extensión también puede mentir —
 * alguien renombra un .wav a .mp4—, pero entonces miente una sola cosa y de forma coherente.
 */
export const MEDIOS: Record<string, { tipo: TipoDeMedio; contentType: string }> = {
  mp4: { tipo: 'video', contentType: 'video/mp4' },
  webm: { tipo: 'video', contentType: 'video/webm' },
  mov: { tipo: 'video', contentType: 'video/quicktime' },
  mp3: { tipo: 'audio', contentType: 'audio/mpeg' },
  m4a: { tipo: 'audio', contentType: 'audio/mp4' },
  wav: { tipo: 'audio', contentType: 'audio/wav' },
}

/** Qué es este archivo, según su extensión. `undefined` si no se admite. */
export function medioDeLaExtension(extension: string) {
  return MEDIOS[extension.toLowerCase()]
}

/** Un lunes en `AAAA-MM-DD`, que es como la tabla guarda la semana. */
function esLunes(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 1
}

/**
 * DÓNDE VA EL ARCHIVO.
 *
 * `personas/<uuid>/<lunes>.<ext>`, que es la forma que la política de storage ya espera. La
 * ruta es **adivinable a propósito** —no es un secreto y no puede serlo—: lo que impide
 * abrirla no es que nadie sepa el nombre, es la política. Confiar en que nadie adivine una
 * ruta es la forma de tener un agujero que nadie ve.
 */
export function rutaDelVideo(usuarioId: string, semana: string, extension: string): string {
  return `personas/${usuarioId}/${semana}.${extension.toLowerCase()}`
}

/**
 * Si este encargo se puede publicar, y qué pasa con lo que ya hubiera.
 *
 * @param yaHay Lo que la tabla tiene para esa persona y esa semana, si hay algo.
 * @param forzar Sobrescribir aunque esté aprobado. Se pide a propósito y con la mano.
 */
export function decidirPublicacion(
  encargo: EncargoDePublicacion,
  yaHay?: VideoYaPublicado,
  forzar = false,
): DecisionDePublicar {
  if (!encargo.usuarioId.trim()) return { publica: false, motivo: 'sin-usuario' }
  if (!esLunes(encargo.semana)) return { publica: false, motivo: 'semana-no-es-lunes' }
  if (encargo.tamanoBytes <= 0) return { publica: false, motivo: 'archivo-vacio' }
  if (encargo.tamanoBytes > TOPE_BYTES) return { publica: false, motivo: 'archivo-enorme' }
  if (!medioDeLaExtension(encargo.extension)) {
    return { publica: false, motivo: 'extension-no-admitida' }
  }
  // EL GUION NO ES OPCIONAL, y no por formalismo: es lo único que permite saber después qué
  // se le dijo a alguien. Un vídeo sin guion guardado es un vídeo que no se puede auditar.
  if (!encargo.guion.trim()) return { publica: false, motivo: 'sin-guion' }

  if (yaHay?.aprobadoEn && !forzar) return { publica: false, motivo: 'ya-aprobado' }

  return {
    publica: true,
    path: rutaDelVideo(encargo.usuarioId, encargo.semana, encargo.extension),
    reemplaza: yaHay !== undefined,
  }
}

/**
 * La fila que se escribe. **Nunca lleva aprobación, y SIEMPRE lleva tipo.**
 *
 * Lo de la aprobación no es que se deje en `null`: es que la clave no se escribe, así que el
 * valor lo pone la base. Si mañana la columna cambia de nombre o de forma, este módulo sigue
 * sin opinar — que es justo lo que se quiere de algo que no tiene permiso para aprobar nada.
 *
 * Con el `tipo` pasa lo contrario, y por eso se escribe siempre aunque la columna tenga un
 * valor por defecto: ese defecto es `'video'`, así que **olvidarse del tipo no falla,
 * miente** — una revisión de audio quedaría marcada como vídeo y nadie se enteraría hasta
 * que a alguien le apareciera un reproductor esperando una cara que no existe. Una columna
 * con defecto es el sitio donde un olvido se disfraza de dato.
 */
export function filaDelVideo(encargo: EncargoDePublicacion, path: string) {
  return {
    usuario_id: encargo.usuarioId,
    semana: encargo.semana,
    path,
    guion: encargo.guion,
    tipo: medioDeLaExtension(encargo.extension)?.tipo,
  }
}
