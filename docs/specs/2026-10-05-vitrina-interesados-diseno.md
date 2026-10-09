# La vitrina de `/interesados` · diseño (2026-10-05)

## Qué
Una presentación corta **encima** del formulario de interesados: quién somos, qué recibe la
persona, en qué se apoya el método (con la fuente a la vista) y el precio. El formulario
(3 preguntas, 4 casillas y la declaración) no cambia.

## Por qué
`/interesados` es la **única** ruta pública de la app (`src/app/rutasPublicas.ts`), y es la
primera pantalla que ve el seguidor de un creador. Hoy abre con «Antes de empezar» y cinco
decisiones sobre datos, sin decir qué recibe a cambio. La investigación del 5-oct
(sesión B, `INVESTIGACION-BOLA-20261005.md` §1 y §4) la marca como el eslabón más débil
de la bola de nieve que se puede arreglar con código.

## Reglas
1. **Sin promesas de resultado.** Nada de «garantizado» ni de kilos en X semanas. Es salud: se
   dice qué hacemos y en qué evidencia nos apoyamos, no lo que le va a pasar a la persona.
2. **Cada frase de respaldo lleva su fuente**, y la fuente es revisada por pares. Si no hay
   fuente, la frase no entra. Lo vigila un test.
3. **Sin campos nuevos.** La vitrina solo tiene texto y un enlace que baja al formulario. El test
   «no hay ni un campo de texto» sigue valiendo.
4. **Sin datos de nadie.** Ni testimonios ni fotos de asesorados: harían falta autorizaciones
   que todavía no existen.
5. El contenido vive en el dominio (`src/domain/interesados/vitrina.ts`) y la pantalla solo lo pinta.

## Lo que decide Bryan antes de publicar
- El precio que se muestra (hoy 225.000 al mes, el precio de lista del plan del 29-sep).
- Si se nombra la nutrición como parte del servicio (OPERACION §3: sin el profesional de
  nutrición firmado, el ciclo se ofrece sin nutrición individualizada). Mientras no lo diga,
  la vitrina **no** la promete.

## Fuera de alcance
Página de entrada aparte, testimonios, video, pago en línea (Mercado Pago aún no está).
