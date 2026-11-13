-- ============================================================================
-- 0180 · Praxis: la cola de huecos (preguntas que no tuvieron pieza aprobada)
-- ============================================================================
--
-- APLICADA en la base real (proyecto sbzmbiwrnvegrticatza) el 12-nov-2026 por orden escrita de Bryan, con el mismo cuerpo
-- de esta migración. Escrita en la rama praxis/huecos-sin-ficha-apagado (PR borrador sobre #480). Verificado tras aplicar:
-- 7 columnas sin persona, RLS activa, anon sin permisos, authenticated solo SELECT, service_role todo, 0 filas.
-- Nada la llama hoy: la Edge Function `praxis-charla` solo escribe aquí si PRAXIS_HUECOS_ENCOLAR=1 (apagada por defecto)
-- y la función está sin desplegar.
--
-- NÚMERO. 0180: la base (list_migrations, 12-nov) llega a 0179 (praxis_organizacion); en las ramas de origin, 0178 es
-- creadores_desde_landing y 0179 es praxis_organizacion (#482 y su rama hermana). 0180 era el siguiente libre mirando ramas Y base.
-- Comprobado antes de aplicar (12-nov): 0180 libre en origin/* y en schema_migrations.
--
-- QUÉ GUARDA. Una fila por TEMA: `tema_clave` es la agrupación gruesa de `normalizarHueco` (palabras del vocabulario
-- permitido, sin repetir, ordenadas). `frase_limpia` es UNA frase de ejemplo (la primera que llegó), ya pasada por el
-- limpiador y por el vocabulario permitido, de 300 caracteres como máximo. `conteo` sube cada vez que otra persona
-- pregunta lo mismo. Sirve para decidir qué ficha escribir primero (diseño 11-nov, sección «praxis_huecos»).
--
-- QUÉ NO GUARDA, A PROPÓSITO. NO hay columna de persona: ni user_id, ni correo, ni nombre, ni sesión, ni hora por persona.
-- Con esta tabla no se puede saber quién preguntó qué; solo cuántas veces se preguntó un tema.
--
-- QUIÉN PUEDE QUÉ (mismo patrón que 0155 praxis_conceptos).
--   · LEE solo el equipo (`es_staff()`).
--   · ESCRIBE solo service_role (la Edge Function). Nadie la escribe desde una sesión.
--   · anon: nada. authenticated: solo SELECT, y por la política solo el equipo.
-- ============================================================================

begin;

create table if not exists public.praxis_huecos (
  id           uuid primary key default gen_random_uuid(),
  tema_clave   text not null check (length(btrim(tema_clave)) > 0 and length(tema_clave) <= 300),
  frase_limpia text not null check (length(frase_limpia) <= 300),
  conteo       integer not null default 1 check (conteo >= 1),
  primera_vez  timestamptz not null default now(),
  ultima_vez   timestamptz not null default now(),
  estado       text not null default 'nuevo'
               check (estado in ('nuevo', 'agrupado', 'en_investigacion', 'ficha_creada', 'descartado', 'a_firma_salud')),
  constraint praxis_huecos_tema_unico unique (tema_clave)
);

comment on table public.praxis_huecos is
  'Cola de huecos de Praxis (0180, 12-nov-2026): temas que se preguntaron y no tuvieron pieza aprobada. Una fila por tema, con una frase '
  'de ejemplo YA LIMPIA y un conteo. Sin columna de persona. Solo el equipo lee; solo service_role escribe.';

alter table public.praxis_huecos enable row level security;

drop policy if exists praxis_huecos_leer on public.praxis_huecos;
create policy praxis_huecos_leer on public.praxis_huecos
  for select to authenticated
  using ((select public.es_staff()));

revoke all on public.praxis_huecos from anon, public;
revoke all on public.praxis_huecos from authenticated;
grant select on public.praxis_huecos to authenticated;
grant all on public.praxis_huecos to service_role;

commit;
