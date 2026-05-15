-- Enable RLS and create full access policies for authenticated users on catalog_items and all spec tables

-- catalog_items
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to catalog_items" ON public.catalog_items;
CREATE POLICY "Allow authenticated full access to catalog_items" 
ON public.catalog_items FOR ALL TO authenticated USING (true);

-- panel_specs
ALTER TABLE public.panel_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to panel_specs" ON public.panel_specs;
CREATE POLICY "Allow authenticated full access to panel_specs" 
ON public.panel_specs FOR ALL TO authenticated USING (true);

-- battery_specs
ALTER TABLE public.battery_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to battery_specs" ON public.battery_specs;
CREATE POLICY "Allow authenticated full access to battery_specs" 
ON public.battery_specs FOR ALL TO authenticated USING (true);

-- inverter_specs
ALTER TABLE public.inverter_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to inverter_specs" ON public.inverter_specs;
CREATE POLICY "Allow authenticated full access to inverter_specs" 
ON public.inverter_specs FOR ALL TO authenticated USING (true);

-- optimiser_specs
ALTER TABLE public.optimiser_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to optimiser_specs" ON public.optimiser_specs;
CREATE POLICY "Allow authenticated full access to optimiser_specs" 
ON public.optimiser_specs FOR ALL TO authenticated USING (true);

-- racking_specs
ALTER TABLE public.racking_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to racking_specs" ON public.racking_specs;
CREATE POLICY "Allow authenticated full access to racking_specs" 
ON public.racking_specs FOR ALL TO authenticated USING (true);

-- additional_racking_specs
ALTER TABLE public.additional_racking_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to additional_racking_specs" ON public.additional_racking_specs;
CREATE POLICY "Allow authenticated full access to additional_racking_specs" 
ON public.additional_racking_specs FOR ALL TO authenticated USING (true);

-- ac_cabling_specs
ALTER TABLE public.ac_cabling_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to ac_cabling_specs" ON public.ac_cabling_specs;
CREATE POLICY "Allow authenticated full access to ac_cabling_specs" 
ON public.ac_cabling_specs FOR ALL TO authenticated USING (true);

-- ac_breaker_specs
ALTER TABLE public.ac_breaker_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to ac_breaker_specs" ON public.ac_breaker_specs;
CREATE POLICY "Allow authenticated full access to ac_breaker_specs" 
ON public.ac_breaker_specs FOR ALL TO authenticated USING (true);

-- install_specs
ALTER TABLE public.install_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to install_specs" ON public.install_specs;
CREATE POLICY "Allow authenticated full access to install_specs" 
ON public.install_specs FOR ALL TO authenticated USING (true);

-- lifting_specs
ALTER TABLE public.lifting_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to lifting_specs" ON public.lifting_specs;
CREATE POLICY "Allow authenticated full access to lifting_specs" 
ON public.lifting_specs FOR ALL TO authenticated USING (true);

-- monitoring_addons_specs
ALTER TABLE public.monitoring_addons_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to monitoring_addons_specs" ON public.monitoring_addons_specs;
CREATE POLICY "Allow authenticated full access to monitoring_addons_specs" 
ON public.monitoring_addons_specs FOR ALL TO authenticated USING (true);

-- monitoring_warranty_specs
ALTER TABLE public.monitoring_warranty_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to monitoring_warranty_specs" ON public.monitoring_warranty_specs;
CREATE POLICY "Allow authenticated full access to monitoring_warranty_specs" 
ON public.monitoring_warranty_specs FOR ALL TO authenticated USING (true);

-- netnada_specs
ALTER TABLE public.netnada_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to netnada_specs" ON public.netnada_specs;
CREATE POLICY "Allow authenticated full access to netnada_specs" 
ON public.netnada_specs FOR ALL TO authenticated USING (true);

-- inverter_station_specs
ALTER TABLE public.inverter_station_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to inverter_station_specs" ON public.inverter_station_specs;
CREATE POLICY "Allow authenticated full access to inverter_station_specs" 
ON public.inverter_station_specs FOR ALL TO authenticated USING (true);
