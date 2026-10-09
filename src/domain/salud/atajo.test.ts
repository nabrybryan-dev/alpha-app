import { describe, expect, it } from 'vitest'
import { ENLACE_ATAJO_ICLOUD, esEnlaceDeIcloud, pareceCodigoDeAtajo, plataformaDe } from './atajo'

describe('el enlace de iCloud del atajo', () => {
  it('está vacío o es un enlace de atajo de iCloud: nada intermedio', () => {
    // Cuando Bryan pegue aquí su enlace, esta prueba le dice si lo copió bien.
    expect(ENLACE_ATAJO_ICLOUD === '' || esEnlaceDeIcloud(ENLACE_ATAJO_ICLOUD)).toBe(true)
  })

  it('acepta el enlace que da «Compartir → Copiar enlace de iCloud»', () => {
    expect(esEnlaceDeIcloud('https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef')).toBe(true)
    expect(esEnlaceDeIcloud('https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef/')).toBe(true)
  })

  it('rechaza otro dominio, http, parámetros, javascript: y vacíos', () => {
    for (const malo of [
      '',
      'https://icloud.com.evil.test/shortcuts/0123456789abcdef0123456789abcdef',
      'http://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef',
      'https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef?x=1',
      'https://www.icloud.com/shortcuts/corto',
      'https://www.icloud.com/otra/0123456789abcdef0123456789abcdef',
      'javascript:alert(1)',
      'https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef"onclick="x',
    ]) {
      expect(esEnlaceDeIcloud(malo), malo).toBe(false)
    }
  })
})

describe('plataformaDe', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36'
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

  it('distingue iPhone, Android y lo demás', () => {
    expect(plataformaDe(IPHONE)).toBe('ios')
    expect(plataformaDe(ANDROID)).toBe('android')
    expect(plataformaDe(WINDOWS)).toBe('otra')
    expect(plataformaDe('')).toBe('otra')
  })

  it('un iPad que se presenta como Mac se reconoce por la pantalla táctil; un Mac de verdad no', () => {
    expect(plataformaDe(MAC, 5)).toBe('ios')
    expect(plataformaDe(MAC, 0)).toBe('otra')
  })
})

describe('pareceCodigoDeAtajo', () => {
  it('sa_ y 40 hexadecimales', () => {
    expect(pareceCodigoDeAtajo('sa_' + 'ab12'.repeat(10))).toBe(true)
    for (const malo of ['', 'sa_', 'sa_' + 'ab12'.repeat(9), 'SA_' + 'ab12'.repeat(10), 'sa_' + 'zz'.repeat(20)]) {
      expect(pareceCodigoDeAtajo(malo), malo).toBe(false)
    }
  })
})
