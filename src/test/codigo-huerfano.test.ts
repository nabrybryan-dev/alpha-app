import { describe, expect, it } from 'vitest'
import {
  buscarHuerfanos,
  esTestPropio,
  exportacionesDeValor,
  importacionesDe,
  nombresUsadosInternamente,
} from '../../scripts/codigo-huerfano.mjs'

// Este test existe por un patrón que se repitió cuatro veces en tres días: un módulo
// del dominio escrito, probado y en verde, que no estaba enchufado a nada. El caso caro
// fue `seContraindica`: llevaba desde el 2026-08-09 sin un solo consumidor, y por eso la
// hoja de cambios estuvo a punto de proponerle hígado a una asesorada embarazada. Ningún
// test lo notó, porque cada pieza pasaba sus pruebas por separado.
//
// Comprobado contra la realidad: corriendo el detector sobre el commit `4bc65db` (el
// anterior al arreglo) `seContraindica` aparece en la lista; sobre `29627f4` ya no.
//
// No prohíbe nada. Obliga a escribir el motivo aquí, que es lo único que faltaba.

/**
 * Módulos del dominio que hoy no importa nadie, con el porqué.
 *
 * Si añades una entrada, escribe un motivo de verdad: qué falta para enchufarlo o por
 * qué es legítimo que viva suelto. «Pendiente» no es un motivo.
 */
const MODULOS_SIN_ENCHUFAR: Record<string, string> = {
  // La derivacion de «esta asentada la tecnica de este ejercicio». Construida el
  // 2026-08-25 y sin enchufar a proposito: se apoya en la tabla
  // `estandarizado_ejercicio` (migracion 0043), y esa migracion NO se aplica
  // hasta que `supabase/comprobar-ids-de-ejercicio.sql` confirme contra la base
  // que los ejercicio.id son unicos dentro de una persona. Que persisten entre
  // microciclos ya esta verificado contra el codigo; que no se repiten, no puede
  // saberse leyendo codigo.
  'src/domain/estandarizacion.ts':
    'Deriva si la tecnica de un ejercicio esta asentada. Espera a la migracion 0043, ' +
    'que a su vez espera a comprobar-ids-de-ejercicio.sql. Ver ' +
    'docs/superpowers/specs/2026-08-25-atributos-por-ejercicio.md §4.',

  // El bucle del dia: la ondulacion flexible intra-semana, EN SOMBRA a proposito.
  // El despliegue pactado con el coach (supuesto del 2026-08-25, §7) empieza
  // calculando sin enseñar: un microciclo entero guardando que escenario se
  // habria pisado, y el cierre compara si esos ajustes habrian reducido la
  // discrepancia. Se enchufa cuando ese numero lo avale, no antes.
  'src/domain/bucleDelDia.ts':
    'El cruce rendimiento x contexto del dia (verde/rojo/ninguno) y la regla del ' +
    'martes. En sombra hasta que la corrida de un microciclo avale que reduce la ' +
    'discrepancia. Ver Cerebro Alpha/docs/superpowers/specs/' +
    '2026-08-25-ondulacion-flexible-intra-semana.md §7.',
}

/**
 * Exportaciones que hoy no usa nadie —ni fuera del módulo ni dentro—, con el porqué.
 *
 * La lista se sembró **midiendo** el 2026-08-12 sobre `29627f4`, no auditando una por
 * una: es una línea base, igual que los umbrales-trinquete de cobertura. Su trabajo es
 * impedir que aparezcan **nuevas**, no bendecir las que ya había. Cada vez que se
 * enchufe o se borre una, su entrada desaparece de aquí (hay un test que lo exige).
 */
