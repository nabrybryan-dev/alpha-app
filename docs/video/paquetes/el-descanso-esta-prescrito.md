# El descanso también está prescrito

Paquete de producción generado el 2026-08-22 con `npm run video`.
Se trabaja **pegando en AI Studio / Flow**, con la cuota de la suscripción ya pagada.
Ningún prompt de aquí consume API ni tokens de imagen.

## Ficha

| | |
|---|---|
| Objetivo | Que el asesorado deje de improvisar el descanso entre series y entienda que el temporizador no es un adorno: el tiempo que espera cambia lo que la serie siguiente puede levantar. |
| Formato | Reel / Shorts / TikTok — 9:16 (1080x1920) |
| Duración | 8 s en 2 planos |
| Archivos | `el-descanso-esta-prescrito-plano-NN.png` → `el-descanso-esta-prescrito-plano-NN.mp4` |

## Bloque de consistencia

Ya va incluido al principio de cada prompt de imagen. Si generas un plano suelto,
pégalo tú: sin él, Nano Banana reinventa la paleta y la persona en cada imagen.

```
ESTILO DE MARCA — Alpha Athletics (aplicar idéntico en todos los planos):
· Paleta: fondo #0a0a0a, superficies #141414, acento rojo #ff1e1e (solo en un elemento por plano), texto #f2f2f2, secundario #a8a8ad.
· Luz: luz de mañana entrando por ventanal, sombras largas, ambiente de gimnasio vacío.
· Cámara: lente 50 mm, poca profundidad de campo, cámara en trípode.
· Encuadre: 9:16 (1080x1920), Reel / Shorts / TikTok.
· Tono: técnico y sobrio. Nada de euforia de anuncio.
· Evitar siempre: texto inventado o ilegible; marcas de agua o logotipos ajenos; manos o dedos deformes; aparatos de gimnasio imposibles; estética de stock photo sonriente.
```

## Planos

### Plano 01 · 00:00–00:03 (3 s)

Plano cerrado de un banco de press vacío con una toalla encima y una botella al lado, gimnasio en silencio.

**1 · Imagen en Nano Banana** → guardar como `el-descanso-esta-prescrito-plano-01.png`

```
ESTILO DE MARCA — Alpha Athletics (aplicar idéntico en todos los planos):
· Paleta: fondo #0a0a0a, superficies #141414, acento rojo #ff1e1e (solo en un elemento por plano), texto #f2f2f2, secundario #a8a8ad.
· Luz: luz de mañana entrando por ventanal, sombras largas, ambiente de gimnasio vacío.
· Cámara: lente 50 mm, poca profundidad de campo, cámara en trípode.
· Encuadre: 9:16 (1080x1920), Reel / Shorts / TikTok.
· Tono: técnico y sobrio. Nada de euforia de anuncio.
· Evitar siempre: texto inventado o ilegible; marcas de agua o logotipos ajenos; manos o dedos deformes; aparatos de gimnasio imposibles; estética de stock photo sonriente.

PLANO 01 — imagen fija (keyframe).
Plano cerrado de un banco de press vacío con una toalla encima y una botella al lado, gimnasio en silencio.
Composición: objeto centrado, mucho aire arriba.
Deja aire limpio en el tercio inferior para sobreimprimir después el texto "90 segundos.". NO escribas el texto dentro de la imagen.
Evitar además: gente de fondo; espejos.
```

**2 · Animación en Veo / Flow** → guardar como `el-descanso-esta-prescrito-plano-01.mp4`

```
Anima esta imagen (PLANO 01) durante 3 s sin cambiar su composición.
Movimiento: cámara fija, motas de polvo en el haz de luz.
Mantén idénticos persona, vestuario, luz y paleta.
Un solo plano continuo: sin cortes, sin texto nuevo, sin zoom brusco.
```

**3 · Texto en pantalla** (se sobreimprime en el montaje, no en la imagen): «90 segundos.»

**Locución:** Noventa segundos.

### Plano 02 · 00:03–00:08 (5 s)

Persona sentada en el banco mirando el móvil con el temporizador en marcha.

**1 · Imagen en Nano Banana** → guardar como `el-descanso-esta-prescrito-plano-02.png`

```
ESTILO DE MARCA — Alpha Athletics (aplicar idéntico en todos los planos):
· Paleta: fondo #0a0a0a, superficies #141414, acento rojo #ff1e1e (solo en un elemento por plano), texto #f2f2f2, secundario #a8a8ad.
· Luz: luz de mañana entrando por ventanal, sombras largas, ambiente de gimnasio vacío.
· Cámara: lente 50 mm, poca profundidad de campo, cámara en trípode.
· Encuadre: 9:16 (1080x1920), Reel / Shorts / TikTok.
· Tono: técnico y sobrio. Nada de euforia de anuncio.
· Evitar siempre: texto inventado o ilegible; marcas de agua o logotipos ajenos; manos o dedos deformes; aparatos de gimnasio imposibles; estética de stock photo sonriente.

PLANO 02 — imagen fija (keyframe).
Persona sentada en el banco mirando el móvil con el temporizador en marcha.
Composición: sujeto a la izquierda, aire a la derecha.
Deja aire limpio en el tercio inferior para sobreimprimir después el texto "No es tiempo muerto.". NO escribas el texto dentro de la imagen.
```

**1b · Si la persona no casa con el plano 01**, en vez del prompt de arriba:

```
Parte de la imagen del PLANO 01 que acabas de generar (adjúntala).
Mantén idénticos: persona, vestuario, gimnasio, luz y paleta.
Cambia solo esto: Persona sentada en el banco mirando el móvil con el temporizador en marcha.
No reencuadres ni cambies el estilo.
```

**2 · Animación en Veo / Flow** → guardar como `el-descanso-esta-prescrito-plano-02.mp4`

```
Anima esta imagen (PLANO 02) durante 5 s sin cambiar su composición.
Movimiento: push-in muy lento, hombros subiendo y bajando por la respiración todavía alta.
Mantén idénticos persona, vestuario, luz y paleta.
Un solo plano continuo: sin cortes, sin texto nuevo, sin zoom brusco.
```

**3 · Texto en pantalla** (se sobreimprime en el montaje, no en la imagen): «No es tiempo muerto.»

**Locución:** No es tiempo muerto. Es parte de la serie.

## Guion de locución

- **00:00–00:03** · Noventa segundos.
- **00:03–00:08** · No es tiempo muerto. Es parte de la serie.

## Antes de publicar

- [ ] Los planos casan entre sí: misma persona, mismo gimnasio, misma luz.
- [ ] Ningún texto generado dentro de una imagen (se sobreimprime en el montaje).
- [ ] Ninguna cara, medida, nombre ni captura de una asesorada real.
- [ ] La duración total cuadra con el corte final.
