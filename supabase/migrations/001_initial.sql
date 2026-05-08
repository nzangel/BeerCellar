-- ============================================================
-- BeerCellar – Schéma initial
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- pour la recherche fuzzy

-- ============================================================
-- PROFILES (complète auth.users)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  avatar_url  text,
  bio         text,
  created_at  timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Profiles sont publics en lecture"
  on public.profiles for select using (true);

create policy "Utilisateurs gèrent leur propre profil"
  on public.profiles for all using (auth.uid() = id);

-- Créer automatiquement un profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- BEERS (catalogue global)
-- ============================================================
create table public.beers (
  id          uuid primary key default uuid_generate_v4(),
  barcode     text unique,
  name        text not null,
  brewery     text,
  style       text,
  abv         numeric(4,1),
  ibu         integer,
  description text,
  image_url   text,
  country     text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now() not null
);

alter table public.beers enable row level security;

create policy "Bières publiques en lecture"
  on public.beers for select using (true);

create policy "Utilisateurs authentifiés peuvent créer des bières"
  on public.beers for insert with check (auth.uid() = created_by);

create policy "Créateur peut modifier sa bière"
  on public.beers for update using (auth.uid() = created_by);

create index beers_barcode_idx on public.beers(barcode);
create index beers_name_trgm_idx on public.beers using gin(name gin_trgm_ops);

-- ============================================================
-- CELLAR ENTRIES (cave personnelle)
-- ============================================================
create table public.cellar_entries (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  beer_id     uuid not null references public.beers(id) on delete cascade,
  rating      numeric(2,1) check (rating >= 0 and rating <= 5),
  notes       text,
  taste_tags  text[] default '{}',
  photo_url   text,
  quantity    integer default 1 check (quantity >= 0),
  is_favorite boolean default false,
  added_at    timestamptz default now() not null,
  unique(user_id, beer_id)
);

alter table public.cellar_entries enable row level security;

create policy "Utilisateurs voient leur cave"
  on public.cellar_entries for select using (auth.uid() = user_id);

create policy "Utilisateurs gèrent leur cave"
  on public.cellar_entries for all using (auth.uid() = user_id);

create index cellar_entries_user_idx on public.cellar_entries(user_id);

-- ============================================================
-- FRIENDSHIPS
-- ============================================================
create table public.friendships (
  id            uuid primary key default uuid_generate_v4(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  addressee_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at    timestamptz default now() not null,
  unique(requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "Voir ses propres demandes d'amitié"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Envoyer une demande d'amitié"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Répondre à une demande d'amitié"
  on public.friendships for update
  using (auth.uid() = addressee_id or auth.uid() = requester_id);

create policy "Supprimer une amitié"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Policy différée : nécessite que friendships existe
create policy "Amis voient les caves partagées"
  on public.cellar_entries for select using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = user_id))
    )
  );

-- ============================================================
-- TASTING GROUPS
-- ============================================================
create table public.tasting_groups (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  avatar_url  text,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz default now() not null
);

create table public.group_members (
  group_id    uuid not null references public.tasting_groups(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('admin','member')),
  joined_at   timestamptz default now() not null,
  primary key (group_id, user_id)
);

alter table public.tasting_groups enable row level security;
alter table public.group_members enable row level security;

create policy "Groupes visibles par les membres"
  on public.tasting_groups for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = id and gm.user_id = auth.uid()
    )
  );

create policy "Tout utilisateur peut créer un groupe"
  on public.tasting_groups for insert
  with check (auth.uid() = created_by);

create policy "Admin peut modifier le groupe"
  on public.tasting_groups for update
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = id and gm.user_id = auth.uid() and gm.role = 'admin'
    )
  );

create policy "Membres voient la liste des membres"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

create policy "Admin peut gérer les membres"
  on public.group_members for all
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid() and gm.role = 'admin'
    )
  );

create policy "Utilisateur peut se retirer"
  on public.group_members for delete
  using (auth.uid() = user_id);

-- Fonction: créateur devient admin automatiquement
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.tasting_groups
  for each row execute procedure public.handle_new_group();

-- ============================================================
-- GROUP SESSIONS
-- ============================================================
create table public.group_sessions (
  id           uuid primary key default uuid_generate_v4(),
  group_id     uuid not null references public.tasting_groups(id) on delete cascade,
  title        text not null,
  description  text,
  scheduled_at timestamptz,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz default now() not null
);

create table public.session_beers (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references public.group_sessions(id) on delete cascade,
  beer_id     uuid not null references public.beers(id) on delete cascade,
  added_by    uuid not null references public.profiles(id),
  unique(session_id, beer_id)
);

create table public.session_ratings (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references public.group_sessions(id) on delete cascade,
  beer_id     uuid not null references public.beers(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  rating      numeric(2,1) check (rating >= 0 and rating <= 5),
  notes       text,
  taste_tags  text[] default '{}',
  created_at  timestamptz default now() not null,
  unique(session_id, beer_id, user_id)
);

alter table public.group_sessions enable row level security;
alter table public.session_beers enable row level security;
alter table public.session_ratings enable row level security;

create policy "Sessions visibles par les membres du groupe"
  on public.group_sessions for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

create policy "Membres peuvent créer des sessions"
  on public.group_sessions for insert
  with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

create policy "Session beers visibles par membres"
  on public.session_beers for select
  using (
    exists (
      select 1 from public.group_sessions gs
      join public.group_members gm on gm.group_id = gs.group_id
      where gs.id = session_id and gm.user_id = auth.uid()
    )
  );

create policy "Membres ajoutent des bières à la session"
  on public.session_beers for insert
  with check (
    exists (
      select 1 from public.group_sessions gs
      join public.group_members gm on gm.group_id = gs.group_id
      where gs.id = session_id and gm.user_id = auth.uid()
    )
    and auth.uid() = added_by
  );

create policy "Notes de session visibles par membres"
  on public.session_ratings for select
  using (
    exists (
      select 1 from public.group_sessions gs
      join public.group_members gm on gm.group_id = gs.group_id
      where gs.id = session_id and gm.user_id = auth.uid()
    )
  );

create policy "Membres notent les bières"
  on public.session_ratings for all
  using (auth.uid() = user_id);

-- ============================================================
-- Storage buckets
-- ============================================================
-- À créer manuellement dans Supabase > Storage :
-- 1. "beer-photos"  (public)  – photos des bouteilles dans la cave
-- 2. "avatars"      (public)  – photos de profil et de groupe
-- ============================================================
