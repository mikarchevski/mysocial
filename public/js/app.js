// public/js/app.js

document.addEventListener('DOMContentLoaded', async () => {
  // Загружаем данные пользователя
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });

    if (!response.ok) {
      // Сюда мы не должны попасть — сервер сам редиректит неавторизованных
      console.error('Не удалось загрузить профиль');
      return;
    }

    const data = await response.json();
    const user = data.user;

    // Заполняем страницу
    const usernameEl = document.getElementById('username');
    const profileNameEl = document.getElementById('profileName');
    const userEmailEl = document.getElementById('userEmail');
    const userCityEl = document.getElementById('userCity');
    const logoutBtn = document.getElementById('logoutBtn');

    if (usernameEl) usernameEl.textContent = `${user.firstName} ${user.lastName}`;
    if (profileNameEl) profileNameEl.textContent = `${user.firstName} ${user.lastName}`;
    if (userEmailEl) userEmailEl.textContent = user.email;
    if (userCityEl) userCityEl.textContent = user.city || 'Не указан';
    if (logoutBtn) logoutBtn.style.display = 'block';

  } catch (error) {
    console.error('Ошибка загрузки профиля:', error);
  }

  // После загрузки данных пользователя добавьте:
    const profileIdEl = document.getElementById('profileId');
    if (profileIdEl) {
        profileIdEl.textContent = user.id;
    }

    // И сделайте ID кликабельным (опционально):
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl) {
        profileNameEl.innerHTML = `${user.firstName} ${user.lastName} <a href="/${user.id}" style="font-size: 14px; color: #2a5885;">(ID: ${user.id})</a>`;
    }

  // Обработчик кнопки выхода
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
});