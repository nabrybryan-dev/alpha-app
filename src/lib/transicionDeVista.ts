import { flushSync } from 'react-dom'

/**
 * Cambiar de pantalla como UNA escena, y no como dos entradas encadenadas.
 *
 * La gramática ya estaba estilada en `tokens.css` desde hace tiempo —las curvas
 * y la duración de `::view-transition-old/new(root)`, y el plano con nombre
 * `ventana-hero`— y **no la disparaba nadie**: `startViewTransition` no aparecía
 * ni una vez en todo `src`. Esto es el interruptor que faltaba.
 *
 * ## El `flushSync` no es opcional
 *
 * El navegador toma la foto del estado NUEVO dentro de esta devolución de
 * llamada. React, por su cuenta, puede aplazar el render a después — y entonces
 * la foto sale con la pantalla vieja y la transición no transiciona nada: se ve
 * un corte igual que sin ella, pero pagando el coste.
 *
 * ## Y si el navegador no la trae, se cambia igual
 *
 * Es la mejora la que se pierde, nunca la función. Lo mismo con `prefers-reduced-motion`:
 * eso lo resuelve `tokens.css`, que ya anula estas animaciones — la transición se
 * pide igual y el sistema decide si se ve.
 */
export function conTransicionDeVista(cambiar: () => void): void {
  // Se ata a `document` a propósito: leerla suelta y llamarla después la
  // desvincula de su dueño y algunos navegadores lanzan un TypeError.
  const arrancar = document.startViewTransition?.bind(document)
  if (!arrancar) {
    cambiar()
    return
  }
  arrancar(() => flushSync(cambiar))
}
