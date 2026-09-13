// public/js/spa-router.js

// Перехватываем все клики по ссылкам с классом spa-link
document.addEventListener('click', async (e) => {
    const link = e.target.closest('.spa-link');
    if (!link) return; // Если кликнули не туда, игнорируем

    e.preventDefault(); // Отменяем стандартный переход и перезагрузку
    const url = link.getAttribute('href');

    // Если кликнули на "Моя страница", нужно перенаправить на страницу профиля текущего пользователя
    if (url === '' || url === '/') {
        try {
            // Получаем информацию о текущем пользователе
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                // Переходим на страницу профиля текущего пользователя
                const profileUrl = `/${data.user.id}`;
                window.history.pushState({ path: profileUrl }, '', profileUrl);
                await loadPageContent(profileUrl);

                // Инициализируем страницу профиля
                if (typeof initProfile === 'function') {
                    setTimeout(initProfile, 100);
                }
            } else {
                // Если пользователь не авторизован, перенаправляем на страницу входа
                window.location.href = '/auth';
            }
        } catch (error) {
            console.error('Ошибка получения информации о пользователе:', error);
            window.location.href = '/auth';
        }
    } else {
        // Меняем URL в адресной строке без перезагрузки
        window.history.pushState({ path: url }, '', url);

        // Загружаем контент
        await loadPageContent(url);
    }
});

// Обработка кнопок "Назад" / "Вперёд" в браузере
window.addEventListener('popstate', () => {
    loadPageContent(window.location.pathname);

    // Если это страница профиля, инициализируем её
    if (/^\/\d+$/.test(window.location.pathname) && typeof initProfile === 'function') {
        setTimeout(initProfile, 100);
    }
});

// Функция загрузки и вставки контента
async function loadPageContent(url) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Показываем индикатор загрузки
    mainContent.innerHTML = '<div class="loading" style="padding: 40px; text-align: center;">Загрузка...</div>';

    try {
        // Для URL профиля загружаем HTML-фрагмент вместо генерации разметки
        const profileMatch = url.match(/^\/(\d+)$/);
        if (profileMatch) {
            // Загружаем готовый HTML-фрагмент профиля
            const response = await fetch('/fragments/profile.html');
            if (!response.ok) throw new Error('Не удалось загрузить шаблон профиля');

            const profileTemplate = await response.text();
            mainContent.innerHTML = profileTemplate;

            // Инициализируем скрипты для страницы профиля
            if (typeof initProfile === 'function') {
                setTimeout(initProfile, 100); // Небольшая задержка для гарантии загрузки DOM
            }
        } else if (url === '/friends') {
            // Для страницы друзей загружаем HTML-фрагмент
            const response = await fetch('/fragments/friends.html');
            if (!response.ok) throw new Error('Не удалось загрузить шаблон друзей');

            const friendsTemplate = await response.text();
            mainContent.innerHTML = friendsTemplate;

            // Инициализируем скрипты для страницы друзей
            if (typeof initFriends === 'function') {
                initFriends();
            }
        } else if (url === '/dialogs') {
            // Для страницы диалогов загружаем HTML-фрагмент
            const response = await fetch('/fragments/dialogs.html');
            if (!response.ok) throw new Error('Не удалось загрузить шаблон диалогов');

            const dialogsTemplate = await response.text();
            mainContent.innerHTML = dialogsTemplate;

            // Инициализируем скрипты для страницы диалогов
            if (typeof initDialogs === 'function') {
                initDialogs();
            }
        } else {
            // Для других URL (например, для API endpoints или других специфических путей) продолжаем обычную логику
            let response;
            try {
                response = await fetch(url);
            } catch (fetchError) {
                console.error('Ошибка загрузки страницы:', fetchError);
                mainContent.innerHTML = '<div class="error">Не удалось загрузить раздел</div>';
                return;
            }

            if (!response.ok) {
                // Если запрос не удался, проверим, может быть это 404 ошибка
                if (response.status === 404) {
                    const response404 = await fetch('/fragments/404.html');
                    const html404 = await response404.text();
                    mainContent.innerHTML = html404;
                } else {
                    mainContent.innerHTML = '<div class="error">Не удалось загрузить раздел</div>';
                }
                return;
            }

            const html = await response.text();

            // Парсим полученный HTML, чтобы вытащить только нужный блок
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Ищем контейнер диалогов или другие специфические элементы
            const newContent = doc.querySelector('.dialogs-container') ||
                doc.querySelector('.friends-container') ||
                doc.querySelector('#main-content > *') ||
                doc.body;

            if (newContent) {
                // Очищаем и вставляем новый контент
                mainContent.innerHTML = '';
                mainContent.appendChild(newContent);

                // Инициализируем скрипты для этой страницы
                initPageScripts(url);
            }
        }
    } catch (error) {
        console.error('Ошибка SPA-роутинга:', error);
        mainContent.innerHTML = '<div class="error">Не удалось загрузить раздел</div>';
    }
}

// Функция для запуска скриптов конкретной страницы
function initPageScripts(url) {
    if (url === '/dialogs' || url.startsWith('/dialogs')) {
        if (typeof initDialogs === 'function') {
            initDialogs();
        }
    } else if (url === '/friends' || url.startsWith('/friends')) {
        if (typeof initFriends === 'function') {
            initFriends();
        }
    }
    // Для страницы профиля вызываем initProfile отдельно в loadPageContent
}