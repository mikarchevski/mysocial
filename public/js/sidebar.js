// public/js/sidebar.js

// Обновляем состояние сайдбара (ОПТИМИЗИРОВАНО с использованием кэша)
async function updateSidebar() {
    try {
        // Используем глобальный кэш вместо нового fetch!
        const user = await getCurrentUser();

        if (user) {
            // Показываем кнопку "Выйти"
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.style.display = 'inline-block';
            }

            // Обновляем имя пользователя
            const usernameSpan = document.getElementById('currentUsername');
            if (usernameSpan) {
                usernameSpan.textContent = `${user.firstName} ${user.lastName}`;
                usernameSpan.classList.remove('skeleton', 'skeleton--medium');
            }

            // Обновляем badge с количеством заявок в друзья
            if (typeof window.updateFriendRequestsBadge === 'function') {
                window.updateFriendRequestsBadge();
            }

            // Обновляем badge с количеством непрочитанных сообщений
            if (typeof window.updateUnreadMessagesBadge === 'function') {
                window.updateUnreadMessagesBadge();
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении сайдбара:', error);
        window.location.href = '/auth';
    }
}

// Функция получения и отображения количества входящих заявок
async function updateFriendRequestsBadge() {
    try {
        const response = await fetch('/api/friends/requests', {
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Не удалось получить список заявок');
            return;
        }

        const data = await response.json();
        const requests = data.requests || [];
        const count = requests.length;

        const badge = document.getElementById('friendRequestsBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Ошибка обновления бейджа заявок:', error);
    }
}

// Делаем функцию доступной глобально
window.updateFriendRequestsBadge = updateFriendRequestsBadge;

// Функция обновления бейджа непрочитанных сообщений
async function updateUnreadMessagesBadge() {
    try {
        const response = await fetch('/api/messages/unread-count', {
            credentials: 'include'
        });

        if (!response.ok) return;

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
    } catch (error) {
        console.error('Ошибка при обновлении badge непрочитанных сообщений:', error);
    }
}

// Делаем функцию доступной глобально
window.updateUnreadMessagesBadge = updateUnreadMessagesBadge;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', updateSidebar);

// Обновляем при каждом переходе по SPA
window.addEventListener('popstate', updateSidebar);

// Экспортируем функцию для использования в других модулях
window.updateSidebar = updateSidebar;