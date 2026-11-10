-- Sin TRUNCATE para quien tiene sesión, y `aprobaciones` sin escritura desde el navegador (0177).
--
-- Qué se prueba:
--   1. Tras las migraciones, ninguna tabla, vista ni partición de public da TRUNCATE a anon ni a
--      authenticated, y `aprobaciones` no da insert, update, delete ni truncate a ninguno de los dos.
--   2. Una tabla nueva creada por postgres en public no da TRUNCATE (permisos por defecto), pero
--      sí conserva los demás permisos por defecto (solo se quitó TRUNCATE).
--   3. Mutante: se devuelven los privilegios (control positivo: la comprobación los ve) y se vuelve
--      a aplicar la 0177; debe quitarlos otra vez y dejar intacto todo lo que no es TRUNCATE.
-- ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- 1 · Estado tras las migraciones.
select pruebas.afirmar(
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
                 and (has_table_privilege('anon', c.oid, 'truncate')
                      or has_table_privilege('authenticated', c.oid, 'truncate'))),
  'queda alguna tabla de public con TRUNCATE para anon o authenticated');

select pruebas.afirmar(
  not has_table_privilege('authenticated', 'public.aprobaciones', 'insert')
  and not has_table_privilege('authenticated', 'public.aprobaciones', 'update')
  and not has_table_privilege('authenticated', 'public.aprobaciones', 'delete')
  and not has_table_privilege('authenticated', 'public.aprobaciones', 'truncate')
  and not has_table_privilege('anon', 'public.aprobaciones', 'insert')
  and not has_table_privilege('anon', 'public.aprobaciones', 'update')
  and not has_table_privilege('anon', 'public.aprobaciones', 'delete')
  and not has_table_privilege('anon', 'public.aprobaciones', 'truncate'),
  'aprobaciones sigue dando escritura a anon o authenticated');

-- 2 · Tabla nueva: sin TRUNCATE, con lo demás que dan los permisos por defecto.
create table public.prueba_0177_nueva (id int);
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.prueba_0177_nueva', 'truncate')
  and not has_table_privilege('authenticated', 'public.prueba_0177_nueva', 'truncate'),
  'una tabla nueva de postgres en public vuelve a dar TRUNCATE por defecto');
select pruebas.afirmar(
  has_table_privilege('authenticated', 'public.prueba_0177_nueva', 'select')
  and has_table_privilege('authenticated', 'public.prueba_0177_nueva', 'insert'),
  'la tabla nueva perdió también los demás permisos por defecto (solo debía perder TRUNCATE)');

-- 3 · Mutante: se devuelven los privilegios y se reaplica la 0177.
grant truncate on public.prueba_0177_nueva to anon, authenticated;
grant insert, update, delete, truncate on public.aprobaciones to anon, authenticated;
alter default privileges for role postgres in schema public grant truncate on tables to anon, authenticated;

-- Control positivo: la misma comprobación de (1) tiene que ver el TRUNCATE devuelto.
select pruebas.afirmar(
  exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
             and (has_table_privilege('anon', c.oid, 'truncate')
                  or has_table_privilege('authenticated', c.oid, 'truncate'))),
  'CONTROL: la comprobación no ve un TRUNCATE devuelto a propósito (el medidor está ciego)');
select pruebas.afirmar(has_table_privilege('authenticated', 'public.aprobaciones', 'insert'),
  'CONTROL: el insert devuelto a propósito en aprobaciones no se ve');

-- Huella de todo lo que NO es TRUNCATE, antes de reaplicar.
create temp table antes_0177 as
  select c.oid::regclass::text as tabla, r.rol, p.priv,
         has_table_privilege(r.rol, c.oid, p.priv) as tiene
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated'), ('service_role')) r(rol)
    cross join (values ('select'), ('insert'), ('update'), ('delete'), ('references'), ('trigger')) p(priv)
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and c.relname <> 'aprobaciones';

\ir ../migrations/0177_sin_truncate_ni_escritura_vieja.sql

select pruebas.afirmar(
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
                 and (has_table_privilege('anon', c.oid, 'truncate')
                      or has_table_privilege('authenticated', c.oid, 'truncate'))),
  'reaplicar la 0177 no quitó el TRUNCATE devuelto');
select pruebas.afirmar(
  not exists (select 1 from (values ('anon'), ('authenticated')) r(rol),
                            (values ('insert'), ('update'), ('delete'), ('truncate')) p(priv)
               where has_table_privilege(r.rol, 'public.aprobaciones', p.priv)),
  'reaplicar la 0177 no quitó la escritura devuelta en aprobaciones (anon o authenticated)');

create table public.prueba_0177_otra (id int);
select pruebas.afirmar(
  not has_table_privilege('authenticated', 'public.prueba_0177_otra', 'truncate'),
  'reaplicar la 0177 no quitó el TRUNCATE de los permisos por defecto');

select pruebas.afirmar(
  not exists (select 1 from antes_0177 a
               where a.tiene is distinct from has_table_privilege(a.rol, a.tabla::regclass, a.priv)),
  'la 0177 cambió un privilegio que no es TRUNCATE (solo debía tocar TRUNCATE y aprobaciones)');

rollback;

\echo 'OK 273: sin TRUNCATE para quien tiene sesión y aprobaciones sin escritura desde el navegador'
