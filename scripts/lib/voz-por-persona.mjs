/**
 * LA VOZ DE LA TANDA, UNA PERSONA POR PROCESO, con la voz de alpha-estudio.
 *
 * Antes (hasta el 22-oct) el paso 2 llamaba a `dev/prueba-voz/generar_revisiones.py`: molde de
 * 12 s, ajustes del 13-sep, un solo proceso para toda la tanda y un modelo de 2-3 GB que se
 * quedaba cargado hora y media. El 15-oct ese proceso murió a los 9 minutos (0xC0000005) y se
 * perdió la tanda entera. Ahora se llama a `estudio.voz` de alpha-estudio (molde
 * `config.MOLDE_OFICIAL`, los ajustes «B» que Bryan eligió a ciegas el 19-sep, recorte de
 * silencios), que está hecho para correr como PROCESO APARTE que muere al terminar (`voz.py:5-8`).
 * Aquí se lanza uno por persona y, si muere, se reintenta UNA vez: una caída cuesta a una
 * persona, no a las dieciséis.
 *
 * LO QUE EL GENERADOR VIEJO PROTEGÍA Y SE CONSERVA (relevo sin pérdidas):
 *   · el TESTIGO: junto a cada mp3 queda el guion exacto con el que se hizo. Un audio ya hecho
 *     solo se salta si dice lo mismo; si el guion cambió se rehace (si no, se publicaría el audio
 *     viejo con la letra nueva al lado);
 *   · «no se entrega si una sale corta»: lo hace `estudio.voz` (tres intentos por trozo y falla
 *     con FALLO.json); aquí, una persona fallida no tiene archivo y el paso 3 la dirá «SIN AUDIO»;
 *   · el código de salida distinto de 0 si alguien falló (lo decide `codigoDeSalidaDeLasVoces`);
 *   · la comprobación de `pkg_resources` para la marca de agua (la hace `generar-voces.mjs`).
 *
 * Y UNA COSA NUEVA: 100-150 ms de silencio ANTES de la primera palabra. El VAD de `voz.py` recorta
 * pegado a la voz y el audio arrancaba sin colchón (medido el 22-oct: los primeros 50 ms ya
 * estaban a -27,7 dBFS), cosa que en el móvil se oye cortada.
 *
 * Esta pieza no sabe de procesos ni de ffmpeg: recibe un objeto `io` (los de verdad viven en
 * `scripts/generar-voces.mjs`) y por eso se prueba sin una hora de máquina.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** 100-150 ms pedidos; 120 deja margen a los dos lados. */
export const SILENCIO_PREVIO_MS = 120
/** Un reintento: una caída aislada (memoria) se supera; dos seguidas no son mala suerte. */
export const REINTENTOS_DE_LA_VOZ = 1
/**
 * Pausa antes de reintentar: que Windows devuelva la memoria del proceso que murió. Con 20 s no
 * bastó: el 22-oct, con el PC al límite de memoria virtual, el reintento murió con el mismo
 * 0xC0000005 de la caída del 15-oct (ver docs/specs/2026-10-22-mensajes-semanales-sin-freno.md).
 */
export const ESPERA_ANTES_DE_REINTENTAR_MS = 60_000

const sinEspacios = (t) => String(t ?? '').trim()

async function leerSiExiste(ruta) {
  try {
    return await readFile(ruta, 'utf8')
  } catch {
    return null
  }
}

async function motivoDelFallo(trabajo, resultado) {
  const crudo = await leerSiExiste(join(trabajo, 'FALLO.json'))
  let propio = ''
  if (crudo) {
    try {
      propio = String(JSON.parse(crudo).motivo ?? '').trim()
    } catch {
      propio = ''
    }
  }
  const codigo = resultado.codigo === null || resultado.codigo === undefined ? 'sin código' : `código ${resultado.codigo}`
  if (propio) return `${codigo}: ${propio}`
  if (resultado.error) return `${codigo}: ${resultado.error}`
  if (resultado.codigo === 0) return 'salió con código 0 pero no dejó el audio'
  return codigo
}

/**
 * @param {object} p
 * @param {string} p.carpeta    la carpeta de la tanda (la del manifiesto)
 * @param {{semana: string, encargos: object[]}} p.manifiesto
 * @param {string} p.molde      ruta del .wav de referencia (`estudio.config.MOLDE_OFICIAL`)
 * @param {string} p.moldeSha256 la huella sha256 de ese archivo, calculada por quien lo lee (H8, revisión 06):
 *   se escribe en el log y junto a cada audio (`<id>.molde.sha256`), y un audio hecho con otro molde se rehace.
 * @param {string} p.estudio    carpeta de alpha-estudio: desde ahí se lanza `estudio.voz`
 * @param {object} p.io         { correrVoz(rutaEncargo, cwd), anteponerSilencio(entrada, salida, ms), esperar(ms) }
 */
