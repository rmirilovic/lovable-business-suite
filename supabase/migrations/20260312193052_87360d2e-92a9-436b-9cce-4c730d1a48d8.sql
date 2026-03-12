
-- Step 1: Temporarily set children parent_code to NULL
UPDATE public.modules 
SET parent_code = NULL
WHERE code IN ('nabavka.nalozi_placanja.odobravanje', 'nabavka.nalozi_placanja.slanje', 'nabavka.nalozi_placanja.placanje');

-- Step 2: Rename the parent module
UPDATE public.modules 
SET parent_code = 'racunovodstvo', 
    code = 'racunovodstvo.nalozi_placanja',
    sort_order = 25
WHERE code = 'nabavka.nalozi_placanja';

-- Step 3: Update children with new codes and parent
UPDATE public.modules 
SET parent_code = 'racunovodstvo.nalozi_placanja',
    code = 'racunovodstvo.nalozi_placanja.odobravanje'
WHERE code = 'nabavka.nalozi_placanja.odobravanje';

UPDATE public.modules 
SET parent_code = 'racunovodstvo.nalozi_placanja',
    code = 'racunovodstvo.nalozi_placanja.slanje'
WHERE code = 'nabavka.nalozi_placanja.slanje';

UPDATE public.modules 
SET parent_code = 'racunovodstvo.nalozi_placanja',
    code = 'racunovodstvo.nalozi_placanja.placanje'
WHERE code = 'nabavka.nalozi_placanja.placanje';

-- Step 4: Update role_permissions
UPDATE public.role_permissions
SET module_code = 'racunovodstvo.nalozi_placanja'
WHERE module_code = 'nabavka.nalozi_placanja';

UPDATE public.role_permissions
SET module_code = 'racunovodstvo.nalozi_placanja.odobravanje'
WHERE module_code = 'nabavka.nalozi_placanja.odobravanje';

UPDATE public.role_permissions
SET module_code = 'racunovodstvo.nalozi_placanja.slanje'
WHERE module_code = 'nabavka.nalozi_placanja.slanje';

UPDATE public.role_permissions
SET module_code = 'racunovodstvo.nalozi_placanja.placanje'
WHERE module_code = 'nabavka.nalozi_placanja.placanje';
