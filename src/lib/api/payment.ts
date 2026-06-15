export interface PaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  receipt: string;
}

export async function createPaymentOrder(request: PaymentRequest) {
  // Stub implementation for Razorpay/Stripe
  console.log('Creating payment order...', request);
  return {
    success: true,
    paymentId: 'stub_pay_' + Date.now()
  };
}
