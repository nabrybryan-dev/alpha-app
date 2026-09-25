import { EmptyState } from '../../../components/ui/EmptyState'

/**
 * El estado vacío honesto que pide DISENO-CONSOLA-V2.md para todo lo que
 * dependa de las tablas nuevas de la cadena (fase 2: `cadena_corridas`,
 * `aprobaciones`, `ordenes`, `publicaciones_pendientes`). Esta primera
 * entrega es de solo lectura sobre lo que YA existe en `src/data/repos.ts`;
 * nada de esto se inventa ni se simula.
 */
export function PendienteDeCadena({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <EmptyState
      titulo={titulo}
      detalle={
        detalle ??
        'Llega cuando la cadena sincronice. Depende de tablas que todavía no existen en esta capa de datos (fase 2 de DISENO-CONSOLA-V2.md).'
      }
    />
  )
}
