'use client';

import { useState, useCallback } from 'react';

export type NotificationType = 'success' | 'error';

export interface NotificationState {
    type: NotificationType;
    message: string;
}

export function useNotification() {
    const [notification, setNotification] = useState<NotificationState | null>(null);

    const notify = useCallback((type: NotificationType, message: string) => {
        setNotification({ type, message });
    }, []);

    const clear = useCallback(() => {
        setNotification(null);
    }, []);

    return { notification, notify, clear } as const;
}
