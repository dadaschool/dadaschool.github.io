// 설정 — 학습 · 🤖 AI · 저장 공간 · 백업 · ⬆ 업그레이드(맨 아래) (설계서 「3-1」 · 「4-11」 · 「5-3」 · 「5-9」)
import { h, toast, fmtBytes, fill } from '../ui.js';
import { settings, setSetting, ALL_DOMAINS } from '../settings.js';
import { loadSituations, LEVEL_KO, ROOT, dialogueId } from '../content.js';
import { entries, exportAll, importAll } from '../db.js';
import { audioUsage, deleteAudio, cleanupAudio } from '../storage.js';
import { MODES } from '../modes.js';
import * as up from '../upgrade.js';
import * as ai from '../ai/providers.js';
import { VERSION } from '../version.js';

function seg(name, value, options, onChange) {
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name },
    options.map(([v, label]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === value),
      onclick: async (e) => {
        for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-checked', 'false');
        e.currentTarget.setAttribute('aria-checked', 'true');
        await onChange(v);
      } }, label)));
}

const row = (label, control, note) => h('div', { class: 'set-row' },
  h('div', { class: 'set-label' }, h('b', {}, label), note ? h('small', {}, note) : null), control);

// 🤖 AI — 회사별 키 · 모델 이름 · 순서 · 연결 시험 (설계서 「5-3」). 바꾸면 바로 저장한다.
async function aiSection() {
  const c = await ai.loadAI();
  const list = h('ol', { class: 'ai-list' });
  const save = () => ai.saveAI(c);
  const move = (id, dir) => {
    const i = c.order.indexOf(id); const j = i + dir;
    if (j < 0 || j >= c.order.length) return;
    [c.order[i], c.order[j]] = [c.order[j], c.order[i]];
    save(); draw();
  };
  const draw = () => fill(list, c.order.map((id, idx) => {
    const p = ai.byId(id);
    const has = !!(c.keys[id] || '').trim();
    const status = p.relay ? '준비 중' : !has ? '키 없음' : c.off[id] ? '쉬는 중' : '✓ 씀';
    const head = h('div', { class: 'ai-head' },
      h('span', { class: 'ai-n' }, idx + 1),
      h('b', {}, p.name),
      h('span', { class: `ai-st${has && !c.off[id] && !p.relay ? ' on' : ''}` }, status),
      h('span', { class: 'ai-move' },
        h('button', { type: 'button', class: 'btn ghost small', disabled: idx === 0, 'aria-label': `${p.name} 위로`, onclick: () => move(id, -1) }, '▲'),
        h('button', { type: 'button', class: 'btn ghost small', disabled: idx === c.order.length - 1, 'aria-label': `${p.name} 아래로`, onclick: () => move(id, 1) }, '▼')));
    if (p.relay) {
      return h('li', { class: 'ai-p relay' }, head,
        h('p', { class: 'note' }, '휴대폰에서 바로 부를 수 없는 곳이라(브라우저 차단), 도우미 서버의 중계가 생기면 열려요. 그때까지는 건너뛰어요.'));
    }
    const key = h('input', { type: 'password', id: `ai-key-${id}`, class: 'ai-key', value: c.keys[id] || '', autocomplete: 'off', spellcheck: 'false',
      placeholder: '키 붙여넣기', 'aria-label': `${p.name} 키` });
    key.addEventListener('change', () => { c.keys[id] = key.value.trim(); save(); draw(); toast(key.value.trim() ? `${p.name} 키를 저장했어요.` : `${p.name} 키를 지웠어요.`); });
    const model = h('input', { type: 'text', id: `ai-model-${id}`, class: 'ai-model', value: c.models[id] || '', autocomplete: 'off', spellcheck: 'false',
      autocapitalize: 'off', placeholder: p.model, 'aria-label': `${p.name} 모델 이름` });
    model.addEventListener('change', () => { c.models[id] = model.value.trim(); save(); });
    const out = h('p', { class: 'note ai-out', 'aria-live': 'polite' });
    const test = h('button', { type: 'button', class: 'btn ghost small', onclick: async () => {
      if (!key.value.trim()) { out.textContent = '먼저 키를 넣어 주세요.'; return; }
      test.disabled = true; out.textContent = '묻는 중…';
      try {
        const r = await ai.testOne(id, key.value, model.value.trim() || p.model);
        out.textContent = `✔ 답했어요 (${(r.ms / 1000).toFixed(1)}초) — «${r.text}»`;
      } catch (e) {
        out.textContent = `✖ ${e.message}${e.detail ? ` — ${String(e.detail).slice(0, 160)}` : ''}`;
      } finally { test.disabled = false; }
    } }, '연결 시험');
    const use = h('label', { class: 'check' },
      h('input', { type: 'checkbox', id: `ai-on-${id}`, checked: !c.off[id], onchange: (e) => { c.off[id] = !e.target.checked; save(); draw(); } }), ' 쓰기');
    const show = h('button', { type: 'button', class: 'linkish', onclick: (e) => { key.type = key.type === 'password' ? 'text' : 'password'; e.currentTarget.textContent = key.type === 'password' ? '보기' : '가리기'; } }, '보기');
    return h('li', { class: 'ai-p' }, head,
      h('div', { class: 'ai-row' }, key, show),
      h('div', { class: 'ai-row' }, h('label', { for: `ai-model-${id}`, class: 'note' }, '모델'), model),
      h('div', { class: 'ai-row' }, use, test,
        h('a', { href: p.url, target: '_blank', rel: 'noopener', class: 'note' }, `키 받는 곳: ${p.where}`)),
      out);
  }));
  draw();
  return h('section', { class: 'card ai-set', id: 'ai' },
    h('h2', {}, '🤖 AI — 자유대화 · 교정'),
    h('p', { class: 'note' }, '키는 이 휴대폰 안에만 저장돼요(백업 파일 · 자동 백업에도 안 들어가요). 위에서부터 차례로 쓰고, 안 되면(키 오류 · 한도 초과 · 서버 오류) 다음 회사로 넘어가요.'),
    h('p', { class: 'note warn' }, '⚠ 쓴 만큼 각 회사에서 요금이 나가요. 키를 만든 회사 콘솔에서 «월 사용 한도» 를 꼭 걸어 두세요.'),
    list,
    h('p', {}, h('button', { type: 'button', class: 'btn ghost', onclick: async () => {
      if (!window.confirm('이 휴대폰에 저장한 AI 키를 모두 지울까요?')) return;
      await ai.clearKeys(); const n = await ai.loadAI(); Object.assign(c, n); draw(); toast('AI 키를 모두 지웠어요.');
    } }, 'AI 키 모두 지우기')));
}

