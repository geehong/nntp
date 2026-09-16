# Easynews 스타일 NNTP 뉴스그룹 웹 클라이언트 설계 및 계획서

Easynews 스타일의 **심플하고 빠른 무료 어드민 대시보드** 레이아웃 기반 NNTP 뉴스그룹 웹 클라이언트 설계 문서입니다.

---

## 1. UX/UI 레이아웃 구조 (Easynews 표본)

웹 애플리케이션 화면은 3개의 주요 구역(Top Header, Left Sidebar, Main Content)으로 나뉩니다.

```
+-----------------------------------------------------------------------------------+
|  [TOP MENU] Logo | Search Groups/Articles | Dashboard | Credentials | Downloads  |
+-------------------+---------------------------------------------------------------+
| [LEFT SIDEBAR]    | [MAIN CONTENT AREA]                                           |
|                   |                                                               |
| 🔍 Newsgroup Search| 📌 Selected Group: alt.binaries.moments                       |
|                   | ------------------------------------------------------------- |
| 📁 Categories     | [Filter/Search] [Sort: Date/Subject/Size] [View: Table/Grid]  |
|  ├─ alt.binaries.*| ------------------------------------------------------------- |
|  ├─ comp.lang.*   | 📄 Article List (Easynews Table Style)                        |
|  ├─ rec.arts.*    |  - Subject / Title                                            |
|  └─ misc.*        |  - Poster / Date                                              |
|                   |  - Size / Part Count                                          |
| ⭐ Favorite Groups |  - Actions: [Preview] [Download NZB/Raw] [View Article Body]   |
|                   | ------------------------------------------------------------- |
| 📊 Connection Status| 🔍 Article Detail / Body Viewer Component                     |
+-------------------+---------------------------------------------------------------+
```

### 1.1 상단 탑 메뉴 (Top Header Navigation)
- **로고 & 브랜딩**: Easynews / Usenet Farm 스타일 심플 헤더
- **검색 바**: 전역 아티클 및 뉴스그룹 빠른 검색 (Subject / Keyword / Message-ID)
- **메인 탭 네비게이션**:
  - `Reader / Newsgroup` (메인 브라우저)
  - `Usenet.Farm Dashboard` (트래픽 그래프 & 연결 통계 대시보드)
  - `Server Credentials` (NNTP 서버 설정)
  - `Download Queue` (NZB/아티클 다운로드 상태)

### 1.2 좌측 사이드바 (Left Sidebar - Newsgroup Browser)
- **뉴스그룹 검색 및 트어 구조**:
  - 인기 카테고리 트리 (`alt.binaries.*`, `comp.*`, `rec.*`, `sci.*`, `news.*` 등)
  - 즐겨찾기 뉴스그룹 (Starred Groups)
  - 그룹별 최근 읽은 기록 및unread 수량 바지

### 1.3 본문 영역 (Main Content Area - Article Reader)
- **뉴스그룹 아티클 목록 테이블 (Easynews 표본)**:
  - 아티클 목록 (제목, 작성자, 작성일시, 아티클 크기, 파트 분할 상태)
  - 파일 미디어 미리보기 (이미지/텍스트 본문 렌더링)
  - 아티클 본문 (Body) 및 인라인 뷰어 / NZB 생성 & 다운로드 버튼

---

## 2. 프레임워크 및 기술 스택 (심플 & 초고속)

- **프론트엔드 (Frontend)**:
  - **React 18 + Vite**: 번들 사이즈 최소화 및 초고속 HMR
  - **Styling**: Vanilla CSS (CSS Modules) - 외부 무거운 UI 라이브러리 없이 순수 CSS로 초경량/초고속 렌더링
  - **State**: Zustand (뉴스그룹 선택, 아티클 목록 캐싱, 소켓 상태 관리)
  - **Icons**: Lucide-React
- **백엔드 (Backend Bridge)**:
  - **Node.js + Express + WebSocket (`ws`)**
  - **NNTP Engine**: raw `net`/`tls` 소켓 관리 (NNTP `GROUP`, `XOVER`/`OVER`, `ARTICLE`, `BODY` 커맨드 파싱)

