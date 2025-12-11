// src/components/gpt/ChatMessageList.tsx
'use client';

import { useEffect, useRef } from "react";
import { ChatMessage } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DOMPurify from "isomorphic-dompurify";

interface Props {
  messages: ChatMessage[];
}

export default function ChatMessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-[#f7f7f8]">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex mb-4 ${
            msg.sender === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`rounded-lg px-4 py-2 max-w-[70%] shadow ${
              msg.sender === "user"
                ? "bg-blue-500 text-white"
                : "bg-white border"
            }`}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ node, ...props }) => (
                  <p className="prose prose-sm max-w-none break-words" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="prose prose-sm max-w-none break-words list-disc pl-4" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="prose prose-sm max-w-none break-words list-decimal pl-4" {...props} />
                ),
                h1: ({ node, ...props }) => <h1 className="text-xl font-bold" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-lg font-bold" {...props} />,
                h3: ({ node, ...props }) => <h3 className="font-bold" {...props} />,
                strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
              }}
            >
              {DOMPurify.sanitize(msg.content)}
            </ReactMarkdown>
            <div className="text-[10px] mt-1 opacity-70">
              {msg.created_at.split("T")[1]?.substring(0, 5)}
            </div>
          </div>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}