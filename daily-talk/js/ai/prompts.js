// AI 에게 보내는 말 (설계서 「4-8」). 모델이 잘 따르도록 지시는 영어로, 사용자에게 보일 설명은 한국어로 받는다.
const LEVEL_EN = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' };
const LENGTH = {
  1: 'one short sentence (about 10 words at most) with very common, simple words',
  2: 'one or two natural sentences with everyday words',
  3: 'up to three natural sentences; idioms and natural phrasing are welcome',
};

// sit: { ko, en, scene, ai: {ko,en}, me: {ko,en}, custom }
export function talkSystem(sit, level) {
  const roles = sit.ai
    ? `You play: ${sit.ai.en} (${sit.ai.ko}). The learner plays: ${sit.me.en} (${sit.me.ko}).`
    : 'Choose the most fitting role for yourself; the learner is the person who needs something in this situation.';
  return [
    'You are a friendly conversation partner in an English speaking practice app for Korean adult learners.',
    `Role-play this situation: ${sit.en ? `${sit.en} — ` : ''}${sit.ko}.${sit.scene ? ` Scene: ${sit.scene}` : ''}`,
    roles,
    `Learner level: ${LEVEL_EN[level]}.`,
    'Rules:',
    '- Stay in character. Keep the conversation natural and moving: in most turns ask something or give the learner something to answer.',
    `- Each reply: ${LENGTH[level]}.`,
    '- Do NOT correct the learner and do not explain grammar or vocabulary. Just understand and reply naturally.',
    '- If the learner writes Korean or seems stuck, reply in simple English and keep going.',
    '- Reply with ONLY your spoken line: no quotation marks, no name labels, no stage directions, no emojis, no translation.',
    '- After about 8 to 12 exchanges you may bring the situation to a natural close.',
  ].join('\n');
}
export const START = '(Start the role-play now. Say your first line.)';

// 도움 — 한국어로 하고 싶은 말 → 영어 표현 2~3개
export function helpMessages(sit, level, lastAI, ko) {
  return [
    { role: 'system', content: 'You help a Korean adult learner say something in English during a role-play. Reply with ONLY a JSON object.' },
    { role: 'user', content: [
      `Situation: ${sit.en || ''} ${sit.ko}`.trim(),
      `Learner level: ${LEVEL_EN[level]} (${LENGTH[level]}).`,
      lastAI ? `The partner just said: "${lastAI}"` : 'The conversation has not started yet.',
      `The learner wants to say (in Korean): "${ko}"`,
      'Give 2 or 3 natural spoken English ways to say it that fit the situation and the level.',
      'JSON shape: {"options":[{"en":"English sentence","ko":"짧은 한국어 설명 (느낌 · 언제 쓰는지)"}]}',
    ].join('\n') },
  ];
}
export const helpOK = (j) => Array.isArray(j.options) && j.options.length > 0 && j.options.every((o) => o && typeof o.en === 'string' && o.en.trim());

// 대화 → 대본 글자 (A = AI, B = 나)
export const transcript = (messages) => messages.map((m) => `${m.role === 'ai' ? 'A' : 'B'}: ${m.text}`).join('\n');

// ① 교정본 대화 만들기
export function reviewMessages(sit, level, messages) {
  return [
    { role: 'system', content: 'You are a kind, precise English teacher for Korean adult learners. Reply with ONLY a JSON object.' },
    { role: 'user', content: [
      `Below is a role-play. A = conversation partner (AI), B = the learner. Learner level: ${LEVEL_EN[level]}.`,
      `Situation: ${sit.en || ''} ${sit.ko}`.trim(),
      '',
      transcript(messages),
      '',
      'Make a corrected version of this conversation for study:',
      '- Keep the same flow and the same turns in the same order. Keep A lines as they are (fix only clear errors).',
      "- For each B line, rewrite it as natural, correct spoken English at the learner's level, keeping what the learner meant.",
      '  If a B line is already natural, keep it unchanged. If it was Korean, write what the learner meant in English.',
      '- "mine": the learner\'s original B line, copied exactly. Only B lines have "mine" and "why".',
      '- "why": for a changed B line, one short Korean sentence explaining the main fix. Empty string if unchanged.',
      '- "ko": a natural Korean translation of the (corrected) line.',
      '- "expressions": 3 to 6 useful expressions from the corrected conversation, each with Korean meaning and a short Korean note.',
      '- "title": a short Korean title (20 characters or fewer). "scene": one Korean sentence describing the scene.',
      '- "roles": short Korean and English names for A and B (for example 호텔 직원 / Hotel clerk).',
      'JSON shape:',
      '{"title":"","scene":"","roles":{"A":{"ko":"","en":""},"B":{"ko":"","en":""}},',
      ' "lines":[{"role":"A","en":"","ko":""},{"role":"B","mine":"","en":"","ko":"","why":""}],',
      ' "expressions":[{"en":"","ko":"","note":""}]}',
    ].join('\n') },
  ];
}
export function reviewOK(j) {
  if (!Array.isArray(j.lines) || j.lines.length < 2) return false;
  if (!j.lines.every((l) => l && (l.role === 'A' || l.role === 'B') && typeof l.en === 'string' && l.en.trim())) return false;
  return j.lines.some((l) => l.role === 'B');
}

