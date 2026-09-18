// public/js/dialogs.js

// ==========================================
// 1. Глобальное состояние
// ==========================================
let currentDialogsFilter = 'all';
let currentOpenDialog = null;
let currentUserId = null; // Кэшируем ID, чтобы не делать лишний fetch при рендере
const sentMessagesCache = new Map(); // Кэш для мгновенного доступа в текущей сессии

// ==========================================
// 2. Инициализация
// ==========================================
// В конце dialogs.js, перед экспортами, добавить функции для работы с WebSocket
let wsConnection = null;
let wsReconnectInterval = null;

function initWebSocket() {
    // Проверяем поддержку WebSocket
    if (!window.WebSocket) {
        console.warn('WebSocket не поддерживается браузером');
        return;
    }

    // Создаем подключение к WebSocket серверу
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = `${protocol}${window.location.host}/ws`;
    
    try {
        wsConnection = new WebSocket(wsUrl);
        
        wsConnection.onopen = function(event) {
            console.log('WebSocket соединение установлено');
            // Очищаем таймер переподключения при успешном подключении
            if (wsReconnectInterval) {
                clearInterval(wsReconnectInterval);
                wsReconnectInterval = null;
            }
        };
        
        wsConnection.onmessage = function(event) {
            try {
                const messageData = JSON.parse(event.data);
                
                switch(messageData.type) {
                    case 'new_message':
                        // Проверяем, относится ли сообщение к текущему открытому диалогу
                        if (currentOpenDialog && currentOpenDialog === messageData.data.senderId) {
                            // Обновляем текущий открытый диалог
                            refreshCurrentDialog();
                        } else {
                            // Обновляем список диалогов
                            loadDialogsList();
                        }
                        // Обновляем счётчик непрочитанных сообщений в сайдбаре
                        if (window.updateUnreadMessagesBadge) {
                            window.updateUnreadMessagesBadge();
                        }
                        break;
                    case 'unread_count_change':
                        // Обновляем счётчик непрочитанных сообщений
                        if (window.updateUnreadMessagesBadge) {
                            window.updateUnreadMessagesBadge();
                        }
                        break;
                }
            } catch (error) {
                console.error('Ошибка при обработке WebSocket сообщения:', error);
            }
        };
        
        wsConnection.onclose = function(event) {
            console.log('WebSocket соединение закрыто', event.code, event.reason);
            // Пытаемся восстановить соединение
            scheduleReconnect();
        };
        
        wsConnection.onerror = function(error) {
            console.error('Ошибка WebSocket:', error);
        };
    } catch (error) {
        console.error('Ошибка создания WebSocket соединения:', error);
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (wsReconnectInterval) {
        return; // Уже запланировано переподключение
    }
    
    wsReconnectInterval = setInterval(() => {
        console.log('Попытка переподключения к WebSocket...');
        initWebSocket();
    }, 3000); // Повтор каждые 3 секунды
}

// Функция для обновления текущего открытого диалога
async function refreshCurrentDialog() {
    if (!currentOpenDialog) return;
    
    try {
        const res = await fetch(`/api/messages/dialog/${currentOpenDialog}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        const data = await res.json();
        
        // Получаем имя партнера
        let partnerName = 'Собеседник';
        const dialogItem = document.querySelector(`[data-dialog-id="${currentOpenDialog}"]`);
        if (dialogItem) {
            const nameEl = dialogItem.querySelector('.dialogs-list__name');
            if (nameEl) {
                partnerName = nameEl.textContent;
            }
        } else {
            // Получаем имя партнера через API
            const userRes = await fetch(`/api/users/${currentOpenDialog}`, { credentials: 'include' });
            if (userRes.ok) {
                const userData = await userRes.json();
                partnerName = `${userData.user.firstName} ${userData.user.lastName}`;
            }
        }
        
        // Обновляем отображение диалога
        renderOpenDialog(currentOpenDialog, partnerName, data.messages || []);
    } catch (error) {
        console.error('Ошибка обновления текущего диалога:', error);
    }
}

// Модификация функции initDialogs для инициализации WebSocket
function deferredInitDialogs() {
    // Ждём, пока DOM будет полностью готов
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDialogs);
    } else {
        // Если документ уже загружен, выполняем сразу
        setTimeout(initDialogs, 0);
    }
}

// Модифицируем основную функцию инициализации
async function initDialogs() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ДИАЛОГОВ ===');
    
    // Проверяем наличие элементов перед инициализацией
    const dialogsListElement = document.getElementById('dialogsList');
    if (!dialogsListElement) {
        console.error('❌ Элемент #dialogsList не найден! Проблема с загрузкой фрагмента');
        return;
    }

    try {
        const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
        if (!meResponse.ok) throw new Error('Не авторизован');
        
        const meData = await meResponse.json();
        currentUserId = meData.user.id; // 🔥 Кэшируем ID
        
        const usernameSpan = document.getElementById('currentUsername');
        if (usernameSpan) {
            usernameSpan.textContent = `${meData.user.firstName} ${meData.user.lastName}`;
            usernameSpan.classList.remove('skeleton', 'skeleton--medium');
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.style.display = 'block';

    } catch (err) {
        console.error('Error fetching current user data:', err);
        window.location.href = '/auth';
        return;
    }

    initDialogsTabs();
    await loadDialogsList();

    // Автоматическое открытие диалога по хэшу URL
    const dialogMatch = window.location.hash.match(/^#\/dialog\/(\d+)$/);
    if (dialogMatch) {
        const partnerId = parseInt(dialogMatch[1], 10);
        setTimeout(() => openDialog(partnerId), 300);
    }

    initDialogsEventListeners();
    
    // Инициализируем WebSocket
    initWebSocket();
    
    console.log('=== ЗАВЕРШЕНИЕ ИНИЦИАЛИЗАЦИИ ===');
}

function initDialogsTabs() {
    document.querySelectorAll('.dialogs-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            const tabType = this.getAttribute('data-tab');
            document.querySelectorAll('.dialogs-tab').forEach(t => t.classList.remove('dialogs-tab--active'));
            this.classList.add('dialogs-tab--active');
            
            document.querySelectorAll('.dialogs-tab-content').forEach(c => c.classList.remove('dialogs-tab-content--active'));
            document.getElementById(`tab-${tabType}`).classList.add('dialogs-tab-content--active');
        });
    });
}

function initDialogsEventListeners() {
    const newMessageBtn = document.getElementById('newMessageBtn');
    if (newMessageBtn) newMessageBtn.addEventListener('click', () => openNewMessageModal());

    const closeNewMessageModal = document.getElementById('closeNewMessageModal');
    if (closeNewMessageModal) closeNewMessageModal.addEventListener('click', closeNewMessageModalFn);

    const searchFriendsInput = document.getElementById('searchFriendsInput');
    if (searchFriendsInput) searchFriendsInput.addEventListener('input', handleFriendsSearch);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', handleSearchInput);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            currentDialogsFilter = this.getAttribute('data-filter');
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
            this.classList.add('filter-btn--active');
            loadDialogsList();
        });
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                window.location.href = '/auth';
            } catch (err) {
                console.error('Ошибка при выходе:', err);
            }
        });
    }
}

// ==========================================
// 3. Работа со списком диалогов
// ==========================================
async function loadDialogsList() {
    const container = document.getElementById('dialogsList');
    if (container) container.innerHTML = '<div class="loading" style="padding: 20px; text-align: center;">Загрузка диалогов...</div>';
    
    try {
        const res = await fetch(`/api/messages/dialogs?filter=${currentDialogsFilter}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        const data = await res.json();
        renderDialogsList(data.dialogs || []);
    } catch (error) {
        console.error('Ошибка загрузки диалогов:', error);
        if (container) {
            container.innerHTML = `<div class="error" style="color: red; padding: 20px; text-align: center;">Не удалось загрузить диалоги.</div>`;
        }
    }
}
// ==========================================
// 4. Рендеринг списка диалогов
// ==========================================
function renderDialogsList(dialogs) {
    const container = document.getElementById('dialogsList');
    if (!container) return;

    if (!dialogs || dialogs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Нет активных диалогов</p></div>';
        return;
    }

    container.innerHTML = dialogs.map(dialog => `
        <div class="dialogs-list__item" data-dialog-id="${dialog.partnerId}" onclick="openDialog(${dialog.partnerId}, '${escapeHtml(dialog.partnerName)}')">
            <div class="dialogs-list__avatar">
                <img src="${dialog.avatar || '/images/default-avatar.svg'}" alt="${escapeHtml(dialog.partnerName)}">
                ${dialog.unreadCount > 0 ? `<div class="dialogs-list__badge">${dialog.unreadCount}</div>` : ''}
            </div>
            <div class="dialogs-list__info">
                <span class="dialogs-list__name">${escapeHtml(dialog.partnerName)}</span>
                <span class="dialogs-list__last-message">${escapeHtml(dialog.lastMessage)}</span>
            </div>
        </div>
    `).join('');
}

// ==========================================
// 5. Открытие конкретного диалога
// ==========================================
async function openDialog(partnerId, partnerName = null) {
    // Если имя не передано, получаем его через API
    if (!partnerName) {
        try {
            const userRes = await fetch(`/api/users/${partnerId}`, { credentials: 'include' });
            if (!userRes.ok) throw new Error('Не удалось получить данные собеседника');
            const userData = await userRes.json();
            partnerName = `${userData.user.firstName} ${userData.user.lastName}`;
        } catch (error) {
            console.error('Ошибка получения имени собеседника:', error);
            partnerName = 'Собеседник';
        }
    }

    currentOpenDialog = partnerId;

    // Переключаем на вкладку просмотра
    document.querySelectorAll('.dialogs-tab').forEach(tab => tab.classList.remove('dialogs-tab--active'));
    document.querySelector('[data-tab="view"]').classList.add('dialogs-tab--active');
    document.querySelectorAll('.dialogs-tab-content').forEach(c => c.classList.remove('dialogs-tab-content--active'));
    document.getElementById('tab-view').classList.add('dialogs-tab-content--active');

    const container = document.getElementById('openDialogsList');
    if (!container) return;

    container.innerHTML = '<div class="loading" style="padding: 20px; text-align: center;">Загрузка переписки...</div>';

    try {
        const res = await fetch(`/api/messages/dialog/${partnerId}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        const data = await res.json();

        renderOpenDialog(partnerId, partnerName, data.messages || []);
    } catch (error) {
        console.error('Ошибка загрузки переписки:', error);
        container.innerHTML = `<div class="error" style="color: red; padding: 20px; text-align: center;">Не удалось загрузить переписку.</div>`;
    }
}

// ==========================================
// 6. Рендеринг открытого диалога
// ==========================================
function renderOpenDialog(partnerId, partnerName, messages) {
    const container = document.getElementById('openDialogsList');
    if (!container) return;

    container.innerHTML = '<div class="loading" style="padding: 20px; text-align: center;">Расшифровка сообщений...</div>';

    // 🔥 Передаем currentUserId, чтобы избежать лишнего fetch внутри renderMessages
    renderMessages(messages, currentUserId).then(decryptedMessages => {
        container.innerHTML = `
            <div class="dialog-messages-header">
                <button class="back-to-list-btn" onclick="showDialogsList()">← Назад к списку</button>
                <h3 class="dialog-partner-name">${escapeHtml(partnerName || 'Собеседник')}</h3>
            </div>
            <div class="messages-container" id="messagesContainer">
                ${decryptedMessages.map(msg => `
                    <div class="message ${Number(msg.senderId) === currentUserId ? 'message--sent' : 'message--received'}" data-message-id="${msg.id}">
                        <div class="message__text">${escapeHtml(msg.text)}</div>
                        <div class="message__time">${formatTime(msg.createdAt)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="message-input-area">
                <textarea id="messageTextarea" placeholder="Напишите сообщение..."></textarea>
                <button onclick="sendChatMessage(${partnerId})">Отправить</button>
            </div>
        `;

        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;

        const textarea = document.getElementById('messageTextarea');
        if (textarea) {
            const adjustHeight = () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 168) + 'px';
            };
            textarea.addEventListener('input', adjustHeight);
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage(partnerId);
                }
            });
            adjustHeight();
        }
    }).catch(err => {
        console.error('Критическая ошибка при расшифровке:', err);
        container.innerHTML = `
            <div class="error" style="color: red; padding: 20px; text-align: center;">
                Не удалось отобразить переписку.
                <br><button onclick="openDialog(${partnerId})" style="margin-top:10px;">Повторить</button>
            </div>
        `;
    });
}