const EXPORTACIONES_SIN_USO: Record<string, string> = {
  // El equilibrio es un CONTRATO, no una función de la app: `desequilibrio`
  // mide cuántos centímetros se sale el peso del apoyo y lo consume la batería
  // de gravedad, que es quien exige que todos los patrones de pie se sostengan.
  // La app dibuja la plomada (centroDeMasas y plomada sí tienen consumidor);
  // el número queda para el guardián.
  'src/domain/patrones/gravedad.ts#desequilibrio':
    'Contrato de equilibrio: lo ejecuta gravedad.test.ts sobre los 31 patrones. ' +
    'La app dibuja la plomada; el numero es del guardian.',
  'src/domain/patrones/gravedad.ts#_soloParaTests':
    'Las fracciones de masa, expuestas para que el test compruebe que suman 1.',
  // El acabado de imagen corre en la TARJETA, no en TypeScript: el shader recibe
  // `GLSL_ACABADO`, que es texto generado con estos mismos coeficientes. Las
  // versiones en TS existen para poder probar la curva —que no se puede ejecutar
  // desde un test— y son el espejo de la que se inyecta. Borrarlas dejaría el
  // tonemapping sin una sola prueba.
  'src/domain/patrones/color.ts#acabado':
    'Espejo en TS de la curva que corre en el shader. Es lo que hace probable el ' +
    'tonemapping; el GLSL se genera con los mismos coeficientes.',
  'src/domain/patrones/color.ts#aLineal':
    'Espejo en TS de la linealizacion del shader. Su test es el que fija que ida y ' +
    'vuelta se cancelan, que es lo que fallaba cuando la imagen salia lavada.',
  // Donde cae el pico de exigencia externa de cada una de las 32 categorias.
  // Nacio para decidir si el cue llevaba el ancla de «parciales en reserva»; ese
  // uso se RETIRO el 2026-08-25 porque contradecia el metodo -en Alpha las
  // repeticiones son completas y a rango completo salvo prescripcion contraria-.
  // La tabla se queda porque es conocimiento verificado contra
  // `perfiles-de-resistencia` §2.1 y tiene un uso previsto: la seleccion de
  // ejercicios por rango donde el musculo es eficiente aplicando fuerza.
  'src/domain/taxonomia.ts#PICO_DE_EXIGENCIA':
    'Pico de exigencia por categoria. Su primer uso -el ancla del cue- se retiro por ' +
    'contradecir el metodo. Espera a la seleccion de ejercicios. Ver ' +
    'docs/superpowers/specs/2026-08-25-atributos-por-ejercicio.md §7.',
  // Encuentra la EXCEPCION: el rango completo es el defecto, y lo que se declara
  // en la frase es cuando NO. Lo usara la UI para saber que ese ejercicio lleva
  // mini-bloques que capturar en SerieRegistrada.extra.
  'src/domain/taxonomia.ts#tieneTecnicaDeclarada':
    'Detecta tecnica o recorrido declarados en la prescripcion. Espera a la captura de ' +
    'SerieRegistrada.extra en RegistroSerie.tsx.',
  // La tabla de palancas dejó de ser un módulo huérfano el 2026-08-24: la
  // consume `scripts/corpus-video.mjs`, que la choca contra el catálogo de 168
  // vídeos reales de gimnasio y es lo que destapó que faltaba el implemento.
  // La elección del eje YA la hace la tabla desde el 2026-08-28 (#187): la cadena
  // entera pasa por `medir-palancas.mjs`. Lo que dejó a estas dos sin usar es que
  // el eje viaja DENTRO del plan (`planDeMedida` → `ejeObjetivo`), así que nadie
  // necesita preguntarlo por separado. No es que esperen a algo: es que la vía
  // buena pasa por otro sitio, y aquí se quedan por lo que dice cada una.
  'src/domain/biomecanica/palancas.ts#ejePrincipal':
    'El eje que manda, sin construir el plan entero. Hoy nadie lo pide suelto porque ' +
    'el plan ya lo lleva; queda para etiquetar una serie en pantalla, que es el único ' +
    'sitio donde hará falta el eje y no el plan.',
  'src/domain/biomecanica/palancas.ts#MODELOS_DE_PALANCA':
    'La tabla entera, para recorrerla. La usan los tests de invariantes y el día ' +
    'que el selector de ejercicio de la pantalla lea de aquí.',
  // La guarda del relleno masivo de carga, que se corre desde el SQL Editor y
  // no desde la app: si componer los campos devuelve el MISMO texto, guardar no
  // cambia ni una letra de lo que el asesorado va a leer; si no, el ejercicio se
  // aparta para mirarlo a mano. Vive en TypeScript porque es la misma regla que
  // `componerPrescripcion`, y separarlas es justo lo que causó el desajuste del
  // 2026-08-12.
  'src/domain/prescripcion.ts#componerCoincide':
    'Guarda del relleno masivo de carga. Se ejecuta desde SQL, no desde la app, ' +
    'pero comparte regla con componerPrescripcion y separarlas ya costó 128 ejercicios.',
  // Lo que espera a una función ya planeada y todavía sin construir:
  'src/domain/nutricion/techos.ts#DIAS_ENTRE_RACIONES':
    'Espera al aviso de frecuencia: «comiste hígado hace 5 días, deja pasar dos ' +
    'semanas». Necesita mirar 14 días de registros hacia atrás y esa vista no existe.',
  'src/domain/nutricion/techos.ts#motivoDeLaFrecuencia':
    'Mismo aviso de frecuencia pendiente que DIAS_ENTRE_RACIONES.',
  // Las tres que quedan de la despensa. El módulo dejó de estar huérfano el
  // 2026-08-16, cuando se le puso capa de datos: `agregar`, `quitar` y `claveDe`
  // ya los usan `mockDb` y `sync`. Estas esperan a la PANTALLA, que es el paso
  // siguiente del spec.
  'src/domain/nutricion/despensa.ts#paraElMotor':
    'Filtra lo que tiene tabla nutricional, que es lo único con lo que se pueden ' +
    'calcular cantidades. La usará el motor de cambios cuando la despensa le diga ' +
    'qué hay en casa (paso 6 del spec del 2026-08-16). Hasta entonces nadie calcula ' +
    'nada contra la despensa.',
  'src/domain/nutricion/despensa.ts#pedidos':
    'Lo que la persona escribió y el catálogo no conoce. Su destino es la cola de ' +
    'trabajo del staff, que arriba ya existe como vista `alimentos_pedidos` (0024) ' +
    'y abajo necesita la pantalla del paso 5.',
  'src/domain/nutricion/embarazo.ts#puedeQuedarEmbarazada':
    'La encuesta ya recoge «no puedo quedar embarazada» (PR #41), pero todavía nadie ' +
    'consulta la respuesta para saltarse las preguntas del ciclo.',

  // Línea base heredada del 2026-08-12: medida, no auditada. Al tocar cualquiera de
  // estos módulos, resolver su entrada (enchufarla, borrarla o escribirle el motivo).
  'src/domain/nutricion/calibracion.ts#debeVolverAPesar': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/nutricion/datosSospechosos.ts#motivoDeLaDuda': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/nutricion/dia.ts#rangoKcal': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/nutricion/encuesta.ts#LAS_QUE_VUELVEN_NO_BLOQUEAN': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/nutricion/energia.ts#objetivoInsuficiente': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/nutricion/estado.ts#elegir': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/nutricion/estado.ts#hayQuePreguntar': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/nutricion/gastoEjercicio.ts#MET_CAMINAR': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/nutricion/techos.ts#fuenteDelLimite': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/nutricion/topes.ts#revisarDia': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/nutricion/unidades.ts#opciones': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/ondulacion.ts#fasePeriodizacion': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/ondulacion.ts#sesionOndulada': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/rutaEntrenamiento.ts#requisitosDeNivel': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/senales/hambre.ts#diasExigidos': 'HEREDADO 2026-08-12, sin revisar.',
  'src/domain/senales/hambre.ts#evaluarRacha': 'HEREDADO 2026-08-12, sin revisar.',
}

