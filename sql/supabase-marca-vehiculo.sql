-- Ejecutar en Supabase → SQL Editor → New query → Run (después de supabase.sql y supabase-roles.sql).
alter table products add column if not exists brand text not null default '';
alter table products add column if not exists vehicle text not null default '';
create index if not exists products_brand_idx on products (brand);
