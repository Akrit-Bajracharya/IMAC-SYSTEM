import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert.js';
import { Copy, Check, ShieldAlert, KeyRound } from 'lucide-react';

interface TemporaryPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  temporaryPassword: string;
}

export function TemporaryPasswordModal({
  open,
  onOpenChange,
  username,
  temporaryPassword,
}: TemporaryPasswordModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback if clipboard API is restricted
      const textArea = document.createElement('textarea');
      textArea.value = temporaryPassword;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{t('admin.users.tempPassword.title')}</DialogTitle>
              <DialogDescription>
                {t('admin.users.tempPassword.subtitle', { username })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Warning Banner */}
          <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-900 dark:text-amber-200 font-semibold">
              {t('admin.users.tempPassword.warningTitle')}
            </AlertTitle>
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
              {t('admin.users.tempPassword.warningDesc')}
            </AlertDescription>
          </Alert>

          {/* Password Display Box */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('admin.users.tempPassword.label')}
            </span>
            <div className="flex items-center justify-between gap-2">
              <code className="text-lg font-mono font-bold tracking-wider select-all text-primary">
                {temporaryPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-semibold text-green-600">
                      {t('common.copied')}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span className="text-xs">{t('common.copy')}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {t('admin.users.tempPassword.doneButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
