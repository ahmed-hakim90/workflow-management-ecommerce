import { ChatsWorkspace } from "@/features/chats/components/ChatsWorkspace";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <ChatsWorkspace conversationId={conversationId} />;
}
