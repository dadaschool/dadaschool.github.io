# 사실 확인 기록 (verification log)

- 확인 날짜: 2026-10-14 (모든 항목 동일)
- 확인 방법: 작성 환경의 네트워크 정책 때문에 `support.google.com`, `workspaceupdates.googleblog.com` 페이지를 브라우저로 직접 열 수 없었습니다(프록시가 연결 거부).
  그래서 **웹 검색 도구로 해당 공식 페이지의 본문 발췌를 확인**하는 방식으로 진행했습니다. 아래 URL은 발췌를 확인한 공식 페이지입니다.
  연수 전 강사가 각 URL을 한 번 직접 열어 문구가 바뀌지 않았는지 확인하기를 권합니다.
- 상태 표시: ✅ 공식 문서로 확인 / ⚠️ 공식 문서끼리 내용이 다르거나 오래된 안내 / ❌ 확인하지 못함(페이지에는 "학교 계정에서 확인" 문구로 씀)

## 1. 지시서의 "확인된 사실" 재확인

| 항목 | 결과 | 확인한 URL | 확인 날짜 |
|---|---|---|---|
| Gemini 앱이 모든 교육 에디션·모든 연령에 제공 | ✅ | https://workspaceupdates.googleblog.com/2025/06/the-gemini-app-is-now-available-for-all-google-workspace-for-education-users.html | 2026-10-14 |
| Gemini 앱·NotebookLM이 교육용 Core 서비스, 사람 검토·AI 학습에 쓰지 않음 | ✅ | https://workspaceupdates.googleblog.com/2025/04/notebookLM-and-gemini-app-core-services-for-education-customers.html , https://support.google.com/a/answer/14130944 | 2026-10-14 |
| 만 18세 미만에게 더 엄격한 콘텐츠 정책 | ✅ | https://support.google.com/a/answer/16350447 | 2026-10-14 |
| Classroom Gemini: Fundamentals·Standard·Plus, 기본값 켜짐, 관리자 제어 | ✅ | https://support.google.com/a/answer/16291887 , https://workspaceupdates.googleblog.com/2026/04/gemini-in-google-classroom-is-now-available-in-all-Classroom-supported-languages.html | 2026-10-14 |
| Classroom 교사용 생성 기능은 만 18세 이상(교사 인증) 사용자 | ✅ | https://workspaceupdates.googleblog.com/2026/06/updates-to-gemini-in-google-classroom.html | 2026-10-14 |
| Classroom 모바일 앱 Gemini 탭(2026-06) | ✅ | https://workspaceupdates.googleblog.com/2026/06/updates-to-gemini-in-google-classroom.html | 2026-10-14 |
| 교사용 시작 프롬프트(퀴즈, 훅, 오개념, 프로젝트 아이디어, 인포그래픽, 만화, 파일→슬라이드 변환) | ✅ | https://workspaceupdates.googleblog.com/2026/06/updates-to-gemini-in-google-classroom.html | 2026-10-14 |
| Gem·NotebookLM 노트북을 Classroom으로 배정, 관리자 허용 필요 | ✅ | https://support.google.com/edu/classroom/answer/16534159 , https://workspaceupdates.googleblog.com/2025/09/educators-create-gems-notebooks-google-classroom.html | 2026-10-14 |
| 배정된 노트북: 학생은 소스 읽기 전용, 교사는 열람 수 확인 | ✅ | https://support.google.com/edu/classroom/answer/16534159 | 2026-10-14 |
| Forms "Help me create": 프롬프트·Drive 파일 근거, 퀴즈 정답·배점, 여러 섹션·기존 양식 편집 미지원 | ✅ | https://support.google.com/docs/answer/16346789 , https://workspaceupdates.googleblog.com/2025/06/help-me-create-gemini-google-forms.html | 2026-10-14 |
| NotebookLM → Gemini Notebook 이름 변경 | ✅ (지시서보다 구체화) 2026-07-16 발표, 몇 주에 걸쳐 적용, 기존 링크 자동 연결 | https://workspaceupdates.googleblog.com/2026/07/notebooklm-now-gemini-notebook.html | 2026-10-14 |

