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
    backbone: 'Omicron / Highwinds (최장 Retention)',
    newsgroups: '125,000+',
    retention: '5,878+ 일 (약 16년 - 최장 보존)',
    badge: 'Fill Account 1위 추천',
    badgeColor: '#8b5cf6', // purple
    monthlyCapacity: '구매 블록 용량 (무기한 이월)',
    recommendation: '오래된 희귀 자료 다운로드용 보완(Fill) 블록 계정 필수 1순위',
    plans: [
      { name: '50GB Block', price: '$5.49 (약 7,400원)', speed: 'Unlimited', conn: 50, capacity: '50 GB ($0.11/GB)', type: 'block' },
      { name: '100GB Block', price: '$8.99 (약 12,100원)', speed: 'Unlimited', conn: 50, capacity: '100 GB ($0.09/GB)', type: 'block' },
      { name: '200GB Block', price: '$14.49 (약 19,500원)', speed: 'Unlimited', conn: 50, capacity: '200 GB ($0.07/GB)', type: 'block', highlight: true },
      { name: '500GB Block', price: '$24.99 (약 33,700원)', speed: 'Unlimited', conn: 50, capacity: '500 GB ($0.05/GB)', type: 'block' },
      { name: '1024GB (1TB) Block', price: '$39.99 (약 54,000원)', speed: 'Unlimited', conn: 50, capacity: '1,024 GB ($0.04/GB)', type: 'block' },
      { name: '3072GB (3TB) Block', price: '$99.99 (약 135,000원)', speed: 'Unlimited', conn: 50, capacity: '3,072 GB ($0.03/GB)', type: 'block' },
    ],
    features: [
      '업계 최장 보유 기간(5,878일+) Omicron 백본 직접 이용',
      'Non-Expiring (구매한 용량이 절대로 만료되거나 사라지지 않음)',
      'SABnzbd / NZBGet 등의 2차 우선순위(Priority 1) 백업용 최고',
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
    </div>
  );
}
