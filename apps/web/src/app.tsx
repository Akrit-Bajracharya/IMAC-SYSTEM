import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/index.js';
import { router } from './router/index.js';
import { useCsrf } from './hooks/useCsrf.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppInner() {
  useCsrf();
  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
    </I18nextProvider>
  );
}
