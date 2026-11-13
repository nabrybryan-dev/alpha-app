import { useSyncExternalStore } from 'react'

/**
 * Si la capa de Praxis está abierta. Un almacén mínimo a nivel de módulo, y no un contexto, para que el botón
 * de la barra (`BottomNav`) y la capa se hablen sin que ningún proveedor nuevo envuelva la app: con la bandera
 * apagada nada de esto se monta ni se lee.
 */
let abierta = false
const oyentes = new Set<() => void>()

function avisar() {
  for (const o of oyentes) o()
}

export function capaAbierta(): boolean {
  return abierta
}

export function abrirCapa(): void {
  if (abierta) return
  abierta = true
  avisar()
}

export function cerrarCapa(): void {
  if (!abierta) return
  abierta = false
  avisar()
}

/** Un toque abre; otro toque cierra. */
export function alternarCapa(): void {
  if (abierta) cerrarCapa()
  else abrirCapa()
}

function suscribir(o: () => void): () => void {
  oyentes.add(o)
  return () => {
    oyentes.delete(o)
  }
}

export function useCapaAbierta(): boolean {
  return useSyncExternalStore(suscribir, capaAbierta, () => false)
}

/** Solo para pruebas. */
export function _reiniciarCapaParaPruebas(): void {
  abierta = false
  oyentes.clear()
}
