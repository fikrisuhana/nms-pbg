import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

const COLORS = {
    cpu:     '#3b82f6',
    ram:     '#a855f7',
    disk:    '#f59e0b',
    net_rx:  '#22c55e',
    net_tx:  '#ef4444',
    load:    '#06b6d4',
}

function fmtTime(ts) {
    try { return format(new Date(ts), 'HH:mm') } catch { return ts }
}

function CustomTooltip({ active, payload, label, unit }) {
    if (!active || !payload?.length) return null
    return (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>
            <div style={{ color: '#94a3b8', marginBottom: 4 }}>{fmtTime(label)}</div>
            {payload.map(p => (
                <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}{unit}
                </div>
            ))}
        </div>
    )
}

export default function MetricChart({ title, data, dataKey, unit = '', color, yDomain }) {
    return (
        <div className="card">
            <div className="card-title">{title}</div>
            {(!data || data.length === 0) ? (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
                    Belum ada data
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            dataKey="ts"
                            tickFormatter={fmtTime}
                            stroke="#475569"
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            stroke="#475569"
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            domain={yDomain || [0, 'auto']}
                        />
                        <Tooltip content={<CustomTooltip unit={unit} />} />
                        {Array.isArray(dataKey) ? (
                            dataKey.map((k, i) => (
                                <Line key={k.key} type="monotone" dataKey={k.key} name={k.label}
                                    stroke={k.color} strokeWidth={1.5} dot={false} />
                            ))
                        ) : (
                            <Line type="monotone" dataKey={dataKey}
                                stroke={color || COLORS[dataKey] || '#3b82f6'}
                                strokeWidth={1.5} dot={false} />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    )
}
