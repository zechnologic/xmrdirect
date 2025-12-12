/**
 * Formats payment method values for display in the UI
 * Converts snake_case payment method codes to human-readable format
 */
export function formatPaymentMethod(paymentMethod: string): string {
  const paymentMethodMap: Record<string, string> = {
    in_person: "In person",
    cash_by_mail: "Cash by mail",
  };

  return paymentMethodMap[paymentMethod] || paymentMethod;
}
