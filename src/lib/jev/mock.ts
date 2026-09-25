/**
 * A stand-in for the Jev API, used when no API key is set. It plugs into the
 * SDK's `fetch` option, so the SDK, the request builder and the response
 * handling all run exactly as they do against the live API.
 *
 * It reads only what the real API receives: the question text and each
 * choice's description. Its answers are deterministic for a given position.
 */

type WireQuestion = {
  type: "choice" | "score" | "noul";
  instructions?: unknown;
  criteria?: Record<string, unknown> | unknown[] | null;
};

type WireRequest = {
  model?: string;
  state?: unknown;
  questions?: Record<string, WireQuestion>;
};

export type MockOptions = {
  /** Answer every request with this HTTP status instead, to exercise error handling. */
  failWithStatus?: number;
};

export const MOCK_MODEL = "jev-mock";

const CAPTURE_VALUE: Record<string, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9 };

function scoreDescription(description: string, style: string): number {
  const text = description.toLowerCase();
  let score = 0;
  if (text.includes("delivers checkmate")) score += 100;
  else if (text.includes("gives check")) score += /aggressive|forcing/.test(style) ? 4 : 2;
  const capture = /captures a (\w+)/.exec(text);
  if (capture) score += (CAPTURE_VALUE[capture[1]!] ?? 1) * (/forcing|material/.test(style) ? 2 : 1.5);
  const promotion = /promotes to a (\w+)/.exec(text);
  if (promotion) score += CAPTURE_VALUE[promotion[1]!] ?? 3;
  if (text.includes("castles")) score += /safe|positionally/.test(style) ? 3 : 1.5;
  if (/^(knight|bishop) from [a-h][18]/.test(text)) score += 0.8;
  if (/^knight from \w+ to [ah]/.test(text)) score -= 1.2;
  if (/^pawn from [a-h][27] to [de][45]/.test(text)) score += 1.2;
  if (/^pawn from [a-h][27] to [cf][45]/.test(text)) score += 0.3;
  if (text.startsWith("king from")) score -= 1;

  // Safety notes: avoid giving material away, less so when told to take risks.
  const taken = /can be taken by a (\w+)( and is not defended)?/.exec(text);
  if (taken) {
    const moved = CAPTURE_VALUE[/^(\w+) from/.exec(text)?.[1] ?? ""] ?? 0;
    const loss = taken[2] ? moved : Math.max(0, moved - (CAPTURE_VALUE[taken[1]!] ?? moved));
    score -= loss * (/aggressive/.test(style) ? 0.5 : 1);
  }

  // Hybrid mode: Stockfish's notes. Its evaluation dominates; personality only tips the balance.
  const evaluation = /stockfish evaluation for you: ([+-]\d+(?:\.\d+)?) pawns/.exec(text);
  if (evaluation) score += Math.max(-10, Math.min(10, Number(evaluation[1]))) * 2;
  if (text.includes("stockfish sees mate in")) score += 50;
  if (text.includes("getting mated")) score -= 50;
  const rank = /stockfish's choice #(\d+)/.exec(text);
  if (rank) score += Math.max(0, 5 - Number(rank[1])) * 0.2;
  return score;
}

/** A small, stable hash so the same position always gets the same answer. */
function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) / 4294967295;
}

function answerChoice(question: WireQuestion, seed: string) {
  const criteria = (question.criteria ?? {}) as Record<string, unknown>;
  const labels = Object.keys(criteria);
  const style = String(question.instructions ?? "").toLowerCase();
  const scores = labels.map(
    (label) => scoreDescription(String(criteria[label] ?? ""), style) + hash(seed + label),
  );
  const max = Math.max(...scores);
  // A sharp distribution, closer to how a confident model answers.
  const exps = scores.map((score) => Math.exp((score - max) / 0.4));
  const total = exps.reduce((sum, value) => sum + value, 0);
  const probabilities: Record<string, number> = {};
  labels.forEach((label, i) => (probabilities[label] = exps[i]! / total));
  const best = labels[scores.indexOf(max)]!;
  return { type: "choice", choice: best, confidence: probabilities[best]!, probabilities };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * A score question, read as "who stands better": the material balance picks
 * the level, three points of material to a level, and the neighbouring levels
 * share some probability, as the live API's answers do.
 */
function answerScore(question: WireQuestion, state: Record<string, unknown>) {
  const levels = Array.isArray(question.criteria) ? question.criteria : [];
  const top = Math.max(1, levels.length - 1);
  const balance = Number(state.material_balance_for_white ?? 0) || 0;
  const centre = Math.min(top, Math.max(0, top / 2 + balance / 3));
  const weights = levels.map((_, level) => Math.exp(-((level - centre) ** 2) / 0.5));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const probabilities: Record<string, number> = {};
  const legend: Record<string, unknown> = {};
  let score = 0;
  let best = 0;
  levels.forEach((description, level) => {
    const probability = weights[level]! / total;
    probabilities[level] = round2(probability);
    legend[level] = description;
    score += level * probability;
    if (probability > weights[best]! / total) best = level;
  });
  return { type: "score", score: round2(score), confidence: probabilities[best] ?? 0, legend, probabilities };
}

/**
 * A yes or no question, read as a draw offer: accept when behind, decline when
 * level or ahead. Stockfish's evaluation, when given, counts instead of material,
 * and a style that "rarely accepts" leans towards no.
 */
function answerDrawOffer(question: WireQuestion, state: Record<string, unknown>) {
  const style = String(question.instructions ?? "").toLowerCase();
  const evaluation = /([+-]\d+(?:\.\d+)?) pawns/.exec(String(state.stockfish_evaluation_for_you ?? ""));
  const advantage = evaluation ? Number(evaluation[1]) : Number(state.material_balance_for_you ?? 0) || 0;
  const lean = /rarely accept/.test(style) ? -1 : /accept when the position is level/.test(style) ? 1 : 0;
  const noul = 1 / (1 + Math.exp(advantage * 1.5 + 0.8 - lean));
  return { type: "noul", noul: round2(noul) };
}

export function createMockFetch(options: MockOptions = {}) {
  return async (_url: string, init?: RequestInit): Promise<Response> => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", "x-typesafe-request-id": "mock" },
      });

    if (options.failWithStatus) {
      return json({ error: { message: "Mock failure" } }, options.failWithStatus);
    }

    const request = JSON.parse(String(init?.body ?? "{}")) as WireRequest;
    const seed = JSON.stringify(request.state ?? "");
    const answers: Record<string, unknown> = {};
    const state = (typeof request.state === "object" && request.state !== null ? request.state : {}) as Record<
      string,
      unknown
    >;
    for (const [name, question] of Object.entries(request.questions ?? {})) {
      if (question.type === "choice") answers[name] = answerChoice(question, seed);
      else if (question.type === "noul") answers[name] = answerDrawOffer(question, state);
      else answers[name] = answerScore(question, state);
    }
    return json({
      model: MOCK_MODEL,
      answers,
      usage: { input_tokens: Math.ceil(String(init?.body ?? "").length / 4), output_tokens: 1 },
    });
  };
}
