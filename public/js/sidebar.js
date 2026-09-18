// public/js/sidebar.js

// Обновляем состояние сайдбара
function updateSidebar() {
    // Проверяем, авторизован ли пользователь, и обновляем UI соответственно
    fetch('/api/auth/me', {
        credentials: 'include'
    })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                window.location.href = '/auth';
            }
        })
        .then(data => {
            if (data && data.user) {
                // Показываем кнопку "Выйти"
                const logoutBtn = document.getElementById('logoutBtn');
                if (logoutBtn) {
                    logoutBtn.style.display = 'inline-block';

                    // Обновляем имя пользователя
                    const usernameSpan = document.getElementById('currentUsername');
                    if (usernameSpan) {
                        usernameSpan.textContent = `${data.user.firstName} ${data.user.lastName}`;
                        usernameSpan.classList.remove('skeleton');
                    }
                }

                // Обновляем badge с количеством заявок в друзья
                updateFriendRequestsBadge();

                // Обновляем badge с количеством непрочитанных сообщений
                updateUnreadMessagesBadge();
            }
        })
        .catch(error => {
            console.error('Ошибка при обновлении сайдбара:', error);
            window.location.href = '/auth';
        });
}

function updateFriendRequestsBadge() {
    fetch('/api/friends/requests/count', {
        credentials: 'include'
    })
        .then(response => response.json())
        .then(data => {
            const badge = document.getElementById('friendRequestsBadge');
            if (badge) {
                if (data.count > 0) {
                    badge.textContent = data.count;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        })
        .catch(error => {
            console.error('Ошибка при обновлении badge заявок в друзья:', error);
        });
}

function updateUnreadMessagesBadge() {
    fetch('/api/messages/unread-count', {
        credentials: 'include'
    })
        .then(response => response.json())
        .then(data => {
            const badge = document.getElementById('unreadBadge');
            if (badge) {
                if (data.unreadDialogs > 0) {
                    badge.textContent = data.unreadDialogs;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        })
        .catch(error => {
            console.error('Ошибка при обновлении badge непрочитанных сообщений:', error);
        });
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', updateSidebar);

// Обновляем при каждом переходе по SPA
window.addEventListener('popstate', updateSidebar);

// Экспортируем функцию для использования в других модулях
window.updateSidebar = updateSidebar;