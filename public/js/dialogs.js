// public/js/dialogs.js

// ✅ Защита от дубликатов при загрузке из localStorage
const rawDialogs = JSON.parse(localStorage.getItem('openDialogs') || '[]');

const state = {
    openDialogs: [...new Set(rawDialogs.map(String))], // уникальные строки
    currentFilter: 'all',
    activeDialog: null, // добавляем новое свойство для отслеживания активного диалога
    usersCache: {}, // кэш для информации о пользователях
};

// WebSocket соединение
let ws = null;
let reconnectTimeout = null;

// Подключение к WebSocket
function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = function(event) {
            console.log('WebSocket connected');
            clearTimeout(reconnectTimeout);
        };

        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                
                switch(data.type) {
                    case 'new_message':
                        // Обработка нового сообщения
                        handleNewMessage(data.data);
                        break;
                        
                    case 'unread_count_change':
                        // Обновляем счетчик непрочитанных сообщений
                        updateUnreadBadge();
                        if (window.updateFriendRequestsBadge) {
                            window.updateFriendRequestsBadge();
                        }
                        break;
                        
                    default:
                        console.log('Unknown WebSocket message type:', data.type);
                }
            } catch (err) {
                console.error('Error parsing WebSocket message:', err);
            }
        };

        ws.onclose = function(event) {
            console.log('WebSocket disconnected, attempting to reconnect...');
            // Попробуем переподключиться через 3 секунды
            reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
        };
    } catch (err) {
        console.error('Failed to create WebSocket connection:', err);
        // Попробуем переподключиться через 3 секунды
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
    }
}

// Обработка нового сообщения
function handleNewMessage(message) {
    // Обновляем список диалогов
    loadDialogs(state.currentFilter);
    
    // Если у нас открыт диалог с этим пользователем, добавляем сообщение
    if (state.openDialogs.includes(String(message.senderId))) {
        addMessageToChat(message);
    }
    
    // Обновляем счетчик непрочитанных
    updateUnreadBadge();
    if (window.updateFriendRequestsBadge) {
        window.updateFriendRequestsBadge();
    }
}

// Функция для добавления сообщения в чат
function addMessageToChat(message) {
    const container = document.getElementById(`messages-${message.senderId}`);
    if (!container) return;

    // Правильно определяем тип сообщения (моё или партнёра)
    const isOwnMessage = message.senderId === window.currentUserId;
    const messageElement = document.createElement('div');
    messageElement.className = `message message--${isOwnMessage ? 'own' : 'partner'}`;
    messageElement.innerHTML = `
        <div class="message__content">${escapeHtml(message.encryptedContent)}</div>
        <div class="message__time">${formatDate(message.createdAt)}</div>
    `;
    
    container.appendChild(messageElement);
    container.scrollTop = container.scrollHeight;
}

// Загрузка данных текущего пользователя
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            const user = data.user;

            window.currentUserId = user.id;

            const usernameEl = document.getElementById('currentUsername');
            if (usernameEl) {
                usernameEl.className = '';
                usernameEl.textContent = `${user.firstName} ${user.lastName}`;
            }

            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'block';
        }
    } catch (err) {
        console.error('Ошибка загрузки пользователя:', err);
    }
}

