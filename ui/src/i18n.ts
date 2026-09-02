/* Korean-first copy. Same rewrite principles as the vanilla page: headings are
   questions, descriptions say what you get, no pipeline jargon. */
export const T = {
  title: "PPT 만들기 — 디자인 정하기",
  hint: "고르고 나서 아래 버튼만 누르면 됩니다. 창이 닫히면 채팅으로 돌아오세요.",
  stages: ["1단계 · 무엇을, 누구에게", "2단계 · 어떤 모습으로", "3단계 · 이미지와 마무리"],
  loading: "불러오는 중…",
  deriving: "고르신 내용에 맞춰 다음 단계를 준비하는 중…",
  loadError: "추천안을 불러오지 못했습니다. 채팅으로 돌아가 다시 시도해 주세요.",
  next: "다음",
  confirm: "이대로 만들기",
  confirmedTitle: "다 정했습니다",
  confirmedHint: "선택이 저장됐습니다. 이 창을 닫고 채팅으로 돌아가세요.",
  recommended: "추천",

  secTemplate: "이미 있는 디자인을 쓸까요?",
  secCanvas: "어떤 크기로 만들까요?",
  secAudience: "누가 보나요?",
  secStyle: "어떻게 설명하고, 어떤 느낌으로?",
  secPages: "몇 장으로 만들까요?",
  secColor: "색을 골라주세요",
  secIcons: "아이콘은 어떤 느낌으로?",
  secType: "글꼴과 글씨 크기",
  secFormula: "수식이 들어가나요?",
  secImages: "이미지는 어떻게 할까요?",
  secMode: "한 번에 끝낼까요, 나눠서 할까요?",
  secRefine: "만들기 전에 계획서를 먼저 볼까요?",

  subMode: "설명 방식",
  subVisual: "화면 분위기",
  subAdherence: "템플릿을 얼마나 지킬까요?",
  subDivergence: "원본을 얼마나 그대로 따를까요?",
  subDelivery: "어디서 보는 자료인가요?",
  subImagePath: "이미지를 어디서 만들까요?",
  subImageStrategy: "이미지 분위기",
  subImageNotes: "이미지에 대해 더 하실 말씀",

  phAudience: "예: 임원 보고용 / 신입사원 교육용 / 투자자 대상",
  phPages: "예: 12-15",
  phDivergence: "자유롭게 적어주세요 — 예: “문서 내용 그대로 가주세요”. 비워 두면 알아서 균형을 잡습니다.",
  phImageNotes: "예: 실제 사진 위주로, 만화풍 일러스트는 빼주세요.",

  bodySize: "본문 글씨 크기",
  bodySizeHint: "나머지 글씨 크기는 모두 이 값을 기준으로 정해집니다.",
  ptRelation: "화면 px ↔ 파워포인트 pt: 1px = 0.75pt",
  ptApprox: (pt: number) => `파워포인트에서 약 ${pt}pt로 보입니다`,
  sizeOverride: "글씨 크기 개별 조정",
  sizeOverrideHint: "본문 크기를 바꾸면 나머지도 비례해서 같이 움직입니다.",
  roleTitle: "제목",
  roleSubtitle: "부제목",
  roleAnnotation: "작은 설명",
  hexOverride: "색을 직접 지정하기",
  refineOn: "네, 계획서를 먼저 보여주세요",
  refineOff: "아니요, 바로 만들어 주세요",

  errImageRequired: "이미지를 어떻게 할지 하나 이상 골라주세요.",
  errImageNoneExclusive: "“이미지 없이”는 다른 항목과 같이 고를 수 없습니다.",
  errRetry: "저장에 실패했습니다. 다시 눌러주세요.",

  roles: {
    background: "배경",
    secondary_bg: "보조 배경",
    primary: "메인",
    accent: "강조",
    secondary_accent: "보조 강조",
    body_text: "본문 글자",
  } as Record<string, string>,

  strategyFields: {
    rendering: "그림체",
    palette: "색 쓰는 방식",
    visual: "생김새",
    color: "색",
    mood: "느낌",
  } as Record<string, string>,
};

/** Pick the Korean label from a catalog entry, falling back across languages. */
export const label = (e: any): string =>
  e?.label_ko || e?.label_en || e?.label || e?.id || "";
export const desc = (e: any): string => e?.desc_ko || e?.desc_en || e?.desc || "";
export const candName = (c: any): string => c?.name_ko || c?.name_en || c?.name || "";
export const candNote = (c: any): string => c?.note_ko || c?.note_en || c?.note || "";
