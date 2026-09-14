// Tipos del vigía (`vigia.mjs`).
//
// El script es `.mjs` a propósito: lo ejecuta Node en Actions sin instalar nada, ni
// siquiera `npm ci`. Esta declaración existe para que `vigia.test.ts` lo vea tipado,
// y el test importa los tipos DE AQUÍ y los valores del `.mjs`, igual que
// `espejo.test.ts`. Si cambian las firmas del `.mjs`, hay que actualizar este
// archivo a mano.
//
// `scripts/` queda fuera de `tsconfig.app.json`, así que `tsc -b` no revisa esta
// carpeta: la vigila el test.

export interface Config {
  repo: string
  urlApp: string
  /** Empieza por aquí, con guion largo. Vercel renombró los entornos. */
  prefijoProduccion: string
  /** Contexto del estado de commit que publica Vercel para este proyecto. */
  contextoVercel: string
  margenMin: number
  etiqueta: string
  intentos: number
  esperaMs: number
}
export const CONFIG: Config

export type EstadoComprobacion = 'verde' | 'alarma' | 'en-espera' | 'indeterminado'

export interface Comprobacion {
  nombre: 'app' | 'produccion'
  estado: EstadoComprobacion
  /** Solo en alarma. Estable entre corridas: es lo que decide si hay que volver a avisar. */
  clave?: string
  detalle: string
}

export type RespuestaApp = { codigo: number; errorVercel: string | null } | { fallo: string }

export interface Despliegue {
  sha: string
  environment: string
  created_at?: string
}

export interface EstadoCommit {
  context: string
  state: string
  description: string | null
}

export interface EstadoCombinado {
  state: string
  statuses: EstadoCommit[]
}

export interface Head {
  sha: string
  /** Fecha del committer: en una fusión por PR, el momento de fusionar. */
  fecha: string
}

export function evaluarApp(respuesta: RespuestaApp): Comprobacion

export function evaluarProduccion(entrada: {
  head: Head
  estado: EstadoCombinado
  despliegues: Despliegue[]
  ahora: Date
  margenMin: number
}): Comprobacion

export interface Resumen {
  comprobaciones: Comprobacion[]
  alarmas: Comprobacion[]
  /** `false` si alguna comprobación quedó indeterminada o en espera. */
  concluyente: boolean
  /** Claves de las alarmas, ordenadas y unidas. Vacía si no hay alarmas. */
  clave: string
}

export function resumir(comprobaciones: Comprobacion[]): Resumen

export interface IssueAbierto {
  numero: number
  /** Motivo del último aviso escrito en el issue; `null` si no lleva marca. */
  clave: string | null
}

export type TipoAccion = 'nada' | 'abrir' | 'comentar' | 'cerrar'

export interface Accion {
  tipo: TipoAccion
  motivo: string
}

export function decidir(issue: IssueAbierto | null, resumen: Resumen): Accion

/** Comentario HTML invisible con la clave, para leerla en la corrida siguiente. */
export function marcar(clave: string): string

/** La clave de la ÚLTIMA marca del texto, o `null`. */
export function leerClave(texto: string | null | undefined): string | null

export interface OpcionesVigilar {
  fetch?: typeof globalThis.fetch
  token?: string | null
  ahora?: Date
  /** `false` (por defecto): decide y lo cuenta, pero no escribe en GitHub. */
  avisar?: boolean
  urlApp?: string
  margenMin?: number
  intentos?: number
  esperaMs?: number
  registrar?: (linea: string) => void
  /** Enlace a la corrida de Actions, para ponerlo en el aviso. */
  enlaceCorrida?: string | null
}

export interface ResultadoVigilar {
  comprobaciones: Comprobacion[]
  resumen: Resumen
  issue: IssueAbierto | null
  accion: Accion
  /** `true` solo si se escribió de verdad en GitHub. */
  escrito: boolean
}

export function vigilar(opciones?: OpcionesVigilar): Promise<ResultadoVigilar>

export interface Argumentos {
  avisar: boolean
  urlApp: string
  margenMin: number
}

export function leerArgumentos(argv: string[]): Argumentos
