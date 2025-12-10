// app/(protected)/gpt/page.tsx

import { useState, useEffect } from "react";
import ChatRoomList from "@/components/gpt/ChatRoomList";
import ChatHeader from "@/components/gpt/ChatHeader";
import ChatMessageList from "@/components/gpt/ChatMessageList";
import ChatInput from "@/components/gpt/ChatInput";

import { ChatMessage, ChatRoom } from "@/types/chat";
import { getMessages, sendMessage, getChatRoomList } from "@/services/chatService";

export default function GPTPage() {
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
      loadRoomInfo(selectedRoomId);
      loadMessages(selectedRoomId);
    }
  }, [selectedRoomId]);

  const handleSend = async ({ message }: { message: string }) => {
    if (!selectedRoomId) return;

    setLoading(true);
    const reply = await sendMessage(selectedRoomId, { message });
    await loadMessages(selectedRoomId);
    setLoading(false);
  };

  return (
    <div className="flex h-[90vh]">
      <ChatRoomList selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />

      {/* 우측 컨텐츠 */}
      <div className="flex-1 flex flex-col">
        <ChatHeader room={room} />
        <ChatMessageList messages={messages} />
        <ChatInput onSend={handleSend} disabled={!selectedRoomId || loading} />
      </div>
    </div>
  );
}