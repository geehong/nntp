import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useNNTPStore } from '../../store/useNNTPStore';

export default function FarmDashboard() {
  const { credentials } = useNNTPStore();
  const [timeframe, setTimeframe] = useState('Today');

  const chartData = [
    { time: '09:00', downloaded: 0, uploaded: 0 },
    { time: '12:00', downloaded: 1.2, uploaded: 0.1 },
    { time: '15:00', downloaded: 3.5, uploaded: 0.2 },
    { time: '18:00', downloaded: 2.1, uploaded: 0.05 },
    { time: '21:00', downloaded: 4.8, uploaded: 0.3 },
    { time: 'Aug 16', downloaded: 0.5, uploaded: 0.02 },
    { time: '03:00', downloaded: 0, uploaded: 0 },
    { time: '06:00', downloaded: 0, uploaded: 0 },
  ];

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div style={{ flex: 1 }}>
        <div className="farm-stats-grid">
          <div className="stat-card">
            <div className="label">Downloaded</div>
            <div className="value" style={{ color: '#ef4444' }}>0 B</div>
          </div>
          <div className="stat-card">
            <div className="label">Uploaded</div>
            <div className="value" style={{ color: '#0284c7' }}>0 B</div>
          </div>
          <div className="stat-card">
            <div className="label">Articles Found</div>
            <div className="value" style={{ color: '#8b5cf6' }}>0</div>
          </div>
          <div className="stat-card">
            <div className="label">Articles Not Found</div>
            <div className="value" style={{ color: '#0284c7' }}>0</div>
          </div>
          <div className="stat-card">
            <div className="label">Articles Posted</div>
            <div className="value" style={{ color: '#0284c7' }}>0</div>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              DOWNLOAD SUMMARY (A DAY AGO TO 5 MINUTES AGO)
            </h3>
            <div className="nav-tabs">
              {['Today', 'Week', 'Month', 'Quarter'].map((tf) => (
                <button
                  key={tf}
                  className={`nav-tab ${timeframe === tf ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} unit=" GB" />
                <Tooltip />
                <Area type="monotone" dataKey="downloaded" stroke="#f97316" fill="#ffedd5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}
        >
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', marginBottom: '12px' }}>
            YOUR CONNECTIONS (0)
          </h3>
          <table className="article-table">
            <thead>
              <tr>
                <th>IP:Port</th>
                <th>Active Since</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={2} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                  No active socket connections to news.usenet.farm
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444' }}>
            10 GB
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            REMAINING
          </div>

          <div
            style={{
              height: '8px',
              background: '#ef4444',
              borderRadius: '4px',
              margin: '16px 0 8px 0',
            }}
          />
          <div
            style={{
              display: 'flex',
              justify: 'space-between',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#64748b',
            }}
          >
            <span>AVAILABLE</span>
            <span>100%</span>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}
        >
          <h4 style={{ color: '#ef4444', fontWeight: 700, marginBottom: '4px' }}>Need help?</h4>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px' }}>E-MAIL US!</p>
          <a
            href="mailto:support@usenet.farm"
            style={{ fontSize: '0.85rem', color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
          >
            support@usenet.farm
          </a>
        </div>
      </div>
    </div>
  );
}
