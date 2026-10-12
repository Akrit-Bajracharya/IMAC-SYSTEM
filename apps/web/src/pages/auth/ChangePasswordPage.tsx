import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

import { changePassword } from '../../api/auth.js';
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

export function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const changePasswordSchema = z
    .object({
      currentPassword: z
        .string()
        .min(1, { message: t('auth.changePassword.tooShort') }),
      newPassword: z
        .string()
        .min(1, { message: t('auth.changePassword.tooShort') }),
      confirmPassword: z
        .string()
        .min(1, { message: t('auth.changePassword.tooShort') }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('auth.changePassword.mismatch'),
      path: ['confirmPassword'],
    });

  type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/', { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data as { error?: string } | undefined;
        if (errorData?.error === 'wrong_current_password') {
          setErrorMessage(t('auth.changePassword.errors.wrongCurrentPassword'));
        } else {
          setErrorMessage(t('auth.changePassword.errors.generic'));
        }
      } else {
        setErrorMessage(t('auth.changePassword.errors.generic'));
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
            {t('auth.changePassword.title')}
          </CardTitle>
          <CardDescription className="text-center">
            {t('auth.changePassword.subtitle')}
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
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.changePassword.currentPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder={t('auth.changePassword.currentPasswordPlaceholder')}
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
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.changePassword.newPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder={t('auth.changePassword.newPasswordPlaceholder')}
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
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.changePassword.confirmPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder={t('auth.changePassword.confirmPasswordPlaceholder')}
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
                    {t('auth.changePassword.submitting')}
                  </>
                ) : (
                  t('auth.changePassword.submit')
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </GuestLayout>
  );
}
