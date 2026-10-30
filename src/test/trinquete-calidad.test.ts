import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

// Trinquete de calidad: impide EMPEORAR dos medidas deterministas sin obligar a arreglar
// lo viejo (misma idea que la regla de delta del linter, CLAUDE.md §2).
//   1. Archivos de produccion con mas de 800 lineas.
//   2. Funciones con complejidad ciclomatica > 20 (regla `complexity` de ESLint).
// Falla si aparece un archivo o funcion NUEVA por encima del limite, o si uno listado crece.
// Si uno listado baja del limite, o su cifra baja, la prueba pide actualizar la lista
// (como codigo-huerfano.test.ts con lo que sobra): asi el trinquete solo gira hacia mejor.
//
// Produccion = .ts/.tsx/.js/.mjs de `src/` y `supabase/functions/`, sin `*.test.*`.
// No toca eslint.config.js: la regla se activa aqui, solo para medir (ESLint es JS puro,
// sin binarios nativos, ver CLAUDE.md §1).
//
// Para regenerar las listas tras una mejora: TRINQUETE_GENERAR=ruta/base npx vitest run
// src/test/trinquete-calidad.test.ts  (escribe base.lineas.json y base.complejidad.json).

const LIMITE_LINEAS = 800
const LIMITE_COMPLEJIDAD = 20

/** Archivo -> lineas. Deuda conocida; la cifra es un techo, no un objetivo. */
const ARCHIVOS_LARGOS: Record<string, number> = {
  'src/data/mockDb.ts': 1035,
  'src/data/nube/hidratar.ts': 825,
  'src/data/nube/sync.ts': 1095,
  'src/domain/patrones/catalogo.ts': 2173,
  'src/domain/rutaEntrenamiento.ts': 831,
  'src/domain/types.ts': 965,
  'src/features/entrenar/encoder/EncoderPage.tsx': 838,
  'src/features/entrenar/encoder/nucleo/analisis.js': 1126,
  'src/features/entrenar/encoder/nucleo/disco.js': 1435,
  'src/features/entrenar/salon/SalonEntrenar.tsx': 1345,
  'src/features/entrenar/visor/VisorPatron.tsx': 1513,
  'src/features/entrenar/visor/motor.ts': 870,
  'supabase/functions/praxis-registro/index.ts': 1048,
}

