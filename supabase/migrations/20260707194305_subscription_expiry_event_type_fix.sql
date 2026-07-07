BEGIN;

CREATE OR REPLACE FUNCTION public.automate_subscription_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sub record;
  grace_days integer := 3;
  period_end timestamptz;
  grace_end timestamptz;
  new_status text;
BEGIN
  FOR sub IN
    SELECT s.id, s.org_id, s.status, s.current_period_end
    FROM public.org_subscriptions s
    WHERE s.status IN ('active', 'trialing')
      AND s.current_period_end < now()
  LOOP
    period_end := sub.current_period_end;
    grace_end := period_end + (grace_days * interval '1 day');

    IF now() > grace_end THEN
      new_status := 'expired';
    ELSE
      new_status := 'past_due';
    END IF;

    UPDATE public.org_subscriptions
    SET status = new_status, updated_at = now()
    WHERE id = sub.id;

    INSERT INTO public.license_events (org_id, entity_type, entity_id, event_type, event_data)
    VALUES (
      sub.org_id,
      'org_subscription',
      sub.id,
      CASE
        WHEN new_status = 'expired' THEN 'subscription_expired'
        ELSE 'subscription_updated'
      END,
      jsonb_build_object(
        'action', 'automated_expiry',
        'previousStatus', sub.status,
        'newStatus', new_status,
        'graceDays', grace_days
      )
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.automate_subscription_expiry() FROM anon;
GRANT EXECUTE ON FUNCTION public.automate_subscription_expiry() TO service_role;

COMMIT;
