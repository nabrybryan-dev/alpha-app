/**
 * LOS TEXTOS DE LA CAPA «PRAXIS A UN TOQUE».
 *
 * Dos grupos, y no se mezclan:
 *
 *  1. `TEXTOS_APROBADOS`: las frases que Bryan aprobó «tal cual» en el selector del 11-nov-2026 (noche), tabla
 *     `TEXTOS-INTERFAZ-PRAXIS-UN-TOQUE-20261111.md`. Se copian sin tocar una palabra; el número es el de esa tabla.
 *  2. `TEXTOS_PENDIENTES`: todo lo demás que la pantalla necesita para funcionar (rótulos, botones, pasos del
 *     esquema, preguntas, rechazos que la tabla no cubre). Los escribió quien construyó la capa, solo para que
 *     el flujo se pueda probar. NINGUNO está aprobado: cada uno lleva la marca `MARCA_DE_TEXTO_PENDIENTE` y hay
 *     que pasarlos por el selector del dueño (sí / sí con cambio / no) antes de encender la bandera para nadie.
 *
 * Con la bandera apagada, ninguno de estos textos se pinta.
 */

import { TOPE_DE_OCULTAS } from '../../../app/organizacionPraxis'

export const TEXTOS_APROBADOS = {
  /** 1. Saludo (partido en titular y línea, sin cambiar palabras). */
  saludoTitulo: '¿Qué necesitas?',
  saludoLinea: 'Te explico y te ordeno la app. Tu plan y tu salud los decide tu coach.',
  /** 2. Tras traer. */
  traje: (pieza: string) => `Te traje ${pieza}. No cambié nada de tu orden.`,
  /** 3. Ocultar una parte fija. */
  ocultarFija: 'Esa parte no se oculta: es para cuidarte. Si quieres, la muevo de sitio; sus avisos te siguen llegando igual.',
  /** 4. Ocultar lo que puso el coach. */
  ocultarDelCoach: (pieza: string) => `No puedo ocultar ${pieza}. ¿Le dejo el aviso de que te sobra?`,
  ocultarDelCoachSub: 'El aviso no lleva tu frase, solo qué parte es.',
  /** 4 (solo la primera oración): cuando no hay camino para dejar el aviso, no se pregunta lo que no se puede hacer. */
  ocultarDelCoachSinAviso: (pieza: string) => `No puedo ocultar ${pieza}.`,
  /** 5. Tarjeta de ocultar una parte libre. */
  confirmaOcultar: (pieza: string, pantalla: string) => `Voy a ocultar ${pieza} de ${pantalla}.`,
  confirmaOcultarSub: (pieza: string) => `No se borra nada. La traes cuando quieras con «muéstrame ${pieza}».`,
  confirmaOcultarSi: 'Sí, ocultar',
  confirmaOcultarNo: 'No, dejarlo',
  /** 6. Tras ocultar. */
  hechoOcultar: (n: number) => `Hecho. Tienes ${n} de ${TOPE_DE_OCULTAS} ocultas. Si te arrepientes, dime «déjalo como estaba».`,
  /** 7. Tope de ocultas. */
  tope: `Ya tienes ${TOPE_DE_OCULTAS} partes ocultas, que es el tope para que la app no se quede vacía. Trae una de vuelta y oculto esta.`,
  /** 8. Núcleo de la barra. */
  barra: 'Hoy y Praxis se quedan en su puesto en la barra, para que siempre sepas volver. Lo demás sí lo puedo mover.',
  /** 9. Salud. */
  saludTitulo: 'No lo valoro yo. Tu coach es quien decide qué hacer con tu sesión.',
  saludSub: 'Si sientes que es urgente, no esperes al coach: acude a un servicio de salud.',
  saludAvisar: 'Avisar a mi coach',
  saludCheckin: 'Abrir mi check-in',
  /** 12. No entendí. */
  noEntendi: '¿Qué quisiste decir? Puedo traerte una parte de la app, ocultarla, moverla o buscarte una ficha.',
  /** 13. Rótulo de la respuesta provisional (el código de #480 lo trae como ROTULO_PROVISIONAL; ya coincide). */
  rotuloProvisional: 'Respuesta provisional, sin revisar. Confírmala con tu coach.',
} as const

/** La marca exacta con que se señala cada texto sin aprobar; `textos.test.ts` la cuenta. */
export const MARCA_DE_TEXTO_PENDIENTE = 'TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO'

// TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO: todo lo que sigue (cada línea lleva además su propia marca).
// Provisionales, tomados de la maqueta del 11-nov o escritos para poder probar el flujo.
export const TEXTOS_PENDIENTES = {
  // — rótulos y entrada —
  rotuloEn: (pantalla: string) => `Praxis · en ${pantalla}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  nombreDeLaCapa: 'Praxis', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  cerrar: 'Cerrar Praxis', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  etiquetaDelCampo: 'Dile algo a Praxis', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  marcadorDelCampo: 'Dime qué necesitas', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  enviar: 'Ir', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  botonCerrado: 'Praxis. Un toque para hablar', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  botonAbierto: 'Praxis abierta. Un toque para cerrar', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  frasesDeEjemplo: 'Frases de ejemplo', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  // — sugerencias (frases inventadas de la maqueta; la etiqueta chica es el verbo) —
  sugerencias: [
    { etiqueta: 'Traer', frase: 'Muéstrame el agua' },
    { etiqueta: 'Ocultar', frase: 'Oculta las recetas' },
    { etiqueta: 'Mover', frase: 'Pon el agua arriba' },
    { etiqueta: 'Ambigua', frase: 'Quita eso' },
    { etiqueta: 'Lista', frase: '¿Qué tengo escondido?' },
    { etiqueta: 'Pregunta', frase: '¿Cuántas series por músculo a la semana?' },
  ] as const, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  sugerenciaDeshacer: { etiqueta: 'Deshacer', frase: 'Déjalo como estaba' }, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  // — esquema de orden —
  esquemaTitulo: 'Esquema de orden', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pasoEntendi: 'Entendí', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pasoReglas: 'Reglas', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pasoVoy: 'Voy', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pasoTePropongo: 'Te propongo', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pasoPregunto: 'Pregunto', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pasoNoLoHago: 'No lo hago', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pasoPrimeroTuSalud: 'Primero tu salud', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pasoNoPasaAlModelo: 'No pasa al modelo', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pasoVaATuCoach: 'Va a tu coach', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  leidoEnElTelefono: 'teléfono', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  verbo: {
    traer: 'traer',
    ocultar: 'ocultar',
    fijar: 'fijar',
    mover_arriba: 'mover arriba',
    mover_abajo: 'mover abajo',
    deshacer: 'deshacer el último cambio de orden',
    restablecer: 'dejar todo como venía',
    listar: 'listar lo que se puede ocultar',
    listar_ocultas: 'listar lo que tienes oculto',
    sugerir_ocultar: 'ocultar',
    solo_lo_importante: 'dejar solo lo importante',
    quitar_ambiguo: 'quitar',
  } as const, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaTraer: 'Traer no guarda nada: va sin confirmar.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaTraerOculta: 'Está oculta: la traigo solo esta vez.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaLibre: (n: number) => `Es libre: se puede. Quedarían ${n} de ${TOPE_DE_OCULTAS} ocultas.`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaMover: 'Mover se puede con cualquier parte, también las fijas. Hoy y Praxis de la barra no se mueven.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaFija: 'Fija: no se oculta', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaAsignada: 'La puso tu coach: se mueve, no se oculta', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaTope: `Tope: ${TOPE_DE_OCULTAS} de ${TOPE_DE_OCULTAS} ocultas`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaNucleo: 'Hoy y Praxis son el núcleo de la barra', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaEquipo: 'Es del equipo: no se organiza', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaProtegida: 'Lleva dentro partes fijas o del coach: no se oculta', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaYaOculta: 'Ya estaba oculta', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaGuardado: 'Cambia lo guardado: va con tarjeta.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaNoExiste: 'No está en tu catálogo', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  reglaSinAcceso: 'Esa pantalla no es de tu cuenta', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  noCambioNada: 'No cambió nada.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  saludCuerpo: 'Tu frase habla de dolor, de un síntoma o de cómo estás', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  saludNoModelo: 'No sale a ninguna conversación con modelo ni ordena nada', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  saludNoValora: 'Praxis no valora dolores ni da consejo clínico', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  saludEtiqueta: 'Esto lo ve tu coach', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  ocultasCuenta: (n: number) => `${n} de ${TOPE_DE_OCULTAS} ocultas`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  // — tarjetas —
  tarjetaOcultarTitulo: '¿Lo hago?', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  noBorroTusDatos: 'No borro tus datos: solo escondo la tarjeta.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  tarjetaMoverTitulo: '¿Lo dejo así?', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  confirmaMoverArriba: (pieza: string, pantalla: string) => `Voy a poner ${pieza} de primero en ${pantalla}.`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  confirmaMoverAbajo: (pieza: string, pantalla: string) => `Voy a poner ${pieza} de último en ${pantalla}.`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  confirmaFijar: (pieza: string) => `Voy a dejar ${pieza} fija: sin ocultarse.`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  antes: 'Antes', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  despues: 'Después', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  primeroDe: (pieza: string) => `Primero: ${pieza}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  ultimoDe: (pieza: string) => `Último: ${pieza}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  confirmaMoverSi: 'Sí, moverla', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  confirmaFijarSi: 'Sí, dejarla fija', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  hechoMover: 'Hecho. Si te arrepientes, dime «déjalo como estaba».', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  noMovi: 'Listo, no moví nada.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  loDejeComoEsta: 'Listo, lo dejé como está.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  tarjetaDeshacerTitulo: '¿Lo deshago?', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  confirmaDeshacer: (cambio: string) => `Voy a deshacer «${cambio}». Todo vuelve a como estaba antes de ese cambio.`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  deshacerSi: 'Sí, como estaba', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  deshacerNo: 'No, dejarlo', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  hechoDeshacer: 'Listo. Volvió a como estaba.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  noDeshice: 'Listo, no deshice nada.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  nadaQueDeshacer: 'No hay ningún cambio de orden que deshacer. No toqué nada.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  cambioOcultar: (pieza: string) => `ocultar ${pieza}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  cambioMoverArriba: (pieza: string) => `subir ${pieza}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  cambioMoverAbajo: (pieza: string) => `bajar ${pieza}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  cambioFijar: (pieza: string) => `fijar ${pieza}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  // — preguntas y listas —
  cualTitulo: '¿Cuál?', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  cualCuerpo: (verbo: string) => `¿Cuál de estas quieres ${verbo}?`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  cualHayMas: 'Hay más que se llaman parecido: dime el nombre completo si no está aquí.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  queQuitoTitulo: '¿Qué quito?', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  queQuitoCuerpo: '¿Qué quieres quitar?', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  queQuitoUltimo: 'Lo último que anoté', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  queQuitoUltimoRespuesta: 'Eso es deshacer un registro: va por el libro de registros, con su propia tarjeta.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  ocultasConLista: (lista: string) => `Tienes ocultas: ${lista}. Dime «muéstrame…» y te la traigo.`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  ocultasVacia: 'No tienes nada oculto.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  ocultablesConLista: (lista: string) => `Puedo ocultar, por ejemplo: ${lista}.`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  yaOculta: (pieza: string) => `Ya la tienes oculta. Para verla dime «muéstrame ${pieza}».`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  noExiste: 'No encontré esa parte. Puedo traerte, por ejemplo: el agua, las recetas, la sesión de hoy o tu semana.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  sinAcceso: 'Esa pantalla no está disponible para tu cuenta.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO (es la FRASE_SIN_ACCESO que ya existe en `navegarPraxis.ts`)
  equipoSinOrganizacion: (pieza: string) => `${pieza} es del equipo y no se organiza desde aquí.`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  protegida: (pieza: string) => `${pieza} lleva dentro partes que no se ocultan; las puedo mover.`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  avisoCoachSi: 'Dejarle el aviso', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  avisoCoachNo: 'No, gracias', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  avisoCoachHecho: 'Aviso dejado para tu coach. No cambié nada.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  avisoCoachNoHice: 'Listo, no hice nada.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  sinSoporte: 'Esa orden todavía no la sé hacer desde aquí. No toqué nada.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  // — píldora —
  pildoraTraje: (pieza: string) => `Te traje ${pieza}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pildoraTrajeSub: 'Nada cambió en tu orden', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pildoraOculte: (pieza: string) => `Oculté ${pieza}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pildoraMovi: (pieza: string) => `Moví ${pieza}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pildoraFije: (pieza: string) => `Fijé ${pieza}`, // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  pildoraDeshecho: 'Deshecho', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  deshacer: 'Deshacer', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  abrirPraxis: 'Praxis', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  // — charla (punto de enganche) —
  pensando: 'Pensando', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  charlaSinConectar: 'Las preguntas con respuesta todavía no están conectadas. No toqué nada.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  charlaSinRespuesta: 'No tengo una respuesta aprobada para eso. No me lo invento.', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  fichaEstudios: 'Lo que dicen los estudios', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
  fichaCriterio: 'Criterio de práctica', // TEXTO PENDIENTE DE APROBACIÓN DEL DUEÑO
} as const
