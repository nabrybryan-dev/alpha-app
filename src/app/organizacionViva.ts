import { useEffect, useSyncExternalStore } from 'react'
import { leerOrganizacion, type OrganizacionGuardada } from '../data/praxis/organizacion'
import { SIN_ORGANIZACION, type OrganizacionVisible } from '../domain/praxis/organizacion/aplicarOrganizacion'
import { disenoFinalEncendidoPara, organizarEncendidoPara } from '../domain/praxis/rapidezLocal'

/**
 * La organización guardada de la persona con sesión, compartida entre Hoy, la barra y Praxis. Se lee una vez y se
 * reemplaza después de cada cambio que Praxis guarda (`fijarOrganizacionViva`). Solo existe para quien tiene encendida
 * la prueba (`organizarEncendidoPara`); para cualquier otra persona es siempre «sin organización» y no lee nada.
 */
let actual: { usuarioId: string; org: OrganizacionVisible } | null = null
let pedida: string | null = null
/** La persona con sesión que pidió su organización (la marca el layout). Las piezas de cada pantalla leen la suya. */
let vigente: string | null = null
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((f) => f())

const aVisible = (g: OrganizacionGuardada): OrganizacionVisible => ({ ocultas: new Set(g.ocultas), movidas: g.movidas })

export function fijarOrganizacionViva(usuarioId: string, g: OrganizacionGuardada): void {
  actual = { usuarioId, org: aVisible(g) }
  avisar()
}

/** Solo para pruebas. */
export function reiniciarOrganizacionViva(): void { actual = null; pedida = null; vigente = null; avisar() }

export function useOrganizacionVisible(usuarioId: string): OrganizacionVisible {
  const encendida = organizarEncendidoPara(usuarioId)
  useEffect(() => {
    if (vigente !== usuarioId) { vigente = usuarioId; avisar() }
    if (!encendida || pedida === usuarioId) return
    pedida = usuarioId
    void leerOrganizacion(usuarioId).then((g) => fijarOrganizacionViva(usuarioId, g))
  }, [encendida, usuarioId])
  const org = useSyncExternalStore(
    (f) => { oyentes.add(f); return () => { oyentes.delete(f) } },
    () => (encendida && actual?.usuarioId === usuarioId ? actual.org : SIN_ORGANIZACION),
  )
  return org
}

/**
 * La organización de la persona con sesión, para las piezas de cada pantalla (`PiezaOrganizable`), sin depender de la
 * sesión: es la que pidió el layout. Para quien no tiene la prueba encendida, siempre «sin organización».
 */
export function useOrganizacionDeLaSesion(): OrganizacionVisible {
  return useSyncExternalStore(
    (f) => { oyentes.add(f); return () => { oyentes.delete(f) } },
    () => (vigente && organizarEncendidoPara(vigente) && actual?.usuarioId === vigente ? actual.org : SIN_ORGANIZACION),
  )
}

/**
 * ¿Esta persona ve el diseño final encendido? `forzado` (una prueba o una pantalla que lo pide) manda; si no, es la persona
 * con sesión que marcó el layout. Para quien no está en la lista (`CUENTAS_CON_DISENO_FINAL`) siempre es `false`.
 */
export function useDisenoFinal(forzado?: boolean): boolean {
  const deLaSesion = useSyncExternalStore(
    (f) => { oyentes.add(f); return () => { oyentes.delete(f) } },
    () => disenoFinalEncendidoPara(vigente),
  )
  return forzado ?? deLaSesion
}
