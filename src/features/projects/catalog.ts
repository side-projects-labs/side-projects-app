/**
 * 허브에 노출하는 사이드 프로젝트 카탈로그.
 * url은 GitHub 레포 homepage에서 확인한 배포 주소만 등록한다.
 * jobs-scrap(private, 배포 URL 없음), side-projects-app(본 앱)은 제외.
 */
export type ProjectEntry = {
  /** 레포 이름과 동일. 푸시 이벤트의 projectId와 매칭된다. */
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  repo: string;
};

export const PROJECTS: readonly ProjectEntry[] = [
  {
    id: 'portfolio-admin',
    name: 'Portfolio Admin',
    description: '포트폴리오 관리자',
    icon: '🗂️',
    url: 'https://admin.ycseng.com',
    repo: 'side-projects-labs/portfolio-admin',
  },
  {
    id: 'jobs-scrap-dashboard',
    name: 'Jobs Scrap Dashboard',
    description: 'FE 공고 데이터 대시보드',
    icon: '📊',
    url: 'https://scrap.ycseng.com',
    repo: 'side-projects-labs/jobs-scrap-dashboard',
  },
  {
    id: 'Dreamweaver-AI',
    name: 'Dreamweaver AI',
    description: '나만의 동화책 만들기 with AI',
    icon: '📖',
    url: 'https://dreamweaver-ai-beta.vercel.app',
    repo: 'side-projects-labs/Dreamweaver-AI',
  },
  {
    id: 'stock-ai-platform',
    name: 'Stock AI Platform',
    description: '주식 AI 분석 및 종목 추천',
    icon: '📈',
    url: 'https://stock-ai-platform-beige.vercel.app',
    repo: 'side-projects-labs/stock-ai-platform',
  },
];

export function findProject(id: string | undefined): ProjectEntry | undefined {
  return PROJECTS.find((p) => p.id === id);
}