const huerfanos = buscarHuerfanos({ raizProyecto: process.cwd() })

const listar = (claves: string[]) => claves.map((c) => `  · ${c}`).join('\n')

describe('el dominio no acumula código sin enchufar', () => {
  it('ningún módulo nuevo queda sin que nadie lo importe', () => {
    const nuevos = huerfanos.modulos.map((m) => m.clave).filter((c) => !(c in MODULOS_SIN_ENCHUFAR))

    expect(
      nuevos,
      `Estos módulos del dominio no los importa nadie fuera de sus propios tests:\n${listar(nuevos)}\n\n` +
        'Enchúfalos donde tocaba, bórralos, o añádelos a MODULOS_SIN_ENCHUFAR con el motivo.',
    ).toEqual([])
  })

  it('ninguna exportación nueva queda sin usar', () => {
    const nuevas = huerfanos.exportaciones.map((e) => e.clave).filter((c) => !(c in EXPORTACIONES_SIN_USO))

    expect(
      nuevas,
      `Estas exportaciones no las usa nadie, ni siquiera su propio módulo:\n${listar(nuevas)}\n\n` +
        'Enchúfalas, bórralas, o añádelas a EXPORTACIONES_SIN_USO con el motivo.',
    ).toEqual([])
  })

  it('la lista de excepciones no guarda entradas ya resueltas', () => {
    const vivos = new Set([...huerfanos.modulos, ...huerfanos.exportaciones].map((h) => h.clave))
    const sobran = [...Object.keys(MODULOS_SIN_ENCHUFAR), ...Object.keys(EXPORTACIONES_SIN_USO)].filter(
      (c) => !vivos.has(c),
    )

    expect(
      sobran,
      `Estas entradas ya no hacen falta (se enchufaron o se borraron):\n${listar(sobran)}\n\n` +
        'Quítalas de la lista. Una excepción que sobrevive a su motivo deja de significar nada.',
    ).toEqual([])
  })

  it('sigue vigilando el dominio entero, no dos archivos sueltos', () => {
    // Si alguien rompe la resolución de rutas, las listas salen vacías y los tres tests
    // de arriba pasan sin comprobar nada. Este ancla el detector a la realidad.
    const perfilCalculado = buscarHuerfanos({ raizProyecto: process.cwd() })
    expect(perfilCalculado.modulos.length + perfilCalculado.exportaciones.length).toBeGreaterThan(0)
    expect(Object.keys(MODULOS_SIN_ENCHUFAR).length + Object.keys(EXPORTACIONES_SIN_USO).length).toBeGreaterThan(15)
  })
})

