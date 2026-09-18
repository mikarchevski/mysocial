// public/js/friends.js

// Функция инициализации страницы друзей
async function initFriendsPage() {
  console.log('=== ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ДРУЗЕЙ ===');
  console.log('Document readyState:', document.readyState);

  let currentUser = null;

  try {
    const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
    console.log('Ответ от /api/auth/me:', meResponse.status);

    if (meResponse.ok) {
      const meData = await meResponse.json();
      console.log('Данные текущего пользователя:', meData);
      currentUser = meData.user;

      const currentUsernameEl = document.getElementById('currentUsername');
      if (currentUsernameEl) {
        currentUsernameEl.className = '';
        currentUsernameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
      }

      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.style.display = 'block';
    } else {
      console.warn('Пользователь не авторизован, перенаправление на /auth');
      window.location.href = '/auth';
      return;
    }
  } catch (err) {
    console.error('Error fetching current user data:', err);
    window.location.href = '/auth';
    return;
  }

  // Инициализация вкладок
  console.log('Инициализация вкладок...');
  initTabs();

  // Загрузка друзей по умолчанию
  console.log('Загрузка списка друзей по умолчанию...');
  loadFriendsList('friends');

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

  console.log('=== ЗАВЕРШЕНИЕ ИНИЦИАЛИЗАЦИИ СТРАНИЦЫ ДРУЗЕЙ ===');
}

// Инициализация вкладок
function initTabs() {
  console.log('Инициализация вкладок');
  const filterButtons = document.querySelectorAll('.friends-filter-btn');
  const menuLinks = document.querySelectorAll('.friends-menu__link');

  const handleTabChange = (tabType) => {
    console.log('Переключение вкладки на:', tabType);

    // Обновляем активные кнопки фильтров
    filterButtons.forEach(btn => {
      if (btn.dataset.tab === tabType) {
        btn.classList.add('friends-filter-btn--active');
      } else {
        btn.classList.remove('friends-filter-btn--active');
      }
    });

    // Обновляем активные ссылки в меню
    menuLinks.forEach(link => {
      if (link.dataset.tab === tabType) {
        link.classList.add('friends-menu__link--active');
        link.classList.remove('friends-menu__link');
      } else {
        link.classList.remove('friends-menu__link--active');
        link.classList.add('friends-menu__link');
      }
    });

    // Загружаем соответствующий список
    loadFriendsList(tabType);
  };

  // Обработчики для кнопок фильтров
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      handleTabChange(btn.dataset.tab);
    });
  });

  // Обработчики для ссылок в меню
  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      handleTabChange(link.dataset.tab);
    });
  });
}

// Загрузка списка друзей/заявок
async function loadFriendsList(tabType) {
  console.log('Загрузка списка:', tabType);
  const friendsList = document.getElementById('friendsList');

  try {
    if (tabType === 'friends') {
      // Загрузка списка друзей
      const response = await fetch('/api/friends/list', { credentials: 'include' });
      console.log('Ответ для друзей:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Данные друзей:', data);
        renderFriendsList(data.friends || []);
      } else {
        friendsList.innerHTML = '<div class="friends-list__empty"><p>Ошибка загрузки списка друзей</p></div>';
      }
    } else if (tabType === 'requests') {
      // Загрузка заявок в друзья
      console.log('Запрос заявок...');
      const response = await fetch('/api/friends/requests', { credentials: 'include' });
      console.log('Ответ для заявок:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Данные заявок:', data);
        renderRequestsList(data.requests || []);
      } else {
        friendsList.innerHTML = '<div class="friends-list__empty"><p>Ошибка загрузки заявок в друзья</p></div>';
      }
    }
  } catch (err) {
    console.error('Ошибка загрузки списка:', err);
    friendsList.innerHTML = '<div class="friends-list__empty"><p>Ошибка загрузки данных</p></div>';
  }
}

