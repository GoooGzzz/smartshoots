import { QueryClient } from '@tanstack/react-query';

// FIX (offline APK): react-query's default networkMode is 'online', which
// PAUSES every query the moment navigator.onLine is false (airplane mode,
// no Wi-Fi). Paused queries never reach apiClient, so its cached-GET
// fallback (api/offlineQueue.ts) never got a chance to run - the app sat
// on endless loading spinners instead of showing the last saved data.
// 'always' makes queries/mutations run regardless, so the cache fallback
// and the offline mutation queue actually work.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'always', retry: (n: number, err: any) => (err?.response ? n < 1 : false), retryDelay: 700, staleTime: 20_000, gcTime: 24 * 60 * 60 * 1000 },
    mutations: { networkMode: 'always' },
  },
});
