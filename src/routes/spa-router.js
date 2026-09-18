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

// Вспомогательная функция для выполнения скриптов из HTML
function executeScriptsFromHTML(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const scripts = temp.querySelectorAll('script');

    scripts.forEach(script => {
        const newScript = document.createElement('script');
        if (script.src) {
            newScript.src = script.src;
        } else {
            newScript.textContent = script.textContent;
        }
        // Копируем атрибуты
        Array.from(script.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
        });
        document.head.appendChild(newScript);
        document.head.removeChild(newScript);
    });
}

// Функция для загрузки и обновления модального окна
async function ensureModalExists() {
    const existingModal = document.getElementById('editModal');

    if (!existingModal) {
        // Если модального окна нет, загружаем его
        try {
            const modalResponse = await fetch('/fragments/edit-modal.html');
            if (modalResponse.ok) {
                const modalHTML = await modalResponse.text();
                // Добавляем модальное окно в конец body
                document.body.insertAdjacentHTML('beforeend', modalHTML);

                // Выполняем скрипты из модального окна
                executeScriptsFromHTML(modalHTML);
            }
        } catch (error) {
            console.error('Ошибка загрузки модального окна:', error);
        }
    }
}

// Функция загрузки и вставки контента
// В файле spa-router.js, замените функцию loadPageContent на следующую:

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
            const response = await fetch('/fragments/profile.html', {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'text/html'
                }
            });
            if (!response.ok) throw new Error('Не удалось загрузить шаблон профиля');

            const profileTemplate = await response.text();
            mainContent.innerHTML = profileTemplate;

            // Выполняем скрипты из фрагмента профиля
            executeScriptsFromHTML(profileTemplate);

            // Убеждаемся, что модальное окно существует
            await ensureModalExists();

            // Инициализируем скрипты для страницы профиля
            if (typeof initProfile === 'function') {
                setTimeout(initProfile, 100); // Небольшая задержка для гарантии загрузки DOM
            }
        } else if (url === '/friends') {
            // Для страницы друзей загружаем HTML-фрагмент
            const response = await fetch('/fragments/friends.html', {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'text/html'
                }
            });
            if (!response.ok) throw new Error('Не удалось загрузить шаблон друзей');

            const friendsTemplate = await response.text();
            mainContent.innerHTML = friendsTemplate;

            // Выполняем скрипты из фрагмента друзей
            executeScriptsFromHTML(friendsTemplate);

            // Убеждаемся, что модальное окно существует
            await ensureModalExists();

            // Инициализируем скрипты для страницы друзей
            if (typeof initFriends === 'function') {
                setTimeout(initFriends, 100);
            }
            if (typeof initDialogs === 'function') {
                setTimeout(() => {
                    // Просто вызываем функцию без управления флагами
                    initDialogs();
                }, 100);
            }
        } else if (url === '/dialogs') {
            // Для страницы диалогов загружаем HTML-фрагмент
            const response = await fetch('/fragments/dialogs.html', {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'text/html'
                }
            });
            if (!response.ok) throw new Error('Не удалось загрузить шаблон диалогов');

            const dialogsTemplate = await response.text();
            mainContent.innerHTML = dialogsTemplate;

            // Выполняем скрипты из фрагмента диалогов
            executeScriptsFromHTML(dialogsTemplate);

            // Убеждаемся, что модальное окно существует
            await ensureModalExists();

            // Инициализируем скрипты для страницы диалогов
            if (typeof initDialogs === 'function') {
                // Сбросим флаг инициализации перед вызовом
                window.dialogsInitAttempted = false;
                setTimeout(initDialogs, 100);
            }
        } else {
            // Для других URL (например, для API endpoints или других специфических путей) продолжаем обычную логику
            let response;
            try {
                response = await fetch(url, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'text/html'
                    }
                });

                if (!response.ok) {
                    // Если запрос не удался, проверим, может быть это 404 ошибка
                    if (response.status === 404) {
                        const response404 = await fetch('/fragments/404.html');
                        const html404 = await response404.text();
                        mainContent.innerHTML = html404;

                        // Выполняем скрипты из 404 страницы
                        executeScriptsFromHTML(html404);
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

                    // Выполняем скрипты из полученного HTML
                    executeScriptsFromHTML(html);

                    // Инициализируем скрипты для этой страницы
                    initPageScripts(url);
                }
            } catch (fetchError) {
                console.error('Ошибка загрузки страницы:', fetchError);
                mainContent.innerHTML = '<div class="error">Не удалось загрузить раздел</div>';
                return;
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

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', async () => {
    const currentPath = window.location.pathname;

    // Загружаем контент для текущего пути, если он не '/' и не '/auth'
    if (currentPath !== '/' && currentPath !== '/auth') {
        // Добавляем небольшую задержку для гарантии загрузки всех скриптов
        setTimeout(async () => {
            await loadPageContent(currentPath);
        }, 100);
    }
});