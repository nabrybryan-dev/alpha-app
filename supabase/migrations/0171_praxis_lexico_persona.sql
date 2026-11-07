-- ============================================================================
-- 0171 · Praxis: cómo dice las cosas cada persona (lexicón por persona)
-- ============================================================================
--
-- APLICADA en la base real el 7-nov-2026 con el sí de Bryan (apply_migration), tras pasar la prueba 266 en el CI del PR #446.
-- Señales tras aplicar: RLS, una política (lee el dueño), sin escritura directa, funciones definer, anon nada, 0 filas.
-- Escrita el 7-nov-2026 (paso 5 del diseño docs/specs/2026-11-07-conectores-lenguaje-a-checkin-diseno.md).
-- Aplicarla es decisión de Bryan. La prueba `supabase/test/266-praxis-lexico-persona.sql` corre en el CI. Nada la llama
-- todavía (la tarjeta del check-in está detrás de `CONECTORES_EN_TARJETA`, apagada).
--
-- NÚMERO. 0171 = el siguiente libre. Revisadas el 7-nov, justo antes de escribirla, las migraciones de todas las ramas
-- remotas: `app/cadena-agentes` tiene 0168 y 0169; `praxis/conectores-checkin` (esta rama) tiene 0170; ninguna 0171.
--
-- QUÉ GUARDA Y QUÉ NO (lo mínimo).
--   · Por persona: el CAMPO del check-in (6 de tres niveles), la EXPRESIÓN VAGA normalizada («como medio», «no tan
--     bien»; nunca la frase entera), el VALOR que eligió y cuántas veces seguidas lo eligió igual.
--   · Nada de salud: hambre, dolor y horas no aprenden. Nada de texto libre: la forma va en minúsculas sin tildes, de
--     1 a 40 caracteres y hasta 5 palabras. Tope de 200 formas por persona.
--   · NO entra al entrenamiento del modelo propio ni a la destilación: es dato de la persona, no un corpus.
--
-- REGLA. Elegir el mismo valor otra vez suma 1; uno distinto vuelve la cuenta a 1 con el valor nuevo. Con 3 iguales
-- seguidas la tarjeta llega con ese valor marcado («como lo dices tú»); la persona sigue confirmando (dominio:
-- `src/domain/praxis/registro/lexicoPersona.ts`, mismas reglas).
--
-- QUIÉN PUEDE QUÉ.
--   · LEER: solo la persona dueña (`usuario_id = auth.uid()`). El equipo NO lo lee (a diferencia del libro): no lo
--     necesita para nada y así no se repite el riesgo de la 0166 (todo el equipo leyendo lo de cualquiera).
--   · ESCRIBIR: nadie directo. Solo `praxis_aprender_forma` (security definer, `auth.uid()`, sin `usuario_id`).
--   · BORRAR: la persona, todo lo suyo, con `praxis_olvidar_mis_formas()` (derecho a supresión, Ley 1581). Al borrar
--     la cuenta se va solo (`on delete cascade`).
--   · anon: nada.
--
-- CÓMO REVERTIRLA:
--   begin;
--   drop function if exists public.praxis_olvidar_mis_formas();
--   drop function if exists public.praxis_aprender_forma(text, text, text);
--   drop table if exists public.praxis_lexico_persona;
--   commit;
--   (Se pierde lo aprendido; ningún otro dato depende de esto.)
-- ============================================================================

begin;

create table if not exists public.praxis_lexico_persona (
  usuario_id      uuid not null references public.usuarios_app (id) on delete cascade,
  campo           text not null check (campo in ('rendimiento', 'motivacion', 'cansancio', 'estres', 'calidadSueno', 'alimentacion')),
  forma           text not null check (forma ~ '^[a-z0-9]+( [a-z0-9]+){0,4}$' and length(forma) between 1 and 40),
  valor           text not null check (valor in ('MALA', 'REGULAR', 'BUENA', 'POCO', 'MUCHO')),
  confirmaciones  int  not null default 1 check (confirmaciones between 1 and 1000),
  actualizado_en  timestamptz not null default now(),
  primary key (usuario_id, campo, forma),
  -- El valor debe ser de la escala de su campo.
  constraint praxis_lexico_persona_valor_de_su_escala check (
    (campo in ('rendimiento', 'calidadSueno', 'alimentacion') and valor in ('MALA', 'REGULAR', 'BUENA'))
    or (campo in ('motivacion', 'cansancio', 'estres') and valor in ('POCO', 'REGULAR', 'MUCHO'))
  )
);

