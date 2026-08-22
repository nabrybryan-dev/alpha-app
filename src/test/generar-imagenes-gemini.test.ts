import { describe, expect, it } from 'vitest'
import {
  construirPeticion,
  extraerImagenBase64,
  extraerPromptsDeImagen,
} from '../../scripts/generar-imagenes-gemini.mjs'
import { construirPaquete } from '../../scripts/produccion-video.mjs'

// La ruta B (API con free tier) es opcional y no se puede probar contra la API real
// sin gastar cuota, así que lo que se prueba es lo único que puede romperse en
// silencio: que el parser siga entendiendo el formato que escribe el generador de
// paquetes. Si alguien cambia el Markdown y el parser deja de encontrar prompts, este
// test se pone rojo aquí y no a mitad de una tanda de imágenes.

const PAQUETE = construirPaquete(
  {
    titulo: 'Vídeo de prueba',
    objetivo: 'Probar el parser.',
    planos: [
      { descripcion: 'Uno.', textoEnPantalla: 'Hola' },
      { descripcion: 'Dos.' },
    ],
  },
  '2026-08-22',
)

describe('extraerPromptsDeImagen', () => {
  it('encuentra un prompt por plano, con su archivo de destino', () => {
    const encontrados = extraerPromptsDeImagen(PAQUETE)
    expect(encontrados.map((p) => p.archivo)).toEqual([
      'video-de-prueba-plano-01.png',
      'video-de-prueba-plano-02.png',
    ])
  })

  // Si esto se rompe, las imágenes salen sin la identidad de marca y no se nota
  // hasta verlas: el bloque tiene que viajar dentro del prompt, no solo estar en el
  // documento.
  it('el prompt extraído conserva el bloque de consistencia entero', () => {
    const [primero] = extraerPromptsDeImagen(PAQUETE)
    expect(primero.prompt).toContain('ESTILO DE MARCA')
    expect(primero.prompt).toContain('#ff1e1e')
    expect(primero.prompt).toContain('PLANO 01')
  })

  it('no confunde los prompts de vídeo con los de imagen', () => {
    const encontrados = extraerPromptsDeImagen(PAQUETE)
    expect(encontrados).toHaveLength(2)
    for (const { prompt } of encontrados) expect(prompt).not.toContain('Anima esta imagen')
  })

  it('devuelve lista vacía si el Markdown no es un paquete', () => {
    expect(extraerPromptsDeImagen('# Cualquier otra cosa\n\ntexto suelto')).toEqual([])
  })
})

describe('construirPeticion', () => {
  it('pide imagen y manda el prompt tal cual', () => {
    const cuerpo = construirPeticion('un gimnasio en penumbra')
    expect(cuerpo.generationConfig.responseModalities).toEqual(['IMAGE'])
    expect(cuerpo.contents[0].parts[0].text).toBe('un gimnasio en penumbra')
  })
})

describe('extraerImagenBase64', () => {
  it('saca el base64 de la primera parte con imagen', () => {
    const respuesta = {
      candidates: [{ content: { parts: [{ text: 'aquí tienes' }, { inlineData: { data: 'QUJD' } }] } }],
    }
    expect(extraerImagenBase64(respuesta)).toBe('QUJD')
  })

  // Un fallo de la API llega como 200 con texto en vez de imagen. Si eso se tragara
  // en silencio se escribiría un PNG vacío y el error aparecería al abrirlo.
  it('lanza con el motivo cuando la respuesta trae texto en vez de imagen', () => {
    const respuesta = {
      promptFeedback: { blockReason: 'SAFETY' },
      candidates: [{ content: { parts: [{ text: 'No puedo generar eso.' }] } }],
    }
    expect(() => extraerImagenBase64(respuesta)).toThrow(/SAFETY/)
    expect(() => extraerImagenBase64(respuesta)).toThrow(/No puedo generar eso/)
  })

  it('lanza también con una respuesta vacía', () => {
    expect(() => extraerImagenBase64({})).toThrow(/no traía imagen/)
  })
})
