import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

import { login } from '../../api/auth.js';
import { GuestLayout } from '../../components/layout/GuestLayout.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../components/ui/form.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loginSchema = z.object({
    username: z.string().min(1, { message: t('auth.login.username') }),
    password: z.string().min(1, { message: t('auth.login.password') }),
  });

  type LoginFormValues = z.infer<typeof loginSchema>;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const user = await login(values.username, values.password);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      if (user.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          setErrorMessage(t('auth.login.errors.invalidCredentials'));
        } else if (status === 423) {
          const lockedUntil = (err.response?.data as { lockedUntil?: string })?.lockedUntil;
          const formattedTime = lockedUntil
            ? new Date(lockedUntil).toLocaleTimeString()
            : '';
          setErrorMessage(
            t('auth.login.errors.accountLocked', { time: formattedTime })
          );
        } else if (!err.response) {
          setErrorMessage(t('auth.login.errors.networkError'));
        } else {
          setErrorMessage(t('auth.login.errors.generic'));
        }
      } else {
        setErrorMessage(t('auth.login.errors.generic'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GuestLayout>
      <Card className="w-full shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold text-center">
            {t('auth.login.title')}
          </CardTitle>
          <CardDescription className="text-center">
            {t('brand.portalTitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.login.username')}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        autoComplete="username"
                        placeholder={t('auth.login.usernamePlaceholder')}
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.login.password')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder={t('auth.login.passwordPlaceholder')}
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.login.loggingIn')}
                  </>
                ) : (
                  t('auth.login.submit')
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </GuestLayout>
  );
}