/**
 * LA SEGUNDA VIGILANCIA: `src/features/entrenar`, y con OTRA regla de consumo.
 *
 * El dominio se vigila contra `['src', 'scripts']` porque ahí un script que importa un
 * módulo es un consumidor legítimo. En el área de entrenar no vale, y esto costó
 * medirlo: el 2-sep `construirSala` llevaba días sin una sola llamada desde la app —el
 * salón dibujaba una capa SVG encima y la sala 3D no se montaba— y el detector no lo
 * señalaba, porque `scripts/medir-implementos.mjs` la importa para un banco de medida.
 * `construirImplementos` estaba igual: 31 KB de geometría que nadie construía.
 *
 * Un banco de pruebas que enciende una máquina una vez al mes no la pone en uso. Si
 * `scripts/` avala, cualquier función muerta en producción queda blanqueada por tener
 * un benchmark, y entonces el inventario no inventaría nada. Aquí el consumidor tiene
 * que ser la aplicación.
 */
const HUERFANOS_DE_ENTRENAR: Record<string, string> = {
  // Las declaraciones del núcleo vendorizado del encoder. No las importa la app: son
  // los tipos con los que TypeScript lee los `.mjs` de `nucleo/`, que vienen del repo
  // de herramientas y no se editan aquí (ver `nucleo/ORIGEN.md`).
  'src/features/entrenar/encoder/nucleo/analisis.d.ts': 'Declaración del núcleo vendorizado: la consume tsc, no la app.',
  'src/features/entrenar/encoder/nucleo/disco.d.ts': 'Declaración del núcleo vendorizado: la consume tsc, no la app.',
  'src/features/entrenar/encoder/nucleo/encuadre.d.ts': 'Declaración del núcleo vendorizado: la consume tsc, no la app.',
  'src/features/entrenar/encoder/nucleo/reloj-fotograma.d.ts': 'Declaración del núcleo vendorizado: la consume tsc, no la app.',

  // Un CANARIO, y por eso vive solo en su test: devuelve los huesos que un nivel del
  // eje W declara y no se pueden encender por separado. Hoy sale vacío porque los tres
  // niveles con hueso encienden el rig entero. El día que uno pida media pelvis, lo
  // dirá esta lista en vez de decirlo una pantalla rara.
  'src/features/entrenar/capas/mallaDelNivel.ts#huesosParcialesDeNivel':
    'Canario del eje W: hoy devuelve vacío a propósito y se comprueba en mallaDelNivel.test.ts.',

  // La pantalla de aterrizaje que el salón sustituyó (commit 25ea6ca). No se monta, y
  // aun así NO se borra: `pruebas/inventario-entrenar.ts` la nombra como el origen
  // documentado de seis bloques de la mudanza, y el test de inventario comprueba que
  // ese archivo existe. Mientras la mudanza se esté verificando, borrarla dejaría sin
  // poder comprobar que el bloque llegó entero. Se va con el inventario, no antes.
  'src/features/entrenar/PortadaMicrociclo.tsx':
    'Origen documentado del inventario de mudanza (pruebas/inventario-entrenar.ts); se retira cuando se retire el inventario.',

  // El historial del encoder está escrito y todavía no tiene fuente de datos: se
  // alimentará cuando `juzgarColocacion.ts` entre en esta rama, que es la precondición
  // para poder comparar dos tomas (mismo sitio del móvil). Hasta entonces la pantalla
  // no puede pintar puntos y esta función no tiene a quién dárselos.
  'src/features/entrenar/encoder/historial.ts#tomasDeLasSeries':
    'Historial del encoder sin fuente de datos hasta que juzgarColocacion.ts llegue a esta rama.',
}

const huerfanosEntrenar = buscarHuerfanos({
  raizProyecto: process.cwd(),
  carpetaVigilada: 'src/features/entrenar',
  carpetasConsumidoras: ['src'],
})

