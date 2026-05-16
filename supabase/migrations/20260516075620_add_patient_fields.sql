ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS occupation TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS gp_practice TEXT;

-- Update the search path if needed, though usually not required for simple ALTER
