-- Rename cost_per_watt to cost_per_unit in inverter_specs table
-- Run this in your Supabase SQL Editor

ALTER TABLE inverter_specs 
RENAME COLUMN cost_per_watt TO cost_per_unit;

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inverter_specs' 
  AND column_name IN ('cost_per_watt', 'cost_per_unit');
