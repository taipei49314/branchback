import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DecisionStoreProvider } from '@/application/DecisionStore'
import { AppShell } from '@/components/AppShell'
import { HomePage } from '@/pages/HomePage'
import { DecisionsPage } from '@/pages/DecisionsPage'
import { NewDecisionPage } from '@/pages/NewDecisionPage'
import { DecisionDetailPage } from '@/pages/DecisionDetailPage'
import { DecisionCommitPage } from '@/pages/DecisionCommitPage'
import { PostCommitEditPage } from '@/pages/PostCommitEditPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { TimelinePage } from '@/pages/TimelinePage'
import { CalibrationPage } from '@/pages/CalibrationPage'
import { AssumptionsPage } from '@/pages/AssumptionsPage'
import { InsightsPage } from '@/pages/InsightsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { HistoryExplorerPage } from '@/pages/HistoryExplorerPage'
import { HistorySearchPage } from '@/pages/HistorySearchPage'

export default function App() {
  return (
    <DecisionStoreProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/decisions" element={<DecisionsPage />} />
            <Route path="/decisions/new" element={<NewDecisionPage />} />
            <Route path="/decisions/:id" element={<DecisionDetailPage />} />
            <Route
              path="/decisions/:id/commit"
              element={<DecisionCommitPage />}
            />
            <Route
              path="/decisions/:id/revise"
              element={<PostCommitEditPage />}
            />
            <Route path="/decisions/:id/review" element={<ReviewPage />} />
            <Route
              path="/decisions/:id/history"
              element={<HistoryExplorerPage />}
            />
            <Route path="/search" element={<HistorySearchPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/calibration" element={<CalibrationPage />} />
            <Route path="/assumptions" element={<AssumptionsPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </DecisionStoreProvider>
  )
}
