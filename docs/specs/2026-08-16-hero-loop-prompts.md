# Dirección A · Despiece — prompts de producción

Dos prompts, en este orden. El primero produce **una imagen**; esa imagen es el
primer y último fotograma del segundo.

Ambos generan **plancha de fondo sin texto**: el wordmark, el lema y la barra de
carga los pinta `Splash.tsx` en HTML.

---

## PASO 3 · Fotograma de referencia (Nano Banana / GPT Image 2)

Adjunta como referencia: `public/fondos/banco-alpha.jpg` (equipo y paleta) y, si el
generador acepta dos, la foto de CBUM en curl (solo para el grading).

```
A single cinematic still, vertical 9:16, shot for a phone splash screen background.

SUBJECT
A male athlete in a plain matte-black sleeveless training top, gripping an Olympic
barbell at the top of a curl, frozen at peak contraction. Forearm and shoulder
detail visible, sweat sheen on the skin, veins raised. His face is turned down and
away, only partially lit — he is not the identity of the shot, the effort is. No
visible logos on his clothing.

EQUIPMENT
The barbell is loaded with two matte-black bumper plates and two deep-red bumper
plates, seated tight against machined collars. Knurled steel shaft with a brushed
satin finish. Black powder-coated sleeves carrying a subtle raised ALPHA ATHLETICS
relief on the plate face. Behind him, a matte-black flat bench in textured vinyl,
half swallowed by shadow.

ENVIRONMENT
A near-black void. A faint concrete floor plane fades into darkness within two
meters. No gym clutter, no mirrors, no windows, no signage, no other people.

COMPOSITION — this matters more than anything else
The athlete and the barbell occupy the upper two thirds of the frame. The bottom
40% of the frame is near-black empty space with nothing legible in it: no legs, no
floor detail, no highlights. This band is reserved for interface text that will be
composited on top later. Nothing bright may enter it.

LIGHTING
A single hard rectangular key light from camera left at 40 degrees elevation,
warm-neutral 5200K, raking across the knurling and his forearm. A deep red rim
light (#FF1E1E) along the top-right edge of the plates and his shoulder line, low
intensity — just enough to separate them from the void. Sparse chalk dust
suspended in the key beam.

COLOR
Background #08090A. Steel highlights between #C9CED6 and #5F646B. Skin warm but
desaturated. Red #FF1E1E confined to the two plates and the single rim — under 5%
of the frame. Shadows carry a slight desaturated olive cast.

GRADE
Cinematic, high contrast, crushed blacks, fine film grain. Reference: the hard warm
key and olive shadows of contemporary bodybuilding cinematography, crossed with the
controlled cleanliness of a Dyson engineering film.

NEGATIVE
No text. No logos other than the ALPHA ATHLETICS relief on the plates. No
watermarks. No UI. No borders. No competitor branding. Nothing in the lower 40%.
```

---

## PASO 4 · Loop de 8 s (Seedance 2.0, imagen-a-vídeo)

Sube la imagen del paso 3 como **primer fotograma y como último fotograma**.

```
SCENE
- Subject: a male athlete in a plain matte-black sleeveless training top, gripping an Olympic barbell at the top of a curl, frozen at peak contraction — forearm and shoulder detail, sweat sheen, face turned down and only partially lit. The barbell is loaded with two matte-black bumper plates and two deep-red bumper plates, knurled steel shaft with brushed satin finish, machined collars, black powder-coated sleeves carrying a raised ALPHA ATHLETICS relief.
- Environment: a near-black void with a faint concrete floor plane fading into darkness. A matte-black flat bench sits behind him, half swallowed by shadow. No gym clutter, no signage, no other people.
- Mood references: Dyson engineering teardown cinematics crossed with the desaturated olive-shadow, hard-warm-key grade of contemporary bodybuilding cinematography.
- Color palette: background #08090A, skin warm but desaturated, steel #C9CED6 to #5F646B, accent red #FF1E1E only on two plates and one rim light. Red stays under 5% of frame at all times.

CAMERA
- Motion: single continuous 360-degree horizontal orbit around the athlete and barbell as one unit.
- Speed: slow, unhurried, cinematic. Constant angular velocity, no easing at the seam.
- Start position equals end position: exactly one full rotation, returning to the identical starting angle and distance.
- Elevation fixed at 14 degrees above the bar's centerline. Distance held constant, no dolly.
- 50mm equivalent, shallow depth of field, focal plane locked on the knurled shaft.

ACTION ARC
- Starting state: athlete holding the loaded bar at peak contraction, plates seated tight against the collars. He does not move for the entire duration — he is a statue.
- Transformation: collars unthread and drift outward first. Each plate then releases from the sleeve and slides along the bar's axis into an even orbital arrangement, rotating slowly on its own axis as it travels. The shaft stays dead centered in his grip. His hands never open.
- Peak visual moment at 52%: maximum separation. Components suspended at even intervals, edge-lit, the full internal geometry of the sleeve exposed. The bar reads as an exploded technical drawing held by a man who has not flinched.
- Return: components draw back along the axis and reseat in reverse order — plates first, collars last — each landing with a precise mechanical click and a 2 to 3 pixel micro-settle.
- Pacing: 0 to 45% slow outward drift, 45 to 60% held at peak, 60 to 100% deliberate reassembly.

TEXT CHOREOGRAPHY
No text. No UI. Background plate only.

Additionally, keep the bottom 40% of the frame near-black and empty for the entire
duration. No component, limb, particle or highlight may enter that band at any
point in the loop — interface text is composited over it downstream.

LIGHTING & ATMOSPHERE
- Key light: a hard rectangular source from camera left, 40 degrees elevation, warm-neutral 5200K, raking across the knurling and the athlete's forearm.
- Static lighting throughout. No shifts, flickers, or color temperature changes at any point.
- Rim light: deep red #FF1E1E along the top-right edge of the plates and the athlete's shoulder line only, low intensity, just enough to separate them from the void.
- Atmosphere: sparse chalk dust suspended in the key beam, very low density.
- Particle state: dust density and distribution identical at first and last frame, zero net drift across the loop.

LOOP SEAL
- First frame and last frame are the same reference image. Use image-to-video mode with the identical image set as both first and last frame.
- Camera returns to its exact starting angle, elevation and distance.
- Every plate, collar and dust particle returns to its exact starting position and rotation. The athlete's pose is unchanged because it never changed.
- No residual motion, no particle drift, no lighting variation at the loop point.
- The final reseat lands with a clean mechanical click and settles — an intentional resolve, not an abrupt cut.

TECHNICAL
- Duration: 8 seconds
- Seamlessly looping video
- Image-to-video generation mode: use the same image for first frame and last frame
- No watermarks
- 4K resolution if supported
```

---

## Cuando tengas los archivos

Guarda en el repo:

| Archivo | Qué es | Presupuesto |
|---|---|---|
| `public/hero/despiece.webm` | El loop, AV1 o VP9 | **≤ 900 KB** |
| `public/hero/despiece.mp4` | Respaldo H.264 para Safari viejo | ≤ 1,2 MB |
| `public/hero/despiece.jpg` | El fotograma del paso 3, a 1080 de ancho | ≤ 120 KB |

El `.jpg` es el `poster`: es lo que se ve durante la carga, con conexión mala, y lo
único que ve quien tiene activado *reducir movimiento*. Tiene que aguantar solo.
