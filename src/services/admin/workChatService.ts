import { adminHttp } from '@/services/http'
import { createWorkChatApi, getWorkChatErrorMessage } from '@/services/workChatBase'

export const adminWorkChatApi = createWorkChatApi(adminHttp, '/admin')
export const getAdminWorkChatErrorMessage = getWorkChatErrorMessage

