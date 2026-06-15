export interface NotificationPayload {
  to: string;
  subject: string;
  body: string;
  type: 'email' | 'sms';
}

export async function sendNotification(payload: NotificationPayload) {
  // Stub implementation for Resend/Twilio
  console.log(`Sending ${payload.type} to ${payload.to}...`);
  return {
    success: true,
    messageId: 'stub_msg_' + Date.now()
  };
}
