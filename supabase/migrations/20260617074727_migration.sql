set check_function_bodies = false;

alter table public.user_profiles
  alter column role drop default;

alter table public.user_profiles
  alter column role type text using role::text;


create function public.apply_authenticated_crud_policies_on_new_tables()
  returns event_trigger
  language plpgsql
  AS $function$DECLARE cmd RECORD;
DECLARE tbl_name text;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
      AND split_part(object_identity, '.', 2) <> 'audit_log'
  LOOP
    -- Extract table name from 'public.table_name'
    tbl_name := split_part(cmd.object_identity, '.', 2);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl_name);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl_name AND policyname = 'authenticated_select_all_rows'
    ) THEN
      EXECUTE format(
        'CREATE POLICY authenticated_select_all_rows ON public.%I FOR SELECT TO authenticated USING (true);',
        tbl_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl_name AND policyname = 'authenticated_insert_all_rows'
    ) THEN
      EXECUTE format(
        'CREATE POLICY authenticated_insert_all_rows ON public.%I FOR INSERT TO authenticated WITH CHECK (true);',
        tbl_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl_name AND policyname = 'authenticated_update_all_rows'
    ) THEN
      EXECUTE format(
        'CREATE POLICY authenticated_update_all_rows ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);',
        tbl_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl_name AND policyname = 'authenticated_delete_all_rows'
    ) THEN
      EXECUTE format(
        'CREATE POLICY authenticated_delete_all_rows ON public.%I FOR DELETE TO authenticated USING (true);',
        tbl_name
      );
    END IF;

  END LOOP;
END;$function$;

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), -- default to email if full_name is not provided
    'Employee' -- default role
  );
  RETURN NEW;
END;
$function$;

create function public.rls_auto_enable()
  returns event_trigger
  language plpgsql
  security definer
  set search_path to 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

create table public.ac_breaker_specs (
  item_id            uuid                     not null,
  item_code          text,
  rating_a           numeric,
  name               text,
  price_per_breaker  numeric,
  breaker_type       text,
  is_projects_needed boolean,
  created_at         timestamp with time zone default now() not null,
  updated_at         timestamp with time zone
);

alter table public.ac_breaker_specs
  enable row level security;

alter table public.ac_breaker_specs
  add constraint ac_breaker_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.ac_breaker_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.ac_breaker_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.ac_breaker_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.ac_breaker_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.ac_cabling_specs (
  item_id            uuid                     not null,
  item_code                       text                     not null,
  conductor_material              text,
  single_core_price_per_meter     numeric,
  size_mm2                        numeric,
  "4c_plus_earth_price_per_meter" numeric,
  inclusion                       text,
  notes                           text,
  created_at                      timestamp with time zone default now() not null,
  updated_at                      timestamp with time zone
);

alter table public.ac_cabling_specs
  enable row level security;

alter table public.ac_cabling_specs
  add constraint ac_cabling_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.ac_cabling_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.ac_cabling_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.ac_cabling_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.ac_cabling_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.ac_calc (
  id         uuid                     default gen_random_uuid() not null,
  quote_id   uuid,
  calc_sheet jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone
);

alter table public.ac_calc
  enable row level security;

alter table public.ac_calc
  add constraint ac_calc_pkey primary key (id);

create policy authenticated_delete_all_rows on public.ac_calc
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.ac_calc
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.ac_calc
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.ac_calc
  for update
  to authenticated
  using (true)
  with check (true);

create table public.ac_combiner_specs (
  item_id            uuid                     not null,
  item_code                  text                     not null,
  ac_combiner_name           text,
  ac_combiner_price_per_unit numeric,
  notes                      text,
  created_at                 timestamp with time zone default now() not null,
  updated_at                 timestamp with time zone
);

alter table public.ac_combiner_specs
  enable row level security;

alter table public.ac_combiner_specs
  add constraint ac_combiner_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.ac_combiner_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.ac_combiner_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.ac_combiner_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.ac_combiner_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.ac_map_specs (
  id         uuid                     default gen_random_uuid() not null,
  ac_map     jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone
);

alter table public.ac_map_specs
  enable row level security;

alter table public.ac_map_specs
  add constraint ac_map_specs_pkey primary key (id);

create policy authenticated_delete_all_rows on public.ac_map_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.ac_map_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.ac_map_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.ac_map_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.additional_racking_specs (
  item_id            uuid                     not null,
  item_name         text                     not null,
  item_code         text,
  total_added_price numeric,
  cost_per_watt     numeric,
  cost_per_item     numeric,
  unit              text,
  created_at        timestamp with time zone default now() not null,
  updated_at        timestamp with time zone
);

alter table public.additional_racking_specs
  enable row level security;

alter table public.additional_racking_specs
  add constraint additional_racking_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.additional_racking_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.additional_racking_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.additional_racking_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.additional_racking_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.agreement_result (
  id                    uuid                     default gen_random_uuid() not null,
  quote_id              uuid,
  agreement_sheet       jsonb,
  total_quote_price     numeric,
  is_pv_only            boolean,
  "is_pv_and _bess"     boolean,
  is_ev_included        boolean,
  is_bess_only          boolean,
  pv_agreement          text,
  pv_and_bess_agreement text,
  ev_agreement          text,
  bess_agreement        text,
  created_at            timestamp with time zone default now() not null,
  updated_at            timestamp with time zone
);

