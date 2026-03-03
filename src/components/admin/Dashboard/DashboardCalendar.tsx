'use client';

import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import { EventInput } from '@fullcalendar/core';

import { fetchTaxSchedules } from '@/services/admin/taxSchedulService';
import { fetchSingleTaxes } from '@/services/admin/single_scheduleService';

// ✅ 일정명 한글 변환
const scheduleTypeMap: Record<string, string> = {
  WITHHOLDING: '원천세',
  VAT: '부가세',
  INCOME_TAX: '소득세',
  CORPORATE_TAX: '법인세',
  INTERIM_TAX: '중간예납',
  양도세: '양도세',
  상속세: '상속세',
  증여세: '증여세',
  기타: '기타',
};

// ✅ 색상 매핑 (파스텔톤)
const scheduleColorMap: Record<string, string> = {
  WITHHOLDING: '#A5D8FF',
  VAT: '#FFE066',
  INCOME_TAX: '#FFA69E',
  CORPORATE_TAX: '#B5E48C',
  INTERIM_TAX: '#CDB4DB',
};

export default function DashboardCalendar() {
  const [events, setEvents] = useState<EventInput[]>([]);

  useEffect(() => {
    const fetchAllSchedules = async () => {
      const [regularResult, singleResult] = await Promise.allSettled([
        fetchTaxSchedules(),
        fetchSingleTaxes(1, 100),
      ]);

      if (regularResult.status === 'rejected') {
        console.warn('정기 일정 조회 실패');
      }
      if (singleResult.status === 'rejected') {
        console.warn('단발성 일정 조회 실패');
      }

      const regular = regularResult.status === 'fulfilled' ? regularResult.value : [];
      const singleRes = singleResult.status === 'fulfilled' ? singleResult.value : { items: [] };

      const regularEvents: EventInput[] = regular.map((item: any) => ({
          id: `r-${item.id}`,
          title: `${item.company_name} - ${scheduleTypeMap[item.schedule_type] || item.schedule_type}`,
          start: item.due_date.split('T')[0],
          color: scheduleColorMap[item.schedule_type] || '#2563eb',
          textColor: 'black',
      }));

      const singleEvents: EventInput[] = singleRes.items.map((item) => ({
          id: `s-${item.id}`,
          title: `[단발성] ${item.client_name} - ${scheduleTypeMap[item.schedule_type] || item.schedule_type}`,
          start: item.due_date?.split('T')[0],
          color: '#FFDAC1',
          textColor: 'black',
      }));

      const allEvents = [...regularEvents, ...singleEvents];
      setEvents(allEvents);
    };

    fetchAllSchedules();
  }, []);

  return (
    <div className="bg-white">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        locale={koLocale}
        initialView="dayGridMonth"
        height="800px"
        headerToolbar={{
          left: '',
          center: 'title',
          right: 'prev today next',
        }}
        events={events}
        fixedWeekCount={false}
        showNonCurrentDates={false}
        dayMaxEventRows={3}
      />
    </div>
  );
}
