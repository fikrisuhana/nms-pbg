import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard    from './pages/Dashboard'
import ServerDetail from './pages/ServerDetail'
import Alerts       from './pages/Alerts'
import Settings     from './pages/Settings'

// Wrapper agar ServerDetail di-remount penuh saat id berubah (fix blank page)
function ServerDetailRoute() {
    const { id } = useParams()
    return <ServerDetail key={id} />
}

export default function App() {
    return (
        <BrowserRouter>
            <Layout>
                <Routes>
                    <Route path="/"            element={<Dashboard />} />
                    <Route path="/servers/:id" element={<ServerDetailRoute />} />
                    <Route path="/alerts"      element={<Alerts />} />
                    <Route path="/settings"    element={<Settings />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    )
}
