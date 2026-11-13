/**
 * Banderas de Hoy. Apagadas por defecto: con la bandera apagada, Hoy queda exactamente
 * como estaba (misma estructura, mismas clases).
 *
 * HOY_CON_ANILLO: pieza C1 del plan de subir el diseño. Enciende el anillo del día
 * (`AnilloDelDia`, B6) arriba de la banda «Lo de hoy» y pasa las tarjetas a radio 22 px
 * (maqueta v17: `build-v8/1-css.css:120`, `.card{border-radius:22px}`). Solo el asesorado.
 * No se enciende hasta que Bryan decida qué dato alimenta el anillo (ver `hechoDelAnillo`
 * en `HoyPage.tsx`).
 */
export const HOY_CON_ANILLO = false
