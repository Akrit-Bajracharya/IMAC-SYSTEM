import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe, logout as logoutApi } from '../api/auth.js';
import type { AuthUser } from '../types/index.js';

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const logout = async () => {
    await logoutApi();
    queryClient.setQueryData(['auth', 'me'], null);
    queryClient.clear();
  };

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
