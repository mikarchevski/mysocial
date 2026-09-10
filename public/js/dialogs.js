// public/js/dialogs.js

// ✅ Защита от дубликатов при загрузке из localStorage
const rawDialogs = JSON.parse(localStorage.getItem('openDialogs') || '[]');

const state = {
    openDialogs: [...new Set(rawDialogs.map(String))], // уникальные строки
    currentFilter: 'all',
};

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
    userId = String(userId); // гарантируем строку
    
    if (!state.openDialogs.includes(userId)) {
        state.openDialogs.push(userId);
        saveOpenDialogs();
    }

    switchTab('view');
    renderOpenDialogs();
}

// Закрыть диалог
function closeDialog(userId) {
    userId = String(userId);
    state.openDialogs = state.openDialogs.filter(id => String(id) !== userId);
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

    container.onclick = (e) => {
        const closeBtn = e.target.closest('.open-dialog__close');
        if (closeBtn) {
            e.stopPropagation();
            closeDialog(closeBtn.dataset.userId);
            return;
        }

        const sendBtn = e.target.closest('.send-btn');
        if (sendBtn) {
            sendMessage(sendBtn.dataset.userId);
            return;
        }
    };

    container.onkeypress = (e) => {
        if (e.key === 'Enter' && e.target.matches('.open-dialog__input input')) {
            sendMessage(e.target.dataset.userId);
        }
    };

    state.openDialogs.forEach(userId => loadDialogMessages(userId));
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
                encryptedContent: content,
                encryptedKey: '',
            }),
        });

        if (response.ok) {
            input.value = '';
            loadDialogMessages(recipientId);
            loadDialogs(state.currentFilter);
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

// ✅ Защита от повторной инициализации
let dialogsInitialized = false;

function initDialogsPage() {
    if (dialogsInitialized) return;
    dialogsInitialized = true;

    loadCurrentUser();
    loadDialogs(state.currentFilter);

    const tabsContainer = document.querySelector('.dialogs-tabs');
    if (tabsContainer) {
        tabsContainer.onclick = (e) => {
            const tab = e.target.closest('.dialogs-tab');
            if (tab) switchTab(tab.dataset.tab);
        };
    }

    const filterContainer = document.querySelector('.dialogs-filter');
    if (filterContainer) {
        filterContainer.onclick = (e) => {
            const btn = e.target.closest('.filter-btn');
            if (btn) {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
                btn.classList.add('filter-btn--active');
                state.currentFilter = btn.dataset.filter;
                loadDialogs(state.currentFilter);
            }
        };
    }

    if (state.openDialogs.length > 0) {
        renderOpenDialogs();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initDialogsPage();
});

// Экспортируем для SPA-router
window.initDialogsView = initDialogsPage;