describe('el área de entrenar no acumula código sin enchufar', () => {
  const listar = (claves: string[]) => claves.map((c) => '  - ' + c).join('\n')

  it('nada de src/features/entrenar queda sin llamar desde la app', () => {
    const todos = [...huerfanosEntrenar.modulos, ...huerfanosEntrenar.exportaciones].map((h) => h.clave)
    const nuevos = todos.filter((c) => !(c in HUERFANOS_DE_ENTRENAR))

    expect(
      nuevos,
      'Esto no lo llama nadie desde la app:\n' +
        listar(nuevos) +
        '\n\nEnchúfalo, bórralo, o añádelo a HUERFANOS_DE_ENTRENAR con el motivo. Que lo ' +
        'importe un script de scripts/ NO cuenta: un banco de medida no pone nada en uso.',
    ).toEqual([])
  })

  it('la lista de excepciones de entrenar no guarda entradas ya resueltas', () => {
    const vivos = new Set([...huerfanosEntrenar.modulos, ...huerfanosEntrenar.exportaciones].map((h) => h.clave))
    const sobran = Object.keys(HUERFANOS_DE_ENTRENAR).filter((c) => !vivos.has(c))
    expect(sobran, 'Estas entradas ya no hacen falta:\n' + listar(sobran)).toEqual([])
  })

  it('vigila la carpeta de verdad, no una ruta que no existe', () => {
    // Si la ruta se rompe, las listas salen vacías y el test de arriba pasa sin mirar
    // nada. Éste lo ancla: sin consumidores, la carpeta entera sale huérfana.
    const conBarrer = buscarHuerfanos({
      raizProyecto: process.cwd(),
      carpetaVigilada: 'src/features/entrenar',
      carpetasConsumidoras: [],
    })
    expect(conBarrer.modulos.length).toBeGreaterThan(20)
  })
})

describe('el detector lee el código, no lo adivina', () => {
  it('cuenta funciones, constantes y clases exportadas, pero no tipos', () => {
    const codigo = `
      export function calcular() {}
      export const TOPE = 10
      export class Motor {}
      export interface Perfil { id: string }
      export type Genero = 'H' | 'M'
      function privada() {}
    `
    expect(exportacionesDeValor(codigo).sort()).toEqual(['Motor', 'TOPE', 'calcular'])
  })

  it('con `import { original as alias }` lo consumido es el nombre original', () => {
    const codigo = `import { seContraindica as vetado } from './embarazo'`
    expect(importacionesDe(codigo)).toEqual([{ especificador: './embarazo', nombres: ['seContraindica'] }])
  })

  it('un import repartido en varias líneas no se le escapa', () => {
    const codigo = `
      import {
        tmb,
        katchMcArdle,
      } from './energia'
    `
    expect(importacionesDe(codigo)[0]?.nombres).toEqual(['tmb', 'katchMcArdle'])
  })

  it('traerse el módulo entero cuenta como usar todo lo que exporta', () => {
    expect(importacionesDe(`import * as energia from './energia'`)[0]?.nombres).toBe('*')
    expect(importacionesDe(`const m = await import('./energia')`)[0]?.nombres).toBe('*')
  })

  it('reexportar también es consumir', () => {
    expect(importacionesDe(`export { tmb } from './energia'`)).toEqual([
      { especificador: './energia', nombres: ['tmb'] },
    ])
  })

  it('distingue el export ancho de más del código muerto', () => {
    const codigo = `
      export function tmb(peso: number) { return peso * 20 }
      export function tmbCombinada(peso: number) { return tmb(peso) }
      export function nadieLaLlama() { return 1 }
    `
    const usados = nombresUsadosInternamente(codigo)
    expect(usados.has('tmb')).toBe(true)
    expect(usados.has('nadieLaLlama')).toBe(false)
  })

  it('no confunde una propiedad con la función del módulo', () => {
    expect(nombresUsadosInternamente(`const x = perfil.tmb`).has('tmb')).toBe(false)
  })

  it('reconoce el test propio de un módulo, incluidos los de nombre compuesto', () => {
    expect(esTestPropio('src/domain/despensa.ts', 'src/domain/despensa.test.ts')).toBe(true)
    expect(esTestPropio('src/app/SessionProvider.tsx', 'src/app/SessionProvider.aislamiento.test.tsx')).toBe(true)
    expect(esTestPropio('src/domain/despensa.ts', 'src/domain/pauta.test.ts')).toBe(false)
    expect(esTestPropio('src/domain/despensa.ts', 'src/otro/despensa.test.ts')).toBe(false)
  })
})
