# Prompts de referencia visual — el salón y el sujeto

Para Google AI Studio o Midjourney. Sirven para decidir **cómo queremos que se vea**,
no para copiar píxel a píxel: un modelo de imagen renderiza una foto sin límite de
tiempo, y el salón renderiza sesenta por segundo en un motor WebGL escrito a mano
dentro de un teléfono.

De estas imágenes es trasladable la **dirección** — negro mate, rojo profundo,
contraluz que separa la silueta, claroscuro, encuadre por tercios, los datos
integrados en la pared en vez de flotando encima. No lo es el detalle de piel ni la
iluminación calculada.

En Google AI Studio se pegan tal cual, sin los parámetros del final.
En Midjourney se añade al final de cada uno: `--ar 9:16 --style raw --v 6.0`

---

## A · La vista principal del salón

```
Vertical 9:16 cinematic still, photorealistic, of a digital performance laboratory:
a matte-black training hall with dark curved walls, a subtle floor grid receding
into shadow, and volumetric haze catching the light.

In the exact centre, filling the frame from mid-thigh to head, stands a
scientifically accurate human anatomical figure mid-repetition of a barbell back
squat, captured at the sticking region — hips descending, torso braced, knees
tracking. The figure is a hybrid anatomical render: the surface reads as a real
athlete, while the working musculature is revealed in cutaway — quadriceps,
gluteus maximus, adductors and hamstrings visible with correct fibre direction,
pennation angle, and clearly defined origins and insertions on the underlying
skeleton. Bone is visible where muscle does not cover it: femur, tibia, pelvis,
ribcage. No cartoon shading, no superhero exaggeration — medical-illustration
accuracy rendered with game-engine materials.

He is loaded with a real barbell across the upper back, deep-red bumper plates,
matte-black knurled bar. To his left, at the foot of the wall, a black tripod
holds a phone in vertical orientation, framing him from the side — a small red
recording indicator glowing.

Floating on the walls around him, integrated into the architecture rather than
overlaid on top, are three-dimensional data panels in the visual language of a
stadium scoreboard: seven-segment numerals glowing deep red and cold white, in
perspective with the wall surface, reading SETS, REP RANGE, RIR, LOAD and a
session timer. Thin white vector lines trace force direction and moment arms
from the barbell down through the hips and knees, with a plumb line falling from
the centre of mass to the base of support.

Lighting: three-point cinematic setup — hard key from camera left, soft fill,
and an intense white rim light separating the silhouette from the black
background. Deep chiaroscuro sculpting muscle volume. Shot on a 50mm lens at
f/2.0, shallow depth of field, gentle background bokeh, subtle 35mm film grain,
Arri Alexa colour science.

Composition: rule of thirds, the figure's head on the upper-left intersection,
negative space in the direction of the movement, floor grid providing leading
lines. Palette strictly matte black, cold white and deep red. No text labels,
no logos, no UI chrome, no visible browser or device frame.

--ar 9:16 --style raw --v 6.0
```

---

## B · La capa anatómica del eje W

```
Vertical 9:16 cinematic still, photorealistic anatomical study, same matte-black
laboratory, same athlete, same squat position — but rendered as a cross-section
through the body's depth: on the left third the skin surface, transitioning
through superficial musculature, then deep musculature, then tendon and passive
tissue, and on the right third the bare skeleton, as if the body were being
travelled through layer by layer.

Each layer is anatomically correct and continuous with the next: the same femur
under the same vastus lateralis, fibre direction preserved, origins and
insertions visible where tendon meets bone. Thin cold-white leader lines mark
insertion points without cluttering the figure.

Intense white rim light along the silhouette, deep chiaroscuro, volumetric haze,
50mm at f/1.8, shallow depth of field, matte black and deep red palette, 35mm
grain, Arri Alexa colour science. No text, no labels, no logos.

--ar 9:16 --style raw --v 6.0
```

---

## De dónde sale cada decisión

| En el prompt | Por qué |
|---|---|
| 9:16, negro mate, rojo profundo, Arri Alexa | dirección de arte del documento maestro de Bryan |
| tres puntos de luz, rim light, claroscuro | el mismo documento, sección de iluminación |
| 50mm / 85mm, f/1.8-2.0, bokeh, grano | sección de óptica: evita distorsión biomecánica |
| tercios, espacio libre en la dirección del gesto | sección de composición |
| datos en la pared, no encima del sujeto | decisión de Bryan del 29-ago: lo importante va a las paredes |
| trípode con el móvil en vertical | el encuadre es la precondición del historial, no decoración |
| vectores de fuerza y plomada al centro de masas | el análisis biomecánico por paralelogramo y centro de masas |
| las cinco capas del eje W | piel → superficial → profundo → tendón → hueso |
| sin texto ni logos en la imagen | son referencia de dirección visual, no maquetas de pantalla |
