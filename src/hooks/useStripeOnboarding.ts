import { useMutation } from '@tanstack/react-query';

const initiateOnboarding = async (params: {
  profileId: string;
  email: string;
  refreshUrl: string;
  returnUrl: string;
}) => {
  const functionsUrl = import.meta.env.VITE_FUNCTIONS_URL;
  const res = await fetch(`${functionsUrl}/create-account-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error('Failed to create account link');
  }

  const { url } = await res.json();
  return url;
};

export const useStripeOnboarding = () => {
  return useMutation({
    mutationFn: initiateOnboarding,
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error) => {
      console.error(error);
      alert('Onboarding failed!');
    },
  });
};