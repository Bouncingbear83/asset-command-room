
ALTER TABLE public.vault_notes_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_backlinks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_scheduled_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ticker_aliases_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
