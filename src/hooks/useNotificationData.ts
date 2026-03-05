// hooks/useNotificationData.ts
import { useEffect, useState } from 'react';
import { fetchSingleTaxes } from '@/services/single_scheduleService';
import { NotificationItem } from '@/types/notification';

export function useNotificationData() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    useEffect(() => {
        const checkDueDates = async () => {
            try {
                const res = await fetchSingleTaxes(1, 100);
                const today = new Date();
                const filtered = res.items
                    .filter(item => item.due_date && item.status?.toUpperCase() !== 'DONE')
                    .map(item => {
                        if (!item.due_date) return null;
                        const due = new Date(item.due_date);
                        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                        if ([3, 2, 1, 0].includes(diff)) {
                            return {
                                id: item.id,
                                message: `${diff === 0 ? '오늘' : `${diff}일 후`} 일정: ${item.client_name} - ${item.title}`,
                                due_date: item.due_date,
                            };
                        }
                        return null;
                    })
                    .filter(Boolean) as NotificationItem[];

                setNotifications(filtered);
            } catch (e) {
                console.error('알림 로드 실패', e);
            }
        };

        checkDueDates();
        const interval = setInterval(checkDueDates, 1000 * 60 * 10); // 10분마다
        return () => clearInterval(interval);
    }, []);

    return notifications;
}