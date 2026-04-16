import axios from 'axios'

const ADMIN_TOKEN = localStorage.getItem('nms_admin_token') || ''

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(cfg => {
    const token = localStorage.getItem('nms_admin_token') || ''
    if (token) cfg.headers['X-Admin-Token'] = token
    return cfg
})

export const getDashboard    = ()          => api.get('/dashboard').then(r => r.data)
export const getServers      = ()          => api.get('/servers').then(r => r.data)
export const getServer       = (id)        => api.get(`/servers/${id}`).then(r => r.data)
export const createServer    = (data)      => api.post('/servers', data).then(r => r.data)
export const updateServer    = (id, data)  => api.put(`/servers/${id}`, data).then(r => r.data)
export const deleteServer    = (id)        => api.delete(`/servers/${id}`).then(r => r.data)

export const getMetrics      = (id, period = '1h') => api.get(`/metrics/${id}?period=${period}`).then(r => r.data)
export const getLatestMetric = (id)        => api.get(`/metrics/${id}/latest`).then(r => r.data)

export const getAlerts       = (params)    => api.get('/alerts', { params }).then(r => r.data)
export const ackAlert        = (id)        => api.patch(`/alerts/${id}/ack`).then(r => r.data)
export const ackAll          = (serverId)  => api.patch('/alerts/ack-all', { serverId }).then(r => r.data)

export const getThresholds   = (id)        => api.get(`/thresholds/${id}`).then(r => r.data)
export const updateThresholds = (id, data) => api.put(`/thresholds/${id}`, data).then(r => r.data)

export const getTelegram     = ()          => api.get('/telegram').then(r => r.data)
export const updateTelegram  = (data)      => api.put('/telegram', data).then(r => r.data)
export const testTelegram    = ()          => api.post('/telegram/test').then(r => r.data)

export const getSshEvents    = (id, limit = 50) => api.get(`/ssh-events/${id}?limit=${limit}`).then(r => r.data)
