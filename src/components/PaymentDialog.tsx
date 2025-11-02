import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutForm from "./CheckoutForm";

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  clientSecret: string | null;
  onSuccess: () => void;
  amountLabel?: string;
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const PaymentDialog = ({
  open,
  onClose,
  clientSecret,
  onSuccess,
  amountLabel,
}: PaymentDialogProps) => {
  if (!clientSecret) {
    return null;
  }

  const options = {
    clientSecret,
    appearance: {
      theme: "flat" as const,
      variables: {
        fontFamily: "Inter, sans-serif",
      },
    },
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finaliser la réservation</DialogTitle>
          <DialogDescription>
            Montant à payer&nbsp;: {amountLabel}
          </DialogDescription>
        </DialogHeader>
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm onSuccess={onSuccess} onCancel={onClose} />
        </Elements>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
