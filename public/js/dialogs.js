// public/js/dialogs.js

// Состояние приложения
const state = {
    openDialogs: JSON.parse(localStorage.getItem('openDialogs') || '[]'),
    currentFilter: 'all',
};

// Загрузка данных текущего пользователя
// Загрузка данных текущего пользователя
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            const user = data.user;
            
            // Сохраняем ID текущего пользователя глобально
            window.currentUserId = user.id;
            
            document.getElementById('currentUsername').textContent = 
                `${user.firstName} ${user.lastName}`;
            document.getElementById('logoutBtn').style.display = 'block';
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
            renderDialogsList(data.dialogs);
        }
    } catch (err) {
        console.error('Ошибка загрузки диалогов:', err);
    }
}

// Рендер списка диалогов
function renderDialogsList(dialogs) {
    const container = document.getElementById('dialogsList');
    
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

    // Добавляем обработчики клика
    container.querySelectorAll('.dialog-item').forEach(item => {
        item.addEventListener('click', () => {
            const userId = item.dataset.userId;
            openDialog(userId);
        });
    });
}

// Открыть диалог в табе "Просмотр"
function openDialog(userId) {
    // Проверяем, не открыт ли уже
    if (!state.openDialogs.includes(userId)) {
        state.openDialogs.push(userId);
        saveOpenDialogs();
    }

    // Переключаемся на таб "Просмотр"
    switchTab('view');
    renderOpenDialogs();
}

// Закрыть диалог
function closeDialog(userId) {
    state.openDialogs = state.openDialogs.filter(id => id !== userId);
    saveOpenDialogs();
    renderOpenDialogs();
}

// Сохранить состояние
function saveOpenDialogs() {
    localStorage.setItem('openDialogs', JSON.stringify(state.openDialogs));
}

// Рендер открытых диалогов
async function renderOpenDialogs() {
    const container = document.getElementById('openDialogsList');

    if (state.openDialogs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Выберите диалог из списка, чтобы открыть его здесь</p></div>';
        return;
    }

    container.innerHTML = state.openDialogs.map(userId => `
        <div class="open-dialog" data-user-id="${userId}">
            <div class="open-dialog__header">
                <span class="open-dialog__title">Загрузка...</span>
                <button class="open-dialog__close" data-user-id="${userId}">×</button>
            </div>
            <div class="open-dialog__messages" id="messages-${userId}">
                <div class="loading">Загрузка сообщений...</div>
            </div>
            <div class="open-dialog__input">
                <input type="text" class="form-input" placeholder="Введите сообщение..." data-user-id="${userId}">
                <button class="send-btn" data-user-id="${userId}">Отправить</button>
            </div>
        </div>
    `).join('');

    // Загружаем данные для каждого диалога
    state.openDialogs.forEach(userId => loadDialogMessages(userId));

    // Обработчики закрытия
    container.querySelectorAll('.open-dialog__close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDialog(btn.dataset.userId);
        });
    });

    // Обработчики отправки
    container.querySelectorAll('.send-btn').forEach(btn => {
        btn.addEventListener('click', () => sendMessage(btn.dataset.userId));
    });

    container.querySelectorAll('.open-dialog__input input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage(input.dataset.userId);
            }
        });
    });
}


function initDialogsView() {
    // Сбрасываем состояние при новом открытии (опционально)
    // state.currentFilter = 'all'; 

    // Запускаем загрузку данных
    loadDialogs(state.currentFilter);

    // Навешиваем обработчики событий на НОВЫЕ элементы DOM
    document.querySelectorAll('.dialogs-tab').forEach(tab => {
        // Удаляем старые слушатели, чтобы не дублировались (простой способ - клонировать узел)
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener('click', () => switchTab(newTab.dataset.tab));
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
            newBtn.classList.add('filter-btn--active');
            state.currentFilter = newBtn.dataset.filter;
            loadDialogs(state.currentFilter);
        });
    });
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

    container.innerHTML = messages.map(msg => `
        <div class="message message--${msg.senderId === window.currentUserId ? 'own' : 'partner'}">
            <div class="message__content">${msg.encryptedContent}</div>
            <div class="message__time">${formatDate(msg.createdAt)}</div>
        </div>
    `).join('');

    // Прокрутка вниз
    container.scrollTop = container.scrollHeight;
}

// Отправка сообщения
async function sendMessage(recipientId) {
    const input = document.querySelector(`.open-dialog__input input[data-user-id="${recipientId}"]`);
    const content = input.value.trim();

    if (!content) return;

    try {
        const response = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                recipientId,
                encryptedContent: content, // Пока отправляем открытым текстом
                encryptedKey: '',
            }),
        });

        if (response.ok) {
            input.value = '';
            loadDialogMessages(recipientId); // Перезагружаем сообщения
            loadDialogs(state.currentFilter); // Обновляем список диалогов
        }
    } catch (err) {
        console.error('Ошибка отправки сообщения:', err);
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

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    await loadDialogs();

    // Переключение табов
    document.querySelectorAll('.dialogs-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
            btn.classList.add('filter-btn--active');
            state.currentFilter = btn.dataset.filter;
            loadDialogs(state.currentFilter);
        });
    });

    // Если есть открытые диалоги - показываем их
    if (state.openDialogs.length > 0) {
        renderOpenDialogs();
    }

});

// ... (весь код выше остается без изменений) ...

// Функция инициализации (выносится отдельно для вызова из роутера)
function initDialogsPage() {
    loadCurrentUser();
    loadDialogs(state.currentFilter);

    // Навешиваем обработчики на табы и фильтры
    document.querySelectorAll('.dialogs-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
            btn.classList.add('filter-btn--active');
            state.currentFilter = btn.dataset.filter;
            loadDialogs(state.currentFilter);
        });
    });

    if (state.openDialogs.length > 0) {
        renderOpenDialogs();
    }
}

// Инициализация при прямой загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, находимся ли мы на странице диалогов
    if (window.location.pathname === '/dialogs') {
        console.log(' Прямая загрузка страницы диалогов, инициализация...');
        initDialogsPage();
    }
});

// Экспортируем функцию для использования в spa-router.js
window.initDialogsView = initDialogsPage;