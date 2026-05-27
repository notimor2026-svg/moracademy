CREATE TABLE public.saved_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  nombre text NOT NULL,
  entidad text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_reports TO authenticated;
GRANT ALL ON public.saved_reports TO service_role;

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_reports rrhh all"
ON public.saved_reports
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'rrhh'::app_role))
WITH CHECK (has_role(auth.uid(), 'rrhh'::app_role));

CREATE INDEX idx_saved_reports_owner ON public.saved_reports(owner_user_id);
CREATE INDEX idx_saved_reports_entidad ON public.saved_reports(entidad);