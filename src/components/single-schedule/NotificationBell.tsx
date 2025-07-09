// components/NotificationBell.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useNotificationData } from '@/hooks/useNotificationData';


export default function NotificationBell() {
  const notifications = useNotificationData();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null); // 🔹 외부 클릭 감지용 ref

  // 🔸 외부 클릭 시 닫히도록 useEffect
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 알림 아이콘 */}
      <button
        onClick={() => setOpen(!open)}
        className="relative focus:outline-none hover:scale-105 transition-transform duration-200"
      >
        <span className="text-2xl">🔔</span>
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow">
            {notifications.length}
          </span>
        )}
      </button>

      {/* 알림 목록 */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-50 animate-fade-in">
          <ul className="p-3 space-y-2">
            {notifications.length === 0 ? (
              <li className="text-gray-400 text-sm text-center py-4">🔕 새 알림이 없습니다.</li>
            ) : (
              notifications.map(n => (
                <li
                  key={n.id}
                  className="text-sm px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 hover:bg-blue-50 transition-colors duration-150"
                >
                  <div className="font-medium text-gray-800">{n.client_name}</div>
                  <div className="text-xs text-gray-500">{n.message}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{new Date(n.due_date).toLocaleString()}</div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}