alter table public.agreement_result
  enable row level security;

alter table public.agreement_result
  add constraint agreement_result_pkey primary key (id);

create policy authenticated_delete_all_rows on public.agreement_result
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.agreement_result
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.agreement_result
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.agreement_result
  for update
  to authenticated
  using (true)
  with check (true);

create table public.audit_log (
  audit_id      uuid                        default gen_random_uuid() not null,
  price_version text                        not null,
  notes         text,
  action        text,
  old_data      jsonb,
  new_data      jsonb,
  created_by    uuid,
  created_at    timestamp with time zone    default now() not null,
  published_at  timestamp without time zone,
  published_by  uuid
);

alter table public.audit_log
  enable row level security;

alter table public.audit_log
  add constraint audit_log_created_by_fkey foreign key (created_by) references public.user_profiles(id);

alter table public.audit_log
  add constraint audit_log_pkey primary key (audit_id);

alter table public.audit_log
  add constraint audit_log_published_by_fkey foreign key (published_by) references public.user_profiles(id);

create policy authenticated_delete_all_rows on public.audit_log
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.audit_log
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.audit_log
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.audit_log
  for update
  to authenticated
  using (true)
  with check (true);

create table public.battery_inverter_specs (
  item_id            uuid                     not null,
  item_code          text                     not null,
  brand              text,
  item_name          text,
  kva                numeric,
  pcs_price_excl_gst numeric,
  notes              text,
  created_at         timestamp with time zone default now() not null,
  updated_at         timestamp with time zone
);

alter table public.battery_inverter_specs
  enable row level security;

alter table public.battery_inverter_specs
  add constraint battery_inverter_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.battery_inverter_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.battery_inverter_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.battery_inverter_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.battery_inverter_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.battery_specs (
  item_id            uuid                     not null,
  item_code                text                     not null,
  item_name                text,
  brand                    text,
  nominal_kwh              numeric,
  battery_price_fob        numeric,
  is_pcs_included          boolean,
  pcs_table_ref            text,
  suggested_pcs            text,
  cost_per_kwh_inc_pcs     numeric,
  notes                    text,
  product_warranty         numeric,
  performance_warranty     numeric,
  is_smartstack_compatible boolean,
  created_at               timestamp with time zone default now() not null,
  updated_at               timestamp with time zone
);

alter table public.battery_specs
  enable row level security;

alter table public.battery_specs
  add constraint battery_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.battery_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.battery_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.battery_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.battery_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.bess_calc (
  id         uuid  default gen_random_uuid() not null,
  calc_sheet jsonb,
  quote_id   uuid  not null,
  created_at uuid,
  updated_at uuid
);

comment on table public.bess_calc is 'contains the calc_sheet (jsonb) of inputs needed for a single quotation';

alter table public.bess_calc
  enable row level security;

alter table public.bess_calc
  add constraint bess_calc_pkey primary key (id);

create policy authenticated_delete_all_rows on public.bess_calc
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.bess_calc
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.bess_calc
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.bess_calc
  for update
  to authenticated
  using (true)
  with check (true);

create table public.bess_rebate (
  id                  uuid                     default gen_random_uuid() not null,
  install_year        bigint,
  install_month_start bigint,
  install_month_end   bigint,
  stc_usable_kwh      numeric,
  created_at          timestamp with time zone not null,
  updated_at          timestamp with time zone
);

alter table public.bess_rebate
  enable row level security;

alter table public.bess_rebate
  add constraint bess_rebate_pkey primary key (id);

create policy authenticated_delete_all_rows on public.bess_rebate
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.bess_rebate
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.bess_rebate
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.bess_rebate
  for update
  to authenticated
  using (true)
  with check (true);

create table public.bessdb_specs (
  item_id            uuid                     not null,
  item_code            text,
  bessdb_type          text,
  full_export_price    numeric,
  export_limited_price numeric,
  created_at           timestamp with time zone default now(),
  updated_at           timestamp with time zone
);

alter table public.bessdb_specs
  enable row level security;

alter table public.bessdb_specs
  add constraint bessdb_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.bessdb_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.bessdb_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.bessdb_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.bessdb_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.cabling_addons_specs (
  item_id            uuid                     not null,
  item_code      text,
  addon_type     text,
  cost_per_meter numeric,
  created_at     timestamp with time zone default now() not null,
  updated_at     timestamp with time zone
);

alter table public.cabling_addons_specs
  enable row level security;

alter table public.cabling_addons_specs
  add constraint cabling_addons_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.cabling_addons_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.cabling_addons_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.cabling_addons_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.cabling_addons_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.catalog_items (
  item_id     uuid                     default gen_random_uuid() not null,
  item_code   text                     not null,
  category    text,
  subcategory text,
  item_name   text,
  item_type   text,
  created_at  timestamp with time zone default now(),
  updated_at  timestamp with time zone
);

comment on table public.catalog_items is 'master list of all items that can be added to the overall specs of a quotation';

