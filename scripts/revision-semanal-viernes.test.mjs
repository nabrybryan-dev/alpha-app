// @vitest-environment node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// EL .ps1 DE VERDAD (revisión 06, H5/A7). Hasta ahora ninguna prueba ejecutaba el script del viernes:
// un cambio de `-ne 0` a `-eq 1` en el paso 3 hacía que una tanda INCOMPLETA (código 3) firmara y
// escribiera «LISTO», y ninguna prueba lo notaba. Aquí se corre el `.ps1` entero con un `npm` FALSO
// al principio del PATH que anota cada llamada y devuelve el código que la prueba le pide. Sin red,
// sin base, sin voz: lo que se prueba es la lógica de pasos y códigos de salida del script.
//
// Solo en Windows (es PowerShell 5.1 + `npm.cmd`); en el CI de Linux se salta, y eso es un SALTO, no un verde.
// `PS1_ALTERNO` apunta a una copia con un defecto sembrado (un mutante) que tiene que dar rojo.

const EN_WINDOWS = process.platform === 'win32'
const PS1 = resolve(process.env.PS1_ALTERNO || 'scripts/revision-semanal-viernes.ps1')
const SEMANA = '2099-01-05' // un lunes de un futuro donde no hay nada real
const CARPETA_TANDA = resolve('salidas', `revision-${SEMANA}`)

let trabajo
beforeEach(async () => {
  trabajo = await mkdtemp(join(tmpdir(), 'ps1-viernes-'))
  await mkdir(join(trabajo, 'bin'), { recursive: true })
  await mkdir(CARPETA_TANDA, { recursive: true })
  await writeFile(join(CARPETA_TANDA, 'manifiesto.json'), JSON.stringify({ semana: SEMANA, encargos: [] }), 'utf8')
  // El `npm` falso: anota los argumentos y sale con el código que diga la variable del paso.
  await writeFile(
    join(trabajo, 'bin', 'npm.cmd'),
    [
      '@echo off',
      // Con un espacio antes de >>: sin él, un argumento final como «3» se lee como el descriptor «3>>».
      'echo %* >>"%FAKE_NPM_LOG%"',
      'echo %* | findstr /C:"--paso publicar" >nul && exit /b %FAKE_NPM_PUBLICAR%',
      'echo %* | findstr /C:"--paso firmar" >nul && exit /b %FAKE_NPM_FIRMAR%',
      'echo %* | findstr /C:"generar-voces" >nul && exit /b %FAKE_NPM_VOCES%',
      'exit /b 0',
      '',
    ].join('\r\n'),
    'utf8',
  )
})
afterEach(async () => {
  await rm(trabajo, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 })
  await rm(CARPETA_TANDA, { recursive: true, force: true })
})

