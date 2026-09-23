import React, { useState, useEffect } from 'react';
import { X, Folder, ChevronLeft, Loader2, Home } from 'lucide-react';

export default function FolderPickerModal({ isOpen, onClose, onSelect, initialPath }) {
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [parentPath, setParentPath] = useState(null);
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadDirectories(initialPath || '');
    }
  }, [isOpen]);

  const loadDirectories = async (pathStr) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/directories?path=${encodeURIComponent(pathStr)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load directories');
      
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);
      setDirectories(data.directories || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: '10px', width: '90%', maxWidth: '500px',
        display: 'flex', flexDirection: 'column', maxHeight: '80vh', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#1e293b' }}>
            <Folder size={18} color="#0284c7" /> Select Folder
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => loadDirectories('')} title="Go to Root" style={{ padding: '6px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Home size={15} color="#475569" />
          </button>
          <input 
            type="text" 
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadDirectories(currentPath)}
            style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />
          <button onClick={() => loadDirectories(currentPath)} style={{ padding: '6px 12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            Go
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', minHeight: '300px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="spin" size={24} color="#0284c7" /></div>
          ) : error ? (
            <div style={{ color: '#ef4444', padding: '20px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 500 }}>{error}</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {parentPath && (
                <li onClick={() => loadDirectories(parentPath)} style={{ padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <ChevronLeft size={16} color="#64748b" />
                  <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>.. (Go up)</span>
                </li>
              )}
              {directories.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>No subfolders found.</div>
              )}
              {directories.map(dir => (
                <li key={dir} onClick={() => loadDirectories(`${currentPath.endsWith('/') || currentPath.endsWith('\\') ? currentPath : currentPath + '/'}${dir}`)} style={{ padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.background='#f0f9ff'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <Folder size={16} color="#94a3b8" />
                  <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{dir}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc', borderRadius: '0 0 10px 10px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
            Cancel
          </button>
          <button onClick={() => { onSelect(currentPath); onClose(); }} style={{ padding: '8px 16px', background: '#0284c7', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>
            Select This Folder
          </button>
        </div>
      </div>
    </div>
  );
}
