// public/js/app.js

// Функция инициализации приложения
async function initApp() {
  // Проверяем, на какой странице мы находимся
  const currentPath = window.location.pathname;

  // Если это главная страница ("/"), перенаправляем на страницу профиля текущего пользователя
  if (currentPath === '/' || currentPath === '') {
    try {
      // Получаем информацию о текущем пользователе
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        // Переходим на страницу профиля текущего пользователя
        const profileUrl = `/${data.user.id}`;
        window.history.replaceState({ path: profileUrl }, '', profileUrl);

        // Обновляем ссылку "Моя страница"
        updateMyPageLink(data.user.id);

        // Загружаем содержимое страницы профиля
        if (typeof loadPageContent === 'function') {
          await loadPageContent(profileUrl);

          // После загрузки содержимого страницы профиля, инициализируем профиль
          if (typeof initProfile === 'function') {
            setTimeout(initProfile, 100); // Небольшая задержка для гарантии загрузки DOM
          }
        } else if (typeof initProfile === 'function') {
          initProfile();
        }
      } else {
        // Если пользователь не авторизован, перенаправляем на страницу входа
        window.location.href = '/auth';
      }
    } catch (error) {
      console.error('Ошибка получения информации о пользователе:', error);
      window.location.href = '/auth';
    }
  } else {
    // Обновляем ссылку "Моя страница" при загрузке
    await updateMyPageLink();

    // Для других страниц загружаем информацию о пользователе и обновляем UI
    await updateUserInfo();

    // Проверяем, является ли текущий путь известным SPA-маршрутом
    const isProfile = /^\/\d+$/.test(currentPath);
    const isFriends = currentPath === '/friends';
    const isDialogs = currentPath === '/dialogs';

    // Явно загружаем контент через роутер для всех наших SPA-страниц
    if (isProfile || isFriends || isDialogs) {
      if (typeof loadPageContent === 'function') {
        await loadPageContent(currentPath);

        // Небольшая страховочная задержка гарантирует, что DOM точно обновлен
        if (isFriends && typeof initFriends === 'function') {
          setTimeout(initFriends, 50);
        } else if (isDialogs && typeof initDialogs === 'function') {
          setTimeout(initDialogs, 50);
        } else if (isProfile && typeof initProfile === 'function') {
          setTimeout(initProfile, 50);
        }
      }
    }
  }

  // Обновляем сайдбар
  if (typeof updateSidebar === 'function') {
    updateSidebar();
  }
}

// Функция обновления информации о пользователе в шапке
async function updateUserInfo() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      const currentUser = data.user;

      // Обновляем имя пользователя в шапке
      const usernameSpan = document.getElementById('currentUsername');
      if (usernameSpan) {
        usernameSpan.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        usernameSpan.classList.remove('skeleton', 'skeleton--medium');
      }

      // Показываем кнопку "Выйти" и вешаем обработчик
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.style.display = 'inline-block';

        // Удаляем старый обработчик (если был) и добавляем новый
        logoutBtn.replaceWith(logoutBtn.cloneNode(true));
        const newLogoutBtn = document.getElementById('logoutBtn');

        newLogoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'include'
            });

            // Очищаем приватный ключ из памяти
            window.sessionPrivateKey = null;

            // Перенаправляем на страницу авторизации
            window.location.href = '/auth';
          } catch (error) {
            console.error('Ошибка при выходе:', error);
            // Даже при ошибке пытаемся выйти
            window.location.href = '/auth';
          }
        });
      }
    } else {
      // Пользователь не авторизован
      window.location.href = '/auth';
    }
  } catch (error) {
    console.error('Ошибка при обновлении информации о пользователе:', error);
    window.location.href = '/auth';
  }
}

