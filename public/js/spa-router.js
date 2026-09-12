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
// Функция загрузки и вставки контента
async function loadPageContent(url) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Показываем индикатор загрузки
    mainContent.innerHTML = '<div class="loading" style="padding: 40px; text-align: center;">Загрузка...</div>';

    try {
        // Запрашиваем HTML-страницу
        const response = await fetch(url);
        if (response.status === 404) {
            // Если страница не найдена, перенаправляем
            window.location.href = '/404.html';
            return;
        }
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
            
            // Обновляем подсветку активного пункта меню
            highlightActiveMenuLink();
            
            // Инициализируем скрипты для этой страницы
            initPageScripts(url);
        }
    } catch (error) {
        console.error('Ошибка SPA-роутинга:', error);
        mainContent.innerHTML = '<div class="error">Не удалось загрузить раздел</div>';
    }
}

// Функция для обновления подсветки активной ссылки меню
// public/js/spa-router.js

// Функция для обновления подсветки активной ссылки меню
function highlightActiveMenuLink() {
    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll('.menu__link');
    
    menuLinks.forEach(link => {
        link.classList.remove('menu__link--active');
        
        // Проверяем точное совпадение или частичное для специфичных случаев
        const href = link.getAttribute('href');
        if (href === currentPath || 
            (href === '/friends' && currentPath === '/friends') ||
            (href === '/' && currentPath.match(/^\/\d+$/))) {
            link.classList.add('menu__link--active');
        }
    });
}

// Остальная часть файла остается без изменений...

// Функция для запуска скриптов конкретной страницы
function initPageScripts(url) {
    if (url === '/dialogs' || url.startsWith('/dialog/')) {
        // Если у вас логика диалогов была в dialogs.js, 
        // нам нужно вызвать функцию инициализации вручную, 
        // так как DOMContentLoaded уже сработал при первой загрузке сайта.
        if (typeof window.initDialogsView === 'function') {
            window.initDialogsView();
        }
    } else if (url === '/friends') {
        // Загружаем и выполняем скрипт для страницы друзей
        // if (typeof window.friendsScriptLoaded === 'undefined') {
        //     const script = document.createElement('script');
        //     script.src = '/js/friends.js';
        //     document.head.appendChild(script);
        //     window.friendsScriptLoaded = true;
        // }
        if (typeof window.initFriendsPage === 'function') {
            console.log('Вызов initFriendsPage из spa-router');
            window.initFriendsPage();
        } else {
            console.warn('Функция initFriendsPage не найдена');
        }
    } else if (url === '/') {
        // Если это главная страница (мой профиль), загружаем profile.js
        if (typeof window.profileScriptLoaded === 'undefined') {
            const script = document.createElement('script');
            script.src = '/js/profile.js';
            document.head.appendChild(script);
            window.profileScriptLoaded = true;
        }
    }
    
    // Здесь можно добавить инициализацию для других страниц
}

// Глобальная функция для обновления подсветки меню
window.highlightActiveMenuLink = highlightActiveMenuLink;