## 2. 지시서의 🔍 항목

| 항목 | 결과 | 페이지에 쓴 내용 | 확인한 URL | 확인 날짜 |
|---|---|---|---|---|
| Docs/Sheets/Slides 사이드 패널 Gemini의 에디션별 제공 | ✅ Docs·Slides / ❌ Sheets | Docs·Slides: Education Plus 또는 Teaching and Learning 추가 라이선스, 만 18세 이상(2026-02). Sheets: "앞으로 몇 달 안에 일부 제공 예정"까지만 확인 → 학교 계정에서 확인 | https://workspaceupdates.googleblog.com/2026/02/gemini-in-workspace-education.html | 2026-10-14 |
| Forms "Help me create" 한국어 지원 | ✅ | 2025-11 7개 언어 확대에 한국어 포함 | https://workspaceupdates.googleblog.com/2025/11/help-me-create-google-forms-seven-languages.html | 2026-10-14 |
| Forms "Help me create" 대상 에디션 | ⚠️ | 2026-04 안내: Education Plus, Teaching & Learning, Google AI Pro for Education. 2025-06 안내는 Gemini Education 추가 라이선스였음 → 최신 안내로 쓰고 🔍 유지 | https://workspaceupdates.googleblog.com/2026/04/form-creation-with-gemini-and-more-now-available-in-more-languages.html | 2026-10-14 |
| Calendar 예약 일정의 교육 에디션 제공 | ⚠️ | 2022-03 안내 기준 Education Fundamentals·Standard·Plus·Teaching and Learning Upgrade 대상(오래된 안내라 🔍 유지) | https://workspaceupdates.googleblog.com/2022/03/blog-post.html | 2026-10-14 |
| 예약 페이지 공개 범위 | ✅ | 예약 페이지는 항상 공개, 링크를 가진 누구나 예약 페이지·프로필 사진·계정 이름 열람. 모바일 앱에서는 만들 수 없음 | https://support.google.com/calendar/answer/10729749 , https://support.google.com/calendar/answer/10733297 | 2026-10-14 |
| 외부(학부모) 예약을 학교 관리자가 막을 수 있는지 | ❌ | "로그아웃 상태 브라우저로 직접 확인" 문구로 대체 | — | 2026-10-14 |
| Meet 녹화 에디션별 제공 | ✅ Fundamentals / ❌ 그 외 세부 | Education Fundamentals는 녹화 불가, Education Plus는 가능. Standard·T&L 세부는 "관리자 설정에 따라 다름"으로 씀 | https://support.google.com/meet/answer/9308681 | 2026-10-14 |
| Gemini 회의록("Take notes for me") | ✅ | 2026 안내 기준 교육용은 Google AI Pro for Education 추가 라이선스 대상 | https://workspaceupdates.googleblog.com/2026/08/take-notes-with-me-for-in-person-meetings-is-now-available.html , https://support.google.com/meet/answer/14754931 | 2026-10-14 |
| Chat 스페이스의 학교 계정 사용 | ✅ | 관리자 콘솔에서 조직·그룹별로 켜고 끔, 교육 에디션용 학생 Chat 제한 설정 있음 | https://support.google.com/a/answer/9071576 , https://workspaceupdates.googleblog.com/2024/08/chat-safer-with-admin-setting-in-google-chat.html | 2026-10-14 |
| Chat 안 Gemini 요약 | ✅ | 교육용 기능표 기준 Google AI Pro for Education 추가 라이선스 대상 | https://support.google.com/chat/answer/13952129 , https://workspaceupdates.googleblog.com/2024/10/gemini-summaries-google-chat.html | 2026-10-14 |
| Classroom Gemini 루브릭 생성 기능 유무 | ✅ | 2026-08-05 출시. 과제 화면 생성 / 기존 루브릭 변환 / Gemini 탭에서 초안 후 Sheets·Docs 내보내기. Fundamentals·Standard·Plus, Gemini in Classroom 켜져 있으면 기본 사용 가능, 만 18세 이상. Classroom 기본 루브릭과 구분해 기술 | https://workspaceupdates.googleblog.com/2026/08/streamlining-rubric-generation-in-Google-Classroom-with-Gemini.html | 2026-10-14 |
| Classroom 루브릭 변환의 언어 | ⚠️ | 도움말에 영어 전용으로 적힌 적이 있음 → 한국어 화면에서 확인 | https://support.google.com/edu/classroom/answer/15410566 | 2026-10-14 |
| Gem 기능 제공 (심화 A) | ✅ + 새 사실 | 교육용 계정에서 2027-06-01 이후(그보다 빠르지 않게) Gem 종료, 초안 상태 스킬로 전환. 2026-10 스킬 출시 지연 안내 | https://workspaceupdates.googleblog.com/2026/09/skills-gemini-app-workspace.html , https://support.google.com/gemini/answer/18560919 , https://workspaceupdates.googleblog.com/2026/10/an-update-on-launch-of-skills-in-gemini-app-and-workspace.html | 2026-10-14 |
| Gemini 앱 Canvas로 발표 자료 만들기·Slides 내보내기 | ✅ | 교육 Fundamentals·Standard·Plus 대상. 관리자가 데이터 접근을 끄면 내보내기 숨김 가능 | https://workspaceupdates.googleblog.com/2025/10/generate-presentations-in-gemini-app.html , https://support.google.com/gemini/answer/16047321 | 2026-10-14 |
| Forms 선택지(항목)별 응답 수 제한 | ✅(기본 기능 없음) | 공식 도움말에는 양식 전체 마감(날짜·응답 수, 2026-01)만 있음. 선택지별 제한은 Marketplace 부가기능 | https://workspaceupdates.googleblog.com/2026/01/forms-stop-collecting-responses.html , https://support.google.com/docs/answer/2839588 | 2026-10-14 |
| Forms 새 응답 이메일 알림(기본 기능) | ✅ | 응답 탭 → 더보기 → 새 응답에 대한 이메일 알림 받기 | https://support.google.com/docs/answer/139706 | 2026-10-14 |
| Apps Script 일일 메일 발송 한도 | ⚠️ | 공식 할당량 표 기준 Workspace 계정 하루 수신자 1,500명 수준, 개인 계정 100명. 도메인 내부/외부 구분 표기가 있어 "수준"으로 씀. 예고 없이 바뀔 수 있음 | https://developers.google.com/apps-script/guides/services/quotas | 2026-10-14 |
| Sites 게시 범위 | ✅ | 공유 → 게시된 사이트: 제한됨/공개(학교 계정은 추가 옵션). 검색엔진 비노출은 보장 아님 | https://support.google.com/sites/answer/6372880 | 2026-10-14 |
| GitHub Pages: Private 저장소 제공 플랜 | ✅ | GitHub Free는 공개 저장소만, Pro·Team·Enterprise는 비공개 저장소도 가능. 비공개 저장소라도 Pages 사이트 자체는 공개 | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits , https://docs.github.com/get-started/learning-about-github/githubs-products | 2026-10-14 |