// Функция обновления ссылки "Моя страница"
async function updateMyPageLink() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      const currentUser = data.user;

      // Обновляем href ссылки "Моя страница"
      const myPageLink = document.getElementById('myPageLink');
      if (myPageLink) {
        myPageLink.href = `/${currentUser.id}`;
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении ссылки "Моя страница":', error);
  }
}
// В app.js или отдельном файле для поиска
document.addEventListener('DOMContentLoaded', () => {
  const searchToggleBtn = document.getElementById('searchToggleBtn');
  const searchInput = document.getElementById('searchInput');
  const searchIcon = document.getElementById('searchIcon');
  const searchClean = document.getElementById('headerSearchClear');

  searchToggleBtn.addEventListener('click', () => {
    searchInput.classList.toggle('active');
    searchToggleBtn.classList.toggle('moved');
    searchIcon.classList.toggle('moved');
    searchClean.classList.toggle('active');

    if (searchInput.classList.contains('active')) {
      searchInput.focus();
    } else {
      searchInput.value = '';
    }
  });

  // Закрытие поля поиска при потере фокуса
  searchInput.addEventListener('blur', () => {
    if (!searchInput.value.trim()) {
      searchInput.classList.remove('active');
      searchToggleBtn.classList.remove('moved');
      searchIcon.classList.remove('moved');
      searchCleaner.classList.remove('active');
    }
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });
});

// === ФУНКЦИИ ПОИСКА ===

async function performSearch(query) {
  const trimmedQuery = query.trim();

  // Находим или создаем контейнер для результатов
  let resultsContainer = document.getElementById('searchResultsContainer');
  if (!resultsContainer) {
    resultsContainer = document.createElement('div');
    resultsContainer.id = 'searchResultsContainer';
    resultsContainer.className = 'search-results-dropdown';
    // Вставляем контейнер сразу после поля ввода
    const searchInput = document.getElementById('searchInput');
    searchInput.parentNode.insertBefore(resultsContainer, searchInput.nextSibling);
  }

  if (trimmedQuery.length < 2) {
    resultsContainer.innerHTML = '<div class="search-message">Введите минимум 2 символа</div>';
    resultsContainer.classList.add('active');
    return;
  }

  // Показываем индикатор загрузки
  resultsContainer.innerHTML = '<div class="search-message">Поиск...</div>';
  resultsContainer.classList.add('active');

  try {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(trimmedQuery)}`, {
      method: 'GET',
      credentials: 'include' // КРИТИЧЕСКИ ВАЖНО: отправляет куку с токеном!
    });

    if (!response.ok) {
      throw new Error('Ошибка при выполнении запроса');
    }

    const data = await response.json();
    renderSearchResults(data.users, resultsContainer);
  } catch (error) {
    console.error('Ошибка при поиске:', error);
    resultsContainer.innerHTML = '<div class="search-message error">Ошибка при поиске</div>';
  }
}

function renderSearchResults(usersList, container) {
  container.innerHTML = ''; // Очищаем предыдущие результаты

  if (!usersList || usersList.length === 0) {
    container.innerHTML = '<div class="search-message">Никого не найдено</div>';
    return;
  }

  usersList.forEach(user => {
    const userElement = document.createElement('a');
    userElement.href = `/${user.id}`; // Ссылка на профиль
    userElement.className = 'search-result-item';

    const name = `${user.firstName} ${user.lastName}`;
    const cityHtml = user.city ? `<span class="search-result-city">📍 ${user.city}</span>` : '';

    userElement.innerHTML = `
            <div class="search-result-name">${name}</div>
            ${cityHtml}
        `;

    // При клике на результат закрываем поле поиска
    userElement.addEventListener('click', () => {
      const searchInput = document.getElementById('searchInput');
      const searchToggleBtn = document.getElementById('searchToggleBtn');
      searchInput.classList.remove('active');
      searchInput.value = '';
      searchToggleBtn.classList.remove('moved');
      container.classList.remove('active');
    });

    container.appendChild(userElement);
  });
}

// Закрываем результаты поиска при клике вне его области
document.addEventListener('click', (e) => {
  const searchInput = document.getElementById('searchInput');
  const resultsContainer = document.getElementById('searchResultsContainer');

  if (searchInput && resultsContainer) {
    if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
      resultsContainer.classList.remove('active');
    }
  }
});
document.addEventListener('DOMContentLoaded', () => {
  // Гарантированно вешаем обработчик на кнопку выхода
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });
        window.sessionPrivateKey = null;
        window.location.href = '/auth';
      } catch (error) {
        console.error('Ошибка при выходе:', error);
        window.location.href = '/auth';
      }
    });
  }
});
// Запускаем инициализацию при загрузке DOM
document.addEventListener('DOMContentLoaded', initApp);

// Также вызываем при изменении состояния истории (SPA переходы)
window.addEventListener('popstate', initApp);