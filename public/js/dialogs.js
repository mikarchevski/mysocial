// public/js/dialogs.js

function initDialogs() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.oninput = handleSearchInput;

    loadDialogsList();
}

async function loadDialogsList(filter = 'all') {
    const container = document.getElementById('dialogsList');
    if (!container) return;
    container.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        const res = await fetch(`/api/messages/dialogs?filter=${filter}`);
        if (!res.ok) throw new Error('Не удалось загрузить');
        const data = await res.json();
        renderDialogsList(data.dialogs || []);
    } catch (error) {
        console.error('Ошибка:', error);
        container.innerHTML = '<div class="empty-state"><p>Ошибка загрузки</p></div>';
    }
}

function renderDialogsList(dialogs) {
    const container = document.getElementById('dialogsList');
    if (!container) return;
    if (!dialogs || dialogs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>У вас пока нет диалогов</p></div>';
        return;
    }
    container.innerHTML = dialogs.map(dialog => `
        <div class="dialogs-list__item" data-dialog-id="${dialog.id}" onclick="openDialog(${dialog.partnerId})">
            <div class="dialogs-list__avatar">
                <img src="${dialog.avatar || '/images/default-avatar.svg'}" alt="${dialog.name}">
                ${dialog.unreadCount > 0 ? `<span class="dialogs-list__badge">${dialog.unreadCount}</span>` : ''}
            </div>
            <div class="dialogs-list__info">
                <span class="dialogs-list__name">${dialog.name}</span>
                <span class="dialogs-list__last-message">${dialog.lastMessage || 'Нет сообщений'}</span>
            </div>
        </div>
    `).join('');
}

async function openDialog(partnerId) {
    try {
        // <-- ИСПРАВЛЕНО: /api/messages/dialog/:userId
        const res = await fetch(`/api/messages/dialog/${partnerId}`);
        if (!res.ok) throw new Error('Не удалось загрузить');
        const data = await res.json();
        renderOpenDialog(partnerId, data.messages || []);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

function renderOpenDialog(partnerId, messages) {
    // Здесь упрощенный рендер, адаптируй под свою верстку
    const container = document.getElementById('openDialogsList') || document.getElementById('dialogsList');
    if (!container) return;

    container.innerHTML = messages.map(msg => `
        <div class="message ${msg.isOwn ? 'message--own' : ''}">
            <div class="message__text">${escapeHtml(msg.content)}</div>
        </div>
    `).join('') + `
        <div class="message-input-area">
            <textarea id="messageTextarea" placeholder="Напишите сообщение..."></textarea>
            <button onclick="sendMessage(${partnerId})">Отправить</button>
        </div>
    `;
}

async function sendMessage(recipientId) {
    const textarea = document.getElementById('messageTextarea');
    if (!textarea) return;
    const text = textarea.value.trim();
    if (!text) return;

    try {
        // <-- ИСПРАВЛЕНО: /api/messages/send, поля recipientId и encryptedContent
        const res = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: recipientId,
                encryptedContent: text, // Пока передаем как есть, если шифрование не реализовано
                encryptedKey: ''
            })
        });
        if (!res.ok) throw new Error('Не удалось отправить');

        textarea.value = '';
        await openDialog(recipientId);
        await loadDialogsList();
    } catch (error) {
        console.error('Ошибка отправки:', error);
    }
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
            renderDialogsList(data.users || []); // Адаптируй под свою верстку поиска
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }, 300);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.initDialogs = initDialogs;