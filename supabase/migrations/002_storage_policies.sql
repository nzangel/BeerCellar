-- ============================================================
-- Storage policies
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- beer-photos : upload par les utilisateurs authentifiés
create policy "Authenticated users can upload beer photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'beer-photos');

create policy "Authenticated users can update beer photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'beer-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Authenticated users can delete their beer photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'beer-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public can read beer photos"
  on storage.objects for select
  to public
  using (bucket_id = 'beer-photos');

-- avatars : upload par les utilisateurs authentifiés
create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

create policy "Authenticated users can update avatars"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public can read avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');
