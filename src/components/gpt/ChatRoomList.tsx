// src/components/gpt/ChatRoomList.tsx
'use client';

import { useEffect, useState } from "react";
import { ChatRoom } from "@/types/chat";
import { getChatRoomList, createChatRoom } from "@/services/chatService";

interface Props {
  selectedRoomId: number | null;
  onSelectRoom: (roomId: number) => void;
}

export default function ChatRoomList({ selectedRoomId, onSelectRoom }: Props) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");

  const loadRooms = async () => {
    const res = await getChatRoomList();
    setRooms(res);
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleCreateRoom = async () => {
    if (!title.trim()) return alert("대화방명을 입력해주세요.");

    const room = await createChatRoom({
      title,
      custom_prompt: prompt || undefined,
    });

    setIsModalOpen(false);
    setTitle("");
    setPrompt("");

    await loadRooms();
    onSelectRoom(room.id);
  };

  return (
    <div className="w-64 border-r bg-gray-50 flex flex-col h-full relative">
      {/* 헤더 */}
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-bold text-lg">채팅방</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-2 py-1 text-sm bg-blue-500 text-white rounded"
        >
          + 새 대화
        </button>
      </div>

      {/* 방 리스트 */}
      <ul className="flex-1 overflow-y-auto">
        {rooms.map((room) => (
          <li
            key={room.id}
            className={`p-3 cursor-pointer border-b hover:bg-gray-100 ${
              selectedRoomId === room.id ? "bg-blue-100" : ""
            }`}
            onClick={() => onSelectRoom(room.id)}
          >
            <div className="font-semibold text-gray-800">{room.title}</div>
            <div className="text-xs text-gray-500">
              {room.last_message_at?.split("T")[0]}
            </div>
          </li>
        ))}
      </ul>

      {/* 🔥 새 대화방 생성 모달 (컴포넌트 분리 없이 이 파일 안에서 처리) */}
      {isModalOpen && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white w-72 rounded-lg shadow-lg p-5">
            <h3 className="text-lg font-bold mb-3">새 대화방 만들기</h3>

            {/* 대화방명 */}
            <label className="text-sm text-gray-700">대화방명</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm mb-3"
              placeholder="예: 회계 문의방"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            {/* custom_prompt */}
            <label className="text-sm text-gray-700">대화 스타일 (선택)</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm mb-4"
              placeholder="예: 세무사처럼 대화 진행"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            {/* 버튼들 */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1 rounded border"
              >
                취소
              </button>
              <button
                onClick={handleCreateRoom}
                className="px-3 py-1 rounded bg-blue-600 text-white"
              >
                생성하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}