comment on table public.praxis_lexico_persona is
  'Como dice las cosas cada persona (0171, 2026-11-07): campo, expresion vaga normalizada, valor elegido y veces seguidas. '
  'Solo la lee la persona; solo la escribe praxis_aprender_forma; la persona la borra con praxis_olvidar_mis_formas. No entra al entrenamiento.';

alter table public.praxis_lexico_persona enable row level security;

drop policy if exists praxis_lexico_persona_leer_propio on public.praxis_lexico_persona;
create policy praxis_lexico_persona_leer_propio on public.praxis_lexico_persona
  for select to authenticated
  using (usuario_id = (select auth.uid()));

revoke all on public.praxis_lexico_persona from anon, public;
revoke all on public.praxis_lexico_persona from authenticated;
grant select on public.praxis_lexico_persona to authenticated;
grant all on public.praxis_lexico_persona to service_role;

-- ---------------------------------------------------------------------------
-- Aprender una elección
-- ---------------------------------------------------------------------------
create or replace function public.praxis_aprender_forma(p_campo text, p_forma text, p_valor text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_forma text := btrim(p_forma);
  v_fila  public.praxis_lexico_persona;
begin
  if v_uid is null then
    raise exception 'praxis_aprender_forma: hace falta una sesion' using errcode = '42501';
  end if;
  if p_campo is null or p_campo not in ('rendimiento', 'motivacion', 'cansancio', 'estres', 'calidadSueno', 'alimentacion') then
    raise exception 'praxis_aprender_forma: ese campo no aprende' using errcode = '22023';
  end if;
  if v_forma is null or v_forma !~ '^[a-z0-9]+( [a-z0-9]+){0,4}$' or length(v_forma) > 40 then
    raise exception 'praxis_aprender_forma: la forma debe ser una expresion corta normalizada' using errcode = '22023';
  end if;
  if not ((p_campo in ('rendimiento', 'calidadSueno', 'alimentacion') and p_valor in ('MALA', 'REGULAR', 'BUENA'))
       or (p_campo in ('motivacion', 'cansancio', 'estres') and p_valor in ('POCO', 'REGULAR', 'MUCHO'))) then
    raise exception 'praxis_aprender_forma: ese valor no es de la escala del campo' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('lex-' || v_uid::text));

  if not exists (select 1 from public.praxis_lexico_persona l where l.usuario_id = v_uid and l.campo = p_campo and l.forma = v_forma)
     and (select count(*) from public.praxis_lexico_persona l where l.usuario_id = v_uid) >= 200 then
    raise exception 'praxis_aprender_forma: tope de 200 formas por persona' using errcode = '22023';
  end if;

  insert into public.praxis_lexico_persona as l (usuario_id, campo, forma, valor, confirmaciones)
  values (v_uid, p_campo, v_forma, p_valor, 1)
  on conflict (usuario_id, campo, forma) do update
    set confirmaciones = case when l.valor = excluded.valor then least(l.confirmaciones + 1, 1000) else 1 end,
        valor          = excluded.valor,
        actualizado_en = now()
  returning * into v_fila;

  return jsonb_build_object('campo', v_fila.campo, 'forma', v_fila.forma, 'valor', v_fila.valor, 'confirmaciones', v_fila.confirmaciones);
end
$$;

comment on function public.praxis_aprender_forma(text, text, text) is
  'Anota que quien llama eligio este valor para esta expresion vaga en este campo: igual suma 1, distinto vuelve a 1. auth.uid(); sin usuario_id. 0171.';

revoke execute on function public.praxis_aprender_forma(text, text, text) from public, anon;
grant execute on function public.praxis_aprender_forma(text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Olvidar todo lo aprendido de quien llama
-- ---------------------------------------------------------------------------
create or replace function public.praxis_olvidar_mis_formas()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_n   int;
begin
  if v_uid is null then
    raise exception 'praxis_olvidar_mis_formas: hace falta una sesion' using errcode = '42501';
  end if;
  delete from public.praxis_lexico_persona where usuario_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

comment on function public.praxis_olvidar_mis_formas() is
  'Borra todo el lexicon de quien llama (derecho a supresion). Devuelve cuantas formas borro. 0171.';

revoke execute on function public.praxis_olvidar_mis_formas() from public, anon;
grant execute on function public.praxis_olvidar_mis_formas() to authenticated, service_role;

commit;