/** `archivo:funcion` (con `#n` si el nombre se repite en el archivo) -> complejidad. */
const FUNCIONES_COMPLEJAS: Record<string, number> = {
  'src/app/layouts.tsx:CoachLayout': 28,
  'src/app/rutas.ts:resolverAcceso': 28,
  'src/components/ui/Stepper.tsx:Stepper': 27,
  'src/components/ui/TopBar.tsx:TopBar': 25,
  'src/data/nube/hidratar.ts:hidratarDesdeNube': 63,
  'src/data/praxis/registrador.ts:extraerIngreso': 24,
  'src/domain/bucleDelDia.ts:contextoDelDia': 22,
  'src/domain/consolaCoach/planRenovado.ts:diferenciaPlanes': 21,
  'src/domain/nivelesAlfa.ts:requisitosParaPeldano': 24,
  'src/domain/nutricion/textoSinKcal.ts:trocear': 29,
  'src/domain/ondulacion.ts:ondularEjercicio': 34,
  'src/domain/patrones/malla.ts:tubo': 24,
  'src/domain/patrones/movimiento.ts:poseAnimada': 28,
  'src/domain/praxis/conversacion.ts:pasoTrasProponer': 27,
  'src/domain/praxis/ingreso/extraer.ts:validarIngreso': 38,
  'src/domain/praxis/plan/responder.ts:responderDelPlan': 28,
  'src/domain/praxis/registro/comida.ts:resolverComida': 85,
  'src/domain/praxis/registro/ejercicio.ts:sinNombre': 22,
  'src/domain/praxis/registro/esquema.ts:validarExtraccion': 26,
  'src/domain/praxis/registro/guardado.ts:prepararSeries': 28,
  'src/domain/praxis/registro/numeros.ts:escanearNumeros': 34,
  'src/domain/praxis/registro/numeros.ts:horaDeCita': 25,
  'src/domain/praxis/registro/resolver.ts:resolverBloque': 83,
  'src/domain/praxis/registro/resolver.ts:resolverCorreccion': 24,
  'src/domain/praxis/registro/resolver.ts:resolverEjercicioDelMensaje': 40,
  'src/domain/praxis/registro/resolver.ts:resolverPropuesta': 101,
  'src/domain/praxis/registro/tarjeta.ts:construirTarjeta': 21,
  'src/domain/praxis/registro/vida.ts:resolverVida': 98,
  'src/domain/sujeto/contrato.ts:verificarCifra': 31,
  'src/features/coach/NotasDeLlamada.tsx:NotasDeLlamada': 27,
  'src/features/coach/administracion/AdministracionPage.tsx:AdministracionPage': 22,
  'src/features/coach/consola/AccionesRevision.tsx:AccionesRevision': 35,
  'src/features/coach/consola/BandejaPlanesRenovados.tsx:FilaPlanRenovado': 24,
  'src/features/coach/consola/BandejaPrimerosPlanes.tsx:FilaPrimerPlan': 22,
  'src/features/coach/consola/CabeceraPersona.tsx:CabeceraPersona': 41,
  'src/features/coach/consola/ConsolaCoachPage.tsx:Consola': 30,
  'src/features/coach/consola/ficha/SeccionPerfil.tsx:SeccionPerfil': 24,
  'src/features/coach/presentacion/escena3d/RigCamara.tsx:(anonima)': 22,
  'src/features/entrenar/SesionPage.tsx:SesionEnCurso': 49,
  'src/features/entrenar/encoder/EncoderPage.tsx:(anonima)': 25,
  'src/features/entrenar/encoder/importarMedida.ts:importarMedida': 23,
  'src/features/entrenar/encoder/nucleo/analisis.js:analizarSerie': 28,
  'src/features/entrenar/encoder/nucleo/analisis.js:pruebaDeGravedad': 29,
  'src/features/entrenar/encoder/nucleo/analisis.js:segmentarRepeticiones': 34,
  'src/features/entrenar/encoder/nucleo/disco.js:centroPorVoto': 27,
  'src/features/entrenar/encoder/nucleo/disco.js:detectarDisco': 26,
  'src/features/entrenar/encoder/nucleo/disco.js:radioMasVotado': 35,
  'src/features/entrenar/encoder/tanda.ts:criteriosDeLaTanda': 24,
  'src/features/entrenar/encoder/useCaptura.ts:pintar': 31,
  'src/features/entrenar/escena/dibujarImplementos.ts:construirMaquina': 28,
  'src/features/entrenar/escena/piezas3d.ts:escribirPieza': 22,
  'src/features/entrenar/salon/SalonEntrenar.tsx:SalonEntrenar': 67,
  'src/features/entrenar/salon/panel/PanelInferior.tsx:PanelInferior': 24,
  'src/features/entrenar/salon/paredes/PanelPared.tsx:PanelCampo': 21,
  'src/features/entrenar/salon/paredes/contenidoPared.ts:contenidoPared': 36,
  'src/features/entrenar/visor/VisorPatron.tsx:(anonima)': 59,
  'src/features/equipo/DecisionesCompartidas.tsx:DecisionesCompartidas': 21,
  'src/features/equipo/DecisionesCompartidas.tsx:FilaDecision': 34,
  'src/features/equipo/EquipoPage.tsx:EquipoPage': 39,
  'src/features/equipo/FormularioDecision.tsx:entradaDeBorrador': 31,
  'src/features/hoy/BloqueActual.tsx:BloqueActual': 33,
  'src/features/hoy/HoyPage.tsx:HoyPage': 77,
  'src/features/logros/ProgresoEvolucion.tsx:ProgresoEvolucion': 27,
  'src/features/nutri/EquipoNutricionPage.tsx:EquipoNutricionPage': 24,
  'src/features/nutricion/DiarioDia.tsx:DiarioDia': 21,
  'src/features/plan/MiPlanPage.tsx:MiPlanPage': 22,
  'src/features/praxis/ingreso/IngresoPrueba.tsx:IngresoPrueba': 26,
  'src/features/praxis/ingreso/PasosDeVoz.tsx:PasoDeTurno': 25,
  'src/features/praxis/motor/bienestar.ts:renderDetalle': 27,
  'src/features/praxis/motor/bienestar.ts:renderMini': 35,
  'src/features/praxis/motor/cabecera.ts:mostrarControles': 23,
  'src/features/praxis/motor/conversacion.ts:registrar': 29,
  'src/features/praxis/motor/cosmos.ts:cuadro': 25,
  'src/features/praxis/motor/cosmos.ts:dibujar': 26,
  'src/features/praxis/motor/dom.ts:parchear': 21,
  'src/features/praxis/motor/firma.ts:firmaDelDia': 42,
  'src/features/praxis/motor/frase.ts:decir': 39,
  'src/features/praxis/motor/interpretar.ts:interpretar': 57,
  'src/features/praxis/motor/onda.ts:altaFrecuencia': 24,
  'src/features/praxis/motor/onda.ts:cuadro': 104,
  'src/features/praxis/motor/ondaDibujo.ts:dibujarEco': 21,
  'src/features/praxis/motor/penta.ts:contenido': 21,
  'src/features/praxis/motor/penta.ts:textoNota': 24,
  'src/features/praxis/motor/sala.ts:abrirSala': 35,
  'src/features/praxis/motor/sala.ts:cerrarSala': 24,
  'src/features/praxis/motor/senales.ts:entrarQuieta': 23,
  'src/features/praxis/motor/turnos.ts:correrCheckin': 24,
  'src/features/praxis/motor/turnos.ts:correrTurno': 26,
  'src/features/praxis/motor/turnos.ts:procesarTexto': 25,
  'src/features/praxis/partes/Privacidad.tsx:Privacidad': 34,
  'src/features/semana/SemanaPage.tsx:SemanaPage': 23,
  'src/test/leerMigraciones.ts:clavesDePrimerNivel': 21,
  'supabase/functions/alta-cliente/index.ts:(anonima)': 25,
  'supabase/functions/avisos-plan/index.ts:manejar': 23,
  'supabase/functions/praxis-registro/index.ts:guardar': 33,
  'supabase/functions/praxis-registro/index.ts:manejar': 21,
  'supabase/functions/praxis-registro/index.ts:proponer': 38,
  'supabase/functions/responder-chat/index.ts:manejar': 46,
}

