// 📨 개발자에게 보내기 — 보내기 전 확인 화면 (설계서 「4-13」)
//   #/send/d/<내가 만든 상황 id>[/dev|all] · #/send/b/<자료 묶음 id>[/dev|all]
import { h, fill, toast, icon } from '../ui.js';
import { put } from '../db.js';
import { LEVEL_KO } from '../content.js';
import * as share from '../share.js';

const MAX = 20 * 1024;

function seg(name, value, options, onChange) {
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name },
    options.map(([v, label]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === value),
      onclick: (e) => {
        for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-checked', 'false');
        e.currentTarget.setAttribute('aria-checked', 'true');
        onChange(v);
      } }, label)));
}

const kindKo = (d) => (d.kind === 'passage' ? '글' : '대화');
const summaryOf = (d) => `${kindKo(d)} · ${LEVEL_KO[d.level] || ''} · ${d.lines.length}문장 · 표현 ${(d.expressions || []).length}개${d.questions?.length ? ` · 퀴즈 ${d.questions.length}` : ''}`;

export default async function sendView(kind, id, preUse) {
  let target = await share.loadTarget(kind, id);
  const back = kind === 'b' ? '#/sit/my' : `#/d/${id}`;
  const page = h('div', { class: 'page send' });
  const body = h('div', { class: 'send-body' });

  const sentView = async (how) => {
    const s = await share.lastSubmission(target.submission);
    fill(body,
      h('section', { class: 'card' },
        h('p', {}, h('b', {}, share.VIS[target.visibility] || target.visibility), s ? ` · ${new Date(s.created).toLocaleString('ko-KR')}` : ''),
        how === 'shared' ? h('p', {}, '✓ 제안 파일을 공유하기로 보냈어요. 받은 사람이 개발자가 맞는지 확인해 주세요.') : null,
        how === 'downloaded' ? h('p', {}, '✓ 제안 파일을 «다운로드» 폴더에 저장했어요. 카카오톡 · 메일 · 텔레그램 등으로 개발자에게 보내 주세요.') : null,
        h('p', { class: 'note' }, '내 사본은 그대로 계속 쓸 수 있어요. 도우미 서버가 생기면 «반영됨 · 반영 안 됨» 상태도 여기서 보여 줘요.'),
        h('div', { class: 'btn-row' },
          s?.file ? h('button', { type: 'button', class: 'btn ghost', onclick: async () => {
            const how2 = await share.deliver(s.file);
            if (how2 !== 'cancel') toast(how2 === 'shared' ? '다시 보냈어요.' : '파일을 다시 저장했어요.');
          } }, '📤 파일 다시 보내기') : null,
          h('button', { type: 'button', class: 'btn ghost', onclick: async () => {
            if (!window.confirm('비밀로 되돌릴까요? 이 휴대폰에서는 🔒 비밀로 바뀌어요.\n이미 보낸 파일은 앱이 지울 수 없으니, 개발자에게 지워 달라고 알려 주세요.')) return;
            await share.withdraw(target);
            toast('🔒 비밀로 되돌렸어요. 개발자에게 보낸 파일을 지워 달라고 알려 주세요.', 5000);
            target = await share.loadTarget(kind, id); draw();
          } }, '🔒 비밀로 되돌리기'),
          h('a', { class: 'btn', href: back }, '돌아가기'))));
  };

  const confirmView = () => {
    let use = preUse === 'all' ? 'all' : 'dev';
    const T = target;
    const hits = share.scanItems(T.items);
    const note = h('input', { type: 'text', class: 'answer-text', id: 'send-note', maxlength: '120', placeholder: '예: 에어비앤비 주인에게 늦게 도착한다고 알리는 상황', 'aria-label': '한 줄 설명' });
    const nick = h('input', { type: 'text', class: 'answer-text', id: 'send-nick', maxlength: '20', placeholder: '별명 (안 써도 돼요)', 'aria-label': '별명' });
    const nickRow = h('div', { class: 'send-row' }, h('label', { for: 'send-nick' }, h('b', {}, '별명'), h('small', {}, ' (선택 — 모두에게 반영될 때만 대화 정보에 보여요)')), nick);
    const agree = h('input', { type: 'checkbox', id: 'send-agree' });
    const agreeText = h('span', {});
    const go = h('button', { type: 'button', class: 'btn primary', disabled: true }, '📨 보내기');
    const out = h('p', { class: 'note', 'aria-live': 'polite' });
    const upd = () => {
      nickRow.hidden = use !== 'all';
      agreeText.textContent = use === 'all'
        ? '개발자가 고쳐서 모든 사용자에게 넣을 수 있다는 데 동의합니다'
        : '개발자가 앱을 고치는 데 참고하는 것에 동의합니다 (다른 사용자에게 그대로 넣지 않아요)';
      go.disabled = !agree.checked || !T.items.length;
    };
    agree.addEventListener('change', upd);

    const hitList = () => {
      const now = share.scanItems(T.items);
      if (!now.length) return h('p', { class: 'ok' }, '✓ 전화번호 · 이메일 · 주민등록번호 · 계좌번호 모양은 찾지 못했어요. 이름 · 회사 이름은 직접 확인해 주세요.');
      return h('ul', { class: 'send-hits' }, now.map((x) => h('li', {},
        h('span', {}, `${x.label} «${x.value}» — ${T.items.length > 1 ? `«${x.d.title.ko}» ` : ''}${x.where}`),
        x.n ? h('button', { type: 'button', class: 'btn ghost small', onclick: (e) => editLine(x.d, x.n, e.currentTarget.closest('li')) }, '고치기') : null)));
    };
    const hitBox = h('div', {});
    const drawHits = () => fill(hitBox, hitList());
    const editLine = (d, n, li) => {
      const l = d.lines.find((x) => x.n === n);
      const en = h('input', { type: 'text', class: 'answer-text', lang: 'en', value: l.en, 'aria-label': `${n}번 영어 문장` });
      const ko = h('input', { type: 'text', class: 'answer-text', value: l.ko, 'aria-label': `${n}번 한국어 뜻` });
      fill(li, h('div', { class: 'imp-edit' }, en, ko, h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn small', onclick: async () => {
          if (!en.value.trim()) { toast('영어 문장을 비울 수 없어요.'); return; }
          l.en = en.value.trim(); l.ko = ko.value.trim();
          if (l.alt) l.alt = l.alt.filter((a) => !share.findPrivate(a).length);
          await put('customDialogues', d.id, d);
          toast('고쳤어요.'); drawHits();
        } }, '저장'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: drawHits }, '취소'))));
    };
    drawHits();

    go.addEventListener('click', async () => {
      const left = share.scanItems(T.items);
      if (left.length && !window.confirm(`개인정보처럼 보이는 것이 ${left.length}개 남아 있어요. 그래도 보낼까요?`)) return;
      const sub = share.buildSubmission(T, { use, note: note.value.trim(), nickname: nick.value.trim() });
      const size = JSON.stringify(sub).length;
      if (size > MAX) { out.textContent = `보낼 내용이 너무 커요(${Math.round(size / 1024)}KB, 20KB 까지). 묶음 안의 학습을 하나씩 보내 주세요.`; return; }
      go.disabled = true; out.textContent = '제안 파일을 만드는 중…';
      const how = await share.deliver(sub);
      if (how === 'cancel') { out.textContent = '보내기를 취소했어요. 아직 🔒 비밀이에요.'; go.disabled = false; return; }
      await share.markSent(T, sub, how);
      target = await share.loadTarget(kind, id);
      sentView(how);
    });

    fill(body,
      h('section', { class: 'card' },
        h('h2', {}, '쓰임'),
        seg('쓰임', use, [['dev', share.USE_KO.dev], ['all', share.USE_KO.all]], (v) => { use = v; upd(); }),
        h('p', { class: 'note' }, '📨 개발자가 앱을 좋게 만드는 데만 참고해요. 🌐 개발자가 검토 · 수정해서 다음 업그레이드 때 모두의 기본 대화로 넣을 수 있어요.')),
      h('section', { class: 'card' },
        h('h2', {}, '보낼 내용'),
        T.items.length ? h('ul', { class: 'send-items' }, T.items.map((d) => h('li', {}, h('b', {}, `«${d.title.ko}»`), ` ${summaryOf(d)}`))) : h('p', { class: 'warn' }, '보낼 수 있는 학습이 없어요.'),
        T.skipped.length ? h('p', { class: 'note' }, `📌 원문 문장을 그대로 담은 «${T.skipped.map((d) => d.title.ko).join(' · ')}» 은 저작권 때문에 빼고 보내요.`) : null,
        h('details', {}, h('summary', {}, '내용 미리 보기'),
          T.items.map((d) => h('div', { class: 'send-preview' }, h('b', {}, d.title.ko),
            h('ol', {}, d.lines.map((l) => h('li', {}, h('span', { lang: 'en' }, `${l.role}: ${l.en}`), l.ko ? h('small', {}, l.ko) : null)))))),
        h('p', { class: 'note' }, '보내지 않는 것: 학습 기록 · 진도 · 오답 · AI 키 · 자유대화 원래 기록 · 자료 원문 · 출처.')),
      h('section', { class: 'card' },
        h('h2', {}, '⚠ 개인정보 확인'),
        h('p', { class: 'note' }, '이름 · 전화번호 · 회사 이름 같은 개인정보가 없는지 확인해 주세요.'),
        hitBox),
      h('section', { class: 'card' },
        h('div', { class: 'send-row' }, h('label', { for: 'send-note' }, h('b', {}, '한 줄 설명'), h('small', {}, ' (선택)')), note),
        nickRow,
        h('label', { class: 'check', for: 'send-agree' }, agree, agreeText),
        h('p', { class: 'note' }, '지금은 도우미 서버가 없어서 «제안 파일» 을 만들어 휴대폰 공유하기로 보내요. 카카오톡 · 메일 · 텔레그램 등에서 개발자를 골라 보내 주세요(공유하기가 안 되면 «다운로드» 폴더에 저장돼요).'),
        h('div', { class: 'btn-row' }, go, h('a', { class: 'btn ghost', href: back }, '취소 — 비밀로 두기')),
        out));
    upd();
  };

  const draw = () => (target.visibility && target.visibility !== 'secret' ? sentView() : confirmView());
  draw();
  page.append(
    h('a', { class: 'back', href: back, html: `${icon('back', 18)}<span>${kind === 'b' ? '내가 만든 상황' : target.title}</span>` }),
    h('h1', {}, '📨 개발자에게 보내기'),
    h('p', { class: 'lead' }, `«${target.title}»${kind === 'b' ? ` 묶음 (${target.all.length}개)` : ''}`),
    body);
  return page;
}
