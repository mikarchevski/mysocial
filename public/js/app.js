// public/js/app.js

// ==========================================
// 1. ГЛОБАЛЬНОЕ КЭШИРОВАНИЕ ПОЛЬЗОВАТЕЛЯ
// ==========================================
window.currentUser = null;
let currentUserFetchPromise = null;
let isAppInitialized = false;

// ==========================================
// ✅ ДОБАВЛЕНО: WEBSOCKET ДЛЯ МГНОВЕННЫХ УВЕДОМЛЕНИЙ
// ==========================================
let websocketConnection = null;
let websocketReconnectTimeout = null;

function connectWebSocket() {
  if (websocketConnection) {
    websocketConnection.close();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    websocketConnection = new WebSocket(wsUrl);

    websocketConnection.onopen = () => {
      console.log('✅ WebSocket подключен');
    };

    websocketConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📩 ПОЛУЧЕНО WS СООБЩЕНИЕ:', data);

        // МГНОВЕННОЕ ОБНОВЛЕНИЕ БЕЙДЖА ЗАЯВОК В ДРУЗЬЯ
        if (data.type === 'friend_request' ||
          data.type === 'friend_request_accepted' ||
          data.type === 'friend_request_declined') {

          console.log('🔔 Обновляем бейдж заявок мгновенно!');
          if (typeof window.updateFriendRequestsBadge === 'function') {
            window.updateFriendRequestsBadge();
          }
        }
      } catch (error) {
        console.error('Ошибка парсинга WebSocket сообщения:', error);
      }
    };

    websocketConnection.onclose = () => {
      console.log('⚠️ WebSocket отключен. Переподключение через 5 секунд...');
      if (websocketReconnectTimeout) clearTimeout(websocketReconnectTimeout);
      websocketReconnectTimeout = setTimeout(() => {
        if (window.currentUser) connectWebSocket();
      }, 5000);
    };

    websocketConnection.onerror = (error) => {
      console.error('Ошибка WebSocket:', error);
    };
  } catch (error) {
    console.error('Не удалось создать WebSocket соединение:', error);
  }
}

