// public/js/dialogs.js

let currentDialogsFilter = 'all';
let currentOpenDialog = null;

// Инициализация страницы диалогов
async function initDialogs() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ДИАЛОГОВ ===');
    console.log('Document readyState:', document.readyState);

    // Загрузка текущего пользователя
    let currentUser = null;
    try {
        const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
        if (meResponse.ok) {
            const meData = await meResponse.json();
            currentUser = meData.user;

            // Обновляем имя в шапке
            const usernameSpan = document.getElementById('currentUsername');
            if (usernameSpan) {
                usernameSpan.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
                usernameSpan.classList.remove('skeleton', 'skeleton--medium');
            }

            // Показываем кнопку "Выйти"
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'block';
        } else {
            window.location.href = '/auth';
            return;
        }
    } catch (err) {
        console.error('Error fetching current user data:', err);
        window.location.href = '/auth';
        return;
    }

    // Инициализация табов
    initDialogsTabs();

    // Загрузка диалогов
    await loadDialogsList();

    // Инициализация обработчиков событий
    initDialogsEventListeners(currentUser);

    console.log('=== ЗАВЕРШЕНИЕ ИНИЦИАЛИЗАЦИИ СТРАНИЦЫ ДИАЛОГОВ ===');
}

// Инициализация табов
function initDialogsTabs() {
    const tabs = document.querySelectorAll('.dialogs-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const tabType = this.getAttribute('data-tab');

            // Обновляем активные табы
            tabs.forEach(t => t.classList.remove('dialogs-tab--active'));
            this.classList.add('dialogs-tab--active');

            // Показываем соответствующий контент
            document.querySelectorAll('.dialogs-tab-content').forEach(content => {
                content.classList.remove('dialogs-tab-content--active');
            });
            document.getElementById(`tab-${tabType}`).classList.add('dialogs-tab-content--active');
        });
    });
}

// Инициализация обработчиков событий
function initDialogsEventListeners(currentUser) {
    // Обработчик кнопки "Написать"
    const newMessageBtn = document.getElementById('newMessageBtn');
    if (newMessageBtn) {
        newMessageBtn.addEventListener('click', () => openNewMessageModal(currentUser));
    }

    // Обработчик закрытия модального окна
    const closeNewMessageModal = document.getElementById('closeNewMessageModal');
    if (closeNewMessageModal) {
        closeNewMessageModal.addEventListener('click', closeNewMessageModalFn);
    }

    // Обработчик поиска друзей
    const searchFriendsInput = document.getElementById('searchFriendsInput');
    if (searchFriendsInput) {
        searchFriendsInput.addEventListener('input', handleFriendsSearch);
    }

    // Обработчик поиска в диалогах
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }

    // Обработчики фильтров
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            currentDialogsFilter = this.getAttribute('data-filter');
            filterButtons.forEach(b => b.classList.remove('filter-btn--active'));
            this.classList.add('filter-btn--active');
            loadDialogsList(); // Перезагружаем список с новым фильтром
        });
    });

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
}

// Открытие модального окна для нового сообщения
async function openNewMessageModal(currentUser) {
    const modal = document.getElementById('newMessageModal');
    const friendsContainer = document.getElementById('friendsListForMessaging');

    if (!modal || !friendsContainer) {
        console.error('Элементы модального окна не найдены');
        return;
    }

    // Показываем модальное окно
    modal.style.display = 'flex';

    // Загружаем список друзей
    try {
        const response = await fetch('/api/friends/list', { credentials: 'include' });
        if (!response.ok) {
            throw new Error('Не удалось загрузить список друзей');
        }

        const data = await response.json();
        renderFriendsForMessaging(data.friends || []);
    } catch (error) {
        console.error('Ошибка загрузки друзей:', error);
        friendsContainer.innerHTML = '<div class="empty-state"><p>Ошибка загрузки списка друзей</p></div>';
    }
}

// Рендер списка друзей для отправки сообщения
function renderFriendsForMessaging(friends) {
    const container = document.getElementById('friendsListForMessaging');
    if (!container) return;

    if (!friends || friends.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>У вас пока нет друзей</p></div>';
        return;
    }

    container.innerHTML = friends.map(friend => `
        <div class="friends-list__item" onclick="startNewDialog(${friend.id}, '${escapeHtml(`${friend.firstName} ${friend.lastName}`)}')">
            <div class="friends-list__item__avatar">
                <img src="/images/default-avatar.svg" alt="${escapeHtml(friend.firstName)} ${escapeHtml(friend.lastName)}">
            </div>
            <div class="friends-list__item__info">
                <span class="friends-list__item__name">${escapeHtml(friend.firstName)} ${escapeHtml(friend.lastName)}</span>
            </div>
        </div>
    `).join('');
}

// Начало нового диалога с другом
function startNewDialog(friendId, friendName) {
    // Закрываем модальное окно
    closeNewMessageModalFn();

    // Открываем диалог с выбранным другом
    openDialog(friendId, friendName);
}

