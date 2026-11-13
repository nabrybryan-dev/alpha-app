import { HOY_CON_ANILLO } from './banderas'

export function hoyConAnillo(esStaff: boolean): boolean {
  return HOY_CON_ANILLO && !esStaff
}

export function marcoDeHoy(marco: string, conAnillo: boolean): string {
  return conAnillo ? `${marco} hoy-con-anillo` : marco
}
