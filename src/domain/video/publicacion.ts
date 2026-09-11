/**
 * QUÉ SE PUBLICA, DÓNDE Y CUÁNDO SE NIEGA — sin tocar la base.
 *
 * El domingo salen veintitrés vídeos, uno por persona, con la cara y la voz clonadas de
 * Bryan. Entre el archivo renderizado y la app no había nada: **hoy nadie escribe en
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

/**
 * La decisión ACEPTADA lleva el tipo dentro, y no por comodidad: es lo que hace imposible
 * construir una fila con un tipo que nadie validó. `filaDelVideo` pide esto, no el encargo,
 * así que el camino de inventarse un tipo sencillamente no existe.
 */
export interface PublicacionAceptada {
  publica: true
  path: string
  tipo: 'audio' | 'video'
  reemplaza: boolean
}

export type DecisionDePublicar =
  | PublicacionAceptada
  | { publica: false; motivo: MotivoDeNegarse }

/**
 * Tope de tamaño, en bytes. Cuarenta megas.
 *
 * No es una regla de calidad: es el suelo por debajo del cual un archivo no puede ser un
 * vídeo vertical de menos de un minuto, y el techo por encima del cual algo ha salido mal
 * en el renderizado. Subir 400 MB a veintitrés personas es una factura, no un domingo.
 */
export const TOPE_BYTES = 40 * 1024 * 1024

/**
 * Los formatos que se pueden publicar, en UNA SOLA TABLA.
 *
 * De aquí salen las tres cosas que antes vivían en dos sitios: qué se admite, con qué
 * `Content-Type` se sube y qué `tipo` se escribe en la fila. El script tenía su propia
 * lista y podía discrepar de ésta sin que nadie se enterara.
 *
 * **Manda la extensión del archivo, no un parámetro aparte.** Un `--tipo` explícito
 * permitiría que la fila dijera «audio» mientras los bytes son un vídeo: dos fuentes que
 * pueden contradecirse, y gana la que nadie miró. La extensión también puede mentir —basta
 * renombrar—, pero entonces mienten las dos a la vez y de forma coherente.
 *
 * **El audio entró el 11-sep y no es un añadido menor:** la primera revisión que se publica
 * ES de audio, y hasta ese día este módulo la habría rechazado por «extensión no admitida».
 * La pieza que publica no podía publicar el único formato que había que publicar.
 */
export const FORMATOS = {
  mp4: { tipo: 'video', contentType: 'video/mp4' },
  webm: { tipo: 'video', contentType: 'video/webm' },
  mov: { tipo: 'video', contentType: 'video/quicktime' },
  mp3: { tipo: 'audio', contentType: 'audio/mpeg' },
  m4a: { tipo: 'audio', contentType: 'audio/mp4' },
  wav: { tipo: 'audio', contentType: 'audio/wav' },
} as const satisfies Record<string, { tipo: 'audio' | 'video'; contentType: string }>

export type Extension = keyof typeof FORMATOS

function formatoDe(extension: string) {
  return FORMATOS[extension.toLowerCase() as Extension]
}

/**
 * Audio o vídeo, según la extensión del archivo real. **`undefined` si no la conoce.**
 *
 * La primera versión de esta función devolvía `'video'` para lo que no reconocía, y eso era
 * el mismo fallo que venía a impedir: la columna ya tiene `default 'video'`, así que
 * olvidarse del tipo no falla — **miente**. Poner ese olvido a mano, dentro de la función
 * encargada de evitarlo, era peor: parecía decidido.
 */
export function tipoDelMedio(extension: string): 'audio' | 'video' | undefined {
  return formatoDe(extension)?.tipo
}

/** Con qué `Content-Type` se sube al cajón. Mismo sitio, misma verdad. */
export function contentTypeDelMedio(extension: string): string | undefined {
  return formatoDe(extension)?.contentType
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
  if (!formatoDe(encargo.extension)) {
    return { publica: false, motivo: 'extension-no-admitida' }
  }
  // EL GUION NO ES OPCIONAL, y no por formalismo: es lo único que permite saber después qué
  // se le dijo a alguien. Un vídeo sin guion guardado es un vídeo que no se puede auditar.
  if (!encargo.guion.trim()) return { publica: false, motivo: 'sin-guion' }

  if (yaHay?.aprobadoEn && !forzar) return { publica: false, motivo: 'ya-aprobado' }

  return {
    publica: true,
    path: rutaDelVideo(encargo.usuarioId, encargo.semana, encargo.extension),
    // El tipo sale de AQUI, donde la extension acaba de comprobarse, y viaja con la
    // decision. Asi no hay forma de construir una fila con un tipo que nadie valido.
    tipo: tipoDelMedio(encargo.extension) as 'audio' | 'video',
    reemplaza: yaHay !== undefined,
  }
}

/**
 * La fila que se escribe. **Nunca lleva aprobación.**
 *
 * No es que se deje en `null`: es que la clave no se escribe, así que el valor lo pone la
 * base. Si mañana la columna cambia de nombre o de forma, este módulo sigue sin opinar —
 * que es justo lo que se quiere de algo que no tiene permiso para aprobar nada.
 */
export function filaDelVideo(encargo: EncargoDePublicacion, decision: PublicacionAceptada) {
  return {
    usuario_id: encargo.usuarioId,
    semana: encargo.semana,
    path: decision.path,
    guion: encargo.guion,
    tipo: decision.tipo,
  }
}