function correr(argumentos = [], codigos = {}) {
  const log = join(trabajo, 'npm.log')
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1,
      '-Fase', 'manana', '-Semana', SEMANA, '-SinActualizar',
      '-Registro', join(trabajo, 'registros'),
      '-Candado', join(trabajo, 'candado.lock'),
      ...argumentos,
    ],
    {
      encoding: 'utf8',
      timeout: 120_000,
      env: {
        ...process.env,
        PATH: `${join(trabajo, 'bin')};${process.env.PATH}`,
        SUPABASE_SERVICE_KEY: 'clave-falsa-de-prueba',
        SUPABASE_URL: 'http://127.0.0.1:9',
        FAKE_NPM_LOG: log,
        FAKE_NPM_PUBLICAR: String(codigos.publicar ?? 0),
        FAKE_NPM_FIRMAR: String(codigos.firmar ?? 0),
        FAKE_NPM_VOCES: String(codigos.voces ?? 0),
      },
    },
  )
  const llamadas = existsSync(log) ? readFileSyncSeguro(log) : ''
  return { ...r, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`, llamadas }
}

function readFileSyncSeguro(ruta) {
  return spawnSync('cmd.exe', ['/c', 'type', ruta], { encoding: 'utf8' }).stdout
}

describe.skipIf(!EN_WINDOWS)('revision-semanal-viernes.ps1, ejecutado de verdad con un npm falso', () => {
  it('A7 · una tanda INCOMPLETA (publicar sale con 3) para, avisa, sale con 3 y NO firma ni escribe LISTO', () => {
    const r = correr(['-FirmaAutomatica'], { publicar: 3 })
    expect(r.error).toBeUndefined()
    expect(r.status, r.salida).toBe(3)
    expect(r.salida).toMatch(/PARO en el paso 3 publicar/)
    expect(r.salida).not.toMatch(/LISTO/)
    // Ni siquiera con la firma encendida se llega al paso 4.
    expect(r.llamadas).not.toMatch(/--paso firmar/)
    // Y avisa a Bryan por el canal que existe.
    expect(r.llamadas).toMatch(/avisar-tanda/)
  })

  it('cualquier código ≠ 0 de «publicar» para, no solo el 1 (el 3 es el de la tanda incompleta)', () => {
    for (const codigo of [1, 2, 3, 7]) {
      const r = correr(['-FirmaAutomatica'], { publicar: codigo })
      expect(r.status, `publicar=${codigo}\n${r.salida}`).toBe(codigo)
      expect(r.llamadas).not.toMatch(/--paso firmar/)
    }
  })

  it('tanda completa y firma APAGADA: sale con 0, publica SIN firmar y lo dice', () => {
    const r = correr([], { publicar: 0 })
    expect(r.status, r.salida).toBe(0)
    expect(r.salida).toMatch(/firma automatica APAGADA/)
    expect(r.salida).toMatch(/SIN FIRMAR/)
    expect(r.llamadas).not.toMatch(/--paso firmar/)
    expect(r.llamadas).not.toMatch(/avisar-tanda/)
  })

  it('tanda completa y firma ENCENDIDA (-FirmaAutomatica): corre el paso 4 una vez', () => {
    const r = correr(['-FirmaAutomatica'], { publicar: 0 })
    expect(r.status, r.salida).toBe(0)
    expect(r.llamadas.match(/--paso firmar/g)).toHaveLength(1)
    expect(r.salida).toMatch(/LISTO\. Publicadas y firmadas/)
  })

  it('si la firma automática falla, sale con ese código, avisa, y NO dice que firmó', () => {
    const r = correr(['-FirmaAutomatica'], { publicar: 0, firmar: 4 })
    expect(r.status, r.salida).toBe(4)
    expect(r.salida).toMatch(/PARO en el paso 4 firma/)
    expect(r.salida).not.toMatch(/Publicadas y firmadas/)
    expect(r.llamadas).toMatch(/avisar-tanda/)
  })

  it('la cara en Kaggle NO corre sola: sin -ConCara dice que está apagada', () => {
    const r = correr([], { publicar: 0 })
    expect(r.salida).toMatch(/la cara APAGADA/)
    expect(r.salida).not.toMatch(/en Kaggle, FUERA del equipo/)
  })

  it('en la fase de la mañana, sin manifiesto, para con aviso (la noche no corrió)', async () => {
    await rm(join(CARPETA_TANDA, 'manifiesto.json'))
    const r = correr([], {})
    expect(r.status, r.salida).toBe(1)
    expect(r.salida).toMatch(/PARO en el paso manifiesto/)
    expect(r.llamadas).toMatch(/avisar-tanda/)
  })
})

describe.skipIf(!EN_WINDOWS)('H4 · el candado: dos corridas a la vez no se pisan', () => {
  it('con otra corrida sosteniendo el candado, ésta para con código 5 y avisa; sin él, corre', async () => {
    const candado = join(trabajo, 'candado.lock')
    const listo = join(trabajo, 'candado-listo.txt')
    // Otra «corrida»: abre el candado SIN compartirlo y lo sostiene unos segundos.
    const otra = spawn(
      'powershell.exe',
      [
        '-NoProfile', '-Command',
        `$f=[System.IO.File]::Open('${candado}','OpenOrCreate','ReadWrite','None'); Set-Content '${listo}' 'listo'; Start-Sleep -Seconds 60; $f.Dispose()`,
      ],
      { stdio: 'ignore' },
    )
    try {
      for (let i = 0; i < 600 && !existsSync(listo); i++) await new Promise((r) => setTimeout(r, 100))
      expect(existsSync(listo), 'la otra corrida no llegó a tomar el candado').toBe(true)

      const bloqueada = correr([], { publicar: 0 })
      expect(bloqueada.status, bloqueada.salida).toBe(5)
      expect(bloqueada.salida).toMatch(/otra corrida/)
      // No hizo NADA de la cadena: ni publicó ni firmó.
      expect(bloqueada.llamadas).not.toMatch(/--paso publicar/)
      expect(bloqueada.llamadas).toMatch(/avisar-tanda/)
    } finally {
      otra.kill()
    }
    // Suelto el candado (el proceso murió), la corrida normal pasa.
    await new Promise((r) => setTimeout(r, 1500))
    const libre = correr([], { publicar: 0 })
    expect(libre.status, libre.salida).toBe(0)
    expect(await readFile(join(trabajo, 'candado.lock'), 'utf8').catch(() => 'sin archivo')).toBeDefined()
  }, 120_000)
})