## 3. 수식·코드 검증 상태

| 항목 | 상태 |
|---|---|
| 사례 5 미제출 수식, 중복·명단 외 번호 조건부 서식 | 예시 — 실행 전 확인. 가상 데이터로 계산 논리만 Python으로 재현해 확인(미제출 4·9·17·22, 중복 12, 명단 외 52). Google Sheets 실행은 하지 않음 |
| 사례 6 순번·대기 수식 | 예시 — 실행 전 확인. 같은 방식으로 논리 확인(코딩 대기 5, 보드게임 대기 2, 중복 제외 2) |
| 사례 7 제출률·조건부 서식 | 예시 — 실행 전 확인. 논리 확인(전체 제출률 86%, 60점 미만 2·14·24번) |
| 사례 1 폴더·공유 권한 Apps Script (2026-10-16 개정 3: 구글 그룹 GROUPS 표로 교사·학생·학년·반 공유, `나만` 추가) | 예시 — 실행 전 확인. `node --check` 문법 확인 + 모의 환경에서 그룹 메일 있음/없음, 학교가 외부 공유를 막은 경우를 실행해 확인. 2026-10-16 교사가 학교 계정에서 실행해 `2026 > 2학년 > 정보·학급운영·학부모` 하위 폴더 생성을 화면으로 확인(공유 권한 설정 결과는 미확인). DriveApp `addViewer`/`addEditor`에 그룹 메일을 넣는 동작, 그룹 공유 시 알림 메일 여부는 공식 문서로 확인하지 못함 |
| 사례 13 알림 메일 Apps Script | 예시 — 실행 전 확인. `node --check`로 문법만 확인. 실행은 하지 않음 |

