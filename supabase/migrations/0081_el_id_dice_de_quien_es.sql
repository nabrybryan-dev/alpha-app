-- 0081 · El id de un microciclo nuevo dice de quién es: `m-<slug>-<numero>`
--
-- Pegar en: Supabase → SQL Editor → New query → Run. **Después** de desplegar la app
-- que ya construye los ids con la regla (ver «ORDEN DE DESPLIEGUE» abajo).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ DECIDIÓ BRYAN (2026-09-15): «regla nueva + orden por fecha»
-- ─────────────────────────────────────────────────────────────────────────────
--   1. No se renombra ningún microciclo que ya exista.
--   2. Los ids nuevos siguen una regla fija, `m-<slug>-<numero>`. La misma persona
--      tiene siempre el mismo prefijo, dos personas nunca comparten prefijo, y un id que
--      incumpla la regla PARA LA CARGA con un error visible.
--   3. «El microciclo anterior» se elige por fecha de inicio (eso va en la app).
--
-- Medido ese día, antes de escribir esto: 170 ids de 27 personas, 15 con `-prop` (dos con
-- doble `-prop`), 2 prefijos compartidos por tres personas cada uno (`m-juan-*`,
-- `m-laura-*`), 8 personas con más de un prefijo, y 6 activos con una letra perdida porque
-- el slug se derivaba del alias en cada carga. El slug derivado en cada sitio es la causa:
-- por eso aquí se GUARDA, uno por persona, y nadie lo vuelve a derivar.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ HACE
-- ─────────────────────────────────────────────────────────────────────────────
--   §1  `slug_de_nombre()` y `slugs_en_conflicto()`.
--   §2  `usuarios_app.slug`, rellenado desde el nombre. **Si hay conflictos, ABORTA
--       listándolos**: no inventa sufijos. Un sufijo inventado es un prefijo que nadie
--       eligió y que se queda para siempre.
--   §3  Forma y unicidad del slug; altas nuevas con slug; el slug no se cambia desde la
--       app ni se le parte el prefijo a quien ya tiene microciclos con él.
--   §4  El guardián de `microciclos`: un trigger **BEFORE INSERT**.
--   §5  Se comprueba aquí dentro.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ UN TRIGGER BEFORE INSERT Y NO UN `CHECK … NOT VALID`
-- ─────────────────────────────────────────────────────────────────────────────
-- `NOT VALID` solo se salta la validación de las filas que ya están. Cada UPDATE vuelve a
-- comprobar la fila entera, y `fijar_series_ejercicio` (0037) actualiza la fila entera:
-- registrar una serie en cualquiera de los 170 microciclos con id viejo sería rechazado.
-- Un trigger que solo corre en INSERT no ve los UPDATE del registro.
--
-- Y un INSERT que en realidad es un upsert de una fila que YA existe (`subirMicrociclo`
-- de la app es `upsert` por id) tampoco es un microciclo nuevo: se deja pasar. Los BEFORE
-- INSERT se disparan también en `INSERT … ON CONFLICT`, antes de mirar el conflicto, así
-- que sin esa salida la app no podría volver a subir un microciclo viejo.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ORDEN DE DESPLIEGUE — NO NEGOCIABLE
-- ─────────────────────────────────────────────────────────────────────────────
--   1. Fusionar la app que construye `m-<slug>-<numero>` (y que sin slug conserva el id
--      de siempre, para funcionar ANTES de esta migración).
--   2. Esperar el despliegue y comprobar la `version` en `errores_navegador`.
--   3. Aplicar esta migración.
--   4. Correr `supabase/comprobar-migraciones.sql`: las tres señales de la 0081 en SI.
--
-- Al revés, un teléfono de coach con la app vieja manda un `-prop`, el trigger lo
-- rechaza, la cola lo reintenta y lo aparta a `alpha-cola-descartes`: la propuesta se
-- pierde y en pantalla no se ve nada.
--
-- Y OJO CON LAS CARGAS DE FUERA DE LA APP: el cerebro (`ejecucion_determinista.py`,
-- `tuberia/cargar.py`, los `carga-*.sql` escritos a mano) fabrica sus propios ids. Desde
-- esta migración, uno que no sea `m-<usuarios_app.slug>-<numero>` aborta la carga. Es lo
-- que se pidió; conviene que el cerebro lea el slug de la base ANTES de la carga del
-- domingo siguiente.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SI ABORTA EN §2
-- ─────────────────────────────────────────────────────────────────────────────
-- El mensaje lista cada conflicto. Se resuelve eligiendo el slug a mano, en el SQL
-- Editor, ANTES de volver a pegar esta migración (la columna se crea con `if not exists`
-- y el relleno respeta lo que ya haya):
--
--   alter table public.usuarios_app add column if not exists slug text;
--   update public.usuarios_app set slug = '<nombre-apellido>' where id = '<uuid>';
--
-- Minúsculas, números y guiones; que no sea prefijo con guion del de otra persona ni al
-- revés (`laura` y `laura-giraldo` no pueden convivir: `like 'm-laura-%'` alcanza a las
-- dos). Medido el 2026-09-15: 0 slugs repetidos, 0 personas sin nombre, y **1 conflicto
-- de prefijo**, entre la cuenta del coach y una cuenta de prueba.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- §1 · Cómo sale un slug, y qué lo hace imposible
-- ─────────────────────────────────────────────────────────────────────────────

