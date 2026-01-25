import { describe, it, expect } from 'vitest';
import { calculatePlatformFee, calculateRefundAmount } from '@/lib/domain/payments/utils';

describe('Payments Domain', () => {
    describe('calculatePlatformFee', () => {
        it('should calculate 20% fee correctly for standard amounts', () => {
            expect(calculatePlatformFee(10000)).toBe(2000); // $100.00 -> $20.00
            expect(calculatePlatformFee(5000)).toBe(1000);  // $50.00 -> $10.00
        });

        it('should round down to the nearest cent', () => {
            // $123.45 * 0.20 = $24.69
            // 12345 * 0.20 = 2469
            expect(calculatePlatformFee(12345)).toBe(2469);

            // $10.01 * 0.20 = $2.002 -> $2.00
            // 1001 * 0.20 = 200.2 -> 200
            expect(calculatePlatformFee(1001)).toBe(200);

            // $10.04 * 0.20 = $2.008 -> $2.00
            // 1004 * 0.20 = 200.8 -> 200
            expect(calculatePlatformFee(1004)).toBe(200);
        });

        it('should handle zero amounts', () => {
            expect(calculatePlatformFee(0)).toBe(0);
        });
    });

    describe('calculateRefundAmount', () => {
        it('should return full amount for full refunds', () => {
            expect(calculateRefundAmount(10000, true)).toBe(10000);
        });

        it('should return 0 for non-full refunds (placeholder logic)', () => {
            // Currently placeholder returns 0, verify this behavior until policy changes
            expect(calculateRefundAmount(10000, false)).toBe(0);
        });
    });
});
