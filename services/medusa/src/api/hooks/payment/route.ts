import type { MedusaRequest, MedusaResponse } from '@medusajs/medusa';
import jwt from 'jsonwebtoken';

// Verify the request came from our Webhook Service
const verifyServiceToken = (token: string): boolean => {
  try {
    const payload = jwt.verify(
      token,
      process.env.INTERNAL_SERVICE_SECRET!
    ) as jwt.JwtPayload;
    return payload.type === 'service';
  } catch {
    return false;
  }
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const signature = req.headers['x-medusa-signature'] as string;

  if (!signature || !verifyServiceToken(signature)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { event_type, payment_id, data } = req.body as {
    event_type: string;
    payment_id: string;
    data: Record<string, unknown>;
  };

  // Medusa v2 uses the event bus to trigger order workflows
  const eventBus = req.scope.resolve('eventBusService');

  await eventBus.emit(`payment.${event_type}`, {
    payment_id,
    data,
  });

  return res.status(200).json({ received: true });
};