---

## 3. 컴포넌트 구조

```text
src/
├── components/
│   ├── layout/
│   │   ├── TopHeader.jsx          # 상단 탑 메뉴
│   │   └── MainLayout.jsx         # 3단 레이아웃 틀
│   ├── sidebar/
│   │   └── NewsgroupSidebar.jsx   # 좌측 뉴스그룹 목록 & 검색
│   ├── reader/
│   │   ├── ArticleTable.jsx       # 본문: Easynews 스타일 글 목록
│   │   ├── ArticleDetail.jsx      # 본문: 글 세부 내용 및 뷰어
│   │   └── GroupHeader.jsx        # 현재 뉴스그룹 정보 및 필터
│   └── dashboard/
│       └── FarmDashboard.jsx      # Usenet.Farm 대시보드 (통계/연결)
```

---

## 4. Usenet 블록 계정 (Block Account) 주요 제공업체 참고

월정액(무제한) 외 사용량(GB/TB) 단위로 차감되는 블록 계정(Fill Account) 제공업체 및 백본 정보입니다.

### 4.1 독자 / 네덜란드 독립 백본 계열
- **[Usenet.Farm](https://usenet.farm/)**
  - **월정액**: Stingy €4.95/월 (약 7,400원, 5TB Fair Use), To the max €7.95/월 (약 11,900원, 10TB Fair Use)
  - **블록 플랜**: €15.00 (약 22,500원, 500GB 1회성)
  - **보유 기간**: 3,000+ 일 (자체 렌탈 풀 + 캐시)
- **[ViperNews](https://www.vipernews.com/)**
  - **월정액**: VIPER10 $1.79/월 (약 2,400원, 월 3.24TB), VIPER50 $2.69/월 (약 3,600원), VIPERUNL $3.59/월 (약 4,800원)
  - **블록 플랜**: $13.99 (약 19,000원, 500GB), $23.99 (약 32,400원, 1TB), $42.99 (약 58,000원, 2TB)
  - **보유 기간**: 3,500+ 일

### 4.2 UsenetExpress 백본 계열 (대용량 / 가성비)
- **[NewsgroupDirect (NGD)](https://newsgroupdirect.com/)**
  - **월정액**: Unlimited $9.00/월 (약 12,100원), Yearly $75/년 (약 101,000원), Triple Play $13/월 (약 17,500원)
  - **블록 플랜**: $6(약 8,100원, 50GB), $10(약 13,500원, 100GB), $25(약 33,700원, 500GB), $45(약 60,700원, 1TB), $75(약 101,000원, 2TB)
  - **보유 기간**: 5,878+ 일 Binary Retention
- **[UsenetExpress](https://usenetexpress.com/)**
  - **월정액**: $10/월 (약 13,500원, 6개월 $50, 1년 $90)
  - **블록 플랜**: $20 (약 27,000원, 500GB 1회성)
  - **보유 기간**: 4,000+ 일

### 4.3 Omicron 백본 계열 (보존기간 Retention 최장)
- **[Blocknews](https://blocknews.net/)**
  - **블록 플랜**: $1.99(약 2,700원), $5.49(약 7,400원), $8.99(약 12,100원), $14.49(약 19,500원), $24.99(약 33,700원), $39.99(약 54,000원, 1TB), $99.99(약 135,000원, 3TB)
  - **보유 기간**: **5,878+ 일 (약 16년 - 최장 보존)**
  - **특징**: Non-Expiring 만료 없는 Fill Account 1순위 추천.

### 4.4 Abavia 계열
- **[Bulknews](https://www.bulknews.eu/)**: €15(약 22,500원, 100GB), €35(약 52,500원, 500GB), €60(약 90,000원, 1TB), €90(약 135,000원), €140(약 210,000원)
- **[XS News](https://www.xsnews.nl/)**: Basic 50 €2.95/월 (약 4,400원, 50Mbit, 월 16.2TB), Unlimited €4.95/월 (약 7,400원, 무제한 속도), €45 (약 67,500원, 1TB)