// ==========================================
// 7. Возвращение к списку диалогов
// ==========================================
function showDialogsList() {
    document.querySelectorAll('.dialogs-tab').forEach(tab => tab.classList.remove('dialogs-tab--active'));
    document.querySelector('[data-tab="list"]').classList.add('dialogs-tab--active');
    document.querySelectorAll('.dialogs-tab-content').forEach(c => c.classList.remove('dialogs-tab-content--active'));
    document.getElementById('tab-list').classList.add('dialogs-tab-content--active');
    currentOpenDialog = null;
}

// ==========================================
// 8. Отправка сообщений
// ==========================================
async function sendChatMessage(recipientId) {
    const textarea = document.getElementById('messageTextarea');
    if (!textarea) return;
    
    const plaintext = textarea.value.trim();
    if (!plaintext) {
        alert('Введите текст сообщения');
        return;
    }

    textarea.disabled = true;

    try {
        const userRes = await fetch(`/api/users/${recipientId}`, { credentials: 'include' });
        if (!userRes.ok) throw new Error(`Ошибка сервера: ${userRes.status}`);
        
        const userData = await userRes.json();
        const publicKey = userData.user?.publicKey || userData.publicKey;

        if (!publicKey) throw new Error('У пользователя не настроено шифрование');

        const { encryptedContent, encryptedKey } = await encryptMessage(plaintext, publicKey);
        
        const sendRes = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ recipientId, encryptedContent, encryptedKey }),
        });

        if (sendRes.ok) {
            const responseData = await sendRes.json().catch(() => ({}));
            const newMessageId = responseData.message?.id; 
            
            // 🔥 ГЛАВНОЕ: Сохраняем plaintext для себя, чтобы переживал перезагрузку
            if (newMessageId) {
                localStorage.setItem(`sent_msg_${newMessageId}`, plaintext);
                sentMessagesCache.set(String(newMessageId), plaintext);
            }
            
            textarea.value = '';
            textarea.style.height = 'auto';
            
            // Полная перерисовка диалога для синхронизации состояния
            await openDialog(recipientId);
        } else {
            const error = await sendRes.json().catch(() => ({}));
            throw new Error(error.error || 'Неизвестная ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        alert('Ошибка отправки: ' + error.message);
    } finally {
        textarea.disabled = false;
        textarea.focus();
    }
}