-- Tildes fuera ANTES de la expresión regular. En el orden contrario —el del cerebro hasta
-- el 2026-09-15— la regex convierte cada letra acentuada en un guion y el paso de las
-- tildes ya no encuentra nada que cambiar: «Andrés» sale `andr-s`.
create or replace function public.slug_de_nombre(p_nombre text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    trim(both '-' from regexp_replace(lower(public.sin_tildes(coalesce(p_nombre, ''))), '[^a-z0-9]+', '-', 'g')),
    ''
  )
$$;

alter table public.usuarios_app add column if not exists slug text;

-- Cada fila es un conflicto que impide dar slug a una persona. Mira el slug guardado y, si
-- no lo hay, el que saldría de su nombre: así sirve para el relleno y para después.
create or replace function public.slugs_en_conflicto()
returns table (usuario_id uuid, nombre text, slug text, motivo text, choca_con text)
language sql
stable
set search_path = public
as $$
  with c as (
    select u.id, u.nombre, coalesce(u.slug, public.slug_de_nombre(u.nombre)) as slug
      from public.usuarios_app u
  )
  select c.id, c.nombre, c.slug, 'sin slug posible: el nombre no deja letras ni números', null::text
    from c where c.slug is null
  union all
  select a.id, a.nombre, a.slug, 'repetido', b.nombre
    from c a join c b on a.id <> b.id and a.slug = b.slug
  union all
  select a.id, a.nombre, a.slug, 'prefijo: m-' || a.slug || '-% alcanzaría también los de ' || b.slug, b.nombre
    from c a join c b on a.id <> b.id and b.slug like a.slug || '-%'
$$;

-- Con quién choca un slug concreto, o null si con nadie. Lo usan los triggers de §3.
create or replace function public.slug_choca_con(p_slug text, p_usuario uuid)
returns text
language sql
stable
set search_path = public
as $$
  select u.slug
    from public.usuarios_app u
   where u.id <> p_usuario
     and u.slug is not null
     and (u.slug = p_slug or u.slug like p_slug || '-%' or p_slug like u.slug || '-%')
   limit 1
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §2 · El relleno: todos o nadie
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_n     int;
  v_lista text;