// ③ 다시 대화한 뒤 — 고친 표현을 실제로 썼는지
export function usedMessages(targets, mineLines) {
  return [
    { role: 'system', content: 'You check a Korean learner\'s English practice. Reply with ONLY a JSON object.' },
    { role: 'user', content: [
      'The learner studied these target sentences (corrected versions of what they said before):',
      ...targets.map((t, i) => `${i + 1}. ${t}`),
      '',
      'In a new conversation in the same situation, the learner said:',
      ...mineLines.map((t) => `- ${t}`),
      '',
      'For each target, decide whether the learner used it, or a natural equivalent with the same key point, in the new conversation.',
      'JSON shape: {"results":[{"i":1,"used":true,"note":"짧은 한국어 메모"}]}',
    ].join('\n') },
  ];
}
export const usedOK = (j) => Array.isArray(j.results) && j.results.every((r) => r && Number.isInteger(r.i) && typeof r.used === 'boolean');

// ── 자료로 학습 만들기 (설계서 「4-12」)
const SRC_HEAD = (text) => `--- MATERIAL START ---\n${text}\n--- MATERIAL END ---`;
const TEACHER = 'You are an expert English teacher who turns real-world material into study content for Korean adult learners. Reply with ONLY a JSON object.';

// 사진 → 글자
export const ocrMessages = (image) => [
  { role: 'user', content: [
    { type: 'text', text: 'Transcribe all readable text in this image exactly as written (keep the original language, line breaks and list order). For a menu or table, write one item per line. Do not add any explanation. If there is no readable text, reply with just: (no text)' },
    { type: 'image_url', image_url: { url: image } },
  ] },
];

// 2. AI 검토 — 자료 종류 · 요약 · 만들 수 있는 것
export function analyzeMessages(text, level) {
  return [
    { role: 'system', content: TEACHER },
    { role: 'user', content: [
      `Learner level: ${LEVEL_EN[level]}.`,
      SRC_HEAD(text),
      'Review the material and plan study content from it.',
      '- "type": one of "conversation" (dialogue, notice, guide, schedule, menu, email, interview questions, etc.), "paper" (English paper, report, article), "book" (English book excerpt: novel, essay, self-help…), "korean" (Korean-language paper, report or book), "other".',
      '- "typeKo": the type in Korean (예: 호텔 안내문, 영어 논문, 소설 일부, 한국어 보고서).',
      '- "summary": exactly 3 short Korean sentences summarizing the material.',
      '- "suitable": false only if the material is unusable for English practice (for example only legal clauses, only numbers, far too short). "reason": Korean explanation when false, else "".',
      '- "dialogues": 2 to 5 practical role-play ideas based on the material. For a paper or book, use ideas like explaining it to a colleague, Q&A after a presentation, a book club talk, recommending it to a friend, or acting out a scene. Each: {"title": Korean title ≤ 20 chars, "titleEn": English title, "desc": one Korean sentence: who talks with whom about what}.',
      '- "passage": true if an easy English summary and key-sentence reading practice make sense (papers, reports, articles, books, long Korean texts), else false.',
      '- "terms": up to 10 useful English expressions or terms from (or for) the material: {"en","ko"}.',
      'JSON shape: {"type":"","typeKo":"","summary":["","",""],"suitable":true,"reason":"","dialogues":[{"title":"","titleEn":"","desc":""}],"passage":false,"terms":[{"en":"","ko":""}]}',
    ].join('\n') },
  ];
}
export const analyzeOK = (j) => Array.isArray(j.summary) && Array.isArray(j.dialogues) && typeof j.type === 'string';

