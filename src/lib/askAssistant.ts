export const ASK_ASSISTANT_EVENT = 'morvello:ask-assistant';

/** Ouvre l'assistant IA et lui pose directement la question (ex. depuis un contrat). */
export function askAssistant(prompt: string): void {
  if (typeof window === 'undefined' || !prompt.trim()) return;
  window.dispatchEvent(new CustomEvent(ASK_ASSISTANT_EVENT, { detail: { prompt } }));
}
