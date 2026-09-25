import { PendienteDeCadena } from '../PendienteDeCadena'

/**
 * Módulo 2: el tablero ①②③④ por persona y la bandeja de preguntas D8.
 *
 * Depende ENTERO de tablas de la fase 2 (`cadena_corridas`, `ordenes`,
 * la bandeja de preguntas con plazo D8) que hoy no existen en
 * `src/data/repos.ts`. No hay ningún dato real que enseñar todavía: mostrar
 * algo aquí sería inventarlo. Se deja como estado vacío honesto, tal como
 * pide DISENO-CONSOLA-V2.md §6 (fase 2, cerebro-alpha-agentes) y
 * §9 (nunca un dato que no exista).
 */
export function AgentesTab() {
  return (
    <PendienteDeCadena
      titulo="El tablero de agentes todavía no llega aquí"
      detalle="①②③④ por persona y la bandeja de preguntas D8 se escriben desde cerebro-alpha-agentes (subir_a_consola.py, fase 2 del diseño). Hasta que esa tubería exista, esta pestaña no tiene ningún dato real que mostrar."
    />
  )
}
