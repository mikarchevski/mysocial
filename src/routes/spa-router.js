// public/js/spa-router.js

// Перехватываем все клики по ссылкам с классом spa-link
document.addEventListener('click', async (e) => {
    const link = e.target.closest('.spa-link');
    if (!link) return; // Если кликнули не туда, игнорируем

    e.preventDefault(); // Отменяем стандартный переход и перезагрузку
    const url = link.getAttribute('href');
    
    // Меняем URL в адресной строке без перезагрузки
    window.history.pushState({ path: url }, '', url);
    
    // Загружаем контент
    await loadPageContent(url);
});

// Обработка кнопок "Назад" / "Вперёд" в браузере
window.addEventListener('popstate', () => {
    loadPageContent(window.location.pathname);
});

// Функция загрузки и вставки контента
async function loadPageContent(url) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Показываем индикатор загрузки
    mainContent.innerHTML = '<div class="loading" style="padding: 40px; text-align: center;">Загрузка...</div>';

    try {
        // Запрашиваем HTML-страницу
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const html = await response.text();
        
        // Парсим полученный HTML, чтобы вытащить только нужный блок
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Ищем контейнер диалогов (мы его обернём в dialogs.html)
        const newContent = doc.querySelector('.dialogs-container') || doc.querySelector('#main-content > *');
        
        if (newContent) {
            // Очищаем и вставляем новый контент
            mainContent.innerHTML = '';
            mainContent.appendChild(newContent);
            
            // Инициализируем скрипты для этой страницы
            initPageScripts(url);
        }
    } catch (error) {
        console.error('Ошибка SPA-роутинга:', error);
        mainContent.innerHTML = '<div class="error">Не удалось загрузить раздел</div>';
    }
}

// Функция для запуска скриптов конкретной страницы
function initPageScripts(url) {
    if (url === '/dialogs' || url.startsWith('/dialog/')) {
        // Если у вас логика диалогов была в dialogs.js, 
        // нам нужно вызвать функцию инициализации вручную, 
        // так как DOMContentLoaded уже сработал при первой загрузке сайта.
        if (typeof initDialogsView === 'function') {
            initDialogsView();
        }
    }
    // Здесь можно добавить инициализацию для других страниц (например, initProfileView())
}