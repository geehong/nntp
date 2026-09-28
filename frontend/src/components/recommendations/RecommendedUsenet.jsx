import React, { useState } from 'react';
import {
  Globe,
  ExternalLink,
  ShieldCheck,
  Zap,
  HardDrive,
  Database,
  Layers,
  Calculator,
  CheckCircle2,
  Sparkles,
  Search,
  Filter,
  ArrowUpRight,
  Clock,
  Tag
} from 'lucide-react';

const PROVIDERS_DATA = [
  {
    id: 'newshosting',
    name: 'Newshosting',
    url: 'https://www.newshosting.com/',
    backbone: 'Omicron / Newshosting (글로벌 1위)',
    newsgroups: '120,000+',
    retention: '6,400+ 일 (17년+ 최장 보유)',
    badge: 'Tom\'s Guide 종합 1위',
    badgeColor: '#0284c7', // blue
    monthlyCapacity: '무제한 (Unlimited)',
    recommendation: 'Tom\'s Guide 및 해외 평가 종합 1위. 17년+ 최장 보유기간, 99.9% 완결성, 검색 및 프리뷰 기능 자체 뉴스리더 & 무료 VPN 포함',
    plans: [
      { name: 'Special 12+3 Deal', price: '$5.99 / 월 (약 8,100원)', speed: 'Unlimited', conn: 100, capacity: '무제한 (15개월 할인가)', highlight: true },
      { name: 'Unlimited Monthly', price: '$12.95 / 월 (약 17,500원)', speed: 'Unlimited', conn: 100, capacity: '무제한', highlight: false },
      { name: 'XL Powerpack', price: '$15.83 / 월 (약 21,300원)', speed: 'Unlimited', conn: 100, capacity: '무제한 + VPN + Easynews 웹검색', highlight: false },
    ],
    features: [
      'Tom\'s Guide 선정 2026 베스트 유즈넷 서비스 종합 1위',
      '17년+ (6,400일+) 업계 최고 아티클 보존 기간 및 99.9% 다운로드 완결률',
      '파일 프리뷰 및 직관적 검색이 가능한 전용 Newsreader 제공',
      '미국/유럽 멀티 데이터센터 보유로 회선 속도 100% 포화',
      '무제한 플랜 시 스위스 기반 노로그(No-Log) VPN 무료 제공'
    ]
  },
  {
    id: 'eweka',
    name: 'Eweka',
    url: 'https://www.eweka.nl/',
    backbone: 'Independent Dutch Backbone (유럽 1위 백본)',
    newsgroups: '125,000+',
    retention: '6,400+ 일 (17년+ 최장 보유)',
    badge: 'Tom\'s Guide 가성비 1위',
    badgeColor: '#10b981', // green
    monthlyCapacity: '무제한 (Unlimited)',
    recommendation: 'Tom\'s Guide 선정 최고의 가성비 유즈넷. 유럽 독자 백본 데이터센터로 유휴 삭제/DMCA 영향이 적고 125,000개 이상의 가장 많은 뉴스그룹 보유',
    plans: [
      { name: '15 Months Special', price: '€6.99 / 월 (약 10,500원)', speed: 'Unlimited', conn: 50, capacity: '무제한 (15개월 일시불)', highlight: true },
      { name: '12 Months Plan', price: '€9.00 / 월 (약 13,500원)', speed: 'Unlimited', conn: 50, capacity: '무제한', highlight: false },
      { name: '1 Month Standard', price: '€9.50 / 월 (약 14,250원)', speed: 'Unlimited', conn: 50, capacity: '무제한', highlight: false },
    ],
    features: [
      '유럽 최고의 독립 데이터센터 및 대서양 가로지르는 전용 백본망 운영',
      '125,000개 이상의 뉴스그룹 지원 (업계 최상위 수치)',
      '6,400일+ 최장 Retention 보유로 오래된 희귀 자료 다운로드에 최적',
      '복잡한 단계 없는 투명하고 명확한 단일 가격 플랜'
    ]
  },
  {
    id: 'usenetserver',
    name: 'UsenetServer',
    url: 'https://www.usenetserver.com/',
    backbone: 'Tier-1 Backbone (로우 데이터 검색)',
    newsgroups: '100,000+',
    retention: '6,400+ 일 (17년+)',
    badge: 'Tom\'s Guide 수동검색 1위',
    badgeColor: '#8b5cf6', // purple
    monthlyCapacity: '무제한 (Unlimited)',
    recommendation: 'Global Search로 인덱서에 등록되지 않은 숨겨진/난수화된 파일 직접 쿼리 가능. Tier-1 회선으로 20커넥션만으로도 900+Mbps 완벽 대역폭 보장',
    plans: [
      { name: 'Annual Exclusive', price: '$7.95 / 월 (약 10,700원)', speed: 'Unlimited', conn: 20, capacity: '무제한 + PrivadoVPN 포함', highlight: true },
      { name: '3 Months Plan', price: '$8.95 / 월 (약 12,000원)', speed: 'Unlimited', conn: 20, capacity: '무제한', highlight: false },
      { name: '1 Month Standard', price: '$14.95 / 월 (약 20,100원)', speed: 'Unlimited', conn: 20, capacity: '무제한', highlight: false },
    ],
    features: [
      'Global Search 기능으로 외부 인덱서에서 빠진 원본 데이터 아카이브 직검색 가능',
      'Tier-1 백본 망으로 20개 커넥션만으로 900Mbps 이상의 회선 속도 완벽 소화',
      '6,400일+ 최상위 아티클 보존 기간 제공',
      '연간 플랜 결제 시 PrivadoVPN (노로그 프리미엄 VPN) 무료 포함'
    ]
  },
  {
    id: 'giganews',
    name: 'Giganews',
    url: 'https://www.giganews.com/',
    backbone: 'Giganews High-Speed Active Storage',
    newsgroups: '110,000+',
    retention: '1,800+ 일 (최신 5년 액티브 전용)',
    badge: '최신자료 속도 1위',
    badgeColor: '#e11d48', // rose
    monthlyCapacity: '무제한 (Unlimited)',
    recommendation: '최근 5년 이내의 자료를 가장 빠르고 100% 손실 없이 다운로드받고 싶을 때 최적. VyprVPN 무료 번들 및 전문 엔지니어 지원',
    plans: [
      { name: '1 Year Plan', price: '$8.33 / 월 (약 11,200원)', speed: 'Unlimited', conn: 100, capacity: '무제한 + VyprVPN 포함', highlight: true },
      { name: '6 Months Plan', price: '$9.17 / 월 (약 12,300원)', speed: 'Unlimited', conn: 100, capacity: '무제한 + VyprVPN', highlight: false },
      { name: '1 Month Standard', price: '$9.99 / 월 (약 13,500원)', speed: 'Unlimited', conn: 100, capacity: '무제한 + VyprVPN', highlight: false },
    ],
    features: [
      '느린 장기 아카이브 대신 고속 액티브 스토리지 중심 운영으로 압도적 다운로드 속도',
      '최근 5년 이내 자료에 대해 100% 완결성(Completion Rate) 보장',
      '업계 최고 수준의 VyprVPN 프리미엄 서비스 전 플랜 무료 포함',
      '100개 동시 SSL 커넥션 및 24/7 전문 기술지원팀 운영'
    ]
  },
  {
    id: 'tweaknews',
    name: 'TweakNews',
    url: 'https://www.tweaknews.eu/',
    backbone: 'Independent Dutch Backbone',
    newsgroups: '120,000+',
    retention: '5,000+ 일 (약 13.6년)',
    badge: '유연한 플랜 / 블록 1위',
    badgeColor: '#f97316', // orange
    monthlyCapacity: '속도제한 플랜 또는 블록 용량',
    recommendation: '속도별 알뜰 플랜(50Mbps/100Mbps/무제한)과 유효기간 무제한 블록 계정을 모두 제공하는 유비무환 유즈넷',
    plans: [
      { name: 'Fast Plan (50Mbps)', price: '€5.83 / 월 (약 8,700원)', speed: '50 Mbit/s (6.25 MB/s)', conn: 30, capacity: '30일 16.20 TB 수용', highlight: false },
      { name: 'Lightning (100Mbps)', price: '€7.50 / 월 (약 11,250원)', speed: '100 Mbit/s (12.5 MB/s)', conn: 45, capacity: '30일 32.40 TB 수용', highlight: false },
      { name: 'Ultimate + VPN', price: '€9.07 / 월 (약 13,600원)', speed: 'Unlimited', conn: 60, capacity: '무제한 + VPN 포함', highlight: true },
      { name: '500GB Block', price: '€45.00 (약 67,500원)', speed: 'Unlimited', conn: 30, capacity: '500 GB (무기한 이월)', type: 'block' },
    ],
    features: [
      '인터넷 속도에 맞춘 유연한 속도제한 플랜(50Mbit/100Mbit)으로 비용 절감',
      '유효기간이 절대 만료되지 않는 비만료(Non-expiring) 블록 계정 제공',
      '전용 뉴스리더 UsenetWire 제공 및 스위스/네덜란드 백본 이용',
      '5,000일 이상의 깊은 보존 기간 지원'
    ]
  },
  {
    id: 'easynews',
    name: 'Easynews',
    url: 'https://www.easynews.com/',
    backbone: 'Omicron / Easynews Web Engine',
    newsgroups: '120,000+',
    retention: '6,400+ 일 (17년+)',
    badge: '입문자 / 브라우저 1위',
    badgeColor: '#06b6d4', // cyan
    monthlyCapacity: '웹 브라우저 다운로드 또는 NNTP 무제한',
    recommendation: '프로그램 설치 없이 웹 브라우저에서 바로 검색/재생/다운로드 가능! 초보자가 유즈넷을 시작하기에 가장 쉬운 최고의 전용 웹 인터페이스 제공',
    plans: [
      { name: 'Annual Unlimited Special', price: '$5.99 / 월 (약 8,100원)', speed: 'Unlimited', conn: 60, capacity: '무제한 웹 + NNTP (15개월 할인가)', highlight: true },
      { name: 'Classic Plan', price: '$9.95 / 월 (약 13,400원)', speed: 'Unlimited', conn: 20, capacity: '웹 20GB/월 (미사용 이월)', highlight: false },
      { name: 'Big Gig Plan', price: '$14.95 / 월 (약 20,100원)', speed: 'Unlimited', conn: 20, capacity: '웹 150GB/월 + NNTP 포함', highlight: false },
    ],
    features: [
      '별도의 다운로드 프로그램(SABnzbd 등) 없이 웹 브라우저에서 1클릭 다운로드',
      '미디어 썸네일 미리보기, 코덱/해상도별 브라우저 즉시 스트리밍 지원',
      '미사용 웹 다운로드 트래픽이 다음 달로 이월되는 Gig Bank 시스템',
      '6,400일+ 최고의 retention 및 120,000+ 뉴스그룹 지원'
    ]
  },
  {
    id: 'vipernews',
    name: 'ViperNews',
    url: 'https://www.vipernews.com/',
    backbone: 'Independent EU (독자 백본)',
    newsgroups: '110,000+',
    retention: '3,500+ 일 (Binary & Text)',
    badge: '가성비 1위 추천',
    badgeColor: '#10b981', // green
    monthlyCapacity: '3.24 TB ~ 무제한 (속도별)',
    recommendation: '백그라운드 저장용으로 월 $1.79 (약 2,400원 / 월 3.24TB) 플랜 강추',
    plans: [
      { name: 'VIPER10', price: '$1.79 / 월 (약 2,400원)', speed: '10 Mbit/s (1.25 MB/s)', conn: 5, capacity: '30일 3.24 TB / 31일 3.35 TB', highlight: true },
      { name: 'VIPER50', price: '$2.69 / 월 (약 3,600원)', speed: '50 Mbit/s (6.25 MB/s)', conn: 20, capacity: '30일 16.20 TB / 31일 16.74 TB', highlight: false },
      { name: 'VIPERUNL', price: '$3.59 / 월 (약 4,800원)', speed: 'Unlimited', conn: 40, capacity: '무제한 (Unlimited)', highlight: false },
      { name: '500GB Block', price: '$13.99 (약 19,000원)', speed: 'Unlimited', conn: 40, capacity: '500 GB (무기한 이월)', type: 'block' },
      { name: '1000GB Block', price: '$23.99 (약 32,400원)', speed: 'Unlimited', conn: 40, capacity: '1,000 GB (무기한 이월)', type: 'block' },
      { name: '2000GB Block', price: '$42.99 (약 58,000원)', speed: 'Unlimited', conn: 40, capacity: '2,000 GB (무기한 이월)', type: 'block' },
    ],
    features: [
      '독자 구축 네덜란드 서버로 DMCA/NTD 대응 유연',
      '256-bit SSL 암호화 연결 기본 제공',
      '7일 무조건 환불 보장',
      '40개 소켓 커넥션 지원'
    ]
  },
  {
    id: 'usenetfarm',
    name: 'Usenet.Farm',
    url: 'https://usenet.farm/',
    backbone: 'Independent + Hybrid (자체 독자 백본)',
    newsgroups: '110,000+',
    retention: '3,000+ 일 (자체 렌탈/캐시 풀)',
    badge: '독자 백본 대시보드 연동',
    badgeColor: '#0284c7', // blue
    monthlyCapacity: '5 TB ~ 10 TB Fair-Use (이후 48Mbit 속도제한)',
    recommendation: '자체 렌탈 풀 서버로 속도가 우수하며 본 앱 대시보드와 직연동',
    plans: [
      { name: 'Stingy', price: '€4.95 / 월 (약 7,400원)', speed: '100 Mbit/s (12.5 MB/s)', conn: 40, capacity: '5TB Fair-Use (이후 48Mbit)', highlight: false },
      { name: 'To the max', price: '€7.95 / 월 (약 11,900원)', speed: 'Unlimited', conn: 40, capacity: '10TB Fair-Use (이후 48Mbit)', highlight: true },
      { name: 'Block 500GB', price: '€15.00 (약 22,500원)', speed: 'Unlimited', conn: 50, capacity: '500 GB (무기한 이월)', type: 'block' },
    ],
    features: [
      '자체 풀 렌탈 엔진으로 프라이버시 최우선',
      '대시보드 실시간 트래픽 그래프 제공 (본 웹앱에 직연동)',
      '속도 제한 없는 무기한 500GB 블록 계정 제공',
      'Account Sharing 허용 (To the max & Block 플랜)'
    ]
  },
  {
    id: 'blocknews',
    name: 'Blocknews',
    url: 'https://blocknews.net/',
    backbone: 'Abavia / BaseIP (Block Reseller)',
    newsgroups: '115,000+',
    retention: '1,500~2,000+ 일 (헤더 단축 인덱스)',
    badge: '충전형 Fill Account 추천',
    badgeColor: '#8b5cf6', // purple
    monthlyCapacity: '구매 블록 용량 (무기한 이월)',
    recommendation: '메인 서버의 누락 조각(Missing Parts) 보충 및 만료 없는 이월용 충전형 블록 계정',
    plans: [
      { name: '50GB Block', price: '$5.49 (약 7,400원)', speed: 'Unlimited', conn: 50, capacity: '50 GB (무기한 이월)', type: 'block' },
      { name: '100GB Block', price: '$8.99 (약 12,100원)', speed: 'Unlimited', conn: 50, capacity: '100 GB (무기한 이월)', type: 'block' },
      { name: '200GB Block', price: '$14.49 (약 19,500원)', speed: 'Unlimited', conn: 50, capacity: '200 GB (무기한 이월)', type: 'block', highlight: true },
      { name: '500GB Block', price: '$24.99 (약 33,700원)', speed: 'Unlimited', conn: 50, capacity: '500 GB (무기한 이월)', type: 'block' },
      { name: '1024GB (1TB) Block', price: '$39.99 (약 54,000원)', speed: 'Unlimited', conn: 50, capacity: '1,024 GB (무기한 이월)', type: 'block' },
      { name: '3072GB (3TB) Block', price: '$99.99 (약 135,000원)', speed: 'Unlimited', conn: 50, capacity: '3,072 GB (무기한 이월)', type: 'block' },
    ],
    features: [
      'Non-Expiring (구매한 용량이 절대로 만료되거나 사라지지 않음)',
      'SABnzbd / NZBGet 등에서 2차 우선순위(Priority 1) 누락 조각 보충용(Fill Server)',
      '메인 서버(Usenet.Farm / Eweka)에서 빠진 조각 자동 채움',
      'PayPal, 신용카드, 가상화폐 결제 지원'
    ]
  },
  {
    id: 'newsgroupdirect',
    name: 'NewsgroupDirect (NGD)',
    url: 'https://newsgroupdirect.com/',
    backbone: 'UsenetExpress Backbone',
    newsgroups: '120,000+',
    retention: '5,878+ 일 Binary Retention',
    badge: '대용량 프로모션 1위',
    badgeColor: '#f97316', // orange
    monthlyCapacity: '무제한 또는 대용량 블록 (TB 단위)',
    recommendation: 'Triple Play 콤보 플랜 (Supernews + ViperNews + Usenet.Farm 접근 포함)',
    plans: [
      { name: 'Monthly Unlimited', price: '$9.00 / 월 (약 12,100원)', speed: 'Unlimited', conn: 100, capacity: '무제한 (VPN 포함)', highlight: true },
      { name: 'Unlimited Yearly', price: '$75.00 / 년 (약 101,000원 / 월 8,400원)', speed: 'Unlimited', conn: 100, capacity: '무제한 (월 $6.25 꼴)', highlight: false },
      { name: 'Triple Play Monthly', price: '$13.00 / 월 (약 17,500원)', speed: 'Unlimited', conn: 100, capacity: 'Supernews + Viper + Farm 콤보', highlight: false },
      { name: '500GB Block', price: '$25.00 (약 33,700원)', speed: 'Unlimited', conn: 100, capacity: '500 GB (무기한 이월)', type: 'block' },
      { name: '1000GB Block', price: '$45.00 (약 60,700원)', speed: 'Unlimited', conn: 100, capacity: '1,000 GB (무기한 이월)', type: 'block' },
      { name: '2000GB Block', price: '$75.00 (약 101,000원)', speed: 'Unlimited', conn: 100, capacity: '2,000 GB (무기한 이월)', type: 'block' },
    ],
    features: [
      'UsenetExpress 독립 백본 + 멀티 백본 액세스',
      '최대 100개의 동시 SSL 소켓 커넥션 제공',
      'Ghost Path VPN 무료 포함',
      '15GB / 30일 환불 보장'
    ]
  },
  {
    id: 'usenetexpress',
    name: 'UsenetExpress',
    url: 'https://usenetexpress.com/',
    backbone: 'UsenetExpress Independent',
    newsgroups: '120,000+',
    retention: '4,000+ 일',
    badge: '북미/유럽 고속 백본',
    badgeColor: '#06b6d4',
    monthlyCapacity: '무제한 또는 블록 용량',
    recommendation: '자체 망을 보유한 고성능 가성비 유즈넷 백본',
    plans: [
      { name: 'Monthly Unlimited', price: '$10.00 / 월 (약 13,500원)', speed: 'Unlimited', conn: 50, capacity: '무제한 (VPN 포함)', highlight: true },
      { name: '6 Months Unlimited', price: '$50.00 / 6개월 (약 67,500원)', speed: 'Unlimited', conn: 50, capacity: '무제한 (월 $8.33 꼴)', highlight: false },
      { name: 'Yearly Unlimited', price: '$90.00 / 년 (약 121,500원)', speed: 'Unlimited', conn: 50, capacity: '무제한 (월 $7.50 꼴)', highlight: false },
      { name: '500GB Block', price: '$20.00 (약 27,000원)', speed: 'Unlimited', conn: 50, capacity: '500 GB (무기한 이월)', type: 'block' },
    ],
    features: [
      '직접 운영하는 독립 백본망으로 고속 전송',
      '미국 동/서부 및 네덜란드 거점 서버',
      '30일 위험 부담 없는 환불 보장',
      'VPN 계정 포함'
    ]
  },
  {
    id: 'bulknews',
    name: 'Bulknews',
    url: 'https://www.bulknews.eu/',
    backbone: 'Abavia Backbone',
    newsgroups: '110,000+',
    retention: '3,000+ 일',
    badge: '유럽 Abavia 백본',
    badgeColor: '#64748b',
    monthlyCapacity: '블록 구매 용량 (무기한 이월)',
    recommendation: 'Abavia 백본 기반 유럽산 알뜰 블록 계정',
    plans: [
      { name: 'BLOCK 100', price: '€15.00 (약 22,500원)', speed: 'Unlimited', conn: 30, capacity: '100 GB (무기한 이월)', type: 'block' },
      { name: 'BLOCK 500', price: '€35.00 (약 52,500원)', speed: 'Unlimited', conn: 30, capacity: '500 GB (무기한 이월)', type: 'block' },
      { name: 'BLOCK 1000', price: '€60.00 (약 90,000원)', speed: 'Unlimited', conn: 30, capacity: '1,000 GB (무기한 이월)', type: 'block', highlight: true },
      { name: 'BLOCK 2500', price: '€90.00 (약 135,000원)', speed: 'Unlimited', conn: 30, capacity: '2,500 GB (무기한 이월)', type: 'block' },
      { name: 'BLOCK 6000', price: '€140.00 (약 210,000원)', speed: 'Unlimited', conn: 30, capacity: '6,000 GB (무기한 이월)', type: 'block' },
    ],
    features: [
      'Abavia 백본으로 안정적인 유럽 아티클 보존',
      '최대 30개 커넥션 및 SSL 기본 포함',
      'TRIAL 10GB 무료 체험 제공'
    ]
  },
  {
    id: 'xsnews',
    name: 'XS News',
    url: 'https://www.xsnews.nl/',
    backbone: 'Abavia / XS News Independent',
    newsgroups: '110,000+',
    retention: '3,200+ 일',
    badge: '유럽 대표 고속회선',
    badgeColor: '#3b82f6',
    monthlyCapacity: '16.20 TB ~ 무제한 (속도별)',
    recommendation: 'Basic 50 플랜(약 4,400원/월, 50Mbps)으로 한 달 최대 16.2TB 다운로드 가능',
    plans: [
      { name: 'Basic 50', price: '€2.95 / 월 (약 4,400원)', speed: '50 Mbit/s (6.25 MB/s)', conn: 50, capacity: '30일 16.20 TB / 31일 16.74 TB', highlight: true },
      { name: 'Unlimited', price: '€4.95 / 월 (약 7,400원)', speed: 'Unlimited speed', conn: 100, capacity: '무제한 (Unlimited)', highlight: false },
      { name: '1000GB Block', price: '€45.00 (약 67,500원)', speed: 'Unlimited', conn: 30, capacity: '1,000 GB (무기한 이월)', type: 'block' },
    ],
    features: [
      'Unlimited 플랜 이용 시 무제한 속도 & 100개 동시 SSL 커넥션',
      'Basic 50 플랜으로 월 약 4,400원에 최대 16.2TB 수용 가능',
      '14일 조건 없는 환불 보장',
      'TLS 암호화 연결 기본 제공'
    ]
  }
];

