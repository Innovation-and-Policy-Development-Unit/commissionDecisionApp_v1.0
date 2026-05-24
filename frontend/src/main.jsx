import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/shared/ErrorBoundary.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import FluentThemeProvider from './fluent/FluentThemeProvider.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'
import './i18n/index.js'
import { loadRemoteTranslationBundles } from './i18n/remoteTranslations.js'
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
              <ToastProvider>
                <ConfirmProvider>
                  <App />
                </ConfirmProvider>
              </ToastProvider>
            </AuthProvider>
          </FluentThemeProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
