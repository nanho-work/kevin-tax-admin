// src/components/gpt/ChatInput.tsx
'use client';

import { useState, useEffect, useRef } from "react";
import { SendMessageRequest } from "@/types/chat";

interface Props {
  onSend: (data: SendMessageRequest) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleSend = () => {
    if (!value.trim()) return;
    onSend({ message: value });
    setValue("");
  };

  return (
    <div className="p-4 border-t bg-white flex gap-2">
      <input
        ref={inputRef}
        className="flex-1 border rounded px-3 py-2"
        placeholder="메시지를 입력하세요…"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
      />
      <button
        onClick={handleSend}
        disabled={disabled}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
      >
        {disabled ? "전송중…" : "전송"}
      </button>
    </div>
  );
}