insert into storage.buckets (id, name, public) values ('email-assets', 'email-assets', true) on conflict (id) do update set public = true;
create policy "Public read email-assets" on storage.objects for select using (bucket_id = 'email-assets');
create policy "Service write email-assets" on storage.objects for insert with check (bucket_id = 'email-assets');