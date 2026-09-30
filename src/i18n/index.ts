import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import he from './he.json'

export type Lang = 'he' | 'en'
export const LANGS: Lang[] = ['he', 'en']

export function applyDocumentLang(lang: Lang) {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
}

export function initI18n(lang: Lang) {
  void i18n.use(initReactI18next).init({
    resources: { he: { translation: he }, en: { translation: en } },
    lng: lang,
    fallbackLng: 'he',
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  return i18n
}

export default i18n