export async function generarVocesDeLaTanda({
  carpeta,
  manifiesto,
  molde,
  moldeSha256,
  estudio,
  io,
  silencioMs = SILENCIO_PREVIO_MS,
  reintentos = REINTENTOS_DE_LA_VOZ,
  esperaMs = ESPERA_ANTES_DE_REINTENTAR_MS,
  soloUno = undefined,
  log = console.log,
}) {
  const resumen = { generadas: [], yaEstaban: [], fallidas: [], omitidas: [] }
  const encargos = manifiesto.encargos.filter((e) => !soloUno || e.usuarioId === soloUno)
  log(`Semana del ${manifiesto.semana} · ${encargos.length} voces, una por proceso`)
  log(`Molde: ${molde} · sha256 ${moldeSha256}`)

  let n = 0
  for (const encargo of encargos) {
    n += 1
    const quien = encargo.nombre || encargo.usuarioId
    const marca = `[${n}/${encargos.length}] ${quien}`
    const ficha = { usuarioId: encargo.usuarioId, nombre: encargo.nombre }

    if (encargo.omitido) {
      log(`  ${marca}: omitida por el agente (${encargo.mensaje?.motivo ?? 'sin motivo escrito'})`)
      resumen.omitidas.push(ficha)
      continue
    }
    const guion = sinEspacios(encargo.guion)
    if (!guion) {
      log(`  ${marca}: NO SE HACE, el guion está vacío`)
      resumen.fallidas.push({ ...ficha, intentos: 0, motivo: 'guion vacío' })
      continue
    }

    const destino = join(carpeta, `${encargo.usuarioId}.mp3`)
    const testigo = join(carpeta, `${encargo.usuarioId}.guion.txt`)
    const testigoDelMolde = join(carpeta, `${encargo.usuarioId}.molde.sha256`)
    if (existsSync(destino)) {
      const dice = await leerSiExiste(testigo)
      const conMolde = await leerSiExiste(testigoDelMolde)
      if (dice !== null && sinEspacios(dice) === guion && conMolde !== null && sinEspacios(conMolde) === moldeSha256) {
        log(`  ${marca}: ya estaba`)
        resumen.yaEstaban.push(ficha)
        continue
      }
      const motivo =
        dice === null
          ? 'no consta con qué guion se hizo'
          : sinEspacios(dice) !== guion
            ? 'el guion CAMBIÓ'
            : conMolde === null
              ? 'no consta con qué molde se hizo'
              : 'el molde CAMBIÓ'
      log(`  ${marca}: se rehace (${motivo})`)
      await unlink(destino).catch(() => {})
    }

    const trabajo = join(carpeta, 'voz-trabajo', encargo.usuarioId)
    let hecho = false
    let ultimoMotivo = ''
    let intentos = 0
    for (let intento = 1; intento <= 1 + reintentos; intento++) {
      intentos = intento
      // Cada intento empieza de cero: lo que dejó el proceso que murió no se hereda.
      await rm(trabajo, { recursive: true, force: true })
      await mkdir(trabajo, { recursive: true })
      const rutaEncargo = join(trabajo, 'encargo.json')
      await writeFile(rutaEncargo, JSON.stringify({ texto: guion, molde, destino: trabajo }), 'utf8')

      let resultado
      try {
        resultado = await io.correrVoz(rutaEncargo, estudio)
      } catch (e) {
        resultado = { codigo: null, error: String(e?.message ?? e) }
      }
      const completo =
        resultado.codigo === 0 && existsSync(join(trabajo, 'TERMINADO.json')) && existsSync(join(trabajo, 'voz.mp3'))
      if (completo) {
        hecho = true
        break
      }
      ultimoMotivo = await motivoDelFallo(trabajo, resultado)
      log(`  ${marca}: intento ${intento} falló (${ultimoMotivo})`)
      if (intento <= reintentos) await io.esperar(esperaMs)
    }

    if (!hecho) {
      resumen.fallidas.push({ ...ficha, intentos, motivo: ultimoMotivo })
      continue
    }

    await io.anteponerSilencio(join(trabajo, 'voz.mp3'), destino, silencioMs)
    await writeFile(testigo, guion, 'utf8')
    await writeFile(testigoDelMolde, moldeSha256, 'utf8')
    await rm(trabajo, { recursive: true, force: true })
    log(`  ${marca}: lista${intentos > 1 ? ` (al intento ${intentos})` : ''}`)
    resumen.generadas.push({ ...ficha, intentos })
  }

  log(
    `\nVoces · ${resumen.generadas.length} hechas · ${resumen.yaEstaban.length} ya estaban · ` +
      `${resumen.omitidas.length} omitidas · ${resumen.fallidas.length} fallidas`,
  )
  for (const f of resumen.fallidas) log(`  NO SE ENTREGA ${f.nombre || f.usuarioId}: ${f.motivo}`)
  return resumen
}

/** 0 si todas las que tocaban quedaron; 1 si alguien no tiene audio. */
export function codigoDeSalidaDeLasVoces(resumen) {
  return resumen.fallidas.length > 0 ? 1 : 0
}
