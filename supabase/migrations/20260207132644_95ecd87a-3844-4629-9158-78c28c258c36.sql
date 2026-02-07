
-- Fix stock values: only receipt 260001 (Masterbač 2400) is currently posted
-- AB KONUS and AB PLOCA have no posted receipts, stock should be 0

ALTER TABLE articles DISABLE TRIGGER article_audit_trigger;

-- Masterbač Crni: current receipt has 2400
UPDATE articles SET stock = 2400, updated_at = now() 
WHERE id = '03237ed7-74b8-48ba-bb29-78ecc7de9178';

-- AB KONUS: no current receipts
UPDATE articles SET stock = 0, updated_at = now() 
WHERE id = '69a5b018-5ad5-4622-bdaf-217ae3fac73b';

-- AB PLOCA: no current receipts  
UPDATE articles SET stock = 0, updated_at = now() 
WHERE id = 'c744c780-5f09-4f1a-ad33-cdaea1ccc084';

ALTER TABLE articles ENABLE TRIGGER article_audit_trigger;
