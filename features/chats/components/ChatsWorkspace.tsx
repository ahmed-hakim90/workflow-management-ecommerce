"use client";

import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChatsWorkspace({
  conversationId,
}: {
  conversationId?: string;
}) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Chats"
        description="WhatsApp conversations and customer replies."
      />

      <Card className="min-h-[calc(100dvh-14rem)]">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>
            {conversationId ? "Conversation" : "Inbox"}
          </CardTitle>
          <span className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-text-secondary)]">
            Preview
          </span>
        </CardHeader>
        <CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] text-[color:var(--color-text-secondary)]">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="max-w-md space-y-1">
            <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
              Chat workspace is not wired yet
            </p>
            <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
              The route is available and ready for the chat UI implementation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
