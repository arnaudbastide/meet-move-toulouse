import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { toast } from 'sonner';
import { getStripe } from '@/lib/stripe';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type PaymentDialogProps = {
  clientSecret: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  amountLabel?: string;
};

type StripeTestWindow = Window & {
  __STRIPE_TEST_MODE__?: boolean;
};

const stripePromise = getStripe();

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  clientSecret,
  open,
  onClose,
  onSuccess,
  amountLabel,
}) => {
  const isTestMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as StripeTestWindow).__STRIPE_TEST_MODE__);
  }, []);
  const testTriggeredRef = useRef(false);

  useEffect(() => {
    if (isTestMode && open && clientSecret && !testTriggeredRef.current) {
      testTriggeredRef.current = true;
      onSuccess();
    }
  }, [clientSecret, isTestMode, onSuccess, open]);

  useEffect(() => {
    if (!open) {
      testTriggeredRef.current = false;
    }
  }, [open]);

  if (!clientSecret) {
    return null;
  }

  if (isTestMode) {
    return (
      <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paiement simulé</DialogTitle>
            <DialogDescription>
              Mode test activé : la confirmation de paiement a été simulée.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalisez votre paiement</DialogTitle>
          {amountLabel ? <DialogDescription>Total : {amountLabel}</DialogDescription> : null}
        </DialogHeader>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <ConfirmPaymentForm onSuccess={onSuccess} />
        </Elements>
      </DialogContent>
    </Dialog>
  );
};

type ConfirmPaymentFormProps = {
  onSuccess: () => void;
};

const ConfirmPaymentForm: React.FC<ConfirmPaymentFormProps> = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!stripe || !elements) {
        toast.error('Stripe n\'est pas prêt.');
        return;
      }

      setSubmitting(true);
      try {
        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: typeof window !== 'undefined' ? window.location.href : undefined,
          },
          redirect: 'if_required',
        });
        if (error) {
          throw error;
        }
        onSuccess();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Paiement refusé.';
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [elements, onSuccess, stripe],
  );

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: 'tabs' }} />
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={submitting || !stripe}>
          {submitting ? 'Confirmation...' : 'Payer maintenant'}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default PaymentDialog;