"검증됨"으로 표기한 코드는 없습니다. 연수 전에 강사가 학교 계정에서 직접 실행한 뒤 해당 박스 표시를 바꿔 주세요.

## 4. 샘플 파일 인코딩

2026-10-16: `samples/`의 CSV·TXT를 UTF-8(BOM)으로 바꿨습니다. BOM이 없으면 한국어 Windows 엑셀이 CP949로 읽어 한글이 깨집니다(교사 화면에서 실제로 발생, 작업 환경에서 CP949로 읽어 같은 깨짐을 재현함).

## 5. 조직 단위 공유 (2026-10-16)

| 항목 | 결과 | 확인한 URL |
|---|---|---|
| 조직 단위를 직접 드라이브 공유 대상으로 지정 | 불가(공유 대상은 사람·그룹·도메인·링크) → 구글 그룹 사용 | https://support.google.com/a/answer/9934697 |
| 조직 단위로 사용자 목록 조회 | `orgUnitPath` 검색은 `viewType=admin_view`에서만 가능 → 일반 교사 계정으로는 불가로 판단 | https://developers.google.com/workspace/admin/directory/v1/guides/search-users |
| 동적 그룹(조직 단위 조건) | 도움말 기준 Education Standard·Plus 등. 문서마다 에디션 이름이 달라 관리 콘솔 확인 필요 | https://support.google.com/a/answer/10286834 |
| 파일 1개 공유 인원 | 메일 주소 600개 (폴더 한도는 찾지 못함) | https://support.google.com/drive/answer/2494822 |

## 6. 화면 메뉴 이름

한국어 메뉴 이름(예: `만들기 → 예약 일정`, `응답 → Sheets에 연결`, `트리거 → 트리거 추가`)은 작성자가 실제 학교 계정 화면으로 확인하지 못했습니다. 각 페이지에 "화면 문구는 학교 계정에서 확인" 문구를 함께 넣었습니다.

## 7. Gemini 스킬 (2026-10-17, 모듈 6 m6-gemini-skills.html)

