# Vídeos con Nano Banana

Flujo en tres pasos. **No gasta API ni tokens de imagen**: la generación se hace en
AI Studio / Flow con la cuota de la suscripción que ya está pagada. El porqué y las
alternativas descartadas, en `docs/specs/2026-08-22-video-nano-banana-diseno.md`.

1. **Escribe el brief** en `briefs/<nombre>.json`. Hay dos de los que partir:
   - `briefs/ejemplo-ajuste-semanal.json` — lo mínimo que hace falta.
   - `briefs/el-descanso-esta-prescrito.json` — **usa todos los campos**, incluido
     el `marca` para cambiarle la luz a un vídeo sin tocar la paleta. Copia este si
     quieres verlos todos en su sitio.

   Solo son obligatorios `titulo`, `objetivo` y `planos[].descripcion`; el resto
   tiene valores por defecto.

   **Lo que se ve y lo que se mueve van en campos distintos.** `descripcion` la lee
   un generador de imagen fija, así que una respiración agitada ahí no la representa
   nadie: eso va en `movimiento`, que es lo que lee Veo al animar («hombros subiendo
   y bajando»). Mismo criterio para cualquier cosa que solo exista en el tiempo.

2. **Genera el paquete**. Lo más simple en Windows: **arrastra el `.json` encima de
   `GENERAR VIDEO.bat`** (en la raíz del proyecto). Sin argumentos usa el de ejemplo.

   Desde la terminal, y **desde la carpeta del proyecto** —si sale
   `ENOENT ... C:\Users\Usuario\package.json` es que npm se ejecutó en otro sitio—:

   ```bash
   npm run video -- docs/video/briefs/<nombre>.json
   ```

   Sale un Markdown en `paquetes/` con, para cada plano: el prompt de imagen
   completo, el de continuidad, el de animación para Veo, el rótulo y la locución.

   `paquetes/` está en `.gitignore` a propósito: es **salida**, se reconstruye
   desde el brief en un doble clic. El brief es lo que se versiona.

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

Usa Flash Image. Es **solo para encuadre**: el plano que se publica se genera con
Nano Banana Pro en AI Studio. La key va en el entorno, nunca en el repo.

> **Hoy esto no funciona, y no es la key.** Comprobado el 2026-08-21: el proyecto
> `gen-lang-client-0617952892` está en plan de **prepago con el saldo a cero**, y en
> ese estado la API rechaza **todos** los modelos —también Flash Image, aunque tenga
> free tier— con `429 RESOURCE_EXHAUSTED · Your prepayment credits are depleted`.
> El free tier solo aplica a proyectos que no han pasado a prepago.
>
> La key autentica bien: `GET /v1beta/models` devuelve 200 y lista los 50 modelos,
> incluidos `nano-banana-pro-preview` y `gemini-3-pro-image`. Lo que falta es saldo.
>
> Y ojo con la confusión que costó una tarde: **la mensualidad de Google AI no
> rellena este saldo.** Son dos cajas distintas — la suscripción paga la app web, y
> la API se paga con créditos del proyecto. Por eso el paso 3 (pegar en AI Studio)
> sigue siendo gratis y este atajo no.
