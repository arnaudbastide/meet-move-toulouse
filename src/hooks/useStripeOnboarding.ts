import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getFunctionsBaseUrl } from '@/lib/utils';

export type StartOnboardingOptions = {
  returnPath?: string;
};

const normalizePath = (path: string) => {
  if (!path) return '/vendor-dashboard';
  return path.startsWith('/') ? path : `/${path}`;
};

export const useStripeOnboarding = () => {
  const { user } = useAuth();
  const [starting, setStarting] = useState(false);

  const startOnboarding = useCallback(
    async ({ returnPath = '/vendor-dashboard' }: StartOnboardingOptions = {}) => {
      if (!user) {
        toast.error('Connectez-vous en tant que vendor pour accéder à Stripe.');
        return;
      }

      const baseUrl = getFunctionsBaseUrl();
      if (!baseUrl) {
        toast.error("Configurez VITE_FUNCTIONS_URL pour lancer l'onboarding Stripe.");
        return;
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      if (!origin) {
        toast.error("Impossible de calculer l'URL de retour pour Stripe.");
        return;
      }

      const targetPath = normalizePath(returnPath);

      setStarting(true);
      try {
        const response = await fetch(`${baseUrl}/create-account-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: user.id,
            email: user.email,
            refreshUrl: `${origin}${targetPath}`,
            returnUrl: `${origin}${targetPath}`,
          }),
        });
        const payload = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !payload.url) {
          throw new Error(payload.error ?? 'Impossible de générer le lien Stripe.');
        }
        window.location.href = payload.url;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur lors de l'initialisation Stripe.";
        toast.error(message);
      } finally {
        setStarting(false);
      }
    },
    [user],
  );

  return { startOnboarding, starting };
};