begin
  select count(*),
         string_agg(format('%s (%s): %s%s', c.nombre, coalesce(c.slug, '—'), c.motivo,
                           coalesce(' · con ' || c.choca_con, '')),
                    E'\n  · ' order by c.motivo, c.nombre)
    into v_n, v_lista
    from public.slugs_en_conflicto() c;

  if v_n > 0 then
    raise exception using
      message = format('0081 ABORTA · %s conflicto(s) de slug. No se inventan sufijos: '
                       'elige el slug de cada persona a mano y vuelve a pegar la migración.', v_n),
      detail  = '  · ' || v_lista,
      hint    = 'alter table public.usuarios_app add column if not exists slug text; '
                'update public.usuarios_app set slug = ''<nombre-apellido>'' where id = ''<uuid>'';';
  end if;

  update public.usuarios_app
     set slug = public.slug_de_nombre(nombre)
   where slug is null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §3 · El slug: forma, unicidad, altas y cambios
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.usuarios_app drop constraint if exists usuarios_app_slug_forma;
alter table public.usuarios_app
  add constraint usuarios_app_slug_forma check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.usuarios_app drop constraint if exists usuarios_app_slug_unico;
alter table public.usuarios_app add constraint usuarios_app_slug_unico unique (slug);

-- LAS ALTAS. `crear_usuario_app` (0001) mete la fila con el nombre de los metadatos o la
-- parte local del correo. Aquí se le da slug si sale limpio. Si no sale —nombre vacío o
-- choque con otra persona— la fila entra SIN slug y la alta no se bloquea: bloquearla
-- dejaría a alguien sin poder entrar por un detalle de nombres. Esa persona no puede
-- recibir microciclos hasta que se le ponga uno a mano (el trigger de §4 lo dice), y la
-- señal de `comprobar-migraciones.sql` la cuenta.
create or replace function public.poner_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  if new.slug is not null then
    if public.slug_choca_con(new.slug, new.id) is not null then
      raise exception using errcode = '23505',
        message = format('0081 · el slug %s choca con el de otra persona (%s).',
                         new.slug, public.slug_choca_con(new.slug, new.id));
    end if;
    return new;
  end if;

  v_slug := public.slug_de_nombre(new.nombre);
  if v_slug is not null and public.slug_choca_con(v_slug, new.id) is null then
    new.slug := v_slug;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_poner_slug on public.usuarios_app;
create trigger trg_poner_slug
  before insert on public.usuarios_app
  for each row execute function public.poner_slug();

-- LOS CAMBIOS. `usuarios_editar_propio` deja a cada persona actualizar su fila, así que
-- sin esto cualquiera podría quedarse con un prefijo ajeno o cambiarse el suyo. Tres
-- reglas, en este orden:
--   · desde la app (hay `auth.uid()`), nunca — tampoco el coach;
--   · a nadie se le quita;
--   · a quien ya tiene microciclos con su prefijo no se le cambia: se le partiría.
-- Desde el SQL Editor sí se puede poner o corregir el de quien aún no tiene ninguno.
create or replace function public.proteger_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_choca text;
begin
  if new.slug is not distinct from old.slug then
    return new;
  end if;

  if auth.uid() is not null then
    raise exception using errcode = '42501',
      message = '0081 · el slug de una persona no se cambia desde la app.';
  end if;

  if new.slug is null then
    raise exception '0081 · no se le quita el slug a una persona: sus microciclos nuevos no podrían crearse.';
  end if;

  if old.slug is not null and exists (
       select 1 from public.microciclos m
        where m.usuario_id = old.id and m.id = 'm-' || old.slug || '-' || m.numero) then
    raise exception '0081 · % ya tiene microciclos con el prefijo m-%-: cambiarle el slug le partiría el prefijo.',
      old.nombre, old.slug;
  end if;

  v_choca := public.slug_choca_con(new.slug, new.id);
  if v_choca is not null then
    raise exception using errcode = '23505',
      message = format('0081 · el slug %s choca con el de otra persona (%s).', new.slug, v_choca);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_slug on public.usuarios_app;
create trigger trg_proteger_slug
  before update on public.usuarios_app
  for each row execute function public.proteger_slug();

-- ─────────────────────────────────────────────────────────────────────────────
-- §4 · El guardián de `microciclos`: solo BEFORE INSERT
-- ─────────────────────────────────────────────────────────────────────────────
-- `security definer` para ver la fila existente y el slug aunque la RLS de quien escribe
-- no los enseñe. No escribe nada: solo mira y, si hace falta, para.
create or replace function public.exigir_id_de_la_regla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existente public.microciclos%rowtype;
  v_slug      text;
  v_esperado  text;
