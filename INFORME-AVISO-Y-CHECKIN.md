# Informe — Aviso diario y check-in corto (2026-09-13)

## Qué se hizo

- **Spec** `docs/specs/2026-09-13-aviso-diario-y-checkin-corto.md`: mapeo de cada pregunta a campo existente (calidadSueno, cansancio inverso para energía, dolor/dolorDonde + dolorDesdeAyer opcional), UI plegada, push 19:00 Bogotá, migración y secretos.
- **Dominio** `src/domain/types.ts`: añadido `dolorDesdeAyer?: { hay, donde?, eva? }` (opcional, jsonb, sin migración).
- **Selección** `src/domain/avisos/seleccion.ts` + `seleccionAviso.test.ts`: `hoyBogota` (America/Bogota), `esViva`, `sinCheckinHoy`, `esMuerta` (404/410).
- **UI** `src/features/bienestar/CheckinForm.tsx`: 3 obligatorias arriba (¿Cómo dormiste? / ¿Cómo llegas hoy? con etiquetas Con energía-Normal-Sin energía → POCO/REGULAR/MUCHO / ¿Te duele algo desde ayer? No/Sí → EVA+dónde). Resto en `<details>Más detalles (opcional)</details>`. Guardado espeja `dolorDesdeAyer` en `dolor/dolorDonde` para compatibilidad readiness. Tests 3-archivos adaptados.
- **Función** `supabase/functions/enviar-aviso-checkin/index.ts` (Deno): lee permisos, filtra sin check-in hoy Bogotá, envía Web Push VAPID (ES256 JWT, Web Crypto), 404/410 → `vivo_en=null`, éxito → `vivo_en=now()`. Lógica de selección duplicada inline para no depender de bundling. Secretos por env, nada en código.
- **Migración** `supabase/migrations/NNNN_aviso_diario_checkin.sql` (literal NNNN): activa `pg_net` si existe, lee `supabase_url` y `service_role_key` de `vault.decrypted_secrets` (fallback `app.settings.supabase_url`), programa `cron.schedule('aviso-checkin-diario','0 0 * * *', net.http_post → /functions/v1/enviar-aviso-checkin)`. Sin vault/pg_net/pg_cron: `raise notice` y no programa.

## Commits

- `51f62f3` `feat(aviso-y-checkin-corto): aviso 19h Bogotá y check-in de 3 preguntas` — rama `feat/aviso-y-checkin-corto` (12 archivos, +823 −364). Incluye spec, tipos, selección+tests, CheckinForm+tests, función y migración NNNN.

## Tests corridos

- `npx vitest run src/domain/avisos/seleccionAviso.test.ts` — 4 passed
- `npx vitest run src/domain/avisos/ src/domain/readiness.test.ts src/features/bienestar/` — avisos 13 passed, bienestar 37 passed (CheckinForm 8 + peso-obsoleto 2 + sueno 4 + peso-no-inventado 7 + MedidasCard 16), readiness 5 passed
- `npm run typecheck` (tsc -b) — 0 errores

## Secretos que debe poner el dueño

En Supabase Dashboard → Edge Functions → Secrets **y** en `vault` (para que `pg_cron` pueda leer la service key sin escribirla en la migración):

- **Edge Function env**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (ej `mailto:soporte@alpha.test`).
- **Vault** (`vault.decrypted_secrets`): `supabase_url` (ej `https://<ref>.supabase.co`), `service_role_key` (mismo JWT que `SUPABASE_SERVICE_ROLE_KEY`).
- **Frontend** (ya existente): `VITE_VAPID_PUBLIC_KEY` (misma que `VAPID_PUBLIC_KEY`).

Generar VAPID: `npx web-push generate-vapid-keys` (o equivalente); guardar privada solo en secretos, nunca en repo.

## Riesgos / pendientes

- Push **sin cifrado de payload** (aes128gcm con p256dh/auth): algunos push services exigen cifrado y responderán 400 (no se marca muerta, solo `fallos++`). Añadir cifrado Web Push sin tocar selección.
- Hora fija 19:00 Bogotá, no configurable por usuario.
- `vivo_en = null` colisiona con «nunca contactado» (también null): se trata null inicial como viva; requiere columna `estado` explícita si se quiere distinguir.
- `horasSueno` queda en «más detalles» — `readiness` lo promedia si está, si no lo ignora (compatibilidad preservada).
- Migración con nombre `NNNN_` — el número lo pone el dueño al revisar.
- No se aplicaron migraciones ni se desplegó función (regla NO NEGOCIABLE); todo probado en local.
