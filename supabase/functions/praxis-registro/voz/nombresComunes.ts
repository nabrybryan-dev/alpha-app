/**
 * Nombres de pila comunes en español (Colombia y alrededores), para el limpiador (Enmienda 4 del criterio, Bryan,
 * 4-nov-2026). Escrita por Claude, NO es una fuente pública: sirve de red para el nombre que abre la frase y no está en
 * la app. Solo se aplica a palabras con mayúscula inicial. Fuera a propósito: «Dolores» (en una consulta casi siempre es
 * dolor). Sin los nombres inventados de las pruebas (Anselmo, Clotilde, Eustaquio, Gertrudis, Leocadia, Rosendo):
 * meterlos haría pasar la prueba a la fuerza. Si quita una palabra de más («Rosa», «Máximo»), la pregunta empeora un poco; si deja un nombre, sale de la casa.
 */
const LISTA = `
adriana alba alejandra alejandro alexander alexandra alicia alvaro amanda amparo ana andrea andres angel angela angelica
antonia antonio ariel arturo aura beatriz bernardo blanca brayan bryan camila camilo carla carlos carmen carolina
catalina cecilia cesar clara claudia consuelo cristian cristina daniel daniela david diana diego dora edgar
eduardo elena eliana elizabeth elsa emilio emma enrique erika esperanza esteban eugenia fabian felipe fernanda
fernando francisco gabriel gabriela german gilberto gloria gonzalo gustavo hector helena hernan hugo ignacio ines
isabel isabella ivan jaime jairo javier jennifer jesus jhon jimena joaquin johana jorge jose josefina juan juana julian
juliana julio karen karin karina katherine laura leidy leonardo liliana lina lorena lucia luis luisa luz
manuel manuela marcela marco marcos margarita maria mariana mario marta martha martin mateo mauricio maximo mercedes
miguel milena monica nancy natalia nelson nicolas norma olga omar oscar pablo paola patricia paula pedro rafael ramiro
ramon raul ricardo roberto rocio rodrigo rosa ruben salome samuel santiago sara sebastian sergio silvia
simon sofia sonia stella susana tatiana teresa tomas valentina valeria vanessa veronica victor victoria viviana walter
wilson ximena yeison yolanda yuliana
`

export const NOMBRES_COMUNES: ReadonlySet<string> = new Set(LISTA.split(/\s+/).filter(Boolean))
