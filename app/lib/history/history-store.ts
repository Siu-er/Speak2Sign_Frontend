export type ConversationRole = "speaker" | "signer";

export interface ConversationLine {
  role: ConversationRole;
  text: string;
  at: number;
}

export interface ConversationRecord {
  id: string;
  startedAt: number;
  lines: ConversationLine[];
}

const STORAGE_KEY = "s2s:history";

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): ConversationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConversationRecord[]) : [];
  } catch {
    return [];
  }
}

function write(records: ConversationRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  listeners.forEach((l) => l());
}

export function listConversations(): ConversationRecord[] {
  return read().sort((a, b) => b.startedAt - a.startedAt);
}

export function getConversation(id: string): ConversationRecord | undefined {
  return read().find((r) => r.id === id);
}

export function appendLine(
  session: { id: string; startedAt: number },
  line: ConversationLine,
): void {
  const records = read();
  const existing = records.find((r) => r.id === session.id);
  if (existing) {
    existing.lines.push(line);
  } else {
    records.push({ id: session.id, startedAt: session.startedAt, lines: [line] });
  }
  write(records);
}

export function deleteConversation(id: string): void {
  write(read().filter((r) => r.id !== id));
}

export function clearConversations(): void {
  write([]);
}

export function subscribeHistory(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** First non-empty line, truncated, used as a list title. */
export function conversationTitle(record: ConversationRecord): string {
  const first = record.lines.find((l) => l.text.trim());
  if (!first) return "Conversation";
  const t = first.text.trim();
  return t.length > 48 ? `${t.slice(0, 48)}...` : t;
}
