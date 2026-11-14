-- =====================================================================
-- Swapit — starter data
-- Run AFTER migrations/0001_init.sql (SQL Editor → paste → Run).
-- Safe to run more than once.
--
-- To add a new campus later, copy this pattern: one insert into
-- schools, then its meetup spots.
-- =====================================================================

insert into public.schools (name, email_domain)
values ('Cal Poly San Luis Obispo', 'calpoly.edu')
on conflict (email_domain) do nothing;

insert into public.meetup_spots (school_id, name, description)
select s.id, spot.name, spot.description
from public.schools s
cross join (values
  ('University Union (UU) Plaza', 'Out front by the UU steps. Busy and easy to find.'),
  ('Kennedy Library', 'Main entrance of Robert E. Kennedy Library.'),
  ('Dexter Lawn', 'The big lawn next to Dexter Building.'),
  ('Recreation Center', 'Front entrance of the Rec Center.'),
  ('Campus Market', 'Outside Campus Market, near the seating area.')
) as spot(name, description)
where s.email_domain = 'calpoly.edu'
on conflict (school_id, name) do nothing;
