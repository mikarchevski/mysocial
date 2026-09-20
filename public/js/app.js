// public/js/app.js

// ==========================================
// 1. ГЛОБАЛЬНОЕ КЭШИРОВАНИЕ ПОЛЬЗОВАТЕЛЯ
// ==========================================
window.currentUser = null;
let currentUserFetchPromise = null;
let isAppInitialized = false;

async function getCurrentUser() {
  if (window.currentUser) {
    return window.currentUser;
  }

  if (currentUserFetchPromise) {
    return currentUserFetchPromise;
  }

  currentUserFetchPromise = fetch('/api/auth/me', {
    credentials: 'include'
  })
    .then(response => {
      if (!response.ok) throw new Error('Not authorized');
      return response.json();
    })
    .then(data => {
      window.currentUser = data.user;
      currentUserFetchPromise = null;
      return window.currentUser;
    })
    .catch(error => {
      currentUserFetchPromise = null;
      throw error;
    });

  return currentUserFetchPromise;
}

function clearUserCache() {
  window.currentUser = null;
  currentUserFetchPromise = null;
  isAppInitialized = false;
}

// ==========================================
// 2. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ==========================================
async function initApp() {
  // Предотвращаем повторную инициализацию
  if (isAppInitialized) {
    console.log('App already initialized, skipping...');
    return;
  }

  // Проверяем, на какой странице мы находимся
  const currentPath = window.location.pathname;

  // Если это главная страница ("/"), перенаправляем на страницу профиля текущего пользователя
  if (currentPath === '/' || currentPath === '') {
    try {
      // ИСПОЛЬЗУЕМ КЭШ вместо прямого fetch
      const currentUser = await getCurrentUser();

      // Переходим на страницу профиля текущего пользователя
      const profileUrl = `/${currentUser.id}`;
      window.history.replaceState({ path: profileUrl }, '', profileUrl);

      // Обновляем ссылку "Моя страница"
      updateMyPageLink(currentUser.id);

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

  isAppInitialized = true;
}

// ==========================================
// 3. ОБНОВЛЕНИЕ ИНФОРМАЦИИ О ПОЛЬЗОВАТЕЛЕ В ШАПКЕ
// ==========================================
async function updateUserInfo() {
  try {
    // ИСПОЛЬЗУЕМ КЭШ вместо fetch
    const currentUser = await getCurrentUser();

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

          // Очищаем кэш пользователя
          clearUserCache();

          // Перенаправляем на страницу авторизации
          window.location.href = '/auth';
        } catch (error) {
          console.error('Ошибка при выходе:', error);
          // Даже при ошибке пытаемся выйти
          window.location.href = '/auth';
        }
      });
    }
  } catch (error) {
    console.error('Ошибка при обновлении информации о пользователе:', error);
    window.location.href = '/auth';
  }
}

// ==========================================
// 4. ОБНОВЛЕНИЕ ССЫЛКИ "МОЯ СТРАНИЦА"
// ==========================================
async function updateMyPageLink(userId) {
  try {
    const currentUser = await getCurrentUser();
    const myPageLink = document.getElementById('myPageLink');
    if (myPageLink) {
      myPageLink.href = `/${userId || currentUser.id}`;
    }
  } catch (error) {
    console.error('Ошибка при обновлении ссылки "Моя страница":', error);
  }
}

// ==========================================
// 5. ОБРАБОТЧИКИ ПОИСКА
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const searchToggleBtn = document.getElementById('searchToggleBtn');
  const searchInput = document.getElementById('searchInput');
  const searchIcon = document.getElementById('searchIcon');
  const searchClean = document.getElementById('headerSearchClear');

  if (!searchToggleBtn || !searchInput) return; // Защита от отсутствия элементов

  searchToggleBtn.addEventListener('click', () => {
    searchInput.classList.toggle('active');
    searchToggleBtn.classList.toggle('moved');
    searchIcon.classList.toggle('moved');
    if (searchClean) searchClean.classList.toggle('active');

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
      // Исправлено: было searchCleaner, стало searchClean
      if (searchClean) searchClean.classList.remove('active');
    }
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });
});

// ==========================================
// 6. ФУНКЦИИ ПОИСКА
// ==========================================
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

// ИСПРАВЛЕНО (XSS): Полностью переписано с использованием безопасного DOM API
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

    // 1. Создаем блок имени БЕЗОПАСНО через textContent
    const nameDiv = document.createElement('div');
    nameDiv.className = 'search-result-name';
    nameDiv.textContent = `${user.firstName} ${user.lastName}`; // Браузер сам экранирует <script> и т.д.
    userElement.appendChild(nameDiv);

    // 2. Создаем блок города БЕЗОПАСНО через textContent (если он есть)
    if (user.city) {
      const citySpan = document.createElement('span');
      citySpan.className = 'search-result-city';
      citySpan.textContent = `📍 ${user.city}`; // Браузер сам экранирует
      userElement.appendChild(citySpan);
    }

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

// ==========================================
// 7. ДОПОЛНИТЕЛЬНЫЙ ОБРАБОТЧИК КНОПКИ ВЫХОДА
// ==========================================
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
        clearUserCache();
        window.location.href = '/auth';
      } catch (error) {
        console.error('Ошибка при выходе:', error);
        window.location.href = '/auth';
      }
    });
  }
});

// ==========================================
// 8. ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================
// Запускаем инициализацию при загрузке DOM
document.addEventListener('DOMContentLoaded', initApp);

// Также вызываем при изменении состояния истории (SPA переходы)
window.addEventListener('popstate', initApp);