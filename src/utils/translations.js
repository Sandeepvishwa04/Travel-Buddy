function updateContent() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = i18next.t(key);
  });
}

function changeLanguage(lang) {
  i18next.changeLanguage(lang).then(() => {
    document.documentElement.lang = lang;
    updateContent();
  });
}

// Initialize translations when page loads
document.addEventListener('DOMContentLoaded', () => {
  updateContent();
}); 