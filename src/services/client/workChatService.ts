import { clientHttp } from '@/services/http'
import { createWorkChatApi, getWorkChatErrorMessage } from '@/services/workChatBase'

export const clientWorkChatApi = createWorkChatApi(clientHttp, '/client')
export const getClientWorkChatErrorMessage = getWorkChatErrorMessage

