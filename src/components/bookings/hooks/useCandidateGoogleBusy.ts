'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { fetchCandidateGoogleBusyIntervals } from '@/components/bookings/services/candidateBookingApi';

interface UseCandidateGoogleBusyOptions {
    autoLoad?: boolean;
}

export function useCandidateGoogleBusy(options: UseCandidateGoogleBusyOptions = {}) {
    const { autoLoad = true } = options;
    const [googleBusyIntervals, setGoogleBusyIntervals] = useState<SlotInterval[]>([]);
    const [isLoadingBusy, setIsLoadingBusy] = useState(autoLoad);
    const [busyLoadError, setBusyLoadError] = useState<string | null>(null);
    const [lastBusyRefreshAt, setLastBusyRefreshAt] = useState<Date | null>(null);

    const refreshGoogleBusy = useCallback(async () => {
        setIsLoadingBusy(true);
        setBusyLoadError(null);

        try {
            const intervals = await fetchCandidateGoogleBusyIntervals();
            setGoogleBusyIntervals(intervals);
            setLastBusyRefreshAt(new Date());
        } catch (error: unknown) {
            if (error instanceof Error) {
                setBusyLoadError(error.message);
            } else {
                setBusyLoadError('Google Calendar data could not be loaded. You can still set availability.');
            }
        } finally {
            setIsLoadingBusy(false);
        }
    }, []);

    useEffect(() => {
        if (!autoLoad) {
            setIsLoadingBusy(false);
            return;
        }

        void refreshGoogleBusy();
    }, [autoLoad, refreshGoogleBusy]);

    return {
        googleBusyIntervals,
        isLoadingBusy,
        busyLoadError,
        lastBusyRefreshAt,
        refreshGoogleBusy,
    };
}