alter table public.catalog_items
  enable row level security;

alter table public.catalog_items
  add constraint catalog_items_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.catalog_items
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.catalog_items
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.catalog_items
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.catalog_items
  for update
  to authenticated
  using (true)
  with check (true);

create table public.client_info (
  id                uuid                     default gen_random_uuid() not null,
  abn               text,
  primary_contact   text,
  direct_ph         text,
  email_address     text,
  nmi               text,
  is_off_grid       boolean,
  billing_address   text,
  suburb            text,
  postcode          text,
  state             text,
  sce_agent         text,
  direct_ph_sce     text,
  email_address_sce text,
  created_at        timestamp with time zone default now() not null,
  updated_at        timestamp with time zone
);

alter table public.client_info
  enable row level security;

alter table public.client_info
  add constraint client_info_pkey primary key (id);

create policy authenticated_delete_all_rows on public.client_info
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.client_info
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.client_info
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.client_info
  for update
  to authenticated
  using (true)
  with check (true);

create table public.dc_combiner_specs (
  item_id            uuid                     not null,
  item_code                  text                     not null,
  dc_combiner_name           text,
  dc_combiner_price_per_unit numeric,
  notes                      text,
  created_at                 timestamp with time zone default now() not null,
  updated_at                 timestamp with time zone
);

alter table public.dc_combiner_specs
  enable row level security;

alter table public.dc_combiner_specs
  add constraint dc_combiner_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.dc_combiner_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.dc_combiner_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.dc_combiner_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.dc_combiner_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.dc_twin_cabling_specs (
  item_id            uuid                     not null,
  item_code                  text                     not null,
  size_twin_dc_cable_mm      numeric,
  twin_dc_cable_price_per_mm numeric,
  notes                      text,
  created_at                 timestamp with time zone default now() not null,
  updated_at                 timestamp with time zone,
  dc_cabling_name            text
);

alter table public.dc_twin_cabling_specs
  enable row level security;

alter table public.dc_twin_cabling_specs
  add constraint dc_twin_cabling_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.dc_twin_cabling_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.dc_twin_cabling_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.dc_twin_cabling_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.dc_twin_cabling_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.ev_calc (
  id         uuid                     default gen_random_uuid() not null,
  quote_id   uuid,
  calc_sheet jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone
);

alter table public.ev_calc
  enable row level security;

alter table public.ev_calc
  add constraint ev_calc_pkey primary key (id);

create policy authenticated_delete_all_rows on public.ev_calc
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.ev_calc
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.ev_calc
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.ev_calc
  for update
  to authenticated
  using (true)
  with check (true);

