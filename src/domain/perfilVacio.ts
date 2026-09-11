import type { MedidaCorporal, Perfil } from './types'

/**
 * La ficha de alguien que todavía no tiene ficha: los valores neutros y, si las hay, sus
 * medidas.
 *
 * Es lo que `agregarMedida` (mockDb) fabricaba a mano cuando el asesorado registraba su
 * primera medida sin tener ficha. Desde el 2026-09-06 lo usa también la fusión de lectura
 * (`data/nube/fusion.ts`): una medida pendiente de subir tiene que seguir viéndose aunque
 * la descarga del servidor llegue antes que la subida, y si el servidor aún no tiene la
 * ficha, la fusión la estrena igual que la estrenará él (`registrar_medida`, 0057). Un solo
 * sitio, para que «vacío» signifique lo mismo en los dos.
 */
export function perfilVacio(usuarioId: string, medidas: readonly MedidaCorporal[] = []): Perfil {
  return {
    usuarioId,
    objetivos: '',
    edad: 0,
    diasEntrenamiento: 0,
    tiempoSesionMin: 0,
    somatotipo: '',
    volumenSemanal: {},
    medidas: [...medidas],
  }
}
