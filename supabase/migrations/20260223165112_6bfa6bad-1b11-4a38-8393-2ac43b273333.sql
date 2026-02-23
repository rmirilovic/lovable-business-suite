ALTER TABLE public.delivery_notes
  ADD COLUMN delivery_address text,
  ADD COLUMN delivery_method text,
  ADD COLUMN issued_by text,
  ADD COLUMN received_by text;