-- 1. Create global_settings table
CREATE TABLE IF NOT EXISTS public.global_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  characteristic text NOT NULL, -- e.g. 'tax', 'feed_in_tariff', 'tariff_general', 'margin'
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create procore_budget table
CREATE TABLE IF NOT EXISTS public.procore_budget (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  cost_code text NOT NULL,
  description text,
  amount numeric NOT NULL,
  category text, -- e.g. 'Labor', 'Materials', 'Equipment'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Insert examples into global_settings
INSERT INTO public.global_settings (setting_key, setting_value, characteristic, description)
VALUES 
  ('gst_rate', '"0.10"'::jsonb, 'tax', 'Standard Goods and Services Tax (GST) rate of 10%'),
  ('default_feed_in_tariff', '"0.05"'::jsonb, 'feed_in_tariff', 'Default solar feed-in tariff (c/kWh)'),
  ('default_grid_tariff', '"0.25"'::jsonb, 'tariff_general', 'Default grid electricity rate (c/kWh)'),
  ('base_margin_percentage', '"0.20"'::jsonb, 'margin', 'Base target margin for projects (20%)')
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    characteristic = EXCLUDED.characteristic,
    description = EXCLUDED.description;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_budget ENABLE ROW LEVEL SECURITY;

-- 5. Create basic policies for global_settings (read-only for anon, all for authenticated)
CREATE POLICY "Allow public read access to global_settings" 
ON public.global_settings FOR SELECT 
TO public
USING (true);

CREATE POLICY "Allow authenticated full access to global_settings" 
ON public.global_settings FOR ALL 
TO authenticated 
USING (true);

-- 6. Create policies for procore_budget
CREATE POLICY "Allow authenticated full access to procore_budget" 
ON public.procore_budget FOR ALL 
TO authenticated 
USING (true);

-- 7. Seed Sample Components
-- We first insert into catalog_items, then into their respective _specs tables
INSERT INTO public.catalog_items (item_id, item_code, item_name, category, item_type, subcategory)
VALUES 
  ('seed-panel-1', 'PNL-JINKO-440', 'Jinko Tiger Neo N-Type 440W', 'Solar', 'Panel', 'Residential'),
  ('seed-batt-1', 'BAT-TESLA-PW2', 'Tesla Powerwall 2', 'BESS', 'Battery', 'Residential')
ON CONFLICT (item_id) DO NOTHING;

INSERT INTO public.panel_specs (item_id, item_code, brand, item_type, wattage, cost_per_watt)
VALUES 
  ('seed-panel-1', 'PNL-JINKO-440', 'Jinko', 'Panel', 440, 0.40)
ON CONFLICT (item_id) DO NOTHING;

INSERT INTO public.battery_specs (item_id, item_code, item_name, brand, nominal_kwh, battery_price_fwb)
VALUES 
  ('seed-batt-1', 'BAT-TESLA-PW2', 'Tesla Powerwall 2', 'Tesla', 13.5, 9500)
ON CONFLICT (item_id) DO NOTHING;
