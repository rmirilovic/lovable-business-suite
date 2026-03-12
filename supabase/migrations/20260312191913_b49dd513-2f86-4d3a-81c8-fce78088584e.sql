-- Add sub-modules for payment order workflow permissions
INSERT INTO modules (code, name, module_type, parent_code, sort_order, description, is_active) VALUES
  ('nabavka.nalozi_placanja.odobravanje', 'Odobravanje naloga', 'nabavka', 'nabavka.nalozi_placanja', 61, 'Dozvola za odobravanje naloga za plaćanje (draft → approved)', true),
  ('nabavka.nalozi_placanja.slanje', 'Slanje u banku', 'nabavka', 'nabavka.nalozi_placanja', 62, 'Dozvola za slanje naloga u banku (approved → sent)', true),
  ('nabavka.nalozi_placanja.placanje', 'Potvrda plaćanja', 'nabavka', 'nabavka.nalozi_placanja', 63, 'Dozvola za potvrdu plaćanja naloga (sent → paid)', true);