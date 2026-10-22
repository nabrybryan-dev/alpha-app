// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PATRONES_DE_MODELO_EXTERNO, recorrerLaCadena } from './cadena-sin-modelo-externo.mjs'

// DECISIÓN DE BRYAN, 22-oct: «Todo en el PC». El mensaje semanal NO puede mandar contexto (cifras
// de sesiones, adherencia, sueño, tasa contra el plan, objetivos clínicos) a ningún modelo
// externo. Hasta el 22-oct `revision-larga.mjs` llamaba a la CLI del modelo de Anthropic con la
// ficha de la tasa. Esta prueba falla si una llamada así vuelve a aparecer en CUALQUIER archivo
// que la cadena del viernes alcance: el .ps1, los scripts de npm que lanza y lo que éstos importan.
//
// El detector se prueba con un positivo: un archivo sembrado con cada forma de llamada tiene que
// encenderlo, y uno limpio no. Un detector que nunca se vio encender no puede decir «no hay».

let raiz
beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'cadena-'))
})
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true })
})

async function escribe(ruta, texto) {
  const completa = join(raiz, ruta)
  await mkdir(dirname(completa), { recursive: true })
  await writeFile(completa, texto, 'utf8')
}

/** Una cadena de juguete: .ps1 -> npm run paso -> scripts/paso.mjs -> lib/ayuda.mjs */
async function cadenaDeJuguete(contenidoDeLaLib) {
  await escribe('package.json', JSON.stringify({ scripts: { paso: 'vite-node scripts/paso.mjs', otro: 'vite-node scripts/otro.mjs' } }))
  await escribe('scripts/cadena.ps1', "& npm run paso -- --semana $lunes 2>&1 | Registra\n")
  await escribe('scripts/paso.mjs', "import { ayuda } from './lib/ayuda.mjs'\nayuda()\n")
  await escribe('scripts/lib/ayuda.mjs', contenidoDeLaLib)
  // Un script que la cadena NO alcanza: aunque tenga el patrón, no cuenta.
  await escribe('scripts/otro.mjs', "spawnSync('claude', ['-p'])\n")
}

describe('el detector (con positivos y negativo)', () => {
  const formas = {
    'la CLI por nombre': "spawnSync('claude', ['-p', '--model', 'sonnet'], { input })",
    'la CLI en una orden de texto': "execSync('claude -p --output-format json')",
    'el ejecutable de Windows': "const bin = 'claude.exe'",
    'la variable del ejecutable': 'const bin = process.env.CLAUDE_BIN',
    'la API de Anthropic por HTTP': "await fetch('https://api.anthropic.com/v1/messages', { method: 'POST' })",
    'el SDK de Anthropic': "import Anthropic from '@anthropic-ai/sdk'",
    'otro proveedor': "await fetch('https://api.openai.com/v1/chat/completions')",
  }

  for (const [nombre, codigo] of Object.entries(formas)) {
    it(`enciende con ${nombre}, dos niveles por debajo del .ps1`, async () => {
      await cadenaDeJuguete(`export const ayuda = () => { ${codigo} }\n`)
      const r = await recorrerLaCadena({ raiz, entradas: ['scripts/cadena.ps1'] })
      expect(r.archivos).toEqual(expect.arrayContaining(['scripts/cadena.ps1', 'scripts/paso.mjs', 'scripts/lib/ayuda.mjs']))
      expect(r.hallazgos.length).toBeGreaterThan(0)
      expect(r.hallazgos[0].archivo).toBe('scripts/lib/ayuda.mjs')
    })
  }

  it('encuentra la llamada también si está en el propio .ps1', async () => {
    await cadenaDeJuguete('export const ayuda = () => 1\n')
    await escribe('scripts/cadena.ps1', "& claude -p 'resume esto' | Out-File salida.txt\n& npm run paso\n")
    const r = await recorrerLaCadena({ raiz, entradas: ['scripts/cadena.ps1'] })
    expect(r.hallazgos.map((h) => h.archivo)).toContain('scripts/cadena.ps1')
  })

  it('una cadena limpia no enciende nada y no mira lo que la cadena no alcanza', async () => {
    await cadenaDeJuguete('export const ayuda = () => spawnSync("py", ["agente.py"])\n')
    const r = await recorrerLaCadena({ raiz, entradas: ['scripts/cadena.ps1'] })
    expect(r.hallazgos).toEqual([])
    expect(r.archivos).not.toContain('scripts/otro.mjs')
  })

  it('sigue imports relativos con y sin extensión', async () => {
    await cadenaDeJuguete("import { x } from './mas-abajo'\nexport const ayuda = () => x\n")
    await escribe('scripts/lib/mas-abajo.ts', "export const x = process.env.CLAUDE_BIN\n")
    const r = await recorrerLaCadena({ raiz, entradas: ['scripts/cadena.ps1'] })
    expect(r.archivos).toContain('scripts/lib/mas-abajo.ts')
    expect(r.hallazgos.map((h) => h.archivo)).toContain('scripts/lib/mas-abajo.ts')
  })

  it('la lista de patrones no está vacía', () => {
    expect(PATRONES_DE_MODELO_EXTERNO.length).toBeGreaterThanOrEqual(5)
  })
})

describe('la cadena REAL del viernes', () => {
  it('no llama a ningún modelo externo, y la prueba ve de verdad la cadena (no pasa en vacío)', async () => {
    const r = await recorrerLaCadena({ raiz: process.cwd(), entradas: ['scripts/revision-semanal-viernes.ps1'] })
    // Que alcance las piezas que importan: si el recorrido se perdiera, «0 hallazgos» no diría nada.
    expect(r.archivos).toEqual(
      expect.arrayContaining([
        'scripts/revision-semanal-viernes.ps1',
        'scripts/revision-semanal.mjs',
        'scripts/mensaje-semanal.mjs',
        'scripts/lib/mensaje-semanal.mjs',
        'scripts/generar-voces.mjs',
        'scripts/lib/voz-por-persona.mjs',
        'scripts/lib/publicar-una-revision.mjs',
      ]),
    )
    expect(r.hallazgos).toEqual([])
  })

  it('el paso viejo que llamaba al modelo ya no existe en la cadena', async () => {
    const r = await recorrerLaCadena({ raiz: process.cwd(), entradas: ['scripts/revision-semanal-viernes.ps1'] })
    expect(r.archivos).not.toContain('scripts/revision-larga.mjs')
    expect(r.archivos).not.toContain('scripts/lib/redactar-una-revision.mjs')
  })
})
