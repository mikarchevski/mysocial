// public/js/app.js

// Функция инициализации приложения
// public/js/app.js

async function initApp() {
  const currentPath = window.location.pathname;

  // 1. Если это главная страница, перенаправляем на профиль текущего пользователя
  if (currentPath === '/' || currentPath === '') {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const profileUrl = `/${data.user.id}`;
        window.history.replaceState({ path: profileUrl }, '', profileUrl);

        updateMyPageLink(data.user.id);

        if (typeof loadPageContent === 'function') {
          await loadPageContent(profileUrl);
          if (typeof initProfile === 'function') setTimeout(initProfile, 50);
        }
      } else {
        window.location.href = '/auth';
      }
    } catch (error) {
      console.error('Ошибка получения информации о пользователе:', error);
      window.location.href = '/auth';
    }
  } else {
    // 2. Для всех остальных страниц обновляем UI шапки
    await updateMyPageLink();
    await updateUserInfo();

    // Проверяем, является ли текущий путь известным SPA-маршрутом
    const isProfile = /^\/\d+$/.test(currentPath);
    const isFriends = currentPath === '/friends';
    const isDialogs = currentPath === '/dialogs';

    // 3. Явно загружаем контент через роутер для всех наших SPA-страниц
    if (isProfile || isFriends || isDialogs) {
      if (typeof loadPageContent === 'function') {
        await loadPageContent(currentPath);

        // loadPageContent уже вызывает нужные init-функции внутри себя, 
        // но небольшая страховочная задержка гарантирует, что DOM точно обновлен,
        // и предотвращает конфликты, если где-то остался скрытый вызов.
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

  // 4. Обновляем сайдбар
  if (typeof updateSidebar === 'function') {
    updateSidebar();
  }
}

// Остальной код app.js (updateUserInfo, updateMyPageLink) оставляем без изменений

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