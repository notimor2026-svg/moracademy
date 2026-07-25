CREATE TABLE IF NOT EXISTS public.employee_pins (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.employee_pins TO service_role;
ALTER TABLE public.employee_pins ENABLE ROW LEVEL SECURITY;