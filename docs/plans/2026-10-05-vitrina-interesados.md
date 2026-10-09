# Plan · La vitrina de `/interesados` (2026-10-05)

Diseño: `docs/specs/2026-10-05-vitrina-interesados-diseno.md`.

1. `src/domain/interesados/vitrina.ts`: textos, respaldo con su fuente, precio y su formato.
   Test al lado: toda frase de respaldo tiene fuente; ninguna frase promete resultados; el precio
   se lee en pesos colombianos.
2. `src/features/interesados/Vitrina.tsx`: pinta el contenido; un enlace baja al formulario.
   Test al lado: se ven el precio, las fuentes y el enlace; no hay campos ni botones.
3. `InteresadosPage.tsx`: la vitrina va arriba; «Antes de empezar» pasa a ser el título del
   formulario (`h2`, con `id="formulario"`). Los tests de la página siguen en verde sin tocarlos.
4. `npm run verify` y el linter sin avisos nuevos.
