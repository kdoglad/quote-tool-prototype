-- Fix Row Level Security for audit_log to allow authenticated users to insert

-- Enable RLS on audit_log (if not already enabled)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view the audit log
CREATE POLICY "Allow authenticated read access to audit_log" 
ON public.audit_log FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users to insert into the audit log
CREATE POLICY "Allow authenticated insert to audit_log" 
ON public.audit_log FOR INSERT 
TO authenticated 
WITH CHECK (true);
