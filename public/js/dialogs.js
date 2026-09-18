// public/js/dialogs.js

let currentDialogsFilter = 'all';
let currentOpenDialog = null;
const sentMessagesCache = new Map();

// Инициализация страницы диалогов
async function initDialogs() {
    // Проверяем, доступны ли необходимые элементы
    if (!document.getElementById('dialogsList')) {
        console.log('Элементы диалогов еще не загружены, ждем 100мс...');
        setTimeout(initDialogs, 100);
        return;
    }

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

    // === ИСПРАВЛЕНО: Автоматическое открытие диалога по хэшу ===
    const hash = window.location.hash;
    // Важно: слэши должны быть экранированы как \/
    const dialogMatch = hash.match(/^#\/dialog\/(\d+)$/);
    if (dialogMatch) {
        const partnerId = parseInt(dialogMatch[1], 10);
        // Небольшая задержка, чтобы список диалогов успел отрендериться
        setTimeout(() => openDialog(partnerId), 300);
    }
    // ============================================================

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
    const container = document.getElementById('dialogsList');
    if (container) {
        container.innerHTML = '<div class="loading" style="padding: 20px; text-align: center;">Загрузка диалогов...</div>';
    }
    
    try {
        // ДОБАВЛЕНО: { credentials: 'include' } для передачи куки сессии
        const res = await fetch(`/api/messages/dialogs?filter=${currentDialogsFilter}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        const data = await res.json();
        renderDialogsList(data.dialogs || []);
    } catch (error) {
        console.error('Ошибка загрузки диалогов:', error);
        if (container) {
            container.innerHTML = `<div class="error" style="color: red; padding: 20px; text-align: center;">Не удалось загрузить диалоги. Проверьте авторизацию.</div>`;
        }
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
    const container = document.getElementById('openDialogsList');
    if (container) {
        container.innerHTML = '<div class="loading" style="padding: 20px; text-align: center;">Загрузка сообщений...</div>';
    }

    try {
        // ДОБАВЛЕНО: { credentials: 'include' }
        const res = await fetch(`/api/messages/dialog/${partnerId}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        const data = await res.json();
        
        currentOpenDialog = partnerId;
        
        // Переключаемся на вкладку просмотра
        document.querySelectorAll('.dialogs-tab').forEach(tab => tab.classList.remove('dialogs-tab--active'));
        const viewTab = document.querySelector('[data-tab="view"]');
        if (viewTab) viewTab.classList.add('dialogs-tab--active');
        
        document.querySelectorAll('.dialogs-tab-content').forEach(content => content.classList.remove('dialogs-tab-content--active'));
        const tabView = document.getElementById('tab-view');
        if (tabView) tabView.classList.add('dialogs-tab-content--active');
        
        renderOpenDialog(partnerId, partnerName, data.messages || []);
    } catch (error) {
        console.error('Ошибка открытия диалога:', error);
        if (container) {
            container.innerHTML = `<div class="error" style="color: red; padding: 20px; text-align: center;">Не удалось загрузить сообщения.</div>`;
        }
    }
}


// Функция для создания контента вкладки просмотра, если он не существует
function createViewTabContent() {
    const dialogsContent = document.querySelector('.dialogs-content');
    if (!dialogsContent) {
        console.error('Контейнер диалогов не найден');
        return;
    }
    
    const viewContent = document.createElement('div');
    viewContent.id = 'tab-view';
    viewContent.className = 'dialogs-tab-content';
    viewContent.innerHTML = '<div id="openDialogsList"></div>';
    dialogsContent.appendChild(viewContent);
}

// Вспомогательные функции для работы с локальным хранилищем сообщений
function storeLocalMessage(messageId, text) {
    const messageData = {
        text: text,
        timestamp: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000) // 5 минут
    };
    localStorage.setItem(`local_message_${messageId}`, JSON.stringify(messageData));
}

function getAndRemoveLocalMessage(messageId) {
    const stored = localStorage.getItem(`local_message_${messageId}`);
    if (stored) {
        const messageData = JSON.parse(stored);
        if (Date.now() <= messageData.expiresAt) {
            localStorage.removeItem(`local_message_${messageId}`);
            return messageData.text;
        } else {
            // Удаляем просроченное сообщение
            localStorage.removeItem(`local_message_${messageId}`);
        }
    }
    return null;
}

// Рендер открытого диалога
function renderOpenDialog(partnerId, partnerName, messages) {
    const container = document.getElementById('openDialogsList');
    if (!container) return;

    if (!partnerName) {
        partnerName = 'Собеседник';
    }

    // Показываем лоадер, пока идет расшифровка
    container.innerHTML = '<div class="loading" style="padding: 20px; text-align: center;">Расшифровка сообщений...</div>';

    // Расшифровываем сообщения перед отображением
    renderMessages(messages).then(decryptedMessages => {
        container.innerHTML = `
            <div class="dialog-messages-header">
                <button class="back-to-list-btn" onclick="showDialogsList()">← Назад к списку</button>
                <h3 class="dialog-partner-name">${escapeHtml(partnerName)}</h3>
            </div>
            <div class="messages-container" id="messagesContainer">
                ${decryptedMessages.map(msg => `
                    <div class="message ${Number(msg.senderId) === Number(partnerId) ? 'message--received' : 'message--sent'}" data-message-id="${msg.id}">
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

        // Прокручиваем к последнему сообщению и настраиваем textarea
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        const textarea = document.getElementById('messageTextarea');
        if (textarea) {
            function adjustTextareaHeight() {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 168) + 'px';
            }
            textarea.addEventListener('input', adjustTextareaHeight);
            textarea.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage(partnerId);
                }
            });
            adjustTextareaHeight();
        }
    }).catch(err => {
        console.error('Критическая ошибка при расшифровке сообщений:', err);
        container.innerHTML = `
            <div class="error" style="color: red; padding: 20px; text-align: center;">
                Не удалось отобразить переписку. Проверьте консоль разработчика.
                <br><button onclick="openDialog(${partnerId})" style="margin-top:10px;">Повторить</button>
            </div>
        `;
    });
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
// В функции sendChatMessage, объявите tempMessageId в правильной области видимости
async function sendChatMessage(recipientId) {
    const textarea = document.getElementById('messageTextarea');
    
    if (!textarea) {
        console.error('Элемент textarea с ID "messageTextarea" не найден');
        alert('Ошибка: поле ввода сообщения не найдено. Возможно, вы не в диалоге.');
        return;
    }
    
    const plaintext = textarea.value.trim();
    
    if (!plaintext) {
        alert('Введите текст сообщения');
        return;
    }

    // Объявляем tempMessageId в нужной области видимости
    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        // Получаем публичный ключ получателя
        const userRes = await fetch(`/api/users/${recipientId}`, { credentials: 'include' });
        if (!userRes.ok) {
            throw new Error(`Ошибка сервера при получении профиля: ${userRes.status}`);
        }
        
        const userData = await userRes.json();
        const publicKey = userData.user?.publicKey || userData.publicKey;

        if (!publicKey) {
            console.error('Публичный ключ не найден в ответе API!');
            alert('У пользователя не настроено шифрование!');
            return;
        }

        // Шифруем сообщение
        const { encryptedContent, encryptedKey } = await encryptMessage(plaintext, publicKey);
        
        // Получаем ID текущего пользователя для идентификации отправителя
        const currentUserResponse = await fetch('/api/auth/me', { credentials: 'include' });
        if (!currentUserResponse.ok) {
            throw new Error('Не удалось получить информацию о текущем пользователе');
        }
        const currentUserData = await currentUserResponse.json();
        const currentUserId = currentUserData.user.id;

        // Добавляем сообщение во временный список с расшифрованным текстом
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            const newMessageHtml = `
                <div class="message message--sent" data-message-id="${tempMessageId}" data-temp="true">
                    <div class="message__text">${escapeHtml(plaintext)}</div>
                    <div class="message__time">${formatTime(new Date().toISOString())}</div>
                </div>
            `;
            messagesContainer.insertAdjacentHTML('beforeend', newMessageHtml);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Отправляем зашифрованные данные на сервер
        const sendRes = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                recipientId: recipientId,
                encryptedContent: encryptedContent,
                encryptedKey: encryptedKey,
            }),
        });

        // ... внутри sendChatMessage, после успешной отправки:
            if (sendRes.ok) {
                const responseData = await sendRes.json().catch(() => ({}));
                // Бэкенд возвращает { success: true, message: { id: 123, ... } }
                const newMessageId = responseData.message?.id; 
                
                console.log('Сообщение безопасно отправлено! ID:', newMessageId);
                
                // 🔥 ГЛАВНОЕ ИСПРАВЛЕНИЕ: Сохраняем и в память, и в localStorage
                if (newMessageId) {
                    localStorage.setItem(`sent_msg_${newMessageId}`, plaintext);
                    sentMessagesCache.set(String(newMessageId), plaintext);
                }
                
                // Очищаем поле ввода
                textarea.value = '';
                textarea.style.height = 'auto';
                
                // Обновляем открытый диалог
                await openDialog(recipientId);
            } else {
            const error = await sendRes.json().catch(() => ({}));
            console.error('Ошибка отправки сообщения:', error);
            // Удаляем временное сообщение при ошибке
            const tempMessage = document.querySelector(`[data-message-id="${tempMessageId}"][data-temp="true"]`);
            if (tempMessage) tempMessage.remove();
            alert('Ошибка отправки сообщения: ' + (error.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        // Удаляем временное сообщение при ошибке
        const tempMessage = document.querySelector(`[data-message-id="${tempMessageId}"][data-temp="true"]`);
        if (tempMessage) tempMessage.remove();
        alert('Произошла ошибка при отправке сообщения');
    }
}

// Новая функция для загрузки обновленного диалога
// Новая реализация функции loadUpdatedDialog
// Новая реализация функции loadUpdatedDialog
async function loadUpdatedDialog(recipientId, lastSentMessage = null) {
    try {
        const res = await fetch(`/api/messages/dialog/${recipientId}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        const data = await res.json();
        
        // Обновляем только содержимое сообщений
        await updateMessagesDisplay(data.messages || [], lastSentMessage);
    } catch (error) {
        console.error('Ошибка обновления диалога:', error);
        // В случае ошибки пробуем обновить через openDialog, но с задержкой
        setTimeout(() => {
            openDialog(recipientId);
        }, 500);
    }
}

// Обновляем функцию updateMessagesDisplay
// Обновляем функцию updateMessagesDisplay
async function updateMessagesDisplay(messages, lastSentMessage = null) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    // Получаем ID текущего пользователя
    const currentUserResponse = await fetch('/api/auth/me', { credentials: 'include' });
    if (!currentUserResponse.ok) {
        console.error('Ошибка получения ID пользователя');
        return;
    }
    const currentUserData = await currentUserResponse.json();
    const currentUserId = currentUserData.user.id;

    // Расшифровываем сообщения
    const decryptedMessages = await renderMessages(messages);
    
    // Формируем HTML для всех сообщений
    const messagesHtml = decryptedMessages.map(msg => {
        const isOwnMessage = msg.senderId === currentUserId;
        const messageClass = isOwnMessage ? 'message--sent' : 'message--received';
        const messageText = msg.text || `[Вы]: ${msg.encryptedContent || 'Сообщение'}`;
        return `
            <div class="message ${messageClass}" data-message-id="${msg.id}">
                <div class="message__text">${escapeHtml(messageText)}</div>
                <div class="message__time">${formatTime(msg.createdAt)}</div>
            </div>
        `;
    }).join('');

    // Обновляем содержимое контейнера
    messagesContainer.innerHTML = messagesHtml;
    
    // Прокручиваем к последнему сообщению
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Вспомогательная функция для преобразования текста в base64 (для проверки)
function plaintextToBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
}

// Обновляем renderMessages
// Обновляем функцию renderMessages
async function renderMessages(messagesFromServer) {
    const myPrivateKey = localStorage.getItem('my_private_key');
    if (!myPrivateKey) {
        console.error('Приватный ключ не найден!');
        return messagesFromServer.map(msg => ({...msg, text: '⚠️ Ключ не найден в браузере'}));
    }

    const currentUserResponse = await fetch('/api/auth/me', { credentials: 'include' });
    if (!currentUserResponse.ok) {
        throw new Error('Не удалось получить информацию о текущем пользователе');
    }
    const currentUserData = await currentUserResponse.json();
    const currentUserId = Number(currentUserData.user.id);

    const decryptedMessages = await Promise.all(
        messagesFromServer.map(async (msg) => {
            try {
                // 🔥 ПРОВЕРКА: Это наше собственное сообщение?
                if (Number(msg.senderId) === currentUserId) {
                    // 1. Ищем в localStorage (переживает перезагрузку страницы)
                    const persistedText = localStorage.getItem(`sent_msg_${msg.id}`);
                    if (persistedText) {
                        return { ...msg, text: persistedText };
                    }
                    
                    // 2. Ищем в оперативной памяти (на случай мгновенного рендера до записи в LS)
                    const cachedText = sentMessagesCache.get(String(msg.id));
                    if (cachedText) {
                        return { ...msg, text: cachedText };
                    }
                    
                    // 3. Честная заглушка, если пользователь очистил кэш браузера
                    return { ...msg, text: '[Текст недоступен: кэш браузера очищен]' };
                }

                // Для входящих сообщений - честная расшифровка
                if (!msg.encryptedContent || !msg.encryptedKey) {
                    return { ...msg, text: '⚠️ Нет зашифрованных данных' };
                }
                
                const plaintext = await decryptMessage(
                    msg.encryptedContent,
                    msg.encryptedKey,
                    myPrivateKey
                );
                return { ...msg, text: plaintext };
                
            } catch (err) {
                console.error(`Ошибка обработки сообщения ${msg.id}:`, err);
                return { ...msg, text: '⚠️ Ошибка отображения' };
            }
        })
    );

    return decryptedMessages;
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initDialogs };
} else {
    window.initDialogs = initDialogs;
}