// 문장 비교 (설계서 「4-4」) — 채팅 입력 · 말하기(음성 인식 결과) · 카드 입력이 같이 쓴다.
//   정규화(대소문자 · 문장부호 · 굽은 따옴표 · 줄임말 · 숫자 · 돈 표기) → 단어 단위 맞춰 보기(편집 거리)
//   → right(맞음) · close(거의 맞음) · retry(다시)
const CONTRACTIONS = {
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "he's": 'he is', "she's": 'she is',
  "it's": 'it is', "that's": 'that is', "there's": 'there is', "here's": 'here is', "what's": 'what is',
  "where's": 'where is', "who's": 'who is', "how's": 'how is', "let's": 'let us',
  "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'can not', cannot: 'can not',
  "won't": 'will not', "wouldn't": 'would not', "shouldn't": 'should not', "couldn't": 'could not',
  "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not',
  "haven't": 'have not', "hasn't": 'has not', "hadn't": 'had not', "mustn't": 'must not',
  "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will', "he'll": 'he will',
  "she'll": 'she will', "it'll": 'it will', "that'll": 'that will', "there'll": 'there will',
  "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have',
  "i'd": 'i would', "you'd": 'you would', "we'd": 'we would', "they'd": 'they would', "he'd": 'he would', "she'd": 'she would',
  gonna: 'going to', wanna: 'want to', okay: 'ok', 'o.k.': 'ok',
};
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ARTICLES = new Set(['a', 'an', 'the']);

function numWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numWords(n % 100) : '');
  return String(n);
}

export function normalize(text) {
  let s = String(text).toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'").replace(/[“”]/g, '"')
    .replace(/\$(\d+)\.(\d\d)\b/g, (_, d, c) => `${d} dollars ${Number(c)} cents`)
    .replace(/\$(\d+)/g, '$1 dollars')
    .replace(/(\d+)\s*%/g, '$1 percent')
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/[-–—/]/g, ' ');
  const words = [];
  for (let w of s.split(/\s+/)) {
    w = w.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '').replace(/^'+|'+$/g, '');
    if (!w) continue;
    if (CONTRACTIONS[w]) { words.push(...CONTRACTIONS[w].split(' ')); continue; }
    if (/^\d+$/.test(w) && Number(w) < 1000) { words.push(...numWords(Number(w)).split(' ')); continue; }
    w = w.replace(/'s$/, 's').replace(/[^a-z0-9]/g, '');
    if (w) words.push(w);
  }
  return words;
}

// 철자 거리 (인접 바꿈 포함)
function dist(a, b) {
  const m = a.length; const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}
// 두 글자 이하는 오타로 봐주지 않는다(by ↔ my 처럼 뜻이 바뀜), 3~4글자는 1자, 5글자 이상은 2자까지
const typoOk = (want, got) => {
  const lim = want.length <= 2 ? 0 : want.length <= 4 ? 1 : 2;
  const k = dist(want, got);
  return k > 0 && k <= lim;
};

// 단어 단위 맞춰 보기 — 목표 단어마다 ok · typo · wrong · missing, 그리고 덧붙인 단어(extra)
function align(target, got) {
  const m = target.length; const n = got.length;
  const cost = (i, j) => (target[i] === got[j] ? 0 : typoOk(target[i], got[j]) ? 0.4 : 1);
  const D = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) D[i][0] = i;
  for (let j = 1; j <= n; j++) D[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + cost(i - 1, j - 1));
  const words = []; const extra = [];
  let i = m; let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + cost(i - 1, j - 1)) {
      const c = cost(i - 1, j - 1);
      words.unshift({ w: target[i - 1], got: got[j - 1], status: c === 0 ? 'ok' : c < 1 ? 'typo' : 'wrong' });
      i--; j--;
    } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) {
      words.unshift({ w: target[i - 1], status: 'missing' }); i--;
    } else { extra.unshift(got[j - 1]); j--; }
  }
  return { words, extra };
}

function judge(words, extra, { speech }) {
  const n = words.length || 1;
  const ok = words.filter((w) => w.status === 'ok').length;
  const typos = words.filter((w) => w.status === 'typo').length;
  const bad = words.filter((w) => w.status === 'wrong').length;
  const missing = words.filter((w) => w.status === 'missing');
  const score = (ok + typos * 0.7) / Math.max(n, n + extra.length * 0.5);
  if (ok === words.length && extra.length === 0) return { verdict: 'right', score: 1 };
  if (speech) {                                    // 음성 인식은 비슷한 소리로 바꿔 적곤 해서 조금 너그럽게
    if (bad + missing.length === 0 && extra.length <= 1) return { verdict: 'right', score };
    return { verdict: score >= 0.8 ? 'close' : 'retry', score };
  }
  const missArticles = missing.filter((w) => ARTICLES.has(w.w)).length;
  const closeEnough = bad === 0 && typos <= 2 && missing.length - missArticles === 0 && missArticles <= 1 && extra.length <= 1;
  return { verdict: closeEnough ? 'close' : 'retry', score };
}

// answers: [목표 문장, ...허용 답안] — 가장 가까운 것과 비교
export function compare(input, answers, opts = {}) {
  const got = normalize(input);
  let best = null;
  for (const ans of answers) {
    const target = normalize(ans);
    const { words, extra } = align(target, got);
    const j = judge(words, extra, opts);
    const r = { ...j, answer: ans, words, extra };
    const rank = { right: 2, close: 1, retry: 0 };
    if (!best || rank[r.verdict] > rank[best.verdict] || (rank[r.verdict] === rank[best.verdict] && r.score > best.score)) best = r;
  }
  return best;
}

// 초급용 단어 블록 — 목표 문장을 단어로 나눠 섞는다 (문장부호는 단어에 붙여 둠)
export function wordBlocks(sentence) {
  const blocks = sentence.split(/\s+/).filter(Boolean);
  const shuffled = blocks.slice();
  for (let k = 0; k < 6 && shuffled.join(' ') === blocks.join(' ') && blocks.length > 1; k++) {
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  }
  return shuffled;
}

// 중급용 첫 글자 힌트 — «Y__. I h___ a r__________ u____ K__.»
export function firstLetters(sentence) {
  return sentence.replace(/[A-Za-z]+/g, (w) => w[0] + '_'.repeat(w.length - 1));
}
