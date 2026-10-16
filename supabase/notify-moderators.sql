-- =====================================================================
-- Email every moderator (via Brevo) when a new listing needs review.
-- 1. Run this whole file once in Supabase → SQL Editor.
-- 2. Then store your Brevo API key (separate query, see the bottom).
-- Safe to run more than once. A failed email never blocks a submission.
-- =====================================================================

create extension if not exists pg_net;

create table if not exists public.notify_settings (
  id           int primary key default 1 check (id = 1),
  enabled      boolean not null default true,
  sender_email text not null default 'noreply@findmypetcy.com',
  sender_name  text not null default 'Find My Pet Cyprus',
  site_url     text not null default 'https://www.findmypetcy.com'
);
insert into public.notify_settings (id) values (1) on conflict (id) do nothing;
alter table public.notify_settings enable row level security;   -- no public access

create or replace function public.notify_moderators_new_listing()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  s        record;
  api_key  text;
  recips   jsonb;
  waiting  int;
  kind     text;
  title    text;
  subj     text;
  photo    text;
  html     text;
begin
  select * into s from public.notify_settings where id = 1;
  if not found or not s.enabled then return new; end if;

  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'brevo_api_key' limit 1;
  if api_key is null or api_key = '' then return new; end if;

  select coalesce(jsonb_agg(jsonb_build_object('email', u.email)), '[]'::jsonb) into recips
  from public.moderators m join auth.users u on u.id = m.user_id
  where coalesce(u.email, '') <> '';
  if jsonb_array_length(recips) = 0 then return new; end if;

  select count(*) into waiting from public.listings where moderation_status = 'pending';

  kind  := lower(coalesce(nullif(new.exotic_type, ''), new.species));
  title := coalesce(nullif(new.name, ''), coalesce(nullif(new.color, ''), array_to_string(new.colours, ' & ')) || ' ' || kind);
  subj  := left(regexp_replace(title, '[\r\n]+', ' ', 'g'), 80);
  title := replace(replace(replace(title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  photo := new.photos[1];

  html := '<div style="font-family:Arial,sans-serif;max-width:520px;color:#201e1d">'
       || '<h2 style="margin:0 0 6px">New ' || new.status || ' ' || kind || ' to review</h2>'
       || '<p style="margin:0 0 14px;font-size:16px"><b>' || title || '</b> · '
       || replace(replace(new.district || ' — ' || new.area, '<', '&lt;'), '>', '&gt;') || '</p>'
       || case when photo is not null then '<img src="' || replace(photo, '"', '') || '" alt="" style="width:100%;max-width:520px;border-radius:12px;margin-bottom:14px">' else '<p style="color:#a8361f">No photo attached.</p>' end
       || '<p style="font-size:14px">' || waiting || ' listing' || case when waiting = 1 then ' is' else 's are' end || ' waiting for review.</p>'
       || '<p><a href="' || s.site_url || '/moderation.html" style="display:inline-block;background:#c67139;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Open the moderation queue</a></p>'
       || '<p style="font-size:12px;color:#777">You get this because you are a moderator on Find My Pet Cyprus.</p></div>';

  perform net.http_post(
    url     := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', api_key, 'Content-Type', 'application/json', 'accept', 'application/json'),
    body    := jsonb_build_object(
                 'sender', jsonb_build_object('name', s.sender_name, 'email', s.sender_email),
                 'to', recips,
                 'subject', 'New listing to review: ' || subj || ' (' || waiting || ' waiting)',
                 'htmlContent', html)
  );
  return new;
exception when others then
  return new;   -- never let a notification problem stop someone reporting a pet
end $$;

drop trigger if exists notify_moderators_new_listing on public.listings;
create trigger notify_moderators_new_listing
  after insert on public.listings
  for each row when (new.moderation_status = 'pending')
  execute function public.notify_moderators_new_listing();

revoke execute on function public.notify_moderators_new_listing() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- STEP 2 (run separately, once): store your Brevo API key securely.
--   select vault.create_secret('PASTE-YOUR-BREVO-API-KEY', 'brevo_api_key');
-- To change it later:
--   select vault.update_secret((select id from vault.secrets where name = 'brevo_api_key'), 'NEW-KEY');
-- To pause emails:   update public.notify_settings set enabled = false;
-- ---------------------------------------------------------------------
