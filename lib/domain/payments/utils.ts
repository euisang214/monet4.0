/**
 * Payment utility functions
 */

/**
 * Calculates the platform fee (20%) from the gross amount.
 * Rounds down to the nearest cent.
 * 
 * @param amountCents Total transaction amount in cents
 * @returns Platform fee in cents
 */
export function calculatePlatformFee(amountCents: number): number {
    return Math.floor(amountCents * 0.20);
}

/**
 * Calculates the refund amount based on policy.
 * 
 * @param amountCents Total amount
 * @param isFullRefund Whether it is a full refund
 * @returns Refund amount in cents
 */
export function calculateRefundAmount(amountCents: number, isFullRefund: boolean): number {
    if (isFullRefund) {
        return amountCents;
    }
    // Partial refund logic can be added here if complex rules exist.
    // For now, if not full, it might be 50% or custom. 
    // This is a placeholder for standardized partial logic if needed.
    return 0;
}