// Закрытие модального окна
function closeNewMessageModalFn() {
    const modal = document.getElementById('newMessageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Обработчик поиска друзей в модальном окне
function handleFriendsSearch(e) {
    clearTimeout(window.searchFriendsTimeout);
    window.searchFriendsTimeout = setTimeout(async () => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            // Если поисковый запрос короткий, загружаем всех друзей
            const response = await fetch('/api/friends/list', { credentials: 'include' });
            if (!response.ok) throw new Error('Ошибка загрузки друзей');
            const data = await response.json();
            renderFriendsForMessaging(data.friends || []);
            return;
        }

        try {
            // Поиск друзей по имени
            const res = await fetch(`/api/friends/list?search=${encodeURIComponent(query)}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Ошибка поиска друзей');
            const data = await res.json();
            renderFriendsForMessaging(data.friends || []);
        } catch (error) {
            console.error('Ошибка поиска друзей:', error);
        }
    }, 300);
}

// Обработчик поиска в диалогах
function handleSearchInput(e) {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(async () => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            loadDialogsList();
            return;
        }
        try {
            const res = await fetch(`/api/messages/search?q=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error('Ошибка поиска');
            const data = await res.json();
            renderDialogsList(data.users || []); // Адаптируй под свою верстку поиска
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }, 300);
}

// Загрузка списка диалогов
async function loadDialogsList() {
    try {
        const res = await fetch(`/api/messages/dialogs?filter=${currentDialogsFilter}`);
        if (!res.ok) throw new Error('Не удалось загрузить');
        const data = await res.json();
        renderDialogsList(data.dialogs || []);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Рендер списка диалогов
function renderDialogsList(dialogs) {
    const container = document.getElementById('dialogsList');
    if (!container) return;
    if (!dialogs || dialogs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>У вас пока нет диалогов</p></div>';
        return;
    }
    container.innerHTML = dialogs.map(dialog => `
        <div class="dialogs-list__item" data-dialog-id="${dialog.partnerId}" onclick="openDialog(${dialog.partnerId}, '${escapeHtml(`${dialog.firstName} ${dialog.lastName}`)}')">
            <div class="dialogs-list__avatar">
                <img src="/images/default-avatar.svg" alt="${escapeHtml(dialog.firstName)} ${escapeHtml(dialog.lastName)}">
                ${dialog.unreadCount > 0 ? `<span class="dialogs-list__badge">${dialog.unreadCount}</span>` : ''}
            </div>
            <div class="dialogs-list__info">
                <span class="dialogs-list__name">${escapeHtml(dialog.firstName)} ${escapeHtml(dialog.lastName)}</span>
                <span class="dialogs-list__last-message">${escapeHtml(dialog.lastMessage || 'Нет сообщений')}</span>
            </div>
        </div>
    `).join('');
}

// Открытие конкретного диалога
async function openDialog(partnerId, partnerName = null) {
    try {
        const res = await fetch(`/api/messages/dialog/${partnerId}`);
        if (!res.ok) throw new Error('Не удалось загрузить');
        const data = await res.json();

        // Сохраняем ID текущего открытого диалога
        currentOpenDialog = partnerId;

        // Переключаемся на вкладку просмотра
        document.querySelectorAll('.dialogs-tab').forEach(tab => tab.classList.remove('dialogs-tab--active'));
        document.querySelector('[data-tab="view"]').classList.add('dialogs-tab--active');
        document.querySelectorAll('.dialogs-tab-content').forEach(content => content.classList.remove('dialogs-tab-content--active'));
        document.getElementById('tab-view').classList.add('dialogs-tab-content--active');

        renderOpenDialog(partnerId, partnerName, data.messages || []);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Рендер открытого диалога
function renderOpenDialog(partnerId, partnerName, messages) {
    const container = document.getElementById('openDialogsList');
    if (!container) return;

    // Если не передано имя партнера, получаем его
    if (!partnerName) {
        partnerName = 'Собеседник';
    }

    container.innerHTML = `
        <div class="dialog-messages-header">
            <button class="back-to-list-btn" onclick="showDialogsList()">← Назад к списку</button>
            <h3 class="dialog-partner-name">${escapeHtml(partnerName)}</h3>
        </div>
        <div class="messages-container" id="messagesContainer">
            ${messages.map(msg => `
                <div class="message ${msg.senderId === partnerId ? 'message--received' : 'message--sent'}">
                    <div class="message__text">${escapeHtml(msg.encryptedContent)}</div>
                    <div class="message__time">${formatTime(msg.createdAt)}</div>
                </div>
            `).join('')}
        </div>
        <div class="message-input-area">
            <textarea id="messageTextarea" placeholder="Напишите сообщение..."></textarea>
            <button onclick="sendMessage(${partnerId})">Отправить</button>
        </div>
    `;

    // Прокручиваем к последнему сообщению
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Показать список диалогов
function showDialogsList() {
    document.querySelectorAll('.dialogs-tab').forEach(tab => tab.classList.remove('dialogs-tab--active'));
    document.querySelector('[data-tab="list"]').classList.add('dialogs-tab--active');
    document.querySelectorAll('.dialogs-tab-content').forEach(content => content.classList.remove('dialogs-tab-content--active'));
    document.getElementById('tab-list').classList.add('dialogs-tab-content--active');

    // Сбрасываем текущий открытый диалог
    currentOpenDialog = null;
}

// Отправка сообщения
async function sendMessage(recipientId) {
    const textarea = document.getElementById('messageTextarea');
    if (!textarea) return;
    const text = textarea.value.trim();
    if (!text) return;

    try {
        const res = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                recipientId: recipientId,
                encryptedContent: text,
                encryptedKey: ''
            })
        });
        if (!res.ok) throw new Error('Не удалось отправить');

        textarea.value = '';
        // Обновляем текущий диалог
        if (currentOpenDialog) {
            openDialog(currentOpenDialog);
        }
        // Обновляем список диалогов
        await loadDialogsList();
    } catch (error) {
        console.error('Ошибка отправки:', error);
    }
}

// Форматирование времени
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Регистрируем глобально
window.initDialogs = initDialogs;
window.openDialog = openDialog;
window.startNewDialog = startNewDialog;
window.closeNewMessageModalFn = closeNewMessageModalFn;