create table public.global_settings (
  id             uuid                     default gen_random_uuid() not null,
  setting_key    text                     not null,
  setting_value  jsonb                    not null,
  characteristic text                     not null,
  description    text,
  created_at     timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at     timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.global_settings
  enable row level security;

alter table public.global_settings
  add constraint global_settings_pkey primary key (id);

alter table public.global_settings
  add constraint global_settings_setting_key_key unique (setting_key);

create policy "Allow authenticated full access to global_settings" ON public.global_settings
  to authenticated
  using (true);

create policy "Allow public read access to global_settings" ON public.global_settings
  for select
  using (true);

create policy authenticated_delete_all_rows on public.global_settings
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.global_settings
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.global_settings
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.global_settings
  for update
  to authenticated
  using (true)
  with check (true);

create table public.glossary_of_terms (
  id          uuid                     default gen_random_uuid() not null,
  phrase      text,
  explanation text,
  created_at  timestamp with time zone default now() not null,
  updated_at  timestamp with time zone
);

comment on table public.glossary_of_terms is 'contains the glossary for the terms used in the quote tool';

alter table public.glossary_of_terms
  enable row level security;

alter table public.glossary_of_terms
  add constraint glossary_of_terms_pkey primary key (id);

create policy authenticated_delete_all_rows on public.glossary_of_terms
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.glossary_of_terms
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.glossary_of_terms
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.glossary_of_terms
  for update
  to authenticated
  using (true)
  with check (true);

create table public.gpu_req_threshold_specs (
  item_id            uuid                     not null,
  item_code                text,
  dnsp                     text,
  required_over_kva        numeric,
  is_export_limit_enforced boolean,
  created_at               timestamp with time zone default now() not null,
  updated_at               timestamp with time zone
);

alter table public.gpu_req_threshold_specs
  enable row level security;

alter table public.gpu_req_threshold_specs
  add constraint gpu_req_threshold_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.gpu_req_threshold_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.gpu_req_threshold_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.gpu_req_threshold_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.gpu_req_threshold_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.grid_connection_app_specs (
  item_id            uuid                     not null,
  item_code               text                     not null,
  state                   text,
  dnsp                    text,
  is_bess_only            boolean,
  is_solar_or_solar_bess  boolean,
  low_size_kva            numeric,
  high_side_kva           numeric,
  preliminary_enquiry     numeric,
  app_fee_tech_assessment numeric,
  additional_cost         numeric,
  hv_site_variation       numeric,
  full_export_variation   numeric,
  total_network_fee       numeric,
  notes                   text,
  is_project_needed       boolean,
  created_at              timestamp with time zone default now() not null,
  updated_at              timestamp with time zone
);

alter table public.grid_connection_app_specs
  enable row level security;

alter table public.grid_connection_app_specs
  add constraint grid_connection_app_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.grid_connection_app_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.grid_connection_app_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.grid_connection_app_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.grid_connection_app_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.handover_checklist (
  id             uuid                     default gen_random_uuid() not null,
  quote_id       uuid,
  handover_sheet jsonb,
  status         text,
  created_at     timestamp with time zone default now() not null,
  updated_at     timestamp with time zone
);

comment on table public.handover_checklist is 'contains all the handovers required for the quotation';

alter table public.handover_checklist
  enable row level security;

alter table public.handover_checklist
  add constraint handover_checklist_pkey primary key (id);

create policy authenticated_delete_all_rows on public.handover_checklist
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.handover_checklist
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.handover_checklist
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.handover_checklist
  for update
  to authenticated
  using (true)
  with check (true);

create table public.harm_filtering_specs (
  item_id            uuid                     not null,
  item_type      text                     not null,
  price_per_unit numeric,
  item_code      text,
  created_at     timestamp with time zone default now() not null,
  updated_at     timestamp with time zone
);

alter table public.harm_filtering_specs
  enable row level security;

alter table public.harm_filtering_specs
  add constraint harm_filtering_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.harm_filtering_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.harm_filtering_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.harm_filtering_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.harm_filtering_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.inclusions_calc (
  id         uuid                     default gen_random_uuid() not null,
  quote_id   uuid,
  calc_sheet jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone
);

comment on table public.inclusions_calc is 'contains all the inclusion based from the quote tool';

alter table public.inclusions_calc
  enable row level security;

alter table public.inclusions_calc
  add constraint inclusions_calc_pkey primary key (id);

create policy authenticated_delete_all_rows on public.inclusions_calc
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.inclusions_calc
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.inclusions_calc
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.inclusions_calc
  for update
  to authenticated
  using (true)
  with check (true);

create table public.install_specs (
  item_id            uuid                     not null,
  item_code    text,
  install_item text,
  item_type    text,
  price        numeric,
  unit         text,
  created_at   timestamp with time zone default now(),
  updated_at   timestamp with time zone
);

alter table public.install_specs
  enable row level security;

alter table public.install_specs
  add constraint install_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.install_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.install_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.install_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.install_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.internal_glossary (
  id         uuid                     default gen_random_uuid() not null,
  category   text,
  term       text,
  definition text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone
);

comment on table public.internal_glossary is 'for terminologies used within the company and only seen by internal team';

alter table public.internal_glossary
  enable row level security;

alter table public.internal_glossary
  add constraint internal_glossary_pkey primary key (id);

create policy authenticated_delete_all_rows on public.internal_glossary
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.internal_glossary
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.internal_glossary
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.internal_glossary
  for update
  to authenticated
  using (true)
  with check (true);

create table public.inverter_specs (
  item_id            uuid                     not null,
  item_code      text                     not null,
  brand          text,
  model          text,
  warranty_years numeric,
  watt           numeric,
  cost_per_unit  numeric,
  created_at     timestamp with time zone default now() not null,
  updated_at     timestamp with time zone
);

alter table public.inverter_specs
  enable row level security;

alter table public.inverter_specs
  add constraint inverter_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.inverter_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.inverter_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.inverter_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.inverter_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.inverter_station_specs (
  item_id            uuid                     not null,
  item_code                      text                     not null,
  inverter_station               text,
  inverter_station_cost_per_unit numeric,
  created_at                     timestamp with time zone default now() not null,
  updated_at                     timestamp with time zone
);

alter table public.inverter_station_specs
  enable row level security;

alter table public.inverter_station_specs
  add constraint inverter_station_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.inverter_station_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.inverter_station_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.inverter_station_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.inverter_station_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.lifting_specs (
  item_id            uuid                     not null,
  item_code          text,
  lifting_type       text,
  name               text,
  total_cost         numeric,
  set_up_est_price   numeric,
  cost_per_time      numeric,
  "time"             numeric,
  unit               text,
  number_of_lifts    numeric,
  establishments     numeric,
  is_battery_install boolean,
  created_at         timestamp with time zone default now() not null,
  updated_at         timestamp with time zone
);

alter table public.lifting_specs
  enable row level security;

alter table public.lifting_specs
  add constraint lifting_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.lifting_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.lifting_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.lifting_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.lifting_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.monitoring_addons_specs (
  item_id            uuid                     not null,
  item_code  text,
  item_type  text,
  item_name  text,
  price      numeric,
  unit       text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone
);

alter table public.monitoring_addons_specs
  enable row level security;

alter table public.monitoring_addons_specs
  add constraint monitoring_addons_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.monitoring_addons_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.monitoring_addons_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.monitoring_addons_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.monitoring_addons_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.monitoring_warranty_manual_inputs (
  id          uuid                     default gen_random_uuid() not null,
  quote_id    uuid,
  addon_sheet jsonb,
  total_price numeric,
  created_at  timestamp with time zone default now() not null,
  updated_at  timestamp with time zone
);

comment on table public.monitoring_warranty_manual_inputs is 'all manual inputs from like third party qa (monitoring) and most of warranty is here';

alter table public.monitoring_warranty_manual_inputs
  enable row level security;

alter table public.monitoring_warranty_manual_inputs
  add constraint monitoring_warranty_manual_inputs_pkey primary key (id);

create policy authenticated_delete_all_rows on public.monitoring_warranty_manual_inputs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.monitoring_warranty_manual_inputs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.monitoring_warranty_manual_inputs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.monitoring_warranty_manual_inputs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.monitoring_warranty_specs (
  item_id            uuid                     not null,
  item_code  text,
  item_type  text,
  item_name  text,
  price      numeric,
  unit       text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone
);

alter table public.monitoring_warranty_specs
  enable row level security;

alter table public.monitoring_warranty_specs
  add constraint monitoring_warranty_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.monitoring_warranty_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.monitoring_warranty_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.monitoring_warranty_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.monitoring_warranty_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.netnada_addons_specs (
  item_id            uuid                     not null,
  item_code    text,
  item_name    text,
  price        numeric,
  payment_plan text,
  created_at   timestamp with time zone default now() not null,
  updated_at   timestamp with time zone
);

alter table public.netnada_addons_specs
  enable row level security;

alter table public.netnada_addons_specs
  add constraint netnada_addons_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.netnada_addons_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.netnada_addons_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.netnada_addons_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.netnada_addons_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.netnada_specs (
  item_id            uuid                     not null,
  item_code    text                     not null,
  plan_type    text,
  price        numeric,
  payment_plan text,
  created_at   timestamp with time zone default now() not null,
  updated_at   timestamp with time zone
);

alter table public.netnada_specs
  enable row level security;

alter table public.netnada_specs
  add constraint netnada_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.netnada_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.netnada_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.netnada_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.netnada_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.optimiser_specs (
  item_id            uuid                     not null,
  item_code      text                     not null,
  optimiser_name text,
  size_va        numeric,
  price_per_unit numeric,
  created_at     timestamp with time zone default now() not null,
  updated_at     timestamp with time zone
);

alter table public.optimiser_specs
  enable row level security;

alter table public.optimiser_specs
  add constraint optimiser_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.optimiser_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.optimiser_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.optimiser_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.optimiser_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.panel_specs (
  item_id            uuid                     not null,
  item_code            text                     not null,
  item_type            text,
  brand                text,
  product_warranty     numeric,
  performance_warranty numeric,
  wattage              numeric,
  cost_per_watt        numeric,
  datasheet_code       text,
  is_local_stock       boolean,
  notes                text,
  created_at           timestamp with time zone default now() not null,
  updated_at           timestamp with time zone,
  item_name            text
);

alter table public.panel_specs
  enable row level security;

alter table public.panel_specs
  add constraint panel_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.panel_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.panel_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.panel_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.panel_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.pfc_specs (
  item_id            uuid                     not null,
  pfc_type       text                     not null,
  price_per_unit numeric,
  item_code      text,
  created_at     timestamp with time zone default now() not null,
  updated_at     timestamp with time zone
);

alter table public.pfc_specs
  enable row level security;

alter table public.pfc_specs
  add constraint pfc_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.pfc_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.pfc_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.pfc_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.pfc_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.prelim_specs (
  item_id            uuid                     not null,
  item_code   text                     not null,
  item_type   text,
  item_name   text,
  price_total numeric,
  created_at  timestamp with time zone default now() not null,
  updated_at  timestamp with time zone
);

comment on table public.prelim_specs is 'prelims specs contains the council permission, structural engineering and other engineering specs (item type = subcategory from quote_items and catalog_items)';

alter table public.prelim_specs
  enable row level security;

alter table public.prelim_specs
  add constraint prelim_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.prelim_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.prelim_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.prelim_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.prelim_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.procore_budget (
  id          uuid                     default gen_random_uuid() not null,
  quote_id    uuid,
  cost_code   text                     not null,
  description text,
  amount      numeric                  not null,
  category    text,
  created_at  timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at  timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.procore_budget
  enable row level security;

alter table public.procore_budget
  add constraint procore_budget_pkey primary key (id);

create policy "Allow authenticated full access to procore_budget" ON public.procore_budget
  to authenticated
  using (true);

create policy authenticated_delete_all_rows on public.procore_budget
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.procore_budget
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.procore_budget
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.procore_budget
  for update
  to authenticated
  using (true)
  with check (true);

create table public.pvdb_specs (
  item_id            uuid                     not null,
  item_code            text                     not null,
  pvdb_type            text,
  full_export_price    numeric,
  export_limited_price numeric,
  created_at           timestamp with time zone,
  updated_at           timestamp with time zone
);

alter table public.pvdb_specs
  enable row level security;

alter table public.pvdb_specs
  add constraint pvdb_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.pvdb_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.pvdb_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.pvdb_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.pvdb_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.quote_calc (
  id         uuid                     default gen_random_uuid() not null,
  quote_id   uuid,
  calc_sheet jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone
);

alter table public.quote_calc
  enable row level security;

alter table public.quote_calc
  add constraint quote_calc_pkey primary key (id);

create policy authenticated_delete_all_rows on public.quote_calc
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.quote_calc
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.quote_calc
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.quote_calc
  for update
  to authenticated
  using (true)
  with check (true);

create table public.quote_inputs (
  id       uuid  default extensions.uuid_generate_v4() not null,
  quote_id uuid  not null,
  key      text  not null,
  value    jsonb not null
);

alter table public.quote_inputs
  add constraint quote_inputs_pkey primary key (id);

alter table public.quote_inputs
  add constraint unique_key_per_quote unique (quote_id, key);

create index idx_quote_inputs_quote on public.quote_inputs (quote_id);

create policy authenticated_delete_all_rows on public.quote_inputs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.quote_inputs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.quote_inputs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.quote_inputs
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated full access to quote_inputs" ON public.quote_inputs
  using ((auth.role() = 'authenticated'::text));

create table public.quote_install_info (
  id                           bigint                   generated by default as identity not null,
  total_system_size_kw         numeric,
  funding_model                text,
  install_address              text,
  suburb                       text,
  postcode                     text,
  state                        text,
  stcs_on_first_100kw          boolean,
  expected_commissioning_year  integer,
  expected_commissioning_month text,
  existing_pv_kwp              numeric,
  existing_pv_kva              numeric,
  hv_customer                  boolean,
  site_inspection_confirmed    boolean,
  created_at                   timestamp with time zone default now() not null,
  updated_at                   timestamp with time zone
);

alter table public.quote_install_info
  enable row level security;

alter table public.quote_install_info
  add constraint quote_install_info_pkey primary key (id);

create policy authenticated_delete_all_rows on public.quote_install_info
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.quote_install_info
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.quote_install_info
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.quote_install_info
  for update
  to authenticated
  using (true)
  with check (true);

create table public.quote_items (
  id                 uuid                     default extensions.uuid_generate_v4() not null,
  quote_id           uuid                     not null,
  catalog_id         uuid,
  quote_number       text,
  category           text,
  subcategory        text,
  item_code          text,
  item_name          text,
  item_type          text,
  qty                numeric,
  unit               text,
  cost_per_watt      numeric,
  sale_cost_per_watt numeric,
  quoted_cost        numeric,
  quoted_markup      numeric,
  quoted_sales_cost  numeric,
  total_line_amount  numeric,
  created_at         timestamp with time zone,
  updated_at         timestamp with time zone,
  version_used       text
);

comment on table public.quote_items is 'this is where the items that are included in a quotation are stored and identified per quote id, quote number and catalog_id';

alter table public.quote_items
  enable row level security;

alter table public.quote_items
  add constraint quote_items_catalog_id_fkey foreign key (catalog_id) references public.catalog_items(item_id);

alter table public.quote_items
  add constraint quote_items_pkey primary key (id);

create policy authenticated_delete_all_rows on public.quote_items
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.quote_items
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.quote_items
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.quote_items
  for update
  to authenticated
  using (true)
  with check (true);

create table public.quote_snapshots (
  id             uuid                     default extensions.uuid_generate_v4() not null,
  quote_id       uuid                     not null,
  version_number integer                  not null,
  snapshot       jsonb                    not null,
  change_note    text,
  created_by     uuid                     not null,
  created_at     timestamp with time zone default now() not null
);

alter table public.quote_snapshots
  add constraint quote_snapshots_created_by_fkey foreign key (created_by) references public.user_profiles(id);

alter table public.quote_snapshots
  add constraint quote_snapshots_pkey primary key (id);

alter table public.quote_snapshots
  add constraint unique_snapshot_version unique (quote_id, version_number);

create index idx_snapshots_quote on public.quote_snapshots (quote_id);

create policy authenticated_delete_all_rows on public.quote_snapshots
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.quote_snapshots
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.quote_snapshots
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.quote_snapshots
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated full access to quote_snapshots" ON public.quote_snapshots
  using ((auth.role() = 'authenticated'::text));

create table public.quotes (
  id                uuid                     default extensions.uuid_generate_v4() not null,
  quote_number      text,
  project_name      text                     not null,
  status            public.quote_status      default 'draft'::public.quote_status not null,
  price_version_id  uuid                     not null,
  client_info_id    uuid                     not null,
  site_address      text                     not null,
  site_suburb       text                     not null,
  site_state        text                     not null,
  site_postcode     text                     not null,
  nmi               text,
  dnsp              text,
  system_kw         numeric(10,3),
  system_kva        numeric(10,3),
  has_bess          boolean                  default false,
  has_ev            boolean                  default false,
  existing_solar_kw numeric(10,3)            default 0,
  valid_until       date,
  internal_notes    text,
  created_by        uuid                     not null,
  assigned_to       uuid,
  created_at        timestamp with time zone default now() not null,
  updated_at        timestamp with time zone default now() not null
);



alter table public.quotes
  add constraint quotes_assigned_to_fkey foreign key (assigned_to) references public.user_profiles(id);

alter table public.quotes
  add constraint quotes_client_info_id_fkey foreign key (client_info_id) references public.client_info(id) on update cascade on delete cascade;

alter table public.quotes
  add constraint quotes_created_by_fkey foreign key (created_by) references public.user_profiles(id);

alter table public.quotes
  add constraint quotes_pkey primary key (id);

alter table public.ac_calc
  add constraint ac_calc_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

alter table public.agreement_result
  add constraint agreement_result_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

alter table public.bess_calc
  add constraint bess_calc_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

alter table public.ev_calc
  add constraint ev_calc_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

alter table public.handover_checklist
  add constraint handover_checklist_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

alter table public.inclusions_calc
  add constraint inclusions_calc_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

alter table public.monitoring_warranty_manual_inputs
  add constraint monitoring_warranty_manual_inputs_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

alter table public.procore_budget
  add constraint procore_budget_quote_id_fkey foreign key (quote_id) references public.quotes(id) on delete cascade;

alter table public.quote_calc
  add constraint quote_calc_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

alter table public.quote_inputs
  add constraint quote_inputs_quote_id_fkey foreign key (quote_id) references public.quotes(id) on delete cascade;

alter table public.quote_items
  add constraint quote_items_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

alter table public.quote_snapshots
  add constraint quote_snapshots_quote_id_fkey foreign key (quote_id) references public.quotes(id) on delete cascade;

alter table public.quotes
  add constraint quotes_quote_number_key unique (quote_number);

create index idx_quotes_created_by on public.quotes (created_by);

create index idx_quotes_status on public.quotes (status);

create index idx_quotes_version on public.quotes (price_version_id);

create policy authenticated_delete_all_rows on public.quotes
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.quotes
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.quotes
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.quotes
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated can create quotes" ON public.quotes
  for insert
  with check ((auth.role() = 'authenticated'::text));

create policy "Authenticated can read all quotes" ON public.quotes
  for select
  using ((auth.role() = 'authenticated'::text));

create policy "Authenticated can update quotes" ON public.quotes
  for update
  using ((auth.role() = 'authenticated'::text));

create table public.racking_specs (
  item_id            uuid                     not null,
  item_code      text                     not null,
  racking_type   text,
  cost_per_panel numeric,
  created_at     timestamp with time zone default now() not null,
  updated_at     timestamp with time zone,
  cost_per_watt  numeric
);

alter table public.racking_specs
  enable row level security;

alter table public.racking_specs
  add constraint racking_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.racking_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.racking_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.racking_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.racking_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.rebate_calc (
  id         uuid                     default gen_random_uuid() not null,
  quote_id   uuid                     not null,
  calc_sheet jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone
);

alter table public.rebate_calc
  enable row level security;

alter table public.rebate_calc
  add constraint rebate_calc_pkey primary key (id);

alter table public.rebate_calc
  add constraint rebate_calc_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

create policy authenticated_delete_all_rows on public.rebate_calc
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.rebate_calc
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.rebate_calc
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.rebate_calc
  for update
  to authenticated
  using (true)
  with check (true);

create table public.safety_manual_inputs (
  id          uuid                     default gen_random_uuid() not null,
  quote_id    uuid,
  addon_sheet jsonb,
  total_price numeric,
  created_at  timestamp with time zone default now() not null,
  updated_at  timestamp with time zone
);

comment on table public.safety_manual_inputs is 'made all addons in 1 jsonb row so that it can be compressed and then used on front end';

alter table public.safety_manual_inputs
  enable row level security;

alter table public.safety_manual_inputs
  add constraint safety_manual_inputs_pkey primary key (id);

alter table public.safety_manual_inputs
  add constraint safety_manual_inputs_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

create policy authenticated_delete_all_rows on public.safety_manual_inputs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.safety_manual_inputs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.safety_manual_inputs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.safety_manual_inputs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.safety_specs (
  item_id            uuid                     not null,
  item_code  text,
  item_type  text,
  item_name  text,
  price      numeric,
  unit       text,
  created_at timestamp with time zone default now() not null,
  updated_id timestamp with time zone
);

alter table public.safety_specs
  enable row level security;

alter table public.safety_specs
  add constraint safety_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.safety_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.safety_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.safety_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.safety_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.service_model_calc (
  id         uuid                     default gen_random_uuid() not null,
  quote_id   uuid,
  calc_sheet jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone
);

comment on table public.service_model_calc is 'contains all the calculations from the service model quote tool';

alter table public.service_model_calc
  enable row level security;

alter table public.service_model_calc
  add constraint service_model_calc_pkey primary key (id);

alter table public.service_model_calc
  add constraint service_model_calc_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

create policy authenticated_delete_all_rows on public.service_model_calc
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.service_model_calc
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.service_model_calc
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.service_model_calc
  for update
  to authenticated
  using (true)
  with check (true);

create table public.specs_manual_input (
  id          uuid                     default gen_random_uuid() not null,
  quote_id    uuid,
  spec_sheet  jsonb,
  total_price numeric,
  created_at  timestamp with time zone default now(),
  updated_at  timestamp with time zone
);

alter table public.specs_manual_input
  enable row level security;

alter table public.specs_manual_input
  add constraint specs_manual_input_pkey primary key (id);

alter table public.specs_manual_input
  add constraint specs_manual_input_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

create policy authenticated_delete_all_rows on public.specs_manual_input
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.specs_manual_input
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.specs_manual_input
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.specs_manual_input
  for update
  to authenticated
  using (true)
  with check (true);

create table public.switch_gear_calc (
  id         uuid                     default gen_random_uuid() not null,
  quote_id   uuid                     not null,
  calc_sheet jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

alter table public.switch_gear_calc
  enable row level security;

alter table public.switch_gear_calc
  add constraint switch_gear_calc_pkey primary key (id);

alter table public.switch_gear_calc
  add constraint switch_gear_calc_quote_id_fkey foreign key (quote_id) references public.quotes(id) on update cascade on delete cascade;

create policy authenticated_delete_all_rows on public.switch_gear_calc
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.switch_gear_calc
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.switch_gear_calc
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.switch_gear_calc
  for update
  to authenticated
  using (true)
  with check (true);

create table public.switch_gear_specs (
  item_id            uuid                     not null,
  item_code   text,
  item_type   text,
  item_name   text,
  total_price numeric,
  created_at  timestamp with time zone default now(),
  updated_at  timestamp with time zone
);

alter table public.switch_gear_specs
  enable row level security;

alter table public.switch_gear_specs
  add constraint switch_gear_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.switch_gear_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.switch_gear_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.switch_gear_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.switch_gear_specs
  for update
  to authenticated
  using (true)
  with check (true);

create table public.travel_accoms_freight_specs (
  item_id            uuid                     not null,
  item_code                text,
  travel_rates             text,
  distance_frm_city_center numeric,
  travel                   numeric,
  accom                    numeric,
  freight                  numeric,
  total                    numeric,
  created_at               timestamp with time zone default now() not null,
  updated_at               timestamp with time zone
);

alter table public.travel_accoms_freight_specs
  enable row level security;

alter table public.travel_accoms_freight_specs
  add constraint travel_accoms_freight_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.travel_accoms_freight_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.travel_accoms_freight_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.travel_accoms_freight_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.travel_accoms_freight_specs
  for update
  to authenticated
  using (true)
  with check (true);


create policy authenticated_delete_all_rows on public.user_profiles
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.user_profiles
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.user_profiles
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.user_profiles
  for update
  to authenticated
  using (true)
  with check (true);

create table public.witness_injection_testing_specs (
  item_id            uuid                     not null,
  item_code              text                     not null,
  dnsp                   text,
  required_over_kva      numeric,
  price_total            numeric,
  created_at             timestamp with time zone default now() not null,
  updated_at             timestamp with time zone,
  solar_solar_bess_price numeric,
  bess_only_price        numeric
);

alter table public.witness_injection_testing_specs
  enable row level security;

alter table public.witness_injection_testing_specs
  add constraint witness_injection_testing_specs_pkey primary key (item_id);

create policy authenticated_delete_all_rows on public.witness_injection_testing_specs
  for delete
  to authenticated
  using (true);

create policy authenticated_insert_all_rows on public.witness_injection_testing_specs
  for insert
  to authenticated
  with check (true);

create policy authenticated_select_all_rows on public.witness_injection_testing_specs
  for select
  to authenticated
  using (true);

create policy authenticated_update_all_rows on public.witness_injection_testing_specs
  for update
  to authenticated
  using (true)
  with check (true);

create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

create event trigger trg_apply_authenticated_crud_policies_on_new_tables
  on ddl_command_end
  when tag in ('CREATE TABLE')
  execute function public.apply_authenticated_crud_policies_on_new_tables()

alter table public.ac_breaker_specs add constraint ac_breaker_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.ac_cabling_specs add constraint ac_cabling_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.ac_combiner_specs add constraint ac_combiner_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.additional_racking_specs add constraint additional_racking_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.battery_inverter_specs add constraint battery_inverter_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.battery_specs add constraint battery_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.bessdb_specs add constraint bessdb_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.cabling_addons_specs add constraint cabling_addons_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.dc_combiner_specs add constraint dc_combiner_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.dc_twin_cabling_specs add constraint dc_twin_cabling_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.gpu_req_threshold_specs add constraint gpu_req_threshold_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.grid_connection_app_specs add constraint grid_connection_app_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.harm_filtering_specs add constraint harm_filtering_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.install_specs add constraint install_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.inverter_specs add constraint inverter_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.inverter_station_specs add constraint inverter_station_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.lifting_specs add constraint lifting_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.monitoring_addons_specs add constraint monitoring_addons_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.monitoring_warranty_specs add constraint monitoring_warranty_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.netnada_addons_specs add constraint netnada_addons_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.netnada_specs add constraint netnada_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.optimiser_specs add constraint optimiser_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.panel_specs add constraint panel_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.pfc_specs add constraint pfc_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.prelim_specs add constraint prelim_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.pvdb_specs add constraint pvdb_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.racking_specs add constraint racking_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.safety_specs add constraint safety_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.switch_gear_specs add constraint switch_gear_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.travel_accoms_freight_specs add constraint travel_accoms_freight_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
alter table public.witness_injection_testing_specs add constraint witness_injection_testing_specs_item_id_fkey foreign key (item_id) references public.catalog_items(item_id) on update cascade on delete cascade;
