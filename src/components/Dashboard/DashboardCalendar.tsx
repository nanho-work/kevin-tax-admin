'use client';

import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import { EventInput } from '@fullcalendar/core';
import axios from 'axios';

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
      try {
        const [regular, single] = await Promise.all([
          fetchRegularTaxSchedules(),
          fetchSingleTaxSchedules()
        ]);

        const regularEvents: EventInput[] = regular.map((item: any) => ({
          id: `r-${item.id}`,
          title: `${item.company_name} - ${scheduleTypeMap[item.schedule_type] || item.schedule_type}`,
          start: item.due_date.split('T')[0],
          color: scheduleColorMap[item.schedule_type] || '#2563eb',
          textColor: 'black',
        }));

        const singleEvents: EventInput[] = single.map((item: any) => ({
          id: `s-${item.id}`,
          title: `[단발성] ${item.client_name} - ${scheduleTypeMap[item.schedule_type] || item.schedule_type}`,
          start: item.due_date.split('T')[0],
          color: '#FFDAC1',
          textColor: 'black',
        }));

        setEvents([...regularEvents, ...singleEvents]);
      } catch (error) {
        console.error('일정 불러오기 실패:', error);
      }
    };

    fetchAllSchedules();
  }, []);

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-xl font-bold mb-4">세무 일정 캘린더</h2>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        locale={koLocale}
        initialView="dayGridMonth"
        height="700px"
        headerToolbar={{
          left: '',
          center: 'title',
          right: 'prev today next',
        }}
        events={events}
        fixedWeekCount={false}
        showNonCurrentDates={false}
        dayMaxEventRows={3}
        dayHeaderClassNames="text-gray-700 font-semibold"
        eventContent={(arg) => {
          return {
            domNodes: [
              (() => {
                const container = document.createElement('div');
                container.style.fontSize = '0.85rem';
                container.style.whiteSpace = 'normal';
                container.textContent = arg.event.title;
                return container;
              })(),
            ],
          };
        }}
      />
    </div>
  );
}

// ✅ API 호출 함수들
async function fetchRegularTaxSchedules() {
  const res = await axios.get('/admin/tax-schedule/list');
  return res.data.items;
}

async function fetchSingleTaxSchedules() {
  const res = await axios.get('/admin/tax-schedule/singletax');
  return res.data.items;
}
