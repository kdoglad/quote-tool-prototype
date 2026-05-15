-- Enable RLS and create full access policies for authenticated users on ALL 28 spec tables
-- This ensures that publishing 28 items sequentially doesn't fail due to missing policies.

DO $$ 
DECLARE
    table_name_var text;
    tables_list text[] := ARRAY[
        'prelim_specs',
        'grid_connection_app_specs',
        'gpu_req_threshold_specs',
        'panel_specs',
        'inverter_specs',
        'optimiser_specs',
        'racking_specs',
        'additional_racking_specs',
        'inverter_station_specs',
        'pvdb_specs',
        'pfc_specs',
        'netnada_specs',
        'netnada_addons_specs',
        'harm_filtering_specs',
        'battery_specs',
        'battery_inverter_specs',
        'bessdb_specs',
        'ac_cabling_specs',
        'dc_cabling_specs',
        'cabling_addons_specs',
        'switch_gear_specs',
        'ac_breaker_specs',
        'install_specs',
        'lifting_specs',
        'travel_accoms_freight_specs',
        'safety_specs',
        'monitoring_warranty_specs',
        'monitoring_addons_specs'
    ];
BEGIN
    FOREACH table_name_var IN ARRAY tables_list LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name_var);
        
        -- Drop existing policy if it exists
        EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated full access to %I" ON public.%I', table_name_var, table_name_var);
        
        -- Create new policy
        EXECUTE format('CREATE POLICY "Allow authenticated full access to %I" ON public.%I FOR ALL TO authenticated USING (true)', table_name_var, table_name_var);
    END LOOP;
END $$;
