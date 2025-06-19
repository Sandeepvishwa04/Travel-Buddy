let currentLanguage = 'en';
let translations = {};

async function loadTranslations(lang) {
    try {
        const response = await fetch(`/translations/${lang}.json`);
        if (!response.ok) {
            throw new Error('Failed to load translations');
        }
        translations = await response.json();
        updatePageContent();
        localStorage.setItem('preferredLanguage', lang);
        console.log('Translations loaded:', translations); // Debug log
    } catch (error) {
        console.error('Error loading translations:', error);
    }
}

function updatePageContent() {
    console.log('Updating page content...'); // Debug log
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = getTranslation(key);
        console.log(`Translating ${key} to: ${translation}`); // Debug log
        element.textContent = translation;
    });
}

function getTranslation(key) {
    const keys = key.split('.');
    let value = translations;
    for (const k of keys) {
        value = value?.[k];
    }
    return value || key;
}

async function changeLanguage(lang) {
    console.log('Changing language to:', lang); // Debug log
    currentLanguage = lang;
    await loadTranslations(lang);
}

// Initialize with saved language preference or default to English
document.addEventListener('DOMContentLoaded', async () => {
    const savedLanguage = localStorage.getItem('preferredLanguage') || 'en';
    await loadTranslations(savedLanguage);
    if (document.getElementById('languageSelect')) {
        document.getElementById('languageSelect').value = savedLanguage;
    }
}); 