async function storageSection() {
  const box = h('div', { class: 'storage' }, h('p', {}, '쓰는 양을 세는 중…'));
  const draw = async () => {
    const use = await audioUsage();
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const progress = new Map(await entries('progress'));
    const finished = (id) => { const m = progress.get(id)?.modes || {}; return m.speak?.finish || m.chat?.finish; };
    const doneIds = Object.keys(use.byDialogue).filter(finished);
    const doneBytes = doneIds.reduce((a, id) => a + use.byDialogue[id].en + use.byDialogue[id].ko, 0);
    const s = settings();
    fill(box,
      h('p', {}, h('b', {}, `받아 둔 음성 ${fmtBytes(use.total)}`), s.storageLimitMB ? ` / 한도 ${s.storageLimitMB}MB` : ' / 한도 없음',
        est ? h('span', { class: 'note' }, ` · 앱 전체 약 ${fmtBytes(est.usage || 0)}`) : null),
      h('ul', { class: 'usage' },
        h('li', {}, h('span', {}, `영어 음성 (대화 ${Object.values(use.byDialogue).filter((e) => e.en).length}개)`), h('b', {}, fmtBytes(use.en)),
          h('button', { type: 'button', class: 'btn ghost small', disabled: !doneIds.length, onclick: async () => {
            const keep = new Set(doneIds.flatMap((id) => use.byDialogue[id].urls));
            await deleteAudio((u) => keep.has(u)); toast('마무리한 대화의 음성을 지웠어요. 다시 열면 다시 받아요.'); draw();
          } }, `마무리한 대화 음성 지우기 (${fmtBytes(doneBytes)})`)),
        h('li', {}, h('span', {}, '한국어 뜻 음성'), h('b', {}, fmtBytes(use.ko)),
          h('button', { type: 'button', class: 'btn ghost small', disabled: !use.ko, onclick: async () => {
            await deleteAudio((u) => /\/ko-\d+\.opus/.test(u)); toast('한국어 뜻 음성을 지웠어요.'); draw();
          } }, '모두 지우기'))),
      row('음성 저장 한도', seg('음성 저장 한도', s.storageLimitMB, [[10, '10MB'], [30, '30MB'], [50, '50MB'], [0, '제한 없음']], async (v) => {
        await setSetting('storageLimitMB', v); const n = await cleanupAudio(); if (n) toast(`오래 안 연 대화 ${n}개의 음성을 지웠어요.`); draw();
      }), '넘으면 오래 안 연 대화의 음성부터 지워요 (다시 열면 다시 받음)'),
      row('가벼운 모드', seg('가벼운 모드', s.lightMode, [[false, '끔'], [true, '켬']], (v) => setSetting('lightMode', v)),
        '켜면 미리 녹음한 음성을 받지 않고 휴대폰 기본 음성으로 읽어요. 음성 용량 0 · 음질은 휴대폰마다 다르고, 듣기 모드는 화면을 켜 두어야 할 수 있어요.'),
      h('p', {}, h('button', { type: 'button', class: 'btn ghost', onclick: () => downloadAll(draw) }, '전체 미리 받기 (와이파이에서)')));
  };
  draw().catch(() => fill(box, h('p', { class: 'note' }, '저장 공간을 읽지 못했어요.')));
  return box;
}

