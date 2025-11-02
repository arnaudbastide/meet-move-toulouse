import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import CheckoutForm from './CheckoutForm'; // This component will contain the payment form

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  clientSecret: string | null;
  onSuccess: () => void;
  amountLabel?: string;
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const PaymentDialog = ({ open, onClose, clientSecret, onSuccess, amountLabel }: PaymentDialogProps) => {
  if (!clientSecret) return null;

  const options = { clientSecret };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finaliser la réservation</DialogTitle>
          <DialogDescription>
            Montant à payer: {amountLabel}
          </DialogDescription>
        </DialogHeader>
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm onSuccess={onSuccess} />
        </Elements>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;