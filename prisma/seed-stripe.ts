import { PaymentStatus } from '@prisma/client'
import Stripe from 'stripe'

export type SeedStripePaymentStage = 'authorized' | 'cancelled' | 'held' | 'released' | 'refunded'

export interface StripeSeedEnv {
    stripeTestSecretKey: string
    defaultPaymentMethod: string
}

export interface SeedStripeCounters {
    paymentIntentsCreated: number
    paymentIntentsConfirmed: number
    paymentIntentsCaptured: number
    paymentIntentsCancelled: number
    refundsCreated: number
}

export interface SeedStripePaymentResult {
    paymentIntentId: string
    refundId?: string
}

export interface StripeSeedApi {
    paymentIntents: Pick<Stripe.PaymentIntentsResource, 'create' | 'capture' | 'cancel'>
    refunds: Pick<Stripe.RefundsResource, 'create'>
}

export interface SeedStripePaymentProcessor {
    createPaymentIntentForStage: (input: {
        amountCents: number
        stage: SeedStripePaymentStage
        metadata?: Record<string, string>
        refundAmountCents?: number
    }) => Promise<SeedStripePaymentResult>
    getCounters: () => SeedStripeCounters
}

export interface SeedPaymentCreateDataInput {
    amountGross: number
    platformFee: number
    status: PaymentStatus
    refundedAmountCents?: number
    metadata?: Record<string, string>
}

export interface SeedPaymentCreateData {
    amountGross: number
    platformFee: number
    refundedAmountCents?: number
    stripePaymentIntentId: string
    stripeRefundId?: string
    status: PaymentStatus
}

function normalizeEnvValue(rawValue: string | undefined): string | undefined {
    const trimmed = rawValue?.trim()
    if (!trimmed) return undefined

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        const unquoted = trimmed.slice(1, -1).trim()
        return unquoted || undefined
    }

    return trimmed
}

export function validateStripeSeedEnv(env: NodeJS.ProcessEnv = process.env): StripeSeedEnv {
    const stripeTestSecretKey = normalizeEnvValue(env.STRIPE_TEST_SECRET_KEY)

    if (!stripeTestSecretKey) {
        throw new Error('Missing required environment variable STRIPE_TEST_SECRET_KEY for seed Stripe calls.')
    }

    if (!stripeTestSecretKey.startsWith('sk_test_')) {
        throw new Error('STRIPE_TEST_SECRET_KEY must be a Stripe test key (sk_test_...).')
    }

    const defaultPaymentMethod = normalizeEnvValue(env.STRIPE_TEST_DEFAULT_PAYMENT_METHOD) || 'pm_card_visa'

    return {
        stripeTestSecretKey,
        defaultPaymentMethod,
    }
}

export function mapPaymentStatusToSeedStage(status: PaymentStatus): SeedStripePaymentStage {
    switch (status) {
        case PaymentStatus.authorized:
            return 'authorized'
        case PaymentStatus.cancelled:
            return 'cancelled'
        case PaymentStatus.held:
            return 'held'
        case PaymentStatus.released:
            return 'released'
        case PaymentStatus.refunded:
            return 'refunded'
        default:
            throw new Error(`Unsupported PaymentStatus for seed Stripe lifecycle: ${status}`)
    }
}

export function createSeedStripePaymentProcessor(options: {
    secretKey: string
    defaultPaymentMethod: string
    stripeApi?: StripeSeedApi
}): SeedStripePaymentProcessor {
    const stripeApi: StripeSeedApi = options.stripeApi || new Stripe(options.secretKey, { typescript: true })
    const counters: SeedStripeCounters = {
        paymentIntentsCreated: 0,
        paymentIntentsConfirmed: 0,
        paymentIntentsCaptured: 0,
        paymentIntentsCancelled: 0,
        refundsCreated: 0,
    }

    async function createPaymentIntentForStage(input: {
        amountCents: number
        stage: SeedStripePaymentStage
        metadata?: Record<string, string>
        refundAmountCents?: number
    }): Promise<SeedStripePaymentResult> {
        if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
            throw new Error(`Invalid amountCents for Stripe seed payment: ${input.amountCents}`)
        }

        const paymentIntent = await stripeApi.paymentIntents.create({
            amount: input.amountCents,
            currency: 'usd',
            capture_method: 'manual',
            confirm: true,
            payment_method: options.defaultPaymentMethod,
            payment_method_types: ['card'],
            metadata: input.metadata,
        })
        counters.paymentIntentsCreated += 1
        counters.paymentIntentsConfirmed += 1

        if (paymentIntent.status !== 'requires_capture') {
            throw new Error(
                `Expected PaymentIntent ${paymentIntent.id} to be requires_capture after confirm; got ${paymentIntent.status}`
            )
        }

        if (input.stage === 'authorized') {
            return { paymentIntentId: paymentIntent.id }
        }

        if (input.stage === 'cancelled') {
            await stripeApi.paymentIntents.cancel(paymentIntent.id)
            counters.paymentIntentsCancelled += 1
            return { paymentIntentId: paymentIntent.id }
        }

        await stripeApi.paymentIntents.capture(paymentIntent.id)
        counters.paymentIntentsCaptured += 1

        if (input.stage === 'held' || input.stage === 'released') {
            return { paymentIntentId: paymentIntent.id }
        }

        const refund = await stripeApi.refunds.create({
            payment_intent: paymentIntent.id,
            amount: input.refundAmountCents,
            reason: 'requested_by_customer',
        })
        counters.refundsCreated += 1

        return { paymentIntentId: paymentIntent.id, refundId: refund.id }
    }

    return {
        createPaymentIntentForStage,
        getCounters: () => ({ ...counters }),
    }
}

export async function buildSeedPaymentCreateData(
    input: SeedPaymentCreateDataInput,
    paymentProcessor: SeedStripePaymentProcessor
): Promise<SeedPaymentCreateData> {
    const stage = mapPaymentStatusToSeedStage(input.status)
    const isRefunded = input.status === PaymentStatus.refunded
    const refundedAmountCents = isRefunded ? (input.refundedAmountCents ?? input.amountGross) : undefined

    if (isRefunded && refundedAmountCents !== input.amountGross) {
        throw new Error(
            `Seed supports only full refunds for PaymentStatus.refunded. Got refundedAmountCents=${refundedAmountCents}, amountGross=${input.amountGross}`
        )
    }

    const stripeResult = await paymentProcessor.createPaymentIntentForStage({
        amountCents: input.amountGross,
        stage,
        metadata: input.metadata,
        refundAmountCents: refundedAmountCents,
    })

    const base: SeedPaymentCreateData = {
        amountGross: input.amountGross,
        platformFee: input.platformFee,
        status: input.status,
        stripePaymentIntentId: stripeResult.paymentIntentId,
    }

    if (!isRefunded) {
        return base
    }

    if (!stripeResult.refundId) {
        throw new Error(`Refunded payment for PI ${stripeResult.paymentIntentId} did not return stripeRefundId.`)
    }

    return {
        ...base,
        refundedAmountCents,
        stripeRefundId: stripeResult.refundId,
    }
}
