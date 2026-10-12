import { useEffect } from 'react';
import { fetchCsrfToken } from '../api/auth.js';
import { setCsrfToken } from '../api/client.js';

export function useCsrf() {
  useEffect(() => {
    fetchCsrfToken()
      .then(setCsrfToken)
      .catch(() => console.warn('Failed to fetch CSRF token'));
  }, []);
}