// 4-가. 대화 만들기 (데이터 형식 「2-4」 dialogue)
export function importDialogueMessages(text, idea, level, korean) {
  const lines = { 1: '8 to 10 lines; each line one short sentence', 2: '10 to 12 lines; one or two sentences each', 3: '12 to 14 lines; natural, varied sentences' }[level];
  return [
    { role: 'system', content: TEACHER },
    { role: 'user', content: [
      `Learner level: ${LEVEL_EN[level]}.`,
      SRC_HEAD(text),
      `Write one role-play dialogue for this idea: "${idea.titleEn || ''} / ${idea.title}" — ${idea.desc || ''}`,
      korean ? '- The material is Korean: write the dialogue in natural English that explains or uses its content.' : '- Reuse useful expressions, names, numbers and facts from the material where natural.',
      `- Two roles: A (the other person) and B (the learner). Start with A. ${lines}.`,
      "- For each B line add \"alt\": 1 to 2 other natural ways to say it at the same level.",
      '- "ko": natural Korean translation of every line.',
      '- "expressions": 3 to 6 key expressions used in the dialogue, with Korean meaning, a short Korean note, and "fromLine" = the line number (1-based) where it appears.',
      '- "title": {"ko": Korean title ≤ 20 chars, "en": English title}. "scene": {"ko": one Korean sentence}. "roles": {"A": {"ko","en"}, "B": {"ko","en"}}.',
      'JSON shape: {"title":{"ko":"","en":""},"scene":{"ko":""},"roles":{"A":{"ko":"","en":""},"B":{"ko":"","en":""}},"lines":[{"role":"A","en":"","ko":""},{"role":"B","en":"","ko":"","alt":[""]}],"expressions":[{"en":"","ko":"","note":"","fromLine":2}]}',
    ].join('\n') },
  ];
}
export function importDialogueOK(j) {
  return Array.isArray(j.lines) && j.lines.length >= 4 && j.lines.every((l) => l && (l.role === 'A' || l.role === 'B') && typeof l.en === 'string' && l.en.trim())
    && j.lines.some((l) => l.role === 'B');
}

// 4-나. 쉬운 영어 요약 + 용어 + 내용 퀴즈 (글 학습 passage)
export function summaryMessages(text, level, korean) {
  const n = { 1: '8 to 10 short, simple sentences', 2: '10 to 15 sentences', 3: '15 to 20 sentences, keeping academic phrasing' }[level];
  return [
    { role: 'system', content: TEACHER },
    { role: 'user', content: [
      `Learner level: ${LEVEL_EN[level]}.`,
      SRC_HEAD(text),
      korean
        ? `Write an English explanation of this Korean material that the learner could say aloud to introduce it: ${n}.`
        : `Rewrite the material as an easy English summary at the learner's level: ${n}. Keep the key facts and terms.`,
      '- "lines": one sentence per item, each with a natural Korean translation "ko".',
      '- "expressions": 5 to 12 key terms or useful (academic) expressions, each {"en","ko","note"} — note is a short Korean explanation or example.',
      '- "questions": 5 content questions in Korean-friendly form. Types: {"type":"ox","q":{"en","ko"},"answer":true|false}, {"type":"choice","q":{"en","ko"},"options":["","","",""],"answer":0-3}, {"type":"blank","q":{"en":"sentence with ___","ko":""},"answer":"missing word"}. Mix the types.',
      '- "title": {"ko": Korean title ≤ 24 chars starting with "요약 — ", "en": English title}.',
      'JSON shape: {"title":{"ko":"","en":""},"lines":[{"en":"","ko":""}],"expressions":[{"en":"","ko":"","note":""}],"questions":[]}',
    ].join('\n') },
  ];
}
export const passageOK = (j) => Array.isArray(j.lines) && j.lines.length >= 3 && j.lines.every((l) => l && typeof l.en === 'string' && l.en.trim());

// 4-다. 핵심 문장 따라 읽기 (원문 문장 그대로, 최대 10)
export function keySentenceMessages(text, level) {
  return [
    { role: 'system', content: TEACHER },
    { role: 'user', content: [
      `Learner level: ${LEVEL_EN[level]}.`,
      SRC_HEAD(text),
      `Pick 5 to 10 important sentences from the material for read-aloud practice. Copy them EXACTLY as written in the material. ${level === 1 ? 'Prefer shorter, clearer sentences.' : level === 3 ? 'Include sentences with typical academic or literary phrasing.' : ''}`,
      '- "lines": {"en": the exact sentence, "ko": natural Korean translation}.',
      '- "expressions": 3 to 8 notable expressions from those sentences, {"en","ko","note"}.',
      '- "title": {"ko": Korean title ≤ 24 chars starting with "핵심 문장 — ", "en": English title}.',
      'JSON shape: {"title":{"ko":"","en":""},"lines":[{"en":"","ko":""}],"expressions":[{"en":"","ko":"","note":""}]}',
    ].join('\n') },
  ];
}
