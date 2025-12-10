// src/types/chat.ts

export interface ChatRoom {
  id: number;
  admin_id: number;
  title: string;
  custom_prompt?: string | null;
  summary?: string | null;
  model: string;
  last_message_at?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  room_id: number;
  sender: "user" | "assistant";
  content: string;
  tokens?: number | null;
  created_at: string;
}

export interface CreateRoomRequest {
  title: string;
  custom_prompt?: string;
  model?: string;
}

export interface SendMessageRequest {
  message: string;
}