// Рендер списка друзей
function renderFriendsList(friends) {
  console.log('Отрисовка списка друзей:', friends);
  const friendsList = document.getElementById('friendsList');

  if (!friends || friends.length === 0) {
    friendsList.innerHTML = '<div class="friends-list__empty"><p>У вас пока нет друзей</p></div>';
    return;
  }

  friendsList.innerHTML = friends.map(friend => `
        <div class="friend-item">
            <div class="friend-item__avatar">
                <img src="/images/default-avatar.svg" alt="${friend.firstName} ${friend.lastName}">
            </div>
            <div class="friend-item__info">
                <div class="friend-item__name">${escapeHtml(friend.firstName)} ${escapeHtml(friend.lastName)}</div>
                <div class="friend-item__status">В сети</div>
            </div>
            <div class="friend-item__actions">
                <button class="friend-item__action-btn" onclick="location.href='/${friend.id}'">Профиль</button>
                <button class="friend-item__action-btn" onclick="sendMessage(${friend.id})">Написать</button>
            </div>
        </div>
    `).join('');
}

// Рендер списка заявок
function renderRequestsList(requests) {
  console.log('Отрисовка заявок:', requests);
  const friendsList = document.getElementById('friendsList');

  if (!requests || requests.length === 0) {
    console.log('Нет заявок для отображения');
    friendsList.innerHTML = '<div class="friends-list__empty"><p>Нет заявок в друзья</p></div>';
    return;
  }

  friendsList.innerHTML = requests.map(request => `
        <div class="request-item">
            <div class="request-item__avatar">
                <img src="/images/default-avatar.svg" alt="${escapeHtml(request.firstName)} ${escapeHtml(request.lastName)}">
            </div>
            <div class="request-item__info">
                <div class="request-item__name">${escapeHtml(request.firstName)} ${escapeHtml(request.lastName)}</div>
                <div class="request-item__status">Хочет добавить вас в друзья</div>
            </div>
            <div class="request-item__actions">
                <button class="accept-btn" onclick="acceptRequest(${request.id}, this)">Принять</button>
                <button class="decline-btn" onclick="declineRequest(${request.id}, this)">Отклонить</button>
            </div>
        </div>
    `).join('');
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Принятие заявки в друзья
async function acceptRequest(requestId, button) {
  try {
    const response = await fetch(`/api/friends/accept/${requestId}`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      alert(data.message || 'Заявка принята!');
      // Обновляем список заявок
      loadFriendsList('requests');
      // Обновляем счетчик заявок в бейдже
      if (window.updateFriendRequestsBadge) {
        window.updateFriendRequestsBadge();
      }
    } else {
      const error = await response.json();
      alert(error.error || 'Ошибка при принятии заявки');
    }
  } catch (err) {
    console.error('Ошибка при принятии заявки:', err);
    alert('Ошибка сети. Попробуйте позже.');
  }
}

// Отклонение заявки в друзья
async function declineRequest(requestId, button) {
  try {
    const response = await fetch(`/api/friends/decline/${requestId}`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      alert(data.message || 'Заявка отклонена!');
      // Обновляем список заявок
      loadFriendsList('requests');
      // Обновляем счетчик заявок в бейдже
      if (window.updateFriendRequestsBadge) {
        window.updateFriendRequestsBadge();
      }
    } else {
      const error = await response.json();
      alert(error.error || 'Ошибка при отклонении заявки');
    }
  } catch (err) {
    console.error('Ошибка при отклонении заявки:', err);
    alert('Ошибка сети. Попробуйте позже.');
  }
}

// Отправка сообщения
function sendMessage(userId) {
  // Перенаправляем на диалог с пользователем
  window.location.href = `/dialogs#/dialog/${userId}`;
}

// ГЛОБАЛЬНАЯ РЕГИСТРАЦИЯ ФУНКЦИИ - ОСНОВНОЕ ИСПРАВЛЕНИЕ
window.initFriendsPage = initFriendsPage;

// Запускаем инициализацию при загрузке DOM, если это первая загрузка страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    if (window.location.pathname === '/friends' || window.location.pathname.includes('/friends')) {
      if (typeof window.initFriendsPage === 'function') {
        window.initFriendsPage();
      }
    }
  });
} else {
  // Если документ уже загружен, проверяем URL и запускаем при необходимости
  if (window.location.pathname === '/friends' || window.location.pathname.includes('/friends')) {
    // Используем setTimeout для обеспечения завершения загрузки DOM
    setTimeout(function () {
      if (typeof window.initFriendsPage === 'function') {
        window.initFriendsPage();
      }
    }, 0);
  }
}