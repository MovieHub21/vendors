-- Temporary live-payment test price: ₦100 (10,000 kobo).
-- Restore to 300,000 kobo after the live payment check.
update public.subscription_plans
   set price_kobo = 10000
 where code = 'monthly';
