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

export function checkModeration(texto: string): { blocked: boolean; reason?: string } {
  if (!texto || texto.trim().length === 0) return { blocked: false };
  const normalized = normalize(texto);
  const words = normalized.split(" ");
  for (const word of words) {
    if (BLOCKED_WORDS.has(word)) return { blocked: true, reason: "Conteúdo inapropriado detectado." };
  }
  for (const phrase of BLOCKED_WORDS) {
    if (phrase.includes(" ") && normalized.includes(normalize(phrase))) {
      return { blocked: true, reason: "Conteúdo inapropriado detectado." };
    }
  }
  return { blocked: false };
}

export function moderationResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Conteúdo inapropriado. Use linguagem profissional." }),
    { status: 422, headers: { "Content-Type": "application/json" } }
  );
}