// 고른 영역 · 내 수준 대화의 영어 음성을 미리 받아 둔다
async function downloadAll(done) {
  const s = settings();
  const data = await loadSituations();
  const m = await (await fetch(new URL('audio/manifest.json', ROOT))).json();
  const ids = data.domains.filter((d) => s.domains.includes(d.id)).flatMap((d) => d.situations.map((x) => dialogueId(d.id, x.id, s.level || 1)));
  const urls = ids.flatMap((id) => Object.keys(m.dialogues[id]?.files || {}).filter((f) => !f.startsWith('ko-'))
    .map((f) => new URL(`audio/${id}/${f}.opus?r=${m.dialogues[id].rev || 1}`, ROOT).href));
  const bytes = ids.reduce((a, id) => a + Object.entries(m.dialogues[id]?.files || {}).filter(([f]) => !f.startsWith('ko-')).reduce((b, [, v]) => b + v[0], 0), 0);
  if (!window.confirm(`내 수준 대화 ${ids.length}개의 영어 음성 약 ${fmtBytes(bytes)} 를 받을까요? 와이파이에서 받으세요.`)) return;
  let n = 0;
  toast('받는 중…', 60000);
  for (const u of urls) { try { await fetch(u); } catch { /* 건너뜀 */ } if (++n % 20 === 0) toast(`받는 중 ${n} / ${urls.length}`, 60000); }
  toast(`음성 ${n}개를 받아 두었어요.`);
  done();
}

function backupSection() {
  const file = h('input', { type: 'file', id: 'backup-file', accept: 'application/json,.json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return;
    try {
      const snap = JSON.parse(await f.text());
      if (snap.app !== 'daily-talk' || !snap.stores) throw new Error('Daily Talk 백업 파일이 아니에요.');
      if (!window.confirm(`${snap.date?.slice(0, 10) || ''} 백업으로 지금 기록을 바꿀까요? 지금 휴대폰의 학습 기록은 사라져요(AI 키는 그대로).`)) return;
      await importAll(snap);
      toast('백업을 불러왔어요. 다시 열어요.'); setTimeout(() => location.reload(), 900);
    } catch (e) { toast(`불러오지 못했어요: ${e.message}`); } finally { file.value = ''; }
  });
  return h('section', { class: 'card' }, h('h2', {}, '백업'),
    h('p', { class: 'note' }, '휴대폰을 바꿀 때 백업 파일로 기록을 옮겨요(AI 키는 빼고 저장). 업그레이드할 때는 휴대폰 안에 자동으로 백업해요. 구글 드라이브 백업은 3차에 열려요.'),
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', onclick: async () => {
        const st = await up.getState();
        const snap = await exportAll(st.current?.version);
        const url = URL.createObjectURL(new Blob([JSON.stringify(snap)], { type: 'application/json' }));
        const a = h('a', { href: url, download: `dailytalk-backup-${new Date().toLocaleDateString('sv-SE')}.json` });
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      } }, '백업 파일 내보내기'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => file.click() }, '백업 파일 가져오기')), file);
}

