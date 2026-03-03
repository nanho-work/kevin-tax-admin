// src/services/chatService.ts

import http, { getAccessToken } from '@/services/http';
import {
  ChatRoom,
  ChatMessage,
  CreateRoomRequest,
  SendMessageRequest,
} from "@/types/chat";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// 토큰 공통 처리
function getAuthHeader() {
  const token = getAccessToken() || '';
  return { Authorization: `Bearer ${token}` };
}

/**
 * 1) 채팅방 생성
 */
export async function createChatRoom(data: CreateRoomRequest): Promise<ChatRoom> {
  const response = await http.post<ChatRoom>(
    `${BASE}/admin/chat/rooms`,
    data,
    { headers: getAuthHeader() }
  );
  return response.data;
}

/**
 * 2) 내 채팅방 목록 조회
 */
export async function getChatRoomList(): Promise<ChatRoom[]> {
  const response = await http.get<ChatRoom[]>(
    `${BASE}/admin/chat/rooms`,
    { headers: getAuthHeader() }
  );
  return response.data;
}

/**
 * 3) 특정 채팅방 메시지 목록 조회
 * limit=50 (기본값)
 */
export async function getMessages(
  roomId: number
): Promise<ChatMessage[]> {
  const response = await http.get<ChatMessage[]>(
    `${BASE}/admin/chat/rooms/${roomId}/messages`,
    { headers: getAuthHeader() }
  );
  return response.data;
}

/**
 * 4) 메시지 전송 → GPT → DB 저장 → 응답 반환
 */
export async function sendMessage(
  roomId: number,
  data: SendMessageRequest
): Promise<ChatMessage> {
  const response = await http.post<ChatMessage>(
    `${BASE}/admin/chat/rooms/${roomId}/messages`,
    data,
    { headers: getAuthHeader() }
  );
  return response.data;
}
