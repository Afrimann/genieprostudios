-- 0008_portfolio_entries.sql
-- Public exhibition/portfolio gallery entries. Videos are linked (YouTube/
-- Instagram), not re-hosted — video_id_or_url stores the reference for a
-- lazy-loaded embed facade on the frontend.

create type public.portfolio_platform as enum ('youtube', 'instagram');

create table if not exists public.portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  platform public.portfolio_platform not null,
  video_id_or_url text not null,
  thumbnail_url text,
  display_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.portfolio_entries is
  'Publicly viewable exhibition of producer/videographer work. Stores a '
  'YouTube/Instagram video id or URL only (no raw video files in the DB); '
  'frontend renders a lazy-loaded embed facade using thumbnail_url until '
  'interacted with.';

alter table public.portfolio_entries enable row level security;

create index if not exists portfolio_entries_published_order_idx
  on public.portfolio_entries (published, display_order);