// ==========================================
// 9. Расшифровка и рендер сообщений
// ==========================================
async function renderMessages(messagesFromServer, userId) {
    const myPrivateKey = localStorage.getItem('my_private_key');
    if (!myPrivateKey) {
        return messagesFromServer.map(msg => ({...msg, text: '⚠️ Ключ не найден в браузере'}));
    }

    return Promise.all(messagesFromServer.map(async (msg) => {
        try {
            // 🔥 ПРОВЕРКА: Это наше собственное сообщение?
            if (Number(msg.senderId) === userId) {
                // 1. Ищем в localStorage (переживает перезагрузку)
                const persistedText = localStorage.getItem(`sent_msg_${msg.id}`);
                if (persistedText) return { ...msg, text: persistedText };
                
                // 2. Ищем в оперативной памяти (мгновенный доступ)
                const cachedText = sentMessagesCache.get(String(msg.id));
                if (cachedText) return { ...msg, text: cachedText };
                
                // 3. Фоллбэк, если кэш был очищен пользователем
                return { ...msg, text: '[Текст недоступен: кэш браузера очищен]' };
            }

            // Для входящих сообщений - честная расшифровка приватным ключом
            if (!msg.encryptedContent || !msg.encryptedKey) {
                return { ...msg, text: '⚠️ Нет зашифрованных данных' };
            }
            
            const plaintext = await decryptMessage(msg.encryptedContent, msg.encryptedKey, myPrivateKey);
            return { ...msg, text: plaintext };
            
        } catch (err) {
            console.error(`Ошибка обработки сообщения ${msg.id}:`, err);
            return { ...msg, text: '⚠️ Ошибка отображения' };
        }
    }));
}