const RAIZ = process.cwd()
const CARPETAS = ['src', 'supabase/functions']
const EXT = /\.(ts|tsx|js|mjs)$/
const SALTAR = new Set(['node_modules', 'dist', '.vite', 'coverage'])

function listar(dir: string, salida: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (SALTAR.has(nombre)) continue
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) listar(ruta, salida)
    else if (EXT.test(nombre) && !/\.test\./.test(nombre) && !nombre.endsWith('.d.ts')) salida.push(ruta)
  }
  return salida
}

const archivos = CARPETAS.flatMap((c) => listar(join(RAIZ, c))).map((r) =>
  relative(RAIZ, r).split('\\').join('/'),
)

function medirLineas(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of archivos) {
    const txt = readFileSync(join(RAIZ, f), 'utf8')
    const n = txt.length === 0 ? 0 : txt.split('\n').length - (txt.endsWith('\n') ? 1 : 0)
    if (n > LIMITE_LINEAS) out[f] = n
  }
  return out
}

async function medirComplejidad(): Promise<Record<string, number>> {
  const eslint = new ESLint({
    cwd: RAIZ,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: { parser: tseslint.parser, ecmaVersion: 2023, sourceType: 'module' },
      },
      {
        files: ['**/*.{js,mjs}'],
        languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
      },
      { rules: { complexity: ['warn', LIMITE_COMPLEJIDAD] } },
    ],
  })
  const resultados = await eslint.lintFiles(archivos)
  const out: Record<string, number> = {}
  for (const r of resultados) {
    const f = relative(RAIZ, r.filePath).split('\\').join('/')
    const fatal = r.messages.find((m) => m.fatal)
    if (fatal) throw new Error(`No se pudo analizar ${f}: ${fatal.message}`)
    const vistos = new Map<string, number>()
    const msgs = r.messages
      .filter((m) => m.ruleId === 'complexity')
      .sort((a, b) => a.line - b.line || a.column - b.column)
    for (const m of msgs) {
      const nombre = /(?:function|method|getter|setter|constructor) '([^']+)'/i.exec(m.message)?.[1] ?? '(anonima)'
      const veces = (vistos.get(nombre) ?? 0) + 1
      vistos.set(nombre, veces)
      const cx = Number(/complexity of (\d+)/.exec(m.message)?.[1])
      out[`${f}:${nombre}${veces > 1 ? `#${veces}` : ''}`] = cx
    }
  }
  return out
}

/** Compara medido contra lista: peores (nuevos o crecidos) y mejoras (a sacar o bajar de la lista). */
function comparar(medido: Record<string, number>, lista: Record<string, number>) {
  const peores: string[] = []
  const mejoras: string[] = []
  for (const [k, v] of Object.entries(medido)) {
    if (!(k in lista)) peores.push(`${k}: NUEVO con ${v}`)
    else if (v > lista[k]) peores.push(`${k}: crecio de ${lista[k]} a ${v}`)
    else if (v < lista[k]) mejoras.push(`${k}: bajo de ${lista[k]} a ${v}; actualiza la lista`)
  }
  for (const k of Object.keys(lista)) {
    if (!(k in medido)) mejoras.push(`${k}: ya no supera el limite (o ya no existe); sacalo de la lista`)
  }
  return { peores, mejoras }
}

describe('trinquete de calidad', () => {
  it('ningun archivo de produccion nuevo o crecido supera las 800 lineas', () => {
    const medido = medirLineas()
    if (process.env.TRINQUETE_GENERAR) {
      writeFileSync(process.env.TRINQUETE_GENERAR + '.lineas.json', JSON.stringify(medido, null, 2))
    }
    const { peores, mejoras } = comparar(medido, ARCHIVOS_LARGOS)
    expect(peores, 'Archivos que empeoran (parte el archivo en vez de subir la lista)').toEqual([])
    expect(mejoras, 'Mejoras: baja o saca la entrada de ARCHIVOS_LARGOS').toEqual([])
  })

  it('ninguna funcion nueva o crecida supera complejidad 20', async () => {
    const medido = await medirComplejidad()
    if (process.env.TRINQUETE_GENERAR) {
      writeFileSync(process.env.TRINQUETE_GENERAR + '.complejidad.json', JSON.stringify(medido, null, 2))
    }
    const { peores, mejoras } = comparar(medido, FUNCIONES_COMPLEJAS)
    expect(peores, 'Funciones que empeoran (extrae piezas en vez de subir la lista)').toEqual([])
    expect(mejoras, 'Mejoras: baja o saca la entrada de FUNCIONES_COMPLEJAS').toEqual([])
  }, 180_000)
})
