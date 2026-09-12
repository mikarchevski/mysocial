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
// In spa-router.js, modify the initPageScripts function to properly load the friends script
// Update this function in spa-router.js around line 90-120
// В файле public/js/spa-router.js, замените функцию initPageScripts следующей реализацией:
function initPageScripts(url) {
    if (url === '/dialogs' || url.startsWith('/dialog/')) {
        if (typeof window.initDialogsView === 'function') {
            window.initDialogsView();
        }
    } else if (url === '/friends') {
        // Проверяем, загружен ли скрипт friends.js
        if (typeof window.initFriendsPage === 'function') {
            console.log('Вызов initFriendsPage из spa-router');
            window.initFriendsPage();
        } else {
            // Если функция не найдена, динамически загружаем скрипт
            console.warn('Функция initFriendsPage не найдена, загружаем скрипт...');
            
            // Создаем элемент script для загрузки friends.js
            const script = document.createElement('script');
            script.src = '/js/friends.js';
            script.async = false; // Убедимся, что скрипт выполнится перед продолжением
            
            script.onload = function() {
                console.log('Скрипт friends.js загружен');
                // После загрузки скрипта вызываем инициализацию
                if (typeof window.initFriendsPage === 'function') {
                    console.log('Вызов initFriendsPage после загрузки скрипта');
                    window.initFriendsPage();
                } else {
                    console.error('Функция initFriendsPage по-прежнему не найдена');
                }
            };
            
            script.onerror = function() {
                console.error('Ошибка загрузки скрипта friends.js');
            };
            
            document.head.appendChild(script);
        }
    } else if (url === '/') {
        if (typeof window.initProfilePage === 'function') {
            window.initProfilePage();
        }
    }
    // Здесь можно добавить инициализацию для других страниц
}
// Глобальная функция для обновления подсветки меню
window.highlightActiveMenuLink = highlightActiveMenuLink;