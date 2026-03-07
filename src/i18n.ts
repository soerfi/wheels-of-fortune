import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationEN from './locales/en/translation.json';
import translationDE from './locales/de/translation.json';
import translationFR from './locales/fr/translation.json';
import translationIT from './locales/it/translation.json';

const resources = {
    en: {
        translation: translationEN,
    },
    de: {
        translation: translationDE,
    },
    fr: {
        translation: translationFR,
    },
    it: {
        translation: translationIT,
    },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        supportedLngs: ['en', 'de', 'fr', 'it'],
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
        detection: {
            order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
            caches: ['localStorage', 'cookie'],
        }
    });

export default i18n;