| 항목 | 결과 | 확인한 URL |
|---|---|---|
| Gemini 앱 스킬 배포 | 2026-10-13 배포 시작, 11월 중순 완료 예정. Workspace 앱 안의 스킬은 연기 | https://workspaceupdates.googleblog.com/2026/10/an-update-on-launch-of-skills-in-gemini-app-and-workspace.html |
| 학교 계정 사용 | 도움말에는 "개인 계정만"으로 적혀 있으나, 교사가 학교 계정에서 스킬 메뉴를 확인함(2026-10-17). 도움말이 갱신 전인 것으로 판단 | https://support.google.com/gemini/answer/17094296 |
| 만드는 방법 | Gemini와 만들기 / 템플릿 / 직접 만들기(이름·설명·지침) / SKILL.md 업로드 | https://support.google.com/gemini/answer/17094296 |
| 쓰는 방법 | 대화창에 / (업데이트된 화면은 @) 입력 후 선택, 또는 켜 둔 스킬을 설명 기준으로 자동 사용 | https://support.google.com/gemini/answer/17094296 |
| 관리 | 켜기·끄기·수정·삭제·내려받기는 스킬 화면에서만. 삭제는 되돌릴 수 없음 | https://support.google.com/gemini/answer/17094296 |
| 좋은 스킬 조건 | 언제 쓰는지 / 짧은 지침 / 결과 예시 | https://support.google.com/gemini/answer/17102773 |
| 공유 | 스킬 공유 기능은 "앞으로 몇 주 안에" 예정 → 현재 학생 배포 불가로 안내 | https://workspaceupdates.googleblog.com/2026/10/an-update-on-launch-of-skills-in-gemini-app-and-workspace.html |
| 메뉴 한국어 이름 | "맞춤설정 → 스킬", "Gemini와 만들기", "직접 만들기"는 영어 도움말을 옮긴 것. 학교 계정 화면 문구로 확인 필요 | — |
| 이름 규칙 | 동사로 시작, 모호한 말(helper, data) 피하기, 소문자·하이픈 | https://support.google.com/gemini/answer/17102773 |
| 설명 규칙 | 3인칭으로 하는 일 + "Use when" 상황, 1024자 이내. "쓰지 않을 때" 문장은 이 자료의 권장 | https://support.google.com/gemini/answer/17102773 |
| 읽는 순서 | 이름·설명으로 관련성 판단 → 지침 → 파일은 필요할 때만 | https://support.google.com/gemini/answer/17102773 |
| 업로드 | SKILL.md를 맨 위 폴더에, 폴더나 .zip, 텍스트 파일만(.md·.txt), 100MB, 고치려면 전체 다시 업로드 | https://support.google.com/gemini/answer/17094296 |
| SKILL.md 앞부분(--- name/description ---) 형식 | Gemini 앱 도움말에서 확인 못 함. Gemini CLI 스킬 안내 형식을 따름 → 🔍 표시 | https://codelabs.developers.google.com/gemini-cli/how-to-create-agent-skills-for-gemini-cli |
| 겹쳐 쓰기 | 스킬은 대화 안에서 여러 개를 함께 쓸 수 있음(예: 소식지 스킬 + 기관 문체 스킬) | https://workspaceupdates.googleblog.com/2026/09/skills-gemini-app-workspace.html |
| 예시 날짜 요일 | 2026-11-05 목, 2026-10-30 금, 2026-11-13 금, 2026-11-20 금 (Python으로 계산) | — |

## 8. Gemini Notebook(NotebookLM) (2026-10-17, 모듈 7 m7-gemini-notebook.html)

| 항목 | 결과 | 확인한 URL |
|---|---|---|
| 스튜디오 결과물 | 오디오·동영상 개요, 마인드맵, 보고서(학습 가이드·브리핑·FAQ, Docs/Sheets 내보내기), 플래시카드·퀴즈(난이도, 진행 저장), 인포그래픽(스타일 10가지), 슬라이드(PDF·PPTX) | https://workspaceupdates.googleblog.com/2026/03/new-ways-to-customize-and-interact-with-your-content-in-NotebookLM.html |
| 만 18세 이상 전용 | 시네마틱 동영상(영어), 새 인포그래픽 스타일, 슬라이드 수정, Deep Research | 같은 글, https://support.google.com/notebooklm/answer/16215270 |
| 소스 한도·종류 | 소스당 50만 단어·200MB, 무료 노트북당 50개(에디션별 50~600), Docs·Slides(100장)·PDF·docx·pptx·txt·md·csv·오디오·URL·YouTube·이미지. 복사 방지 PDF 불가, 웹은 글자만 | https://support.google.com/notebooklm/answer/16269187 |
| 오디오 개요 | 80개 이상 언어(한국어 포함), 비평·토론 형식, 길이(짧게·기본, 길게는 영어만이라고 도움말 표기) | https://support.google.com/notebooklm/answer/16212820 |
| 소스 찾기 | 찾아보기(최대 10개 추천), 빠른 조사(웹·Drive), Deep Research(만 18세 이상) | https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-deep-research-file-types/ |
| 공유 | 뷰어·편집자, 교육용은 조직 안에서만, 채팅만 보기는 완전 차단 아님 | https://support.google.com/notebooklm/answer/16179559 |
| 학생 수업 노트북 | Classroom에서 학생이 직접 만드는 기능은 고등교육·만 18세 이상(2026-04) | https://workspaceupdates.googleblog.com/2026/04/students-can-now-create-personal-class-notebooks-with-NotebookLM-in-Google-Classroom.html |
| 휴대폰 앱 | 노트·마인드맵·보고서·데이터 표 생성·보기 미지원 | https://support.google.com/notebooklm/answer/16296687 |
| 채팅 설정 | 대화 스타일(기본·학습 가이드) 등. 에디션별 유료 표시 가능 → 화면 확인 | https://support.google.com/notebooklm/answer/16179559 |
| Gemini 앱에서 노트북 쓰기 | 2026-01 업데이트, 학교 계정 화면 확인 필요 | https://workspaceupdates.googleblog.com/2026/01/take-notebooks-further-notebooklm-gemini.html |
| 2026-09 추가 기능 | 녹음기, 상호작용 학습 개요, 새 퀴즈 형식, 짧은 동영상 | https://workspaceupdates.googleblog.com/2026/09/new-back-to-school-features-and-learning-tools-available-in-Gemini-Notebook.html |
| 예시 날짜 요일 | 11/5 목, 10/30 금, 11/13 금, 11/16 월, 11/20 금, 11/27 금 (Python으로 계산) | — |

