// public/js/friends.js

let currentFriendsTab = 'friends';

async function initFriends() {
    // Проверяем, доступны ли необходимые элементы
    if (!document.getElementById('friendsList')) {
        console.log('Элементы друзей еще не загружены, ждем 100мс...');
        setTimeout(initFriends, 100);
        return;
    }

    console.log('=== ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ДРУЗЕЙ ===');
    console.log('Document readyState:', document.readyState);

    let currentUser = null;

    try {
        const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
        console.log('Ответ от /api/auth/me:', meResponse.status);

        if (meResponse.ok) {
            const meData = await meResponse.json();
            console.log('Данные текущего пользователя:', meData);
            currentUser = meData.user;

            const currentUsernameEl = document.getElementById('currentUsername');
            if (currentUsernameEl) {
                currentUsernameEl.className = '';
                currentUsernameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
            }

            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'block';
        } else {
            console.warn('Пользователь не авторизован, перенаправление на /auth');
            window.location.href = '/auth';
            return;
        }
    } catch (err) {
        console.error('Error fetching current user data:', err);
        window.location.href = '/auth';
        return;
    }

    // Инициализация вкладок
    console.log('Инициализация вкладок...');
    initTabs();

    // Загрузка друзей по умолчанию
    console.log('Загрузка списка друзей по умолчанию...');
    loadFriendsData(currentFriendsTab);

    // Обработчик выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include',
                });
                if (response.ok) {
                    window.location.href = '/auth';
                }
            } catch (err) {
                console.error('Ошибка при выходе:', err);
            }
        });
    }

    // ✅ ДОБАВЛЕНО: Безопасное делегирование событий (вместо опасных onclick в HTML)
    const friendsContainer = document.getElementById('friendsList');
    if (friendsContainer) {
        friendsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return; // Если клик не по кнопке с data-action, игнорируем

            const action = btn.dataset.action;
            const id = btn.dataset.id;

            if (action === 'profile') {
                window.location.href = `/${id}`;
            } else if (action === 'message') {
                sendDirectMessage(id);
            } else if (action === 'accept') {
                acceptFriendRequest(id);
            } else if (action === 'decline') {
                rejectFriendRequest(id);
            }
        });
    }

    console.log('=== ЗАВЕРШЕНИЕ ИНИЦИАЛИЗАЦИИ СТРАНИЦЫ ДРУЗЕЙ ===');
}

// Инициализация вкладок
function initTabs() {
    console.log('Инициализация вкладок');
    const filterButtons = document.querySelectorAll('.friends-filter-btn');
    const menuLinks = document.querySelectorAll('.friends-menu__link');

    const handleTabChange = (tabType) => {
        console.log('Переключение вкладки на:', tabType);
        currentFriendsTab = tabType;

        // Обновляем активные кнопки фильтров
        filterButtons.forEach(btn => {
            if (btn.dataset.tab === tabType) {
                btn.classList.add('friends-filter-btn--active');
            } else {
                btn.classList.remove('friends-filter-btn--active');
            }
        });

        // Обновляем активные ссылки в меню
        menuLinks.forEach(link => {
            if (link.dataset.tab === tabType) {
                link.classList.add('friends-menu__link--active');
                link.classList.remove('friends-menu__link');
            } else {
                link.classList.remove('friends-menu__link--active');
                link.classList.add('friends-menu__link');
            }
        });

        // Загружаем соответствующий список
        loadFriendsData(tabType);
    };

    // Обработчики для кнопок фильтров
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            handleTabChange(btn.dataset.tab);
        });
    });

    // Обработчики для ссылок в меню
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            handleTabChange(link.dataset.tab);
        });
    });
}

async function loadFriendsData(tab) {
    const container = document.getElementById('friendsList');
    if (!container) return;
    container.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        // Используем правильные эндпоинты
        const endpoint = tab === 'requests' ? '/api/friends/requests' : '/api/friends/list';
        const response = await fetch(endpoint, { credentials: 'include' });
        console.log('Ответ для', tab, ':', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Данные для', tab, ':', data);

            if (tab === 'requests') {
                renderFriendRequests(data.requests || []);
            } else {
                renderFriendsList(data.friends || []);
            }
        } else {
            container.innerHTML = '<div class="friends-list__empty"><p>Ошибка загрузки данных</p></div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        container.innerHTML = '<div class="friends-list__empty"><p>Ошибка загрузки данных</p></div>';
    }
}