// ==========================================
// 10. Модальное окно "Новое сообщение"
// ==========================================
async function openNewMessageModal() {
    const modal = document.getElementById('newMessageModal');
    const friendsContainer = document.getElementById('friendsListForMessaging');
    if (!modal || !friendsContainer) return;

    modal.style.display = 'flex';
    try {
        const response = await fetch('/api/friends/list', { credentials: 'include' });
        if (!response.ok) throw new Error('Не удалось загрузить список друзей');
        const data = await response.json();
        renderFriendsForMessaging(data.friends || []);
    } catch (error) {
        console.error('Ошибка загрузки друзей:', error);
        friendsContainer.innerHTML = '<div class="empty-state"><p>Ошибка загрузки списка друзей</p></div>';
    }
}

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
                <img src="/images/default-avatar.svg" alt="Avatar">
            </div>
            <div class="friends-list__item__info">
                <span class="friends-list__item__name">${escapeHtml(friend.firstName)} ${escapeHtml(friend.lastName)}</span>
            </div>
        </div>
    `).join('');
}

function startNewDialog(friendId, friendName) {
    closeNewMessageModalFn();
    openDialog(friendId, friendName);
}

function closeNewMessageModalFn() {
    const modal = document.getElementById('newMessageModal');
    if (modal) modal.style.display = 'none';
}

// ==========================================
// 11. Вкладки и фильтры
// ==========================================
function initDialogsTabs() {
    document.querySelectorAll('.dialogs-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            const tabType = this.getAttribute('data-tab');
            document.querySelectorAll('.dialogs-tab').forEach(t => t.classList.remove('dialogs-tab--active'));
            this.classList.add('dialogs-tab--active');
            
            document.querySelectorAll('.dialogs-tab-content').forEach(c => c.classList.remove('dialogs-tab-content--active'));
            document.getElementById(`tab-${tabType}`).classList.add('dialogs-tab-content--active');
        });
    });
}

function initDialogsEventListeners() {
    const newMessageBtn = document.getElementById('newMessageBtn');
    if (newMessageBtn) newMessageBtn.addEventListener('click', () => openNewMessageModal());

    const closeNewMessageModal = document.getElementById('closeNewMessageModal');
    if (closeNewMessageModal) closeNewMessageModal.addEventListener('click', closeNewMessageModalFn);

    const searchFriendsInput = document.getElementById('searchFriendsInput');
    if (searchFriendsInput) searchFriendsInput.addEventListener('input', handleFriendsSearch);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', handleSearchInput);

    // Добавляем обработчики для фильтров
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
            this.classList.add('filter-btn--active');
            currentDialogsFilter = this.getAttribute('data-filter');
            loadDialogsList();
        });
    });
}

// ==========================================
// 12. Поиск
// ==========================================
function handleFriendsSearch(e) {
    clearTimeout(window.searchFriendsTimeout);
    window.searchFriendsTimeout = setTimeout(async () => {
        const query = e.target.value.trim();
        const url = query.length < 2 ? '/api/friends/list' : `/api/friends/list?search=${encodeURIComponent(query)}`;
        
        try {
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error('Ошибка поиска');
            const data = await res.json();
            renderFriendsForMessaging(data.friends || []);
        } catch (error) {
            console.error('Ошибка поиска друзей:', error);
        }
    }, 300);
}

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
            renderDialogsList(data.users || []);
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }, 300);
}

// ==========================================
// 13. Утилиты
// ==========================================
function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// 14. Экспорт в глобальную область
// ==========================================
window.initDialogs = initDialogs;
window.deferredInitDialogs = deferredInitDialogs; // Экспортируем новую функцию
window.openDialog = openDialog;
window.startNewDialog = startNewDialog;
window.closeNewMessageModalFn = closeNewMessageModalFn;
window.showDialogsList = showDialogsList;
window.sendChatMessage = sendChatMessage;

// ==========================================
// 15. Автоматический запуск
// ==========================================
// Заменяем прежнюю автоматическую инициализацию на отложенную
deferredInitDialogs();