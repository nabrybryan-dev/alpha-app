# La máquina de dominada asistida (2026-09-06)

## Qué pidió Bryan

«Es en máquina gemelos de pie, y las dominadas asistidas: puedes buscar un vídeo de
referencia». Lo primero confirma lo que la tabla ya hacía (`gemelo de pie` a secas →
máquina). Lo segundo es esta tanda.

## Qué se veía antes

«Dominadas asistidas» se prescribe con categoría TRACCIÓN VERTICAL, y esa ficha es un
**jalón sentado**. La escena reconocía la dominada por el nombre (cadena cerrada, «las manos
en la barra fija») y dibujaba la barra fija con sus dos montantes; el sujeto salía **sentado
en el aire, agarrado a la barra**. Bryan lo vio el mismo día y de ahí el encargo.

## Referencia

- Vídeo: «Exercise Tutorial: Technogym Wide Grip Assisted Pull-Up Machine» (Travis Tarrant),
  https://www.youtube.com/watch?v=uuioMSFzQ8U — escalones laterales para subir, agarre en la
  barra, rodillas en la rodillera; la rodillera va unida por una palanca a la pila de placas,
  y cuanto más peso, más ayuda.
- Medidas: Life Fitness Signature Series Assist Dip Chin, **134 × 170 × 225 cm**, pila de
  85 kg (ficha del fabricante). De ahí el ancho del bastidor y la altura del techo.

## Qué se hizo

1. **Ficha propia** `dominada_asistida` (categoría DOMINADA ASISTIDA) en el catálogo: cuelga
   de las manos (`apoyo: 'manos'`, barra a 2,15 m, como la suspensión) y se arrodilla
   (rodilla a 100°). Cadena cerrada: las manos no se mueven, el cuerpo sube.
2. **Variantes por nombre DENTRO de una categoría** (`VARIANTES_POR_NOMBRE` en `catalogo.ts`):
   la categoría sigue mandando sobre el nombre; el nombre solo elige entre las fichas de esa
   misma categoría. «Dominadas asistidas» bajo TRACCIÓN VERTICAL → `dominada_asistida`;
   «Jalón al pecho» y «Dominadas» siguen donde estaban.
3. **La máquina** (`escena/maquinaAsistida.ts`), quinta forma `'asistida'` de `FormaDeMaquina`:
   bastidor de 134 cm clavado al suelo, barra a la altura de las manos y techo justo encima,
   escalones, asas de fondos, columna con pila detrás, y la **rodillera calculada contra las
   espinillas fase a fase**, con su palanca hasta la columna. Dos convenciones conviven a
   propósito: el bastidor va en coordenadas del mundo (como toda máquina), la rodillera contra
   el cuerpo (como el banco), porque en la máquina real sube y baja con quien se arrodilla.
4. La materia (acero, caucho, bastidor, tapizado…) salió de `implementos.ts` a `materia.ts`
   para que la máquina nueva la use sin importar `implementos.ts` de vuelta.

## Cómo se comprobó

- `escena/maquinaAsistida.test.ts`: el nombre separa la asistida del jalón sin quitarle el
  mando a la categoría; el sujeto cuelga con los dedos en la barra (±2 cm) y la espinilla va
  hacia atrás y horizontal en las tres fases; la pelvis sube más de 25 cm; la rodillera queda
  justo bajo las espinillas (sin atravesarlas, a menos de 9 cm) abajo y arriba, y sube más de
  20 cm con el cuerpo; el bastidor llega al suelo y el techo queda entre la barra y 20 cm
  sobre ella; la barra cruza al sujeto aunque llegue una sola mano.
- Fotos en la demo (usuario Mateo, sesión FULL A, con el testigo CDP): abajo y arriba.
  Bryan decide con las de la vista previa de Vercel.

## Lo que queda

- La dominada **sin asistir** sigue cayendo en el jalón sentado (hueco conocido; sería una
  ficha hermana con las piernas estiradas y la barra fija de siempre).
- La asistencia no se mide: la pila descuenta peso, y el plan de medida de la dominada
  (línea desde el centro de masas) no sabe cuánto. Se dibuja; no se cuantifica.