// Загрузка списка диалогов
async function loadDialogs(filter = 'all') {
    try {
        const response = await fetch(`/api/messages/dialogs?filter=${filter}`, {
            credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            // Сохраняем информацию о пользователях в кэш
            data.dialogs.forEach(dialog => {
                state.usersCache[dialog.partnerId] = {
                    firstName: dialog.firstName,
                    lastName: dialog.lastName
                };
            });
            renderDialogsList(data.dialogs);
        }
    } catch (err) {
        console.error('Ошибка загрузки диалогов:', err);
    }
}

// Рендер списка диалогов
function renderDialogsList(dialogs) {
    const container = document.getElementById('dialogsList');
    if (!container) return;

    if (dialogs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Нет диалогов</p></div>';
        return;
    }

    container.innerHTML = dialogs.map(dialog => `
        <div class="dialog-item" data-user-id="${dialog.partnerId}">
            <div class="dialog-item__avatar">
                <img src="/images/default-avatar.svg" alt="Аватар">
            </div>
            <div class="dialog-item__content">
                <div class="dialog-item__header">
                    <span class="dialog-item__name">${dialog.firstName} ${dialog.lastName}</span>
                    <span class="dialog-item__time">${formatDate(dialog.lastMessageAt)}</span>
                </div>
                <div class="dialog-item__message">
                    ${dialog.senderId === (window.currentUserId || '') ? 'Вы: ' : ''}${dialog.lastMessage || 'Нет сообщений'}
                </div>
            </div>
            ${dialog.unreadCount > 0 ? `<div class="dialog-item__badge">${dialog.unreadCount}</div>` : ''}
        </div>
    `).join('');

    container.onclick = (e) => {
        const item = e.target.closest('.dialog-item');
        if (item) {
            openDialog(item.dataset.userId);
        }
    };
}

// ✅ Открыть диалог — с защитой от дубликатов
function openDialog(userId) {
    userId = String(userId); // guarantee string

    if (!state.openDialogs.includes(userId)) {
        state.openDialogs.push(userId);
        saveOpenDialogs();
    }

    // Set this dialog as active
    state.activeDialog = userId;

    switchTab('view');
    renderOpenDialogs(); // This should now be awaited if called from an async context
}

// Закрыть диалог
function closeDialog(userId) {
    userId = String(userId);
    state.openDialogs = state.openDialogs.filter(id => String(id) !== userId);
    
    // Если закрываем активный диалог, переключаемся на другой
    if (state.activeDialog === userId) {
        if (state.openDialogs.length > 0) {
            state.activeDialog = state.openDialogs[0]; // выбираем первый доступный
        } else {
            state.activeDialog = null; // если больше нет диалогов
        }
    }
    
    saveOpenDialogs();
    renderOpenDialogs();
}

function saveOpenDialogs() {
    localStorage.setItem('openDialogs', JSON.stringify(state.openDialogs));
}

// Рендер открытых диалогов
async function renderOpenDialogs() {
    const container = document.getElementById('openDialogsList');
    if (!container) return;

    if (state.openDialogs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Выберите диалог из списка, чтобы открыть его здесь</p></div>';
        return;
    }

    // Получаем имена пользователей для всех диалогов (await them all)
    const userNames = {};
    for (const userId of state.openDialogs) {
        userNames[userId] = await getUserNameById(userId);
    }


// Создаем контейнер для списка доступных диалогов
    const dialogsHeader = document.createElement('div');
    dialogsHeader.className = 'dialogs-header-detail';
    dialogsHeader.innerHTML = `
        <div class="dialogs-list-detail">
            ${state.openDialogs.map(userId => `
                <div class="dialog-tab ${state.activeDialog === userId ? 'dialog-tab--active' : ''}" 
                    data-user-id="${userId}">
                    <span class="dialog-tab-name">${userNames[userId]}</span>
                    <button class="dialog-tab-close ${state.activeDialog === userId ? 'dialog-tab-close--visible' : ''}" 
                            data-user-id="${userId}">×</button>
                </div>
            `).join('')}
        </div>
    `;

    // Если есть активный диалог, отображаем его содержимое
    let activeDialogContent = '';
    if (state.activeDialog) {
        activeDialogContent = `
            <div class="open-dialog" data-user-id="${state.activeDialog}">
                <div class="open-dialog__messages" id="messages-${state.activeDialog}">
                    <div class="loading">Загрузка сообщений...</div>
                </div>
                <div class="open-dialog__input">
                    <input type="text" class="form-input" placeholder="Введите сообщение..." data-user-id="${state.activeDialog}">
                    <button class="send-btn" data-user-id="${state.activeDialog}" type="button">Отправить</button>
                </div>
            </div>
        `;
    } else {
        // Если нет активного диалога, выбираем первый из списка
        state.activeDialog = state.openDialogs[0];
        activeDialogContent = `
            <div class="open-dialog" data-user-id="${state.activeDialog}">
                <div class="open-dialog__messages" id="messages-${state.activeDialog}">
                    <div class="loading">Загрузка сообщений...</div>
                </div>
                <div class="open-dialog__input">
                    <input type="text" class="form-input" placeholder="Введите сообщение..." data-user-id="${state.activeDialog}">
                    <button class="send-btn" data-user-id="${state.activeDialog}" type="button">Отправить</button>
                </div>
            </div>
        `;
    }

    container.innerHTML = dialogsHeader.outerHTML + activeDialogContent;

    // Обработчики событий
    container.onclick = (e) => {
        // Handle close button clicks first (before other handlers)
        const dialogTabCloseBtn = e.target.closest('.dialog-tab-close');
        if (dialogTabCloseBtn) {
            e.stopPropagation(); // Prevent event bubbling
            const userId = dialogTabCloseBtn.dataset.userId;
            closeDialog(userId);
            return; // Exit early to prevent other handlers from running
        }

        // Handle dialog tab clicks
        const dialogTab = e.target.closest('.dialog-tab');
        if (dialogTab) {
            const userId = dialogTab.dataset.userId;
            setActiveDialog(userId);
            return;
        }

        // Handle send button clicks
        const sendBtn = e.target.closest('.send-btn');
        if (sendBtn) {
            e.preventDefault(); // Prevent any potential form submission
            sendMessage(sendBtn.dataset.userId);
            return;
        }
    };

    container.onkeypress = (e) => {
        if (e.key === 'Enter' && e.target.matches('.open-dialog__input input')) {
            e.preventDefault(); // Prevent form submission
            sendMessage(e.target.dataset.userId);
        }
    };

    // Загружаем сообщения для активного диалога
    if (state.activeDialog) {
        loadDialogMessages(state.activeDialog);
    }
}

// Установка активного диалога
function setActiveDialog(userId) {
    state.activeDialog = userId;
    renderOpenDialogs();
}

// Асинхронная функция для получения имени пользователя по ID
// Теперь она сначала проверяет кэш, а если нет - делает запрос
async function getUserNameById(userId) {
    // Сначала проверяем кэш
    if (state.usersCache[userId]) {
        return `${state.usersCache[userId].firstName} ${state.usersCache[userId].lastName}`;
    }

    // Если в кэше нет, делаем запрос к серверу
    try {
        const response = await fetch(`/api/users/${userId}`, { credentials: 'include' });
        if (response.ok) {
            const userData = await response.json();
            // Сохраняем в кэш
            state.usersCache[userId] = {
                firstName: userData.firstName,
                lastName: userData.lastName
            };
            return `${userData.firstName} ${userData.lastName}`;
        } else {
            // Возвращаем заполнитель, если запрос не удался
            return `Пользователь ${userId}`;
        }
    } catch (err) {
        console.error(`Ошибка загрузки данных пользователя ${userId}:`, err);
        return `Пользователь ${userId}`;
    }
}

// Загрузка сообщений диалога
async function loadDialogMessages(userId) {
    try {
        const response = await fetch(`/api/messages/dialog/${userId}`, {
            credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            renderMessages(userId, data.messages);
        }
    } catch (err) {
        console.error(`Ошибка загрузки сообщений с ${userId}:`, err);
    }
}

// Рендер сообщений
function renderMessages(userId, messages) {
    const container = document.getElementById(`messages-${userId}`);
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Нет сообщений. Напишите первое!</p></div>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isOwnMessage = msg.senderId === window.currentUserId;
        return `
            <div class="message message--${isOwnMessage ? 'own' : 'partner'}">
                <div class="message__content">${msg.encryptedContent}</div>
                <div class="message__time">${formatDate(msg.createdAt)}</div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

// Отправка сообщения
async function sendMessage(recipientId) {
    const input = document.querySelector(`.open-dialog__input input[data-user-id="${recipientId}"]`);
    const content = input.value.trim();

    if (!content) return;

    // Создаем объект сообщения для предварительного отображения
    const previewMessage = {
        id: Date.now(), // временное ID
        senderId: window.currentUserId,
        encryptedContent: content,
        createdAt: new Date().toISOString(),
        isRead: true // собственное сообщение считается прочитанным
    };

    try {
        // Добавляем сообщение в UI сразу
        const container = document.getElementById(`messages-${recipientId}`);
        if (container) {
            const messageElement = document.createElement('div');
            messageElement.className = 'message message--own';
            messageElement.innerHTML = `
                <div class="message__content">${escapeHtml(content)}</div>
                <div class="message__time">${formatDate(new Date().toISOString())}</div>
            `;
            
            container.appendChild(messageElement);
            container.scrollTop = container.scrollHeight;
        }

        const response = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                recipientId,
                encryptedContent: content,
                encryptedKey: '',
            }),
        });

        if (response.ok) {
            input.value = '';
            // loadDialogs(state.currentFilter); // обновляем список диалогов через WebSocket
        } else {
            // Если отправка не удалась, удаляем сообщение из UI
            if (container) {
                const lastMessage = container.lastElementChild;
                if (lastMessage && lastMessage.querySelector('.message__content').textContent === escapeHtml(content)) {
                    container.removeChild(lastMessage);
                }
            }
        }
    } catch (err) {
        console.error('Ошибка отправки сообщения:', err);
        // Если произошла ошибка, удаляем сообщение из UI
        const container = document.getElementById(`messages-${recipientId}`);
        if (container) {
            const lastMessage = container.lastElementChild;
            if (lastMessage && lastMessage.querySelector('.message__content').textContent === escapeHtml(content)) {
                container.removeChild(lastMessage);
            }
        }
    }
}

// Переключение табов
function switchTab(tabName) {
    document.querySelectorAll('.dialogs-tab').forEach(tab => {
        tab.classList.toggle('dialogs-tab--active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.dialogs-tab-content').forEach(content => {
        content.classList.toggle('dialogs-tab-content--active', content.id === `tab-${tabName}`);
    });
}

// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
        return 'вчера';
    } else if (days < 7) {
        return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    }
}

// Функция экранирования HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// === Инициализация страницы диалогов ===

async function initDialogsView() {
    // Подключаем WebSocket
    connectWebSocket();

    // First, load current user data and wait for it to complete
    await loadCurrentUser();

    // Only then proceed with loading and rendering dialogs
    await loadDialogs(state.currentFilter);
    await renderOpenDialogs(); // Make this async too since it uses getUserNameById

    // Переключение табов
    document.querySelectorAll('.dialogs-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.dialogs-tab').forEach(t => t.classList.remove('dialogs-tab--active'));
            document.querySelectorAll('.dialogs-tab-content').forEach(c => c.classList.remove('dialogs-tab-content--active'));

            tab.classList.add('dialogs-tab--active');
            const targetTab = tab.dataset.tab;
            const targetContent = document.getElementById(`tab-${targetTab}`);
            if (targetContent) targetContent.classList.add('dialogs-tab-content--active');
        });
    });

    // Фильтры диалогов
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
            btn.classList.add('filter-btn--active');
            state.currentFilter = btn.dataset.filter;
            loadDialogs(state.currentFilter);
        });
    });

    // Поиск пользователей (модалка "Написать")
    const newMessageBtn = document.getElementById('newMessageBtn');
    const newMessageModal = document.getElementById('newMessageModal');
    const closeModalBtn = document.getElementById('closeModal');
    const searchUserInput = document.getElementById('searchUserInput');
    const searchResults = document.getElementById('searchResults');

    if (newMessageBtn && newMessageModal) {
        newMessageBtn.addEventListener('click', () => {
            newMessageModal.style.display = 'block';
        });
    }

    if (closeModalBtn && newMessageModal) {
        closeModalBtn.addEventListener('click', () => {
            newMessageModal.style.display = 'none';
        });
    }

    if (searchUserInput && searchResults) {
        searchUserInput.addEventListener('input', async () => {
            const query = searchUserInput.value.trim();
            if (query.length < 2) {
                searchResults.innerHTML = '';
                return;
            }

            try {
                const response = await fetch(`/api/messages/search?q=${encodeURIComponent(query)}`, {
                    credentials: 'include',
                });
                if (response.ok) {
                    const data = await response.json();
                    searchResults.innerHTML = data.users.map(user => `
                        <div class="search-result-item" data-user-id="${user.id}">
                            ${user.firstName} ${user.lastName}
                        </div>
                    `).join('');

                    searchResults.querySelectorAll('.search-result-item').forEach(item => {
                        item.addEventListener('click', () => {
                            openDialog(item.dataset.userId);
                            newMessageModal.style.display = 'none';
                            searchUserInput.value = '';
                            searchResults.innerHTML = '';
                        });
                    });
                }
            } catch (err) {
                console.error('Ошибка поиска:', err);
            }
        });
    }
}

// Функция для обновления бейджа непрочитанных сообщений
async function updateUnreadBadge() {
    try {
        const response = await fetch('/api/messages/unread-count', {
            credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            const badge = document.getElementById('unreadBadge');
            
            if (badge) {
                if (data.unreadDialogs > 0) {
                    badge.textContent = data.unreadDialogs > 99 ? '99+' : data.unreadDialogs;
                    badge.style.display = 'inline-flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки счётчика непрочитанных:', error);
    }
}

// Экспортируем для SPA-роутера
window.initDialogsView = initDialogsView;

// Инициализация при полной загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    await initDialogsView();
});