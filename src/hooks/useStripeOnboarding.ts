import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getFunctionsBaseUrl } from "@/lib/utils";

type OnboardingParams = {
  profileId: string;
  email: string;
  refreshUrl: string;
  returnUrl: string;
};

type OnboardingResponse = {
  url: string;
};

const requestStripeOnboarding = async (
  params: OnboardingParams,
): Promise<OnboardingResponse> => {
  const response = await fetch(
    `${getFunctionsBaseUrl()}/create-account-link`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error ??
        "Impossible de générer le lien d'onboarding Stripe.",
    );
  }

  return (await response.json()) as OnboardingResponse;
};

export const useStripeOnboarding = () =>
  useMutation({
    mutationFn: requestStripeOnboarding,
    onSuccess: ({ url }) => {
      if (!url) {
        toast.error("Lien d'onboarding Stripe manquant.");
        return;
      }

      toast.success("Redirection vers Stripe…");

      window.location.assign(url);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
