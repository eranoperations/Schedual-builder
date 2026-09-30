import '@fontsource-variable/heebo'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { repo, StoreProvider } from './app/store'
import { applyDocumentLang, initI18n, type Lang } from './i18n'

const lang: Lang = repo.get('lang') === 'en' ? 'en' : 'he'
initI18n(lang)
applyDocumentLang(lang)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
