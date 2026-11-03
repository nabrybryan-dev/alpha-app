import { useState } from 'react'

/**
 * SIMPLE O TÉCNICO en la guía de zonas. Es una preferencia del dispositivo (no de la persona en la
 * base): se recuerda en localStorage y, si el navegador no deja guardar, la guía se dibuja igual.
 * Por defecto es TÉCNICO, para que nadie vea un cambio sin pedirlo. No depende de
 * `perfil.vistaSimple`: quien la tiene no ve el salón.
 */
export type ModoDeLaGuia = 'simple' | 'tecnico'

export const LLAVE_MODO_DE_LA_GUIA = 'alpha-guia-modo'

function leerModo(): ModoDeLaGuia {
  try {
    return localStorage.getItem(LLAVE_MODO_DE_LA_GUIA) === 'simple' ? 'simple' : 'tecnico'
  } catch {
    return 'tecnico'
  }
}

export function useModoDeLaGuia(): [ModoDeLaGuia, (modo: ModoDeLaGuia) => void] {
  const [modo, setModo] = useState<ModoDeLaGuia>(leerModo)
  const elegir = (nuevo: ModoDeLaGuia) => {
    setModo(nuevo)
    try {
      localStorage.setItem(LLAVE_MODO_DE_LA_GUIA, nuevo)
    } catch {
      // Sin almacenamiento el modo vale solo mientras la guía esté abierta.
    }
  }
  return [modo, elegir]
}
