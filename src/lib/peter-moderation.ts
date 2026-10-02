// Lista de palavras bloqueadas (PT-BR) — expansível
const BLOCKED_WORDS = new Set([
  "idiota", "imbecil", "burro", "estupido", "cretino", "babaca", "otario",
  "palhaco", "inutil", "incompetente", "retardado", "debil",
  "merda", "bosta", "porra", "caralho", "foda", "fodase", "foda-se",
  "cu", "buceta", "pau", "puta", "prostituta", "viado", "bicha",
  "filho da puta", "filha da puta", "sua mae", "cuzao",
  "faggot", "nigger", "bastard", "asshole", "bitch", "fuck", "shit",
  "m3rda", "p0rra", "f0da",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ModerationResult {
  blocked: boolean;
  reason?: string;
}

export function moderarEntrada(texto: string): ModerationResult {
  if (!texto || texto.trim().length === 0) return { blocked: false };
  const normalized = normalize(texto);
  const words = normalized.split(" ");
  for (const word of words) {
    if (BLOCKED_WORDS.has(word)) {
      return { blocked: true, reason: "Sua mensagem contém linguagem inapropriada. Por favor, reformule com linguagem profissional." };
    }
  }
  for (const phrase of BLOCKED_WORDS) {
    if (phrase.includes(" ") && normalized.includes(normalize(phrase))) {
      return { blocked: true, reason: "Sua mensagem contém linguagem inapropriada. Por favor, reformule com linguagem profissional." };
    }
  }
  return { blocked: false };
}
