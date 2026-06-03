import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './api/queryClient.js'
import App from './App.jsx'
import ErrorBoundary from './components/shared/ErrorBoundary.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import FluentThemeProvider from './fluent/FluentThemeProvider.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'
import './i18n/index.js'
import { loadRemoteTranslationBundles } from './i18n/remoteTranslations.js'
import { initFluentTypography } from './fluent/initFluentTypography.js'

initFluentTypography()

import './index.css'

loadRemoteTranslationBundles().catch(() => {
  /* bundled locale JSON remains active */
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <ThemeProvider>
          <FluentThemeProvider>
            <AuthProvider>
              <QueryClientProvider client={queryClient}>
                <ToastProvider>
                  <ConfirmProvider>
                    <App />
                  </ConfirmProvider>
                </ToastProvider>
              </QueryClientProvider>
            </AuthProvider>
          </FluentThemeProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
