// Simple event logging service
// Logs important trade events for monitoring and debugging

interface NotificationEvent {
  type: "trade_created" | "deposit_detected" | "payment_sent" | "payment_confirmed" | "escrow_released" | "dispute_opened";
  tradeId: string;
  userId: string;
  data: Record<string, any>;
}

class NotificationService {
  /**
   * Log event (users see updates by checking trade page)
   */
  async notify(event: NotificationEvent): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Event: ${event.type}] Trade: ${event.tradeId} | User: ${event.userId}`);

    if (Object.keys(event.data).length > 0) {
      console.log(`[${timestamp}] [Data]`, event.data);
    }
  }

  /**
   * Notify both participants of a trade
   */
  async notifyTradeParticipants(
    type: NotificationEvent["type"],
    tradeId: string,
    buyerId: string,
    sellerId: string,
    data: Record<string, any> = {}
  ): Promise<void> {
    await Promise.all([
      this.notify({ type, tradeId, userId: buyerId, data }),
      this.notify({ type, tradeId, userId: sellerId, data }),
    ]);
  }
}

export const notificationService = new NotificationService();
export default notificationService;
