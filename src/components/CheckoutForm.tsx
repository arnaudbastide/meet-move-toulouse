import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface CheckoutFormProps {
  onSuccess: () => void;
}

const CheckoutForm = ({ onSuccess }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Return URL is handled by the parent component
        return_url: `${window.location.origin}/bookings`,
      },
      redirect: 'if_required',
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess();
    } else {
      // Handle other statuses if needed
      toast.info('Le paiement est en cours de traitement.');
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <Button disabled={isLoading || !stripe || !elements} className="w-full mt-4">
        {isLoading ? 'Paiement en cours...' : 'Payer & Réserver'}
      </Button>
    </form>
  );
};

export default CheckoutForm;