export default function RecommendedUsenet() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  
  // Speed Calculator State
  const [customSpeed, setCustomSpeed] = useState(10); // Mbit/s

  const filteredProviders = PROVIDERS_DATA.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.backbone.toLowerCase().includes(search.toLowerCase()) ||
      p.recommendation.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'block') {
      return p.plans.some((plan) => plan.type === 'block');
    }
    if (filter === 'independent') {
      return p.backbone.includes('독자') || p.backbone.includes('Independent');
    }
    if (filter === 'budget') {
      return p.id === 'vipernews' || p.id === 'usenetfarm' || p.id === 'newsgroupdirect' || p.id === 'xsnews';
    }
    return true;
  });

  // Calculator Logic
  const bytesPerSec = (customSpeed * 1000 * 1000) / 8;
  const gbPerDay = (bytesPerSec * 86400) / (1000 * 1000 * 1000);
  const tb30Days = (gbPerDay * 30) / 1000;
  const tb31Days = (gbPerDay * 31) / 1000;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#1e293b' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '16px',
          padding: '28px 32px',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
          marginBottom: '28px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '-40px',
            top: '-40px',
            width: '240px',
            height: '240px',
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)',
            borderRadius: '50%',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Sparkles color="#38bdf8" size={24} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Recommended Usenet Providers & Plans (KRW Currency Added)
          </span>
        </div>

        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '10px', color: '#ffffff', letterSpacing: '-0.02em' }}>
          유즈넷 백본별 뉴스그룹 보유기간 · 실시간 최신 가격(원화 환산) 및 분석
        </h1>

        <p style={{ fontSize: '0.95rem', color: '#94a3b8', maxWidth: '900px', lineHeight: 1.6 }}>
          달러($) 및 유로(€) 가격 옆에 직관적으로 비교하실 수 있도록 <strong>원화(KRW, 약 환산가)</strong> 표기를 추가하였습니다. (1달러 ≈ 1,350원, 1유로 ≈ 1,500원 기준)
        </p>

        {/* Quick Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px 16px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={14} color="#38bdf8" /> 검증 제공업체
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>7개 대표 Provider</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px 16px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} color="#a855f7" /> 최장 Retention (보유기간)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#a855f7', marginTop: '4px' }}>5,878+ 일 (Blocknews/NGD)</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px 16px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="#34d399" /> 최고 가성비 월정액
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>약 2,400원 / 월 ($1.79)</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px 16px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} color="#fb923c" /> 백본(Backbone) 종류
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>독자 / Omicron / Express</div>
          </div>
        </div>
      </div>

      {/* Speed & Monthly Capacity Calculator */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '20px 24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Calculator color="#0284c7" size={20} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
            ⚡ 속도제한 플랜 1달(30일/31일) 수용 다운로드 용량 계산기
          </h2>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '260px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
              속도 제한 설정 (Mbit/s): <strong>{customSpeed} Mbps</strong> (초당 {(customSpeed / 8).toFixed(2)} MB/s)
            </label>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={customSpeed}
              onChange={(e) => setCustomSpeed(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {[10, 20, 48, 50, 100].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setCustomSpeed(spd)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: customSpeed === spd ? '#0284c7' : '#f8fafc',
                    color: customSpeed === spd ? '#ffffff' : '#334155',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {spd} Mbps
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              background: '#f8fafc',
              padding: '12px 20px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>1일 (24시간) 최대</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{gbPerDay.toFixed(1)} GB</div>
            </div>
            <div style={{ width: '1px', background: '#cbd5e1' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>1개월 (30일) 최대</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0284c7' }}>{tb30Days.toFixed(2)} TB ({ (tb30Days * 1000).toFixed(0) } GB)</div>
            </div>
            <div style={{ width: '1px', background: '#cbd5e1' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>1개월 (31일) 최대</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{tb31Days.toFixed(2)} TB ({ (tb31Days * 1000).toFixed(0) } GB)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Reddit Provider Deals & Special Promotions Banner Link */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ff4500 0%, #ff5722 50%, #d84315 100%)',
          borderRadius: '12px',
          padding: '16px 24px',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(255, 69, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>🎁</span>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.2px' }}>
              🔥 Reddit Usenet Provider Deals & Special Promotions
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.825rem', color: 'rgba(255, 255, 255, 0.92)' }}>
              해외 유즈넷 커뮤니티 Reddit r/usenet의 최신 시크릿 프로모션, 블랙프라이데이 및 단독 세일 플랜 모음
            </p>
          </div>
        </div>

        <a
          href="https://www.reddit.com/r/usenet/wiki/providerdeals/?solution=61879bff679b403061879bff679b4030&js_challenge=1&jsc_token=2824be10929bdc604753c70a67a1c331caa9ee7c9eb5623138d2c29bf45143c8&jsc_orig_r=&utm_source=gemini"
          target="_blank"
          rel="noreferrer"
          style={{
            background: '#ffffff',
            color: '#d84315',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '0.875rem',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}
        >
          <span>Reddit 프로모션딜 바로가기</span>
          <ExternalLink size={16} />
        </a>
      </div>

      {/* 500GB Block Price Comparison */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '20px 24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Database color="#8b5cf6" size={20} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
            💾 500GB 블록 (유효기간 무제한) 제공업체 가격 비교
          </h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '10px', fontWeight: 600 }}>제공업체 (그룹명)</th>
                <th style={{ padding: '10px', fontWeight: 600 }}>플랜</th>
                <th style={{ padding: '10px', fontWeight: 600 }}>가격</th>
                <th style={{ padding: '10px', fontWeight: 600 }}>보유기간 (Retention)</th>
                <th style={{ padding: '10px', fontWeight: 600 }}>커넥션</th>
                <th style={{ padding: '10px', fontWeight: 600 }}>속도</th>
                <th style={{ padding: '10px', fontWeight: 600 }}>기간 / 수용 용량</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS_DATA.map(p => {
                const block500 = p.plans.find(plan => plan.type === 'block' && (plan.name.includes('500GB') || plan.name.includes('500 GB') || plan.name === 'BLOCK 500'));
                if (!block500) return null;
                const isCheapest = p.name === 'ViperNews';
                
                let wonPerGbText = '';
                const wonMatch = block500.price.match(/약\s*([0-9,]+)원/);
                if (wonMatch) {
                  const won = parseInt(wonMatch[1].replace(/,/g, ''), 10);
                  const wonPerGb = Math.round(won / 500);
                  wonPerGbText = `(약 ${wonPerGb}원/GB)`;
                }

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: isCheapest ? '#f0fdf4' : 'transparent' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 700, color: '#334155' }}>
                      <a href={p.url} target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {p.name}
                        <ExternalLink size={12} />
                      </a>
                    </td>
                    <td style={{ padding: '12px 10px', color: '#475569', fontWeight: 600 }}>
                      {block500.name}
                      {isCheapest && <span style={{ marginLeft: '6px', fontSize: '0.65rem', background: '#10b981', color: '#fff', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle' }}>최저가</span>}
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: 800, color: isCheapest ? '#059669' : '#0f172a' }}>
                      {block500.price}
                      {wonPerGbText && (
                        <span style={{ fontSize: '0.75rem', color: isCheapest ? '#059669' : '#64748b', fontWeight: 500, marginLeft: '6px' }}>
                          {wonPerGbText}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 10px', color: '#64748b' }}>
                      {p.retention}
                    </td>
                    <td style={{ padding: '12px 10px', color: '#64748b' }}>
                      {block500.conn} Conn
                    </td>
                    <td style={{ padding: '12px 10px', color: '#64748b' }}>
                      {block500.speed}
                    </td>
                    <td style={{ padding: '12px 10px', color: '#64748b' }}>
                      {block500.capacity}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              background: filter === 'all' ? '#ffffff' : 'transparent',
              color: filter === 'all' ? '#0f172a' : '#64748b',
              boxShadow: filter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            전체 보기 (7)
          </button>
          <button
            onClick={() => setFilter('budget')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              background: filter === 'budget' ? '#ffffff' : 'transparent',
              color: filter === 'budget' ? '#0f172a' : '#64748b',
              boxShadow: filter === 'budget' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            가성비/추천 (4)
          </button>
          <button
            onClick={() => setFilter('independent')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              background: filter === 'independent' ? '#ffffff' : 'transparent',
              color: filter === 'independent' ? '#0f172a' : '#64748b',
              boxShadow: filter === 'independent' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            독자 백본
          </button>
          <button
            onClick={() => setFilter('block')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              background: filter === 'block' ? '#ffffff' : 'transparent',
              color: filter === 'block' ? '#0f172a' : '#64748b',
              boxShadow: filter === 'block' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            블록 계정(Fill)
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="제공업체 또는 백본 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Providers Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        {filteredProviders.map((provider) => (
          <div
            key={provider.id}
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 6px -1px rgba(0, 0, 0, 0.05)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <div>
              {/* Card Top Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{provider.name}</h3>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        background: provider.badgeColor || '#0284c7',
                        padding: '3px 8px',
                        borderRadius: '12px',
                      }}
                    >
                      {provider.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={14} color="#94a3b8" /> {provider.backbone}
                  </div>
                </div>

                <a
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#0284c7',
                    textDecoration: 'none',
                    background: '#f0f9ff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #bae6fd',
                  }}
                >
                  공식 방문 <ExternalLink size={14} />
                </a>
              </div>

              {/* Recommendation Note */}
              <div
                style={{
                  background: '#f8fafc',
                  borderLeft: `4px solid ${provider.badgeColor || '#0284c7'}`,
                  padding: '10px 12px',
                  borderRadius: '4px',
                  fontSize: '0.83rem',
                  color: '#334155',
                  marginBottom: '16px',
                  lineHeight: 1.5,
                }}
              >
                💡 <strong>특징 요약:</strong> {provider.recommendation}
              </div>

              {/* Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '10px',
                  background: '#f1f5f9',
                  padding: '12px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>뉴스그룹 수</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{provider.newsgroups}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>보유기간 (Retention)</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#8b5cf6', marginTop: '2px' }}>{provider.retention}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>1달 수용 용량</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>{provider.monthlyCapacity}</div>
                </div>
              </div>

              {/* Plans Table */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={14} color="#0284c7" /> 주요 상품 플랜 (외화 + 원화 환산가)
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 10px' }}>플랜명</th>
                        <th style={{ padding: '8px 10px' }}>가격 (외화 / 원화)</th>
                        <th style={{ padding: '8px 10px' }}>속도/커넥션</th>
                        <th style={{ padding: '8px 10px' }}>1달 / 블록 수용 용량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.plans.map((plan, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: idx < provider.plans.length - 1 ? '1px solid #f1f5f9' : 'none',
                            background: plan.highlight ? '#f0fdf4' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '8px 10px', fontWeight: plan.highlight ? 700 : 500, color: plan.highlight ? '#15803d' : '#1e293b' }}>
                            {plan.name}
                            {plan.highlight && (
                              <span style={{ marginLeft: '4px', fontSize: '0.68rem', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '4px' }}>
                                추천
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>{plan.price}</td>
                          <td style={{ padding: '8px 10px', color: '#475569' }}>
                            {plan.speed} ({plan.conn} Conn)
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: plan.type === 'block' ? '#8b5cf6' : '#0284c7' }}>
                            {plan.capacity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Key Features List */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>핵심 특징 및 혜택</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {provider.features.map((feat, idx) => (
                    <div key={idx} style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={13} color="#10b981" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tom's Guide 2026 Special Buying Guide & FAQ Section */}
      <div
        style={{
          marginTop: '36px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '28px 32px',
          boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Sparkles color="#0284c7" size={22} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            📖 Tom's Guide 전문 에디터의 유즈넷 가이드 & 필수 FAQ (2026 분석)
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', fontSize: '0.875rem' }}>
          {/* Guide Item 1 */}
          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0369a1', marginBottom: '8px' }}>
              1. 보존 기간(Retention) vs 다운로드 완결률(Completion Rate)
            </h3>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>
              일반 사용자에게는 단순 Retention(보존 일수)보다 <strong>Completion Rate(다운로드 성공 완결률)</strong>이 훨씬 중요합니다. Newshosting, Eweka처럼 <strong>99.9% 완결률</strong>을 보장하는 업체는 파일 조각이 유실되어 다운로드에 실패하는 일이 거의 없습니다. 2010년 이전의 아주 희귀한 구형 자료를 찾는 것이 아니라면 3,000일 이상의 Retention이면 충분합니다.
            </p>
          </div>

          {/* Guide Item 2 */}
          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0369a1', marginBottom: '8px' }}>
              2. 동시 소켓 커넥션(Connections)은 몇 개가 적당할까?
            </h3>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>
              업체들이 50~100개 커넥션을 내세우지만, 실제 <strong>1Gbps(기가비트) 인터넷 속도를 100% 한계치까지 채우는 데는 20개 커넥션으로도 충분</strong>합니다. (실제로 UsenetServer는 20개 커넥션만으로 900+Mbps 대역폭을 모두 소화했습니다). 2Gbps 이상의 초고속 회선 사용자가 아니라면 커넥션 개수에 연연해 더 많은 돈을 지불할 필요가 없습니다.
            </p>
          </div>

          {/* Guide Item 3 */}
          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0369a1', marginBottom: '8px' }}>
              3. 무제한 월정액(Unlimited) vs 블록 계정(Block Account)
            </h3>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>
              매일 대용량 미디어를 다운로드받는 헤비 유저라면 <strong>무제한 월정액 플랜(Newshosting, Eweka, ViperNews)</strong>을 추천합니다. 반면, 어쩌다 가끔만 사용하거나 백업 보완용(Fill Account)으로만 쓰는 사용자라면 구매한 용량이 평생 차감 이월되는 <strong>TweakNews / Blocknews의 블록 계정</strong>을 선택하는 것이 비용상 훨씬 이득입니다.
            </p>
          </div>

          {/* Guide Item 4 */}
          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0369a1', marginBottom: '8px' }}>
              4. 유즈넷 이용 시 별도의 VPN이 꼭 필요한가요?
            </h3>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>
              결론부터 말하면 <strong>필수가 아닙니다.</strong> 본 추천 목록의 모든 유즈넷 제공업체는 <strong>256-bit SSL/TLS 암호화 연결</strong>을 기본 제공하므로, 통신사(ISP)가 다운로드 내용을 볼 수 없습니다. 다만, 인덱서 웹사이트 접근 시 IP 보안이나 일반 웹 브라우징 프라이버시 보호가 필요하다면 번들 VPN(Newshosting, Giganews, UsenetServer)이 포함된 플랜을 활용하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