begin
  select * into v_existente from public.microciclos m where m.id = new.id;

  if found then
    -- Un upsert sobre una fila que ya está no crea un microciclo: los 170 ids viejos
    -- tienen que poder volver a subirse. Pero hay dos escrituras encima que nunca son
    -- legítimas, y sin este trigger pasarían en silencio:
    if v_existente.usuario_id is distinct from new.usuario_id then
      raise exception using errcode = '23514',
        message = format('0081 · el microciclo %s ya existe y es de otra persona: no se escribe encima.', new.id);
    end if;
    -- La numeración se reinicia al cambiar de bloque: el M9 del bloque nuevo tiene el
    -- mismo id que el M9 del viejo. Una PROPUESTA con ese id escribiría encima de una
    -- semana ya entrenada. El teléfono del coach no siempre lo ve venir: el staff no se
    -- baja los cerrados de la cartera.
    if new.estado = 'propuesto' and v_existente.estado <> 'propuesto' then
      raise exception using errcode = '23514',
        message = format('0081 · la propuesta %s no se guarda: ya existe un microciclo %s con ese id (M%s).',
                         new.id, v_existente.estado, v_existente.numero),
        hint = 'La numeración de esta persona se reinició. Decide el número antes de generar.';
    end if;
    return new;
  end if;

  select u.slug into v_slug from public.usuarios_app u where u.id = new.usuario_id;
  if v_slug is null then
    raise exception using errcode = '23514',
      message = format('0081 · el microciclo %s no se crea: la persona %s no tiene slug.', new.id, new.usuario_id),
      hint = 'Ponle uno en el SQL Editor: update public.usuarios_app set slug = ''<nombre-apellido>'' where id = ''<uuid>'';';
  end if;

  v_esperado := 'm-' || v_slug || '-' || new.numero;
  if new.id is distinct from v_esperado then
    raise exception using errcode = '23514',
      message = format('0081 · id de microciclo rechazado: llegó «%s» y la regla pide «%s» (m-<slug>-<numero>).',
                       new.id, v_esperado),
      hint = 'El slug se lee de usuarios_app.slug; no se deriva del nombre.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_id_de_la_regla on public.microciclos;
create trigger trg_id_de_la_regla
  before insert on public.microciclos
  for each row execute function public.exigir_id_de_la_regla();

-- Ninguna es una RPC. `create function` concede EXECUTE a PUBLIC, y Supabase además a
-- `anon` y `authenticated` por privilegios por defecto: se quitan los tres.
-- `slugs_en_conflicto` devuelve nombres de personas.
revoke execute on function public.slug_de_nombre(text)       from public, anon, authenticated;
revoke execute on function public.slugs_en_conflicto()        from public, anon, authenticated;
revoke execute on function public.slug_choca_con(text, uuid)  from public, anon, authenticated;
revoke execute on function public.poner_slug()                from public, anon, authenticated;
revoke execute on function public.proteger_slug()             from public, anon, authenticated;
revoke execute on function public.exigir_id_de_la_regla()     from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- §5 · No se da por buena: se comprueba aquí dentro
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_sin_slug    int;
  v_conflictos  int;
  v_trigger     int;
begin
  select count(*) into v_sin_slug from public.usuarios_app where slug is null;
  select count(*) into v_conflictos from public.slugs_en_conflicto();
  -- tgtype: 2 = BEFORE, 4 = INSERT, 16 = UPDATE. Tiene que ser BEFORE INSERT y NO UPDATE.
  select count(*) into v_trigger
    from pg_trigger t
   where t.tgrelid = 'public.microciclos'::regclass
     and t.tgname = 'trg_id_de_la_regla'
     and (t.tgtype & 2) = 2 and (t.tgtype & 4) = 4 and (t.tgtype & 16) = 0;

  if v_sin_slug > 0 or v_conflictos > 0 or v_trigger <> 1 then
    raise exception '0081 ABORTA · sin slug: %, conflictos: %, trigger BEFORE INSERT: %',
      v_sin_slug, v_conflictos, v_trigger;
  end if;
end $$;

commit;
