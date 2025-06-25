'use client'

import React, { useEffect, useState } from 'react'
import { fetchTaxSchedules } from '@/services/taxSchedulService'
import type { TaxSchedule } from '@/types/taxSchedule'
import DashboardCalendar from '@/components/Dashboard/DashboardCalendar'

export default function DashboardPage() {
    const [schedules, setSchedules] = useState<TaxSchedule[]>([])

    useEffect(() => {
        fetchTaxSchedules()
            .then(setSchedules)
            .catch(console.error)
    }, [])

    return (
        <main className="min-h-screen p-6 bg-gray-50 text-gray-900">
            <DashboardCalendar />
            <ul className="mt-6 space-y-2">
                {schedules.map(schedule => (
                    <li key={schedule.id} className="p-4 bg-white rounded shadow">
                        <div className="font-semibold">{schedule.company_name}</div>
                        <div className="text-sm text-gray-500">
                            {schedule.schedule_type} | {new Date(schedule.due_date).toLocaleDateString()}
                        </div>
                    </li>
                ))}
            </ul>
        </main>
    )
}