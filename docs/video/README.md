# Vídeos con Nano Banana

Flujo en tres pasos. **No gasta API ni tokens de imagen**: la generación se hace en
AI Studio / Flow con la cuota de la suscripción que ya está pagada. El porqué y las
alternativas descartadas, en `docs/specs/2026-08-22-video-nano-banana-diseno.md`.

1. **Escribe el brief** en `briefs/<nombre>.json`. Hay dos de los que partir:
   - `briefs/ejemplo-ajuste-semanal.json` — lo mínimo que hace falta.
   - `briefs/plantilla-completa.json` — **usa todos los campos**, incluido el
     `marca` para cambiarle la luz a un vídeo sin tocar la paleta. Copia este si
     quieres verlos todos en su sitio.

   Solo son obligatorios `titulo`, `objetivo` y `planos[].descripcion`; el resto
   tiene valores por defecto.

2. **Genera el paquete**. Lo más simple en Windows: **arrastra el `.json` encima de
   `GENERAR VIDEO.bat`** (en la raíz del proyecto). Sin argumentos usa el de ejemplo.

   Desde la terminal, y **desde la carpeta del proyecto** —si sale
   `ENOENT ... C:\Users\Usuario\package.json` es que npm se ejecutó en otro sitio—:

   ```bash
   npm run video -- docs/video/briefs/<nombre>.json
   ```

   Sale un Markdown en `paquetes/` con, para cada plano: el prompt de imagen
   completo, el de continuidad, el de animación para Veo, el rótulo y la locución.

3. **Pega y genera** en [AI Studio](https://aistudio.google.com) (imágenes con Nano
   Banana Pro) y Flow (animación con Veo). Guarda cada archivo con el nombre que
   indica el paquete y monta en ese orden.

## Campos del brief

| Campo | Obligatorio | Por defecto |
|---|---|---|
| `titulo`, `objetivo` | sí | — |
| `formato` | no | `reel-vertical` (`feed-cuadrado`, `horizontal`) |
| `slug` | no | se deriva del título |
| `marca` | no | los tokens de Alpha Athletics |
| `planos[].descripcion` | sí | — |
| `planos[].id` | no | `01`, `02`… |
| `planos[].segundos` | no | `4` |
| `planos[].textoEnPantalla` | no | sin rótulo |
| `planos[].locucion`, `composicion`, `movimiento`, `evitar` | no | — |

## Dos cosas que no se saltan

- **El texto no se genera dentro de la imagen.** Nano Banana lo escribe mal. Los
  prompts piden dejar aire y el rótulo se sobreimprime en el montaje.
- **Ninguna asesorada real.** Ni cara, ni medidas, ni nombre, ni captura de la app
  con sus datos. Los vídeos se hacen con personas generadas.

## Borradores baratos (opcional)

Para iterar mucho sobre un encuadre sin gastar la cuota de la suscripción:

```bash
GEMINI_API_KEY=... node scripts/generar-imagenes-gemini.mjs docs/video/paquetes/<slug>.md
```

Usa Flash Image (tiene free tier). Es **solo para encuadre**: el plano que se publica
se genera con Nano Banana Pro en AI Studio. La key va en el entorno, nunca en el repo.
