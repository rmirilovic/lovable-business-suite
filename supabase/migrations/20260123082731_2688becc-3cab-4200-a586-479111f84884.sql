-- First, we need to handle potential duplicates before removing the column
-- Delete duplicate articles keeping the most recent one per code per company
DELETE FROM articles a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (company_id, code) id
  FROM articles
  ORDER BY company_id, code, updated_at DESC
);

-- Remove article_attribute_assignments for deleted articles (cascade should handle, but being safe)
DELETE FROM article_attribute_assignments
WHERE article_id NOT IN (SELECT id FROM articles);

-- Remove article_history for deleted articles
DELETE FROM article_history
WHERE article_id NOT IN (SELECT id FROM articles);

-- Now drop the business_year_id column from articles
ALTER TABLE articles DROP COLUMN business_year_id;

-- Also remove business_year_id from article_history if it exists
ALTER TABLE article_history DROP COLUMN IF EXISTS business_year_id;