function disconnectWebSocket() {
  if (websocketReconnectTimeout) {
    clearTimeout(websocketReconnectTimeout);
    websocketReconnectTimeout = null;
  }
  if (websocketConnection) {
    websocketConnection.close();
    websocketConnection = null;
  }
}
// ==========================================
// КОНЕЦ ДОБАВЛЕННОГО БЛОКА WEBSOCKET
// ==========================================

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
  disconnectWebSocket(); // ✅ ДОБАВЛЕНО: Закрываем WebSocket при выходе
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
  // ==========================================
  // ✅ 1. ВОССТАНОВЛЕНИЕ КЛЮЧА ИЗ sessionStorage
  // ==========================================
  if (!window.sessionPrivateKey) {
    console.log(' Ключа нет в памяти, проверяем sessionStorage...');
    const storedJwk = sessionStorage.getItem('temp_private_key_jwk');

    if (storedJwk) {
      console.log(' Найден ключ в sessionStorage, пытаемся восстановить...');
      try {
        const jwk = JSON.parse(storedJwk);
        console.log('🔑 JWK распарсен:', jwk);

        window.sessionPrivateKey = await window.crypto.subtle.importKey(
          "jwk",
          jwk,
          { name: "RSA-OAEP", hash: "SHA-256" },
          true,
          ["decrypt"]
        );

        console.log('✅ Приватный ключ успешно восстановлен из sessionStorage!');
        console.log('🔑 Тип ключа:', window.sessionPrivateKey.type);
        console.log('🔑 Алгоритм:', window.sessionPrivateKey.algorithm);

      } catch (e) {
        console.error("❌ КРИТИЧЕСКАЯ ОШИБКА при восстановлении ключа:", e);
        console.error("Стек ошибки:", e.stack);
        sessionStorage.removeItem('temp_private_key_jwk');
      }
    } else {
      console.log('️ Ключа нет ни в памяти, ни в sessionStorage. Потребуется ввод пароля.');
    }
  } else {
    console.log('✅ Ключ уже есть в памяти, восстановление не требуется.');
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

  if (typeof updateFriendRequestsBadge === 'function') {
    updateFriendRequestsBadge();
  }

  // ✅ ДОБАВЛЕНО: Подключаемся к WebSocket, если пользователь авторизован
  if (window.currentUser && !websocketConnection) {
    connectWebSocket();
  }
  // ✅ 2. ПРОВЕРКА РАЗБЛОКИРОВКИ (строго после восстановления ключа!)
  console.log(' Проверяем необходимость разблокировки...');
  console.log('🔑 window.sessionPrivateKey:', window.sessionPrivateKey);
  checkE2EEUnlock();
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
// E2EE РАЗБЛОКИРОВКА ПЕРЕПИСКИ
// ==========================================

// Проверяем, нужен ли ввод пароля для расшифровки
function checkE2EEUnlock() {
  if (!window.sessionPrivateKey) {
    // Ключа нет в памяти — показываем модальное окно
    showE2EEUnlockModal();
  }
}

function showE2EEUnlockModal() {
  const modal = document.getElementById('e2eeUnlockModal');
  if (modal) {
    modal.style.display = 'flex';
    const passwordInput = document.getElementById('e2eePassword');
    if (passwordInput) {
      setTimeout(() => passwordInput.focus(), 100);
    }
  }
}

function hideE2EEUnlockModal() {
  const modal = document.getElementById('e2eeUnlockModal');
  if (modal) {
    modal.style.display = 'none';
    const form = document.getElementById('e2eeUnlockForm');
    if (form) form.reset();
    const error = document.getElementById('e2eeUnlockError');
    if (error) error.style.display = 'none';
  }
}

// Обработчик формы разблокировки
document.addEventListener('DOMContentLoaded', () => {
  const unlockForm = document.getElementById('e2eeUnlockForm');
  if (unlockForm) {
    unlockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('e2eePassword').value;
      const errorEl = document.getElementById('e2eeUnlockError');

      if (!password) {
        errorEl.textContent = 'Введите пароль';
        errorEl.style.display = 'block';
        return;
      }

      try {
        // Получаем зашифрованный ключ и соль с сервера
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        });

        if (!response.ok) throw new Error('Не авторизован');

        const data = await response.json();

        let saltArray;
        if (typeof data.user.salt === 'string') {
          try {
            saltArray = JSON.parse(data.user.salt);
          } catch (e) {
            throw new Error('Неверный формат соли в базе данных');
          }
        } else if (Array.isArray(data.user.salt)) {
          saltArray = data.user.salt;
        }

        if (!saltArray || !data.user.encryptedPrivateKey) {
          throw new Error('Ключи не настроены для этого аккаунта. Создайте нового пользователя.');
        }

        const saltBuffer = new Uint8Array(saltArray);
        const masterKey = await window.E2EECrypto.deriveMasterKey(password, saltBuffer);

        const decryptedKey = await window.E2EECrypto.decryptPrivateKey(
          data.user.encryptedPrivateKey,
          masterKey
        );

        // Сохраняем в оперативную память
        window.sessionPrivateKey = decryptedKey;

        console.log('✅ Ключ расшифрован и сохранён в памяти');
        hideE2EEUnlockModal();

        // Перезагружаем диалоги, чтобы они расшифровались
        if (typeof loadDialogsList === 'function') {
          loadDialogsList();
        }

      } catch (error) {
        console.error('Ошибка расшифровки ключа:', error);
        errorEl.textContent = 'Неверный пароль или ошибка расшифровки';
        errorEl.style.display = 'block';
      }
    });
  }
});

// Проверяем необходимость разблокировки при инициализации
const originalInitApp = initApp;
initApp = async function () {
  await originalInitApp();
  checkE2EEUnlock();
};
// ==========================================
// 8. ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================
// Запускаем инициализацию при загрузке DOM
document.addEventListener('DOMContentLoaded', initApp);

// Также вызываем при изменении состояния истории (SPA переходы)
window.addEventListener('popstate', initApp);