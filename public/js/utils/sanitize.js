// public/js/utils/sanitize.js

/**
 * Экранирует HTML-символы для предотвращения XSS
 * @param {string} str - Строка для экранирования
 * @returns {string} - Безопасная строка
 */
export function escapeHTML(str) {
  if (!str) return '';

  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Безопасно вставляет текст в элемент (аналог textContent, но для HTML-структур)
 * @param {HTMLElement} element - Элемент, в который нужно вставить текст
 * @param {string} text - Текст для вставки
 */
export function safeSetText(element, text) {
  if (!element) return;
  element.textContent = text || '';
}

/**
 * Безопасно создает HTML-элемент с текстом
 * @param {string} tag - Тег элемента (div, span, p и т.д.)
 * @param {string} text - Текст содержимого
 * @param {Object} attributes - Атрибуты элемента
 * @returns {HTMLElement} - Созданный элемент
 */
export function createSafeElement(tag, text = '', attributes = {}) {
  const element = document.createElement(tag);
  element.textContent = text;

  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else {
      element.setAttribute(key, value);
    }
  }

  return element;
}

/**
 * Санитизирует URL (проверяет, что это безопасный URL)
 * @param {string} url - URL для проверки
 * @returns {string} - Безопасный URL или пустая строка
 */
export function sanitizeURL(url) {
  if (!url) return '';

  // Запрещаем javascript: и data: схемы
  if (url.toLowerCase().startsWith('javascript:') ||
    url.toLowerCase().startsWith('data:')) {
    return '';
  }

  return url;
}