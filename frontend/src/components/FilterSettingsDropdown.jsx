import React from 'react';
import { Tooltip } from '@mantine/core';
import { Filter, Calendar, HardDrive, Eye, Lock, RefreshCw, Layers } from 'lucide-react';

export default function FilterSettingsDropdown({
  filterOptions,
  setFilterOptions,
  onReset,
}) {
  const handleChange = (key, val) => {
    setFilterOptions((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #0284c7', borderRadius: '8px', padding: '16px', marginBottom: '16px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={16} />
          <span>🔍 Article Filter Settings (Newsbin Pro Style)</span>
        </div>
        <button
          onClick={onReset}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <RefreshCw size={12} /> Reset Filters
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '0.8rem' }}>
        {/* 1. Display Age Filter */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            <Calendar size={14} color="#0284c7" />
            <span>게시 기간 (Display Age):</span>
          </label>
          <select
            value={filterOptions.age || 'all'}
            onChange={(e) => handleChange('age', e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', fontWeight: 500 }}
          >
            <option value="all">전체 기간 (All Time)</option>
            <option value="24h">최근 24시간 이내 (Past 24 Hours)</option>
            <option value="3d">최근 3일 이내 (Past 3 Days)</option>
            <option value="7d">최근 7일 이내 (Past 7 Days)</option>
            <option value="30d">1개월 이내 (30 Days)</option>
            <option value="3m">3개월 이내 (3 Months)</option>
            <option value="6m">6개월 이내 (6 Months)</option>
            <option value="1y">1년 이내 (1 Year)</option>
            <option value="2y">2년 이내 (2 Years)</option>
            <option value="3y">3년 이내 (3 Years)</option>
            <option value="5y">5년 이내 (5 Years)</option>
            <option value="10y">10년 이내 (10 Years)</option>
          </select>
        </div>

        {/* 2. Media Type Filter */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            <Layers size={14} color="#0284c7" />
            <span>파일 종류 (Media Type):</span>
          </label>
          <select
            value={filterOptions.mediaType || 'all'}
            onChange={(e) => handleChange('mediaType', e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', fontWeight: 500 }}
          >
            <option value="all">전체 (All Media Types)</option>
            <option value="image">🖼️ 이미지 (Images)</option>
            <option value="video">🎬 동영상 (Videos)</option>
            <option value="audio">🎵 오디오 (Audio)</option>
            <option value="archive">📦 압축/문서 (Archives & Docs)</option>
          </select>
        </div>

        {/* 3. Min/Max Size Filter */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            <HardDrive size={14} color="#0284c7" />
            <span>용량 범위 (Min / Max MB):</span>
          </label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="number"
              placeholder="Min MB"
              value={filterOptions.minSizeMB || ''}
              onChange={(e) => handleChange('minSizeMB', e.target.value)}
              style={{ width: '50%', padding: '5px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
            <span style={{ color: '#94a3b8' }}>~</span>
            <input
              type="number"
              placeholder="Max MB"
              value={filterOptions.maxSizeMB || ''}
              onChange={(e) => handleChange('maxSizeMB', e.target.value)}
              style={{ width: '50%', padding: '5px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
          </div>
        </div>

        {/* 4. Read Status Filter */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            <Eye size={14} color="#0284c7" />
            <span>읽음 상태 (Read Status):</span>
          </label>
          <select
            value={filterOptions.readStatus || 'all'}
            onChange={(e) => handleChange('readStatus', e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', fontWeight: 500 }}
          >
            <option value="all">전체 보기 (Show All)</option>
            <option value="unread">안 읽은 글만 보기 (Unread Only)</option>
            <option value="read">읽은 글 숨기기 (Hide Read)</option>
          </select>
        </div>
      </div>

      {/* 5. Checkboxes (Random Subject / Split parts) */}
      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <Tooltip label="Hide automatically generated random 8-40 character hash titles" multiline w={280} withArrow>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
            <input
              type="checkbox"
              checked={!!filterOptions.hideRandomHash}
              onChange={(e) => handleChange('hideRandomHash', e.target.checked)}
            />
            <span>🔒 Hide Random Hash Subjects</span>
          </label>
        </Tooltip>

        <Tooltip label="Expand multi-part file numbers (e.g. (01/50), [1/10]) to show all split parts" multiline w={280} withArrow>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
            <input
              type="checkbox"
              checked={!!filterOptions.expandSplitParts}
              onChange={(e) => handleChange('expandSplitParts', e.target.checked)}
            />
            <span>🧩 분할 파트 펼치기 (Expand Split Parts)</span>
          </label>
        </Tooltip>
      </div>
    </div>
  );
}
