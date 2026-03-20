import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

export interface BillingLocale {
  country: string;
  currency: string;
  symbol: string;
}

const USD_FALLBACK: BillingLocale = { country: '', currency: 'USD', symbol: '$' };

export function useBillingLocale(): BillingLocale {
  const [locale, setLocale] = useState<BillingLocale>(USD_FALLBACK);

  useEffect(() => {
    authenticatedFetch('/billing/locale')
      .then(r => r.json())
      .then((data: BillingLocale) => {
        setLocale(data?.currency ? data : USD_FALLBACK);
      })
      .catch(() => {
        setLocale(USD_FALLBACK);
      });
  }, []);

  return locale;
}