function upgradeSection() {
  const out = h('div', { class: 'up-out', 'aria-live': 'polite' });
  const cur = h('p', { class: 'up-cur' }, '지금 판을 읽는 중…');
  const btnCheck = h('button', { type: 'button', class: 'btn' }, '🔎 새 판이 있는지 확인');
  const btnBack = h('button', { type: 'button', class: 'btn ghost', hidden: true });
  const zipInput = h('input', { type: 'file', id: 'up-zip', accept: '.zip,application/zip', hidden: true });
  const btnFile = h('button', { type: 'button', class: 'btn ghost', onclick: () => zipInput.click() }, '📁 파일로 업그레이드');
  zipInput.addEventListener('change', async () => {
    const f = zipInput.files[0]; if (!f) return;
    const bar = h('progress', { max: '1', value: '0' }); const status = h('p', { class: 'note' }, '꾸러미를 확인하는 중…');
    fill(out, bar, status);
    try {
      const info = await up.fromZip(f, (done, total) => { bar.max = total; bar.value = done; status.textContent = `확인하며 넣는 중 ${done} / ${total}`; });
      showPending({ version: info.version });
    } catch (e) { status.textContent = `설치하지 못했어요: ${e.message} 지금 판은 그대로예요.`; } finally { zipInput.value = ''; }
  });

  async function refresh() {
    const st = await up.getState();
    if (st.current) fill(cur, h('b', {}, `지금 판 ${st.current.version}`), ` (${st.current.date})`);
    else fill(cur, h('b', {}, `지금 판 ${VERSION === '0.0.0' ? '개발판' : VERSION}`), ' — 아직 휴대폰에 설치되지 않았어요. 한 번 더 열면 설치돼요.');
    btnBack.hidden = !st.previous;
    if (st.previous) btnBack.textContent = `↩ 이전 판(${st.previous.version})으로 되돌리기`;
    if (st.pending) showPending(st.pending);
  }

  function showPending(p) {
    fill(out, 
      h('p', {}, h('b', {}, `✔ 새 판 ${p.version} 을 받아 두었어요.`), ' 누르면 새 판으로 다시 열려요. 학습 기록은 그대로예요.'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => up.activate() }, '🔄 새 판으로 다시 시작'));
  }

  btnCheck.addEventListener('click', async () => {
    if (!up.supported()) { out.textContent = '이 브라우저는 앱 안 업그레이드를 지원하지 않아요. 크롬에서 열어 주세요.'; return; }
    btnCheck.disabled = true;
    out.textContent = '확인하는 중…';
    try {
      const r = await up.check();
      if (r.already) { showPending(r.st.pending); return; }
      if (!r.newer) { fill(out, h('p', {}, h('b', {}, '최신 판이에요.'), ` (${r.latest.version})`)); return; }
      const notes = (r.latest.notes || []).map((n) => h('li', {}, n));
      const bar = h('progress', { max: '1', value: '0', hidden: true });
      const status = h('p', { class: 'note' });
      const btnGet = h('button', { type: 'button', class: 'btn primary' }, '⬆ 지금 받기');
      btnGet.addEventListener('click', async () => {
        btnGet.disabled = true; bar.hidden = false;
        status.textContent = '내 기록을 먼저 백업하는 중…';
        try {
          await up.download(r.latest, (done, total) => { bar.max = total; bar.value = done; status.textContent = `받는 중 ${done} / ${total}`; });
          const st = await up.getState();
          showPending(st.pending);
          document.querySelector('.gear')?.classList.remove('has-dot');
        } catch (e) {
          status.textContent = `받지 못했어요: ${e.message} 지금 판은 그대로예요. 잠시 뒤 다시 해 보세요.`;
          btnGet.disabled = false;
        }
      });
      fill(out, 
        h('p', {}, h('b', {}, `새 판 ${r.latest.version}`), ` (${r.latest.date}) · 받을 크기 약 ${fmtBytes(r.bytes)} · 바뀐 파일 ${r.changed.length}개`),
        notes.length ? h('ul', { class: 'notes' }, notes) : null,
        btnGet, bar, status);
    } catch (e) {
      out.textContent = `확인하지 못했어요: ${e.message} 인터넷 연결을 확인해 주세요.`;
    } finally { btnCheck.disabled = false; }
  });

  btnBack.addEventListener('click', async () => {
    if (window.confirm('이전 판으로 되돌릴까요? 학습 기록은 그대로 남아요.')) up.rollback();
  });

  refresh();
  const auto = h('label', { class: 'check' },
    h('input', { type: 'checkbox', id: 'auto-up', checked: settings().autoUpdateCheck,
      onchange: (e) => setSetting('autoUpdateCheck', e.target.checked) }),
    ' 하루 한 번 새 판 자동 확인 (확인만 하고 받지는 않아요)');
  return h('section', { class: 'card up', id: 'upgrade' },
    h('h2', {}, '⬆ 업그레이드'), cur, h('div', { class: 'btn-row' }, btnCheck), out,
    h('hr'), h('div', { class: 'btn-row col' }, btnBack, btnFile, zipInput), h('p', { class: 'note' }, '인터넷으로 못 받을 때: ', h('a', { href: 'guide.html#package' }, '안내 페이지'), '에서 업그레이드 꾸러미(zip)를 받아 위 단추로 올리세요.'), auto);
}