## 9. 회의록 자동 만들기 (2026-10-17, 모듈 8 m8-meeting-minutes.html)

| 항목 | 결과 | 확인한 URL |
|---|---|---|
| Gemini Notebook 녹음기 | 2026-09 휴대폰 앱에 녹음기 추가(차례 배포). 음성 녹음은 1시간까지 받아써 소스로, 원래 녹음은 저장하지 않음 | https://workspaceupdates.googleblog.com/2026/09/new-back-to-school-features-and-learning-tools-available-in-Gemini-Notebook.html , https://support.google.com/notebooklm/answer/16215270 |
| 노트북 오디오 업로드 | m4a·mp3·wav 등, 올릴 때 받아써 소스로 저장, 200MB | https://support.google.com/notebooklm/answer/16215270 |
| Gemini 앱 오디오 첨부 | 기본 10분(상위 요금제 3시간), 파일 100MB. 학교 계정 한도는 화면 확인 | https://support.google.com/gemini/answer/14903178 |
| Docs 음성 입력 | 도구 → 음성 입력, 크롬 권장. 한국어 선택은 도움말 검색 결과로 확인 못 함 → 화면 확인 | https://support.google.com/docs/answer/4492226 |
| Meet 스크립트 | 에디션 비교표 기준 Education Plus·Teaching and Learning. 학생 라이선스 기본 꺼짐. 문서 간 표기 차이 있음 | https://support.google.com/a/answer/10037875 , https://support.google.com/meet/answer/12849897 |
| Take notes for me | 교육용은 Google AI Pro for Education. 대면 회의 지원(2026-08), 관리자 기본값 꺼짐(2026-09-29~) | https://workspaceupdates.googleblog.com/2026/08/take-notes-with-me-for-in-person-meetings-is-now-available.html , https://workspaceupdates.googleblog.com/2026/09/new-google-meet-take-notes-for-me-settings-for-admins-and-end-users-take-effect-September-29th.html |
| 명시적 동의 설정 | 2026-04 관리자가 Gemini 메모·녹화·스크립트에 참석자 명시적 동의를 요구하도록 설정 가능 | https://workspaceupdates.googleblog.com/2026/04/require-explicit-consent-for-take-notes-with-Gemini-recordings-and-transcripts-in-Google-Meet.html |
| 녹음 동의·금지 회의 | 법 해석이 아니라 이 자료의 안전 권장(전원 고지·동의, 민감 회의 녹음 안 함) | — |
| 대본 날짜 요일 | 11/13 금, 11/20 금, 11/6 금, 11/11 수 (Python으로 계산) | — |

