-- Ejecutar en Supabase → SQL Editor → New query → Run (después de los demás archivos .sql).
-- Separa los productos en dos listas: equipamiento y accesorios.
-- Los productos que ya existían quedan en "equipamiento".
alter table products add column if not exists category text not null default 'equipamiento';
alter table products drop constraint if exists products_category_check;
alter table products add constraint products_category_check check (category in ('equipamiento','accesorios'));
create index if not exists products_category_idx on products (category);
