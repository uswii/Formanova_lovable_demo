import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { useAuth } from '@/contexts/AuthContext';

export interface BillingLocale {
  country: string;
  currency: string;
  symbol: string;
}

const USD_FALLBACK: BillingLocale = { country: '', currency: 'USD', symbol: '$' };
const INR_LOCALE: BillingLocale = { country: 'IN', currency: 'INR', symbol: '₹' };
const TEST_INR_EMAILS = ['uswa@raresense.so'];

export function useBillingLocale(): BillingLocale {
  const { user } = useAuth();
  const [locale, setLocale] = useState<BillingLocale>(USD_FALLBACK);

  useEffect(() => {
    // Test mode: pretend this user is in India
    if (user?.email && TEST_INR_EMAILS.includes(user.email)) {
      setLocale(INR_LOCALE);
      return;
    }

    authenticatedFetch('/billing/locale')
      .then(r => r.json())
      .then((data: BillingLocale) => {
        setLocale(data?.currency ? data : USD_FALLBACK);
      })
      .catch(() => {
        setLocale(USD_FALLBACK);
      });
  }, [user?.email]);

  return locale;
}
