// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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

describe('H2 (revisión 06) · subir los audios de la tanda a un servicio externo tampoco vale', () => {
  // La cara se hacía subiendo los `*.mp3` de la tanda (con el nombre y las cifras de salud de cada
  // persona) a Kaggle. Hoy no corre porque el venv de la GPU no existe; si alguien lo repone, los
  // audios salen del PC. Decisión de Bryan: «Todo en el PC». Solo corre con una bandera EXPLÍCITA.
  const subidas = {
    'el lanzador de Kaggle': "& $pythonCara 'C:\\Users\\ASUS\\dev\\cara-alpha\\lanzar_en_kaggle.py' $carpeta",
    'la CLI de Kaggle': '& kaggle kernels push -p $carpeta',
    'el venv de la cara en GPU': "$pythonCara = 'F:\\cara-gpu\\venv311\\Scripts\\python.exe'",
    'una subida por HTTP': "Invoke-RestMethod -Uri 'https://servicio-de-fuera.example/subir' -Method Post -InFile $audio",
    'curl a un host de fuera': 'curl.exe -F "audio=@$audio" https://servicio-de-fuera.example/subir',
    'un fetch a un host de fuera': "await fetch('https://servicio-de-fuera.example/subir', { method: 'POST', body })",
  }

  for (const [nombre, linea] of Object.entries(subidas)) {
    it(`enciende con ${nombre} si NO está detrás de la bandera explícita`, async () => {
      await cadenaDeJuguete('export const ayuda = () => 1\n')
      await escribe('scripts/cadena.ps1', `param([switch]$ConCara)\n& npm run paso\n${linea}\n`)
      const r = await recorrerLaCadena({ raiz, entradas: ['scripts/cadena.ps1'] })
      expect(r.hallazgos.map((h) => h.archivo)).toContain('scripts/cadena.ps1')
      expect(r.optIn).toEqual([])
    })
  }

  it('detrás de `if ($ConCara) { … }` NO es un hallazgo, pero se ve: sale en `optIn`', async () => {
    await cadenaDeJuguete('export const ayuda = () => 1\n')
    await escribe(
      'scripts/cadena.ps1',
      `param([switch]$ConCara)\n& npm run paso\nif ($ConCara) {\n  & $pythonCara 'x\\cara-alpha\\lanzar_en_kaggle.py' $carpeta\n}\n`,
    )
    const r = await recorrerLaCadena({ raiz, entradas: ['scripts/cadena.ps1'] })
    expect(r.hallazgos).toEqual([])
    expect([...new Set(r.optIn.map((h) => h.archivo))]).toEqual(['scripts/cadena.ps1'])
  })

  it('la bandera NO disculpa a un modelo de lenguaje: eso nunca es opt-in', async () => {
    await cadenaDeJuguete('export const ayuda = () => 1\n')
    await escribe('scripts/cadena.ps1', `param([switch]$ConCara)\n& npm run paso\nif ($ConCara) {\n  & claude.exe -p 'resume'\n}\n`)
    const r = await recorrerLaCadena({ raiz, entradas: ['scripts/cadena.ps1'] })
    expect(r.hallazgos.length).toBeGreaterThan(0)
  })

  it('si el bloque de la bandera se cierra, lo que viene después vuelve a vigilarse', async () => {
    await cadenaDeJuguete('export const ayuda = () => 1\n')
    await escribe(
      'scripts/cadena.ps1',
      `param([switch]$ConCara)\n& npm run paso\nif ($ConCara) {\n  Write-Host 'cara'\n}\n& kaggle kernels push -p $carpeta\n`,
    )
    const r = await recorrerLaCadena({ raiz, entradas: ['scripts/cadena.ps1'] })
    expect(r.hallazgos.map((h) => h.archivo)).toEqual(['scripts/cadena.ps1'])
  })

  it('NO se puede encender sin querer: el .ps1 real solo la declara como switch y la usa como condición', async () => {
    const ps1 = await readFile('scripts/revision-semanal-viernes.ps1', 'utf8')
    expect(ps1).toMatch(/\[switch\]\$ConCara/)
    expect(ps1).toMatch(/if\s*\(\$ConCara\)\s*\{/)
    // Y ya no existe la forma vieja, en la que la cara corría salvo que alguien pasara -SinCara.
    expect(ps1).not.toMatch(/\$SinCara/)
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
    // La cara en Kaggle SÍ está en el .ps1, pero solo detrás de -ConCara: el detector la ve y la separa.
    expect(r.optIn.length).toBeGreaterThan(0)
    expect(new Set(r.optIn.map((h) => h.archivo))).toEqual(new Set(['scripts/revision-semanal-viernes.ps1']))
  })

  it('el paso viejo que llamaba al modelo ya no existe en la cadena', async () => {
    const r = await recorrerLaCadena({ raiz: process.cwd(), entradas: ['scripts/revision-semanal-viernes.ps1'] })
    expect(r.archivos).not.toContain('scripts/revision-larga.mjs')
    expect(r.archivos).not.toContain('scripts/lib/redactar-una-revision.mjs')
  })
})
