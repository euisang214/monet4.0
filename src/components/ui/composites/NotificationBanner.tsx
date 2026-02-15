import React from 'react';
import type { NotificationState } from '@/components/ui/hooks/useNotification';

interface NotificationBannerProps {
    notification: NotificationState | null;
}

export function NotificationBanner({ notification }: NotificationBannerProps) {
    if (!notification) return null;

    return (
        <div
            className={`p-4 mb-6 rounded-md text-sm ${notification.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
        >
            {notification.message}
        </div>
    );
}
