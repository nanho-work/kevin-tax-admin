"use client";

import { useState, useEffect } from "react";
import ChatRoomList from "@/components/gpt/ChatRoomList";
import ChatHeader from "@/components/gpt/ChatHeader";
import ChatMessageList from "@/components/gpt/ChatMessageList";
import ChatInput from "@/components/gpt/ChatInput";

import { ChatMessage, ChatRoom, SendMessageRequest } from "@/types/chat";
import { getMessages, sendMessage, getChatRoomList } from "@/services/chatService";

export default function GPTClient() {
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(false);

  const loadRoomInfo = async (id: number) => {
    const list = await getChatRoomList();
    const found = list.find((r) => r.id === id) || null;
    setRoom(found);
  };

  const loadMessages = async (id: number) => {
    const res = await getMessages(id);
    setMessages(res);
  };

  useEffect(() => {
    if (selectedRoomId) {
      void loadRoomInfo(selectedRoomId);
      void loadMessages(selectedRoomId);
    }
  }, [selectedRoomId]);

  // 🔥 ChatInput이 요구하는 타입에 맞춤: (data: SendMessageRequest)
  const handleSend = async (data: SendMessageRequest) => {
    if (!selectedRoomId) return;

    setLoading(true);
    try {
      await sendMessage(selectedRoomId, data);
      await loadMessages(selectedRoomId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[90vh]">
      <ChatRoomList
        selectedRoomId={selectedRoomId}
        onSelectRoom={setSelectedRoomId}
      />

      <div className="flex-1 flex flex-col">
        <ChatHeader room={room} />
        <ChatMessageList messages={messages} />
        <ChatInput onSend={handleSend} disabled={!selectedRoomId || loading} />
      </div>
    </div>
  );
}