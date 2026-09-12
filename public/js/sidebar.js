// public/js/sidebar.js

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

// Обновляем бейдж при загрузке страницы
// public/js/sidebar.js

// Подсветка активного пункта меню
// public/js/sidebar.js

// Подсветка активного пункта меню
function highlightActiveMenuLink() {
    const path = window.location.pathname;
    
    document.querySelectorAll('.menu__link').forEach(link => {
        link.classList.remove('menu__link--active');
        
        const href = link.getAttribute('href');
        
        if (href === '/' && /^\/\d+$/.test(path)) {
            // Профиль: URL вида /123
            link.classList.add('menu__link--active');
        } else if (href === '/dialogs' && (path === '/dialogs' || path.startsWith('/dialog'))) {
            // Диалоги
            link.classList.add('menu__link--active');
        } else if (href === '/friends' && path === '/friends') {
            // Друзья
            link.classList.add('menu__link--active');
        }
    });
}

// Остальной код файла остается без изменений...



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

// public/js/sidebar.js
async function updateFriendRequestsBadge() {
  try {
    const response = await fetch('/api/friends/requests/count', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      const badge = document.getElementById('friendRequestsBadge');
      if (badge) {
        if (data.count > 0) {
          badge.textContent = data.count;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  } catch (err) {
    console.error('Ошибка загрузки количества заявок в друзья:', err);
  }
}


// Обновляем бейдж при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    highlightActiveMenuLink();
    updateUnreadBadge();
    updateFriendRequestsBadge();
    // Обновляем каждые 30 секунд (polling)
    setInterval(updateUnreadBadge, 30000);
});

// Экспортируем для вызова из spa-router.js
window.highlightActiveMenuLink = highlightActiveMenuLink;