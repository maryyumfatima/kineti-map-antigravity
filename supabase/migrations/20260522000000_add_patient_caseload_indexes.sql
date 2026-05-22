-- Speeds up "last completed session" and "completed within window" lookups
create index if not exists idx_bookings_clinic_status_completed
  on public.bookings (clinic_id, status, session_completed_at);

-- Speeds up "next upcoming appointment" lookups
create index if not exists idx_bookings_clinic_status_appttime
  on public.bookings (clinic_id, status, appointment_time);

-- Speeds up engagement-status filtering in the patient directory
create index if not exists idx_patients_clinic_status_tag
  on public.patients (clinic_id, status_tag);
