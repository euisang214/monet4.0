import { describe, expect, it, vi } from 'vitest'
import { PaymentStatus } from '@prisma/client'
import {
    buildSeedPaymentCreateData,
    createSeedStripePaymentProcessor,
    mapPaymentStatusToSeedStage,
    type StripeSeedApi,
    validateStripeSeedEnv,
} from '../prisma/seed-stripe'

function makeMockStripeApi() {
    const paymentIntentsCreate = vi.fn().mockResolvedValue({
        id: 'pi_mock_123',
        status: 'requires_capture',
    })
    const paymentIntentsCapture = vi.fn().mockResolvedValue({
        id: 'pi_mock_123',
        status: 'succeeded',
    })
    const paymentIntentsCancel = vi.fn().mockResolvedValue({
        id: 'pi_mock_123',
        status: 'canceled',
    })
    const refundsCreate = vi.fn().mockResolvedValue({
        id: 're_mock_123',
        status: 'succeeded',
    })

    return {
        api: {
            paymentIntents: {
                create: paymentIntentsCreate,
                capture: paymentIntentsCapture,
                cancel: paymentIntentsCancel,
            },
            refunds: {
                create: refundsCreate,
            },
        } satisfies StripeSeedApi,
        mocks: {
            paymentIntentsCreate,
            paymentIntentsCapture,
            paymentIntentsCancel,
            refundsCreate,
        },
    }
}

describe('seed stripe env validation', () => {
    it('throws when STRIPE_TEST_SECRET_KEY is missing even if STRIPE_SECRET_KEY exists', () => {
        expect(() =>
            validateStripeSeedEnv({
                STRIPE_SECRET_KEY: 'sk_test_should_not_be_used',
            } as NodeJS.ProcessEnv)
        ).toThrow(/STRIPE_TEST_SECRET_KEY/)
    })

    it('throws when STRIPE_TEST_SECRET_KEY is not a test key', () => {
        expect(() =>
            validateStripeSeedEnv({
                STRIPE_TEST_SECRET_KEY: 'sk_live_123',
            } as NodeJS.ProcessEnv)
        ).toThrow(/sk_test_/)
    })

    it('uses pm_card_visa as default payment method when unset', () => {
        const env = validateStripeSeedEnv({
            STRIPE_TEST_SECRET_KEY: 'sk_test_123',
        } as NodeJS.ProcessEnv)
        expect(env.defaultPaymentMethod).toBe('pm_card_visa')
    })
})

describe('payment status stage mapping', () => {
    it('maps supported payment statuses to stripe seed stages', () => {
        expect(mapPaymentStatusToSeedStage(PaymentStatus.authorized)).toBe('authorized')
        expect(mapPaymentStatusToSeedStage(PaymentStatus.cancelled)).toBe('cancelled')
        expect(mapPaymentStatusToSeedStage(PaymentStatus.held)).toBe('held')
        expect(mapPaymentStatusToSeedStage(PaymentStatus.released)).toBe('released')
        expect(mapPaymentStatusToSeedStage(PaymentStatus.refunded)).toBe('refunded')
    })

    it('throws for unsupported statuses', () => {
        expect(() => mapPaymentStatusToSeedStage(PaymentStatus.capture_failed)).toThrow(
            /Unsupported PaymentStatus/
        )
        expect(() => mapPaymentStatusToSeedStage(PaymentStatus.partially_refunded)).toThrow(
            /Unsupported PaymentStatus/
        )
    })
})

describe('seed payment create data lifecycle', () => {
    it('creates authorized payment data without capture/cancel/refund', async () => {
        const { api, mocks } = makeMockStripeApi()
        const processor = createSeedStripePaymentProcessor({
            secretKey: 'sk_test_123',
            defaultPaymentMethod: 'pm_card_visa',
            stripeApi: api,
        })

        const paymentData = await buildSeedPaymentCreateData(
            {
                amountGross: 10000,
                platformFee: 1500,
                status: PaymentStatus.authorized,
            },
            processor
        )

        expect(paymentData.stripePaymentIntentId).toBe('pi_mock_123')
        expect(paymentData.stripeRefundId).toBeUndefined()
        expect(mocks.paymentIntentsCapture).not.toHaveBeenCalled()
        expect(mocks.paymentIntentsCancel).not.toHaveBeenCalled()
        expect(mocks.refundsCreate).not.toHaveBeenCalled()
        expect(mocks.paymentIntentsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 10000,
                capture_method: 'manual',
                confirm: true,
                payment_method: 'pm_card_visa',
            })
        )
    })

    it('creates cancelled payment data by cancelling intent after confirmation', async () => {
        const { api, mocks } = makeMockStripeApi()
        const processor = createSeedStripePaymentProcessor({
            secretKey: 'sk_test_123',
            defaultPaymentMethod: 'pm_card_visa',
            stripeApi: api,
        })

        const paymentData = await buildSeedPaymentCreateData(
            {
                amountGross: 12000,
                platformFee: 1800,
                status: PaymentStatus.cancelled,
            },
            processor
        )

        expect(paymentData.stripePaymentIntentId).toBe('pi_mock_123')
        expect(mocks.paymentIntentsCancel).toHaveBeenCalledWith('pi_mock_123')
        expect(mocks.paymentIntentsCapture).not.toHaveBeenCalled()
        expect(mocks.refundsCreate).not.toHaveBeenCalled()
    })

    it('creates held and released payment data by capturing intent', async () => {
        for (const status of [PaymentStatus.held, PaymentStatus.released]) {
            const { api, mocks } = makeMockStripeApi()
            const processor = createSeedStripePaymentProcessor({
                secretKey: 'sk_test_123',
                defaultPaymentMethod: 'pm_card_visa',
                stripeApi: api,
            })

            const paymentData = await buildSeedPaymentCreateData(
                {
                    amountGross: 14000,
                    platformFee: 2100,
                    status,
                },
                processor
            )

            expect(paymentData.status).toBe(status)
            expect(paymentData.stripePaymentIntentId).toBe('pi_mock_123')
            expect(mocks.paymentIntentsCapture).toHaveBeenCalledWith('pi_mock_123')
            expect(mocks.paymentIntentsCancel).not.toHaveBeenCalled()
            expect(mocks.refundsCreate).not.toHaveBeenCalled()
        }
    })

    it('creates refunded payment data by capture then refund and wires refund id', async () => {
        const { api, mocks } = makeMockStripeApi()
        const processor = createSeedStripePaymentProcessor({
            secretKey: 'sk_test_123',
            defaultPaymentMethod: 'pm_card_visa',
            stripeApi: api,
        })

        const paymentData = await buildSeedPaymentCreateData(
            {
                amountGross: 17500,
                platformFee: 2625,
                refundedAmountCents: 17500,
                status: PaymentStatus.refunded,
            },
            processor
        )

        expect(paymentData.stripePaymentIntentId).toBe('pi_mock_123')
        expect(paymentData.stripeRefundId).toBe('re_mock_123')
        expect(paymentData.refundedAmountCents).toBe(17500)
        expect(mocks.paymentIntentsCapture).toHaveBeenCalledWith('pi_mock_123')
        expect(mocks.refundsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                payment_intent: 'pi_mock_123',
                amount: 17500,
            })
        )
    })
})
