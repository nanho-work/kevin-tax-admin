// src/components/gpt/ChatHeader.tsx
'use client';

import { ChatRoom } from "@/types/chat";

interface Props {
  room: ChatRoom | null;
}

export default function ChatHeader({ room }: Props) {
  return (
    <div className="border-b p-4 bg-white">
      <h1 className="text-xl font-semibold text-gray-800">
        {room ? room.title : "채팅을 선택하세요"}
      </h1>
    </div>
  );
}