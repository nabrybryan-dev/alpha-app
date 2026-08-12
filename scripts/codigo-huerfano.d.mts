// Tipos del detector de código sin enchufar (`codigo-huerfano.mjs`).
//
// El script es `.mjs` a propósito, igual que `semilla-sql.mjs`: lo ejecuta Node sin
// pasar por el compilador. Esta declaración existe para que `tsc --strict` y el test
// `src/test/codigo-huerfano.test.ts` lo vean tipado en vez de como `any` implícito.
// Si cambian las firmas del `.mjs`, hay que actualizar este archivo a mano.

/** Un módulo que no importa nadie, o un nombre exportado que no usa nadie. */
export interface Huerfano {
  /** `src/domain/x.ts` para un módulo; `src/domain/x.ts#nombre` para una exportación. */
  clave: string
  /** Ruta del módulo, relativa a la raíz del proyecto y con barras normales. */
  modulo: string
}

export interface ModuloHuerfano extends Huerfano {
  /** Cuántos nombres exporta el módulo que nadie importa. */
  exporta: number
}

export interface ExportacionHuerfana extends Huerfano {
  nombre: string
}

export interface Huerfanos {
  modulos: ModuloHuerfano[]
  exportaciones: ExportacionHuerfana[]
}

export interface OpcionesBusqueda {
  raizProyecto: string
  /** Por defecto `src/domain`. */
  carpetaVigilada?: string
  /** Por defecto `['src', 'scripts']`. */
  carpetasConsumidoras?: string[]
}

/** Qué importa un archivo; `'*'` cuando se trae el módulo entero. */
export interface Importacion {
  especificador: string
  nombres: string[] | '*'
}

/** `true` si la ruta es un archivo de pruebas. */
export function esArchivoDeTest(ruta: string): boolean

/** `true` si `archivo` es un test del propio módulo (mismo directorio y nombre base). */
export function esTestPropio(rutaModulo: string, archivo: string): boolean

/** Nombres exportados que existen en tiempo de ejecución (sin tipos ni interfaces). */
export function exportacionesDeValor(codigo: string, ruta?: string): string[]

/** Qué importa el archivo y de dónde, incluidos `export … from` e `import()`. */
export function importacionesDe(codigo: string, ruta?: string): Importacion[]

/** Nombres que el archivo usa dentro de sí mismo, más allá de declararlos. */
export function nombresUsadosInternamente(codigo: string, ruta?: string): Set<string>

/** Ruta absoluta del módulo al que apunta un `import` relativo, o `null`. */
export function resolverModulo(archivoQueImporta: string, especificador: string): string | null

/** Todos los archivos de código bajo `raiz`, recursivamente. */
export function listarArchivos(raiz: string): string[]

/** Las dos señales de código sin enchufar: módulos que nadie importa y exportaciones muertas. */
export function buscarHuerfanos(opciones: OpcionesBusqueda): Huerfanos
