// 상황 — 영역 → 상황 → 수준 고르기 (설계서 「3-1」). 맨 끝 «✍️ 내가 만든 상황» 은 AI 자유대화 복습 ⑤ · 📥 자료로 만든 것(묶음).
import { h, fill, toast } from '../ui.js';
import { settings } from '../settings.js';
import { loadSituations, LEVEL_KO, codeOf, dialogueId, MY_DOMAIN } from '../content.js';
import { entries, del } from '../db.js';
import { VIS, isVerbatim } from '../share.js';

const KIND = (d) => (d.kind === 'passage' ? (d.questions?.length ? '📝 글' : '📌 글') : '💬 대화');

function myItem(d, onDelete) {
  return h('li', { class: 'sit-item' },
    h('a', { class: 'sit-text', href: `#/d/${d.id}` },
      h('b', {}, d.title.ko),
      h('span', { class: 'path' }, `${KIND(d)} · ${LEVEL_KO[d.level]} · ${new Date(d.created).toLocaleDateString('ko-KR')} · ${VIS[d.visibility] || VIS.secret} · ${d.lines.length}문장`)),
    h('div', { class: 'my-tools' },
      isVerbatim(d) ? null : h('a', { class: 'btn ghost small', href: `#/send/d/${d.id}`, 'aria-label': `${d.title.ko} 개발자에게 보내기` }, d.visibility && d.visibility !== 'secret' ? '📨 보낸 것' : '📨 보내기'),
      onDelete ? h('button', { type: 'button', class: 'btn ghost small', 'aria-label': `${d.title.ko} 지우기`, onclick: onDelete }, '지우기') : null));
}

function myList(mine, bundles) {
  const box = h('div', { class: 'my-list' });
  const draw = () => {
    const inBundle = new Set(bundles.flatMap((b) => b.items));
    const loose = mine.filter((d) => !inBundle.has(d.id));
    const byId = new Map(mine.map((d) => [d.id, d]));
    fill(box,
      h('div', { class: 'btn-row' }, h('a', { class: 'btn', href: '#/ai' }, '🤖 AI 자유대화로 만들기'), h('a', { class: 'btn', href: '#/import' }, '📥 자료로 만들기')),
      bundles.map((b) => {
        const items = b.items.map((id) => byId.get(id)).filter(Boolean);
        return h('section', { class: 'card my-bundle' },
          h('div', { class: 'imp-head' },
            h('b', {}, `📥 ${b.title}`),
            h('a', { class: 'btn ghost small', href: `#/send/b/${b.id}`, 'aria-label': `${b.title} 묶음 개발자에게 보내기` }, b.visibility && b.visibility !== 'secret' ? '📨 보낸 것' : '📨 묶음 보내기'),
            h('button', { type: 'button', class: 'btn ghost small', 'aria-label': `${b.title} 묶음 지우기`, onclick: async () => {
              if (!window.confirm(`묶음 «${b.title}» 과 그 안의 ${items.length}개를 지울까요? 연습 기록과 카드는 남아요.`)) return;
              for (const d of items) { await del('customDialogues', d.id); mine.splice(mine.indexOf(d), 1); }
              await del('imports', b.id); bundles.splice(bundles.indexOf(b), 1); draw(); toast('묶음을 지웠어요.');
            } }, '묶음 지우기')),
          h('p', { class: 'note' }, `${b.typeKo || '자료'} · ${new Date(b.created).toLocaleDateString('ko-KR')}${b.source?.name ? ` · ${b.source.name}` : ''}${b.source?.part ? ` (${b.source.part}부)` : ''} · ${VIS[b.visibility] || VIS.secret}`),
          b.summary?.length ? h('details', {}, h('summary', {}, '요약 보기'), h('ul', {}, b.summary.map((x) => h('li', {}, x)))) : null,
          h('ol', { class: 'sit-list' }, items.map((d) => myItem(d))));
      }),
      loose.length ? h('ol', { class: 'sit-list' }, loose.map((d) => myItem(d, async () => {
        if (!window.confirm(`«${d.title.ko}» 를 지울까요? 이 대화의 연습 기록은 남아요.`)) return;
        await del('customDialogues', d.id);
        mine.splice(mine.indexOf(d), 1); draw(); toast('지웠어요.');
      }))) : null,
      !mine.length ? h('p', { class: 'note' }, 'AI 와 자유대화를 한 뒤 복습 ⑤ 에서 저장하거나, 📥 자료(글 · 파일 · 사진)로 만들면 여기에 생겨요. 기본 대화처럼 세 모드로 연습해요(음성은 휴대폰 음성).') : null);
  };
  draw();
  return box;
}

export default async function situations(domId) {
  const data = await loadSituations();
  const s = settings();
  const seen = new Set((await entries('progress')).filter(([, v]) => v?.viewed).map(([k]) => k));
  const mine = (await entries('customDialogues')).map(([, v]) => v).filter((d) => d?.lines).sort((a, b) => (b.created || 0) - (a.created || 0));
  const bundles = (await entries('imports')).map(([, v]) => v).filter((b) => b?.items).sort((a, b) => (b.created || 0) - (a.created || 0));
  const isMy = domId === 'my';
  const cur = isMy ? MY_DOMAIN : data.domains.find((d) => d.id === domId) || data.domains.find((d) => s.domains.includes(d.id)) || data.domains[0];
  return h('div', { class: 'page sit' },
    h('nav', { class: 'chips', 'aria-label': '영역' },
      data.domains.map((d) => h('a', { class: `chip${d.id === cur.id ? ' on' : ''}${s.domains.includes(d.id) ? '' : ' dim'}`,
        href: `#/sit/${d.id}`, 'aria-current': d.id === cur.id ? 'page' : 'false' }, `${d.emoji} ${d.ko}`)),
      h('a', { class: `chip${isMy ? ' on' : ''}`, href: '#/sit/my', 'aria-current': isMy ? 'page' : 'false' }, `${MY_DOMAIN.emoji} ${MY_DOMAIN.ko}${mine.length ? ` ${mine.length}` : ''}`)),
    isMy ? myList(mine, bundles) : [
      s.domains.includes(cur.id) ? null : h('p', { class: 'note' }, '공부할 영역으로 고르지 않은 영역이에요. 볼 수는 있지만 오늘의 학습에는 나오지 않아요.'),
      h('ol', { class: 'sit-list' },
        cur.situations.map((x) => h('li', { class: 'sit-item' },
          h('div', { class: 'sit-text' },
            h('span', { class: 'code' }, codeOf(cur, x.id)),
            h('b', {}, x.ko),
            h('span', { class: 'path' }, x.path)),
          h('div', { class: 'levels' },
            [1, 2, 3].map((lv) => {
              const id = dialogueId(cur.id, x.id, lv);
              return h('a', { class: `lv${seen.has(id) ? ' seen' : ''}${s.level === lv ? ' mine' : ''}`, href: `#/d/${id}`,
                'aria-label': `${x.ko} ${LEVEL_KO[lv]}${seen.has(id) ? ' (봄)' : ''}` }, LEVEL_KO[lv]);
            }))))),
    ],
  );
}