function renderFriendsList(friends) {
    console.log('Отрисовка списка друзей:', friends);
    const container = document.getElementById('friendsList');
    if (!container) return;

    if (!friends || friends.length === 0) {
        container.innerHTML = '<div class="friends-list__empty"><p>У вас пока нет друзей</p></div>';
        return;
    }

    container.innerHTML = friends.map(friend => `
        <div class="friend-item" data-user-id="${friend.id}">
            <div class="friend-item__avatar">
                <img src="${escapeHtml(friend.avatar || '/images/default-avatar.svg')}" alt="${escapeHtml(friend.firstName)} ${escapeHtml(friend.lastName)}">
            </div>
            <div class="friend-item__info">
                <a href="/${friend.id}" class="friend-item__name spa-link">${escapeHtml(friend.firstName)} ${escapeHtml(friend.lastName)}</a>
            </div>
            <div class="friend-item__actions">
                <button class="friend-item__action-btn" data-action="profile" data-id="${friend.id}">Профиль</button>
                <button class="friend-item__action-btn" data-action="message" data-id="${friend.id}">Написать</button>
            </div>
        </div>
    `).join('');
}

function renderFriendRequests(requests) {
    console.log('Отрисовка заявок:', requests);
    const container = document.getElementById('friendsList');
    if (!container) return;

    if (!requests || requests.length === 0) {
        console.log('Нет заявок для отображения');
        container.innerHTML = '<div class="friends-list__empty"><p>Нет заявок в друзья</p></div>';
        return;
    }

    container.innerHTML = requests.map(request => `
        <div class="request-item" data-request-id="${request.id}">
            <div class="request-item__avatar">
                <img src="${escapeHtml(request.avatar || '/images/default-avatar.svg')}" alt="${escapeHtml(request.firstName)} ${escapeHtml(request.lastName)}">
            </div>
            <div class="request-item__info">
                <a href="/${request.fromUserId}" class="request-item__name spa-link">${escapeHtml(request.firstName)} ${escapeHtml(request.lastName)}</a>
            </div>
            <div class="request-item__actions">
                <button class="accept-btn" data-action="accept" data-id="${request.id}">Принять</button>
                <button class="decline-btn" data-action="decline" data-id="${request.id}">Отклонить</button>
            </div>
        </div>
    `).join('');
}

// Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function acceptFriendRequest(requestId) {
    try {
        const response = await fetch(`/api/friends/accept/${requestId}`, {
            method: 'POST',
            credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            alert(data.message || 'Заявка принята!');
            // Обновляем список заявок
            loadFriendsData(currentFriendsTab);
            // Обновляем счетчик заявок в бейдже
            if (window.updateFriendRequestsBadge) {
                window.updateFriendRequestsBadge();
            }
        } else {
            const error = await response.json();
            alert(error.error || 'Ошибка при принятии заявки');
        }
    } catch (err) {
        console.error('Ошибка при принятии заявки:', err);
        alert('Ошибка сети. Попробуйте позже.');
    }
}

async function rejectFriendRequest(requestId) {
    try {
        const response = await fetch(`/api/friends/decline/${requestId}`, {
            method: 'POST',
            credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            alert(data.message || 'Заявка отклонена!');
            // Обновляем список заявок
            loadFriendsData(currentFriendsTab);
            // Обновляем счетчик заявок в бейдже
            if (window.updateFriendRequestsBadge) {
                window.updateFriendRequestsBadge();
            }
        } else {
            const error = await response.json();
            alert(error.error || 'Ошибка при отклонении заявки');
        }
    } catch (err) {
        console.error('Ошибка при отклонении заявки:', err);
        alert('Ошибка сети. Попробуйте позже.');
    }
}

// Отправка сообщения
function sendDirectMessage(userId) {
    // Используем SPA-навигацию вместо полной перезагрузки
    if (window.location.pathname === '/dialogs') {
        // Если уже на странице диалогов, просто открываем нужный диалог
        if (typeof openDialog === 'function') {
            openDialog(userId);
        }
    } else {
        // Иначе переходим на страницу диалогов через роутер
        window.history.pushState({ path: '/dialogs' }, '', '/dialogs');
        if (typeof loadPageContent === 'function') {
            loadPageContent('/dialogs').then(() => {
                // После загрузки страницы диалогов открываем нужный диалог
                if (typeof openDialog === 'function') {
                    setTimeout(() => openDialog(userId), 100);
                }
            });
        }
    }
}

window.initFriends = initFriends;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initFriends };
} else {
    window.initFriends = initFriends;
}