export default async function settingsView(section) {
  if (section) setTimeout(() => document.getElementById(section)?.scrollIntoView({ block: 'start' }), 60);
  const s = settings();
  const data = await loadSituations();
  const domainChecks = h('div', { class: 'checks' },
    data.domains.map((d) => h('label', { class: 'check chip' },
      h('input', { type: 'checkbox', id: `dom-${d.id}`, checked: s.domains.includes(d.id),
        onchange: async (e) => {
          const next = ALL_DOMAINS.filter((id) => (id === d.id ? e.target.checked : settings().domains.includes(id)));
          if (!next.length) { e.target.checked = true; toast('영역을 하나 이상 골라 주세요.'); return; }
          await setSetting('domains', next);
        } }),
      ` ${d.emoji} ${d.ko}`)));

  return h('div', { class: 'page settings' },
    h('h1', {}, '설정'),
    h('section', { class: 'card' },
      h('h2', {}, '학습'),
      row('수준', seg('수준', s.level, [[1, LEVEL_KO[1]], [2, LEVEL_KO[2]], [3, LEVEL_KO[3]]], (v) => setSetting('level', v))),
      row('공부할 영역', domainChecks, '고르지 않은 영역은 오늘의 학습에서 빠져요'),
      row('하루 목표', seg('하루 목표', s.dailyGoal, [[5, '5분'], [10, '10분'], [15, '15분'], [20, '20분']], (v) => setSetting('dailyGoal', v))),
      row('연습 모드', seg('연습 모드', s.mode, Object.entries(MODES).map(([k, m]) => [k, `${m.ico} ${m.ko}`]), async (v) => {
        await setSetting('mode', v); document.body.dataset.mode = v;
        for (const b of document.querySelectorAll('.modes button')) b.setAttribute('aria-pressed', String(b.dataset.mode === v));
      }), '화면 위 단추로도 언제든 바꿔요'),
      row('한국어 뜻', seg('한국어 뜻', s.koDisplay, [['auto', '수준에 따라'], ['always', '늘 보기'], ['tap', '눌러서 보기']], (v) => setSetting('koDisplay', v)),
        '수준에 따라: 초급은 늘 보이고 중급 · 고급은 눌러서 봐요'),
      row('내가 만든 학습 기본값', seg('내가 만든 학습 기본값', s.shareDefault || 'secret', [['secret', '🔒 비밀'], ['dev', '📨 개발자 참고'], ['all', '🌐 모두에게 제안']], (v) => setSetting('shareDefault', v)),
        'AI 자유대화 · 자료로 만든 학습을 저장할 때 처음 골라져 있는 공개 범위 (보내기 전에 늘 확인 화면이 나와요)'),
      row('채팅 모드 소리', seg('채팅 모드 소리', s.chatSound, [[true, '🔈 켬'], [false, '🔇 끔']], (v) => setSetting('chatSound', v)), '이어폰이 없으면 끄세요'),
      h('p', {}, h('a', { href: '#/start', class: 'btn ghost' }, '처음 안내 다시 보기'))),
    h('section', { class: 'card' }, h('h2', {}, '저장 공간'), await storageSection()),
    backupSection(),
    await aiSection(),
    h('section', { class: 'card' }, h('h2', {}, '매일 알림'),
      h('p', { class: 'note' }, '휴대폰 알림 · 텔레그램 · 카카오톡 알림은 2차 다음 단계에서 열려요.')),
    upgradeSection(),
  );
}
