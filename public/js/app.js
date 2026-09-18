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

    // Если это страница профиля (содержит ID пользователя), загружаем её
    if (/^\/\d+$/.test(currentPath)) {
      if (typeof loadPageContent === 'function') {
        await loadPageContent(currentPath);

        // После загрузки содержимого страницы профиля, инициализируем профиль
        if (typeof initProfile === 'function') {
          setTimeout(initProfile, 100); // Небольшая задержка для гарантии загрузки DOM
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
        // Убираем класс скелетона
        usernameSpan.classList.remove('skeleton', 'skeleton--medium');
      }

      // Показываем кнопку "Выйти"
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.style.display = 'inline-block';

        // Добавляем обработчик выхода
        logoutBtn.onclick = async () => {
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'include'
            });

            // Перенаправляем на страницу авторизации
            window.location.href = '/auth';
          } catch (error) {
            console.error('Ошибка при выходе:', error);
          }
        };
      }
    } else {
      // Пользователь не авторизован, перенаправляем на страницу входа
      window.location.href = '/auth';
    }
  } catch (error) {
    console.error('Ошибка при обновлении информации о пользователе:', error);
    // В случае ошибки также перенаправляем на страницу авторизации
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

// Запускаем инициализацию при загрузке DOM
document.addEventListener('DOMContentLoaded', initApp);

// Также вызываем при изменении состояния истории (SPA переходы)
window.addEventListener('popstate', initApp);