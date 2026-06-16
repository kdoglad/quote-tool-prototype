-- Allow authenticated users to update audit_log rows (needed for the new one-row-per-version architecture)
DROP POLICY IF EXISTS "Allow authenticated update to audit_log" ON public.audit_log;
CREATE POLICY "Allow authenticated update to audit_log"
ON public.audit_log FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
