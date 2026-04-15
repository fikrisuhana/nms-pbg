import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard   from './pages/Dashboard'
import ServerDetail from './pages/ServerDetail'
import Alerts      from './pages/Alerts'
import Settings    from './pages/Settings'

export default function App() {
    return (
        <BrowserRouter>
            <Layout>
                <Routes>
                    <Route path="/"            element={<Dashboard />} />
                    <Route path="/servers/:id" element={<ServerDetail />} />
                    <Route path="/alerts"      element={<Alerts />} />
                    <Route path="/settings"    element={<Settings />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    )
}
