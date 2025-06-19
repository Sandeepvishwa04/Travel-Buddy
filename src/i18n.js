import i18next from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18next
  .use(Backend)
  .use(LanguageDetector)
  .init({
    fallbackLng: 'en',
    debug: true,
    backend: {
      loadPath: '/locales/{{lng}}.json'
    },
    // Define supported languages
    supportedLngs: ['en', 'ta', 'hi', 'te', 'kn', 'ml'],
  });

export default i18next; 