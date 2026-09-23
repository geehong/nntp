import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Star, Download, AlertCircle } from 'lucide-react';
import { useNNTPStore } from '../../store/useNNTPStore';

export default function StatusDashboard() {
  const { credentials } = useNNTPStore();
  const [stats, setStats] = useState({ usage: [], totalGroups: 0, favGroups: 0 });
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);

    fetch('/api/dashboard/favorites')
      .then(res => res.json())
      .then(data => setFavorites(data))
      .catch(console.error);
  }, []);

  // Process chart data from server usage
  const formatServerName = (id) => id.replace('server-', '').toUpperCase();

  const chartDataMap = {};
  stats.usage.forEach(row => {
    if (!chartDataMap[row.date]) chartDataMap[row.date] = { date: row.date };
    chartDataMap[row.date][formatServerName(row.server_id)] = (row.bytes_downloaded / (1024 * 1024 * 1024)).toFixed(2);
  });
  const chartData = Object.values(chartDataMap).sort((a, b) => a.date.localeCompare(b.date));
  const servers = [...new Set(stats.usage.map(u => formatServerName(u.server_id)))];
  const colors = ['#f97316', '#0284c7', '#8b5cf6', '#10b981'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      
      {/* Top Stats */}
      <div className="farm-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <div className="stat-card" style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Data Used (30 Days)</div>
          <div className="value" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
            {stats.usage.reduce((sum, r) => sum + r.bytes_downloaded, 0) > 0 
              ? (stats.usage.reduce((sum, r) => sum + r.bytes_downloaded, 0) / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
              : '0 GB'}
          </div>
        </div>
        <div className="stat-card" style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Newsgroups</div>
          <div className="value" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0284c7' }}>{stats.totalGroups}</div>
        </div>
        <div className="stat-card" style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Favorite Groups</div>
          <div className="value" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{stats.favGroups}</div>
        </div>
      </div>

      {/* Usage Chart */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Server Data Usage (GB)
          </h3>
        </div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              {servers.map((srv, idx) => (
                <Area key={srv} type="monotone" dataKey={srv} stackId="1" stroke={colors[idx % colors.length]} fill={colors[idx % colors.length]} fillOpacity={0.3} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Favorites Fetch Status */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Star size={16} fill="#f59e0b" color="#f59e0b" /> Favorite Groups Retrieval Status
        </h3>
        
        {favorites.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
            No favorite groups yet. Star a group in the sidebar to track its download progress here.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '10px' }}>Server</th>
                  <th style={{ padding: '10px' }}>Group Name</th>
                  <th style={{ padding: '10px' }}>Total Articles</th>
                  <th style={{ padding: '10px' }}>Fetch Progress</th>
                  <th style={{ padding: '10px' }}>Fetched Blocks</th>
                </tr>
              </thead>
              <tbody>
                {favorites.map((fav, i) => {
                  const fetchedCount = fav.ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
                  const progressPct = fav.total_articles > 0 ? Math.min(100, Math.round((fetchedCount / fav.total_articles) * 100)) : 0;
                  
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 10px', color: '#64748b', fontWeight: 600 }}>{formatServerName(fav.server_id)}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 600, color: '#334155' }}>{fav.name}</td>
                      <td style={{ padding: '12px 10px', color: '#64748b' }}>{fav.total_articles.toLocaleString()}</td>
                      <td style={{ padding: '12px 10px', width: '250px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, background: '#e2e8f0', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct === 100 ? '#10b981' : '#3b82f6' }}></div>
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{progressPct}%</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                          {fetchedCount.toLocaleString()} / {fav.total_articles.toLocaleString()} fetched
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', color: '#64748b', fontSize: '0.75rem' }}>
                        {fav.ranges.length === 0 ? '-' : fav.ranges.map(r => (
                          <div key={`${r.start}-${r.end}`}>
                            {r.start} &rarr; {r.end}
                          </div>
                        ))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
