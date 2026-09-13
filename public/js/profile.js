// public/js/profile.js

// Определяем, чей профиль мы смотрим
function getProfileMode() {
    const path = window.location.pathname;
    const match = path.match(/^\/(\d+)$/);

    if (match) {
        const userId = match[1];
        // Проверяем, является ли это нашим профилем
        return { type: 'other', userId: userId };
    }
    return { type: 'me', userId: 'me' };
}

// Функция получения ID целевого пользователя
function getTargetUserId() {
    const path = window.location.pathname;
    const match = path.match(/^\/(\d+)$/);
    return match ? parseInt(match[1]) : null;
}

// Функция получения текущего пользователя
async function getCurrentUserId() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            return data.user.id;
        }
        return null;
    } catch (error) {
        console.error('Ошибка получения ID текущего пользователя:', error);
        return null;
    }
}

// Форматирование даты
function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Форматирование значения пола
function formatGender(genderValue) {
    if (!genderValue) return null;

    const genderMap = {
        'male': 'Мужской',
        'female': 'Женский',
        'other': 'Другой',
        'm': 'Мужской',
        'f': 'Женский'
    };

    return genderMap[genderValue.toLowerCase()] || genderValue;
}

// Функция обновления текста элемента
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
        // Убираем класс скелетона, если он был
        el.classList.remove('skeleton', 'skeleton--medium', 'skeleton--short', 'skeleton--long');
    }
}

// Загрузка данных профиля
// Загрузка данных профиля
async function loadProfileData() {
    // Определяем ID пользователя из URL
    const path = window.location.pathname;
    const match = path.match(/^\/(\d+)$/);

    if (!match) {
        console.error('Не удалось определить ID пользователя из URL');
        return;
    }

    const userId = parseInt(match[1]);
    if (isNaN(userId)) {
        console.error('Некорректный ID пользователя в URL');
        return;
    }

    try {
        // Проверяем, является ли это нашим профилем
        const meResponse = await fetch('/api/auth/me', {
            credentials: 'include'
        });

        let isMyProfile = false;
        let userProfileData = null;

        if (meResponse.ok) {
            const meData = await meResponse.json();
            isMyProfile = meData.user.id === userId;
            userProfileData = meData.user;
        }

        // Загружаем данные профиля
        let userData;
        if (isMyProfile) {
            // Если это наш профиль, используем эндпоинт /me
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Не удалось загрузить профиль');
            const data = await response.json();
            userData = data.user;
        } else {
            // Если чужой профиль, используем эндпоинт /api/users/:id
            const response = await fetch(`/api/users/${userId}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                // Если пользователь не найден, покажем соответствующее сообщение
                if (response.status === 404) {
                    document.getElementById('main-content').innerHTML = `
                        <div class="error-card">
                            <div class="error-content">
                                <div class="error-icon">
                                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                </div>
                                <h1 class="error-title">404</h1>
                                <p class="error-message">Пользователь не найден</p>
                                <p class="error-description">Страница, которую вы искали, не существует или была удалена.</p>
                                <div class="error-actions">
                                    <a href="/" class="btn btn-primary">Вернуться на главную</a>
                                    <button onclick="history.back()" class="btn btn-secondary">Вернуться назад</button>
                                </div>
                            </div>
                        </div>
                    `;
                    return;
                }
                throw new Error('Не удалось загрузить профиль');
            }
            const data = await response.json();
            userData = data.user;
        }

        // Заполняем данные
        setText('profileName', `${userData.firstName} ${userData.lastName}` || 'Имя не указано');
        setText('userGender', formatGender(userData.gender) || 'Не указан');
        setText('userCity', userData.city || 'Не указано');
        setText('userBirthday', formatDate(userData.dateOfBirth) || 'Не указано');
        setText('userFamily', userData.familyStatus || 'Не указано');
        setText('userAbout', userData.about || 'Не указано');
        setText('userEmail', userData.email || 'Не указано');
        setText('userPhone', userData.phone || 'Не указано');
        setText('userWebsite', userData.website || 'Не указано');

        // Обновляем имя в шапке, если это наш профиль
        if (isMyProfile) {
            const usernameSpan = document.getElementById('currentUsername');
            if (usernameSpan) {
                usernameSpan.textContent = `${userData.firstName} ${userData.lastName}`;
                usernameSpan.classList.remove('skeleton', 'skeleton--medium');
            }
        }

        // Обновляем аватар
        const avatarImg = document.getElementById('userAvatar');
        if (avatarImg) {
            // Используем плейсхолдер, если аватар не установлен
            avatarImg.src = '/images/default-avatar.svg';
        }

        // Кнопку "Ред." показываем ТОЛЬКО если это наш профиль
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            editBtn.style.display = isMyProfile ? 'block' : 'none';
        }

        // Логика для кнопки "Добавить в друзья"
        // Логика для кнопки "Добавить в друзья"
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            if (isMyProfile) {
                // Не показываем кнопку "Добавить в друзья" для своего профиля
                addFriendBtn.style.display = 'none';
            } else {
                // Для чужого профиля проверяем статус дружбы
                addFriendBtn.style.display = 'block'; // Убедимся, что кнопка видима перед проверкой статуса
                await checkFriendshipStatus(userId, addFriendBtn);
            }
        }

        // Загружаем стену пользователя
        await loadWallPosts('all');

    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        document.getElementById('main-content').innerHTML = `
            <div class="error-card">
                <div class="error-content">
                    <h2>Ошибка загрузки профиля</h2>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" class="btn btn-primary">Попробовать снова</button>
                </div>
            </div>
        `;
    }
}
// Проверка статуса дружбы и обновление кнопки
// Проверка статуса дружбы и обновление кнопки
async function checkFriendshipStatus(userId, button) {
    try {
        const response = await fetch(`/api/friends/status/${userId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Ошибка проверки статуса дружбы:', response.statusText);
            button.style.display = 'none';
            return;
        }

        const data = await response.json();
        const status = data.status;

        // Убираем все существующие обработчики, чтобы избежать дублирования
        button.onclick = null;

        switch (status) {
            case 'friends':
                // Если уже друзья, можно добавить кнопку "Удалить из друзей" или не показывать ничего
                button.textContent = 'Друзья';
                button.disabled = true;
                button.classList.add('profile-actions__btn--disabled'); // если хотим дополнительные стили
                button.style.display = 'block';
                break;
            case 'request_sent':
                // Если запрос отправлен, можно показать соответствующий статус
                button.textContent = 'Заявка отправлена';
                button.disabled = true;
                button.classList.add('profile-actions__btn--disabled');
                button.style.display = 'block';
                break;
            case 'request_received':
                // Если получен запрос, можно показать кнопки "Принять/Отклонить"
                button.textContent = 'Принять заявку';
                button.disabled = false;
                button.classList.remove('profile-actions__btn--disabled');
                button.style.display = 'block';
                button.onclick = () => acceptFriendRequest(userId, button);
                break;
            case 'none':
                // Показываем кнопку "Добавить в друзья"
                button.textContent = 'Добавить в друзья';
                button.disabled = false;
                button.classList.remove('profile-actions__btn--disabled');
                button.style.display = 'block';
                button.onclick = () => sendFriendRequest(userId, button);
                break;
        }
    } catch (error) {
        console.error('Ошибка проверки статуса дружбы:', error);
        button.style.display = 'none';
    }
}

// Принятие заявки в друзья
// Принятие заявки в друзья
async function acceptFriendRequest(userId, button) {
    try {
        button.disabled = true;
        button.textContent = 'Принимается...';

        // Сначала нужно получить ID заявки, для этого нужно запросить список заявок
        const requestsResponse = await fetch('/api/friends/requests', {
            credentials: 'include'
        });

        if (!requestsResponse.ok) {
            throw new Error('Не удалось получить список заявок');
        }

        const requestsData = await requestsResponse.json();
        const request = requestsData.requests.find(r => r.fromUserId === userId);

        if (!request) {
            throw new Error('Заявка не найдена');
        }

        const response = await fetch(`/api/friends/accept/${request.id}`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Не удалось принять заявку');
        }

        const data = await response.json();
        console.log(data.message);

        // Обновляем состояние кнопки
        button.textContent = 'Друзья';
        button.disabled = true;
        button.classList.add('profile-actions__btn--disabled');

        // Обновляем счётчики в сайдбаре
        if (window.updateFriendRequestsBadge) {
            window.updateFriendRequestsBadge();
        }

    } catch (error) {
        console.error('Ошибка принятия заявки в друзья:', error);
        button.disabled = false;
        button.textContent = 'Принять заявку';
        button.classList.remove('profile-actions__btn--disabled');
        alert('Не удалось принять заявку в друзья: ' + error.message);
    }
}

// Отправка запроса в друзья
// Отправка запроса в друзья
async function sendFriendRequest(userId, button) {
    try {
        button.disabled = true;
        button.textContent = 'Отправляется...';

        const response = await fetch(`/api/friends/${userId}`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Не удалось отправить запрос');
        }

        const data = await response.json();
        console.log(data.message);

        // Обновляем состояние кнопки
        button.textContent = 'Заявка отправлена';
        button.disabled = true;
        button.classList.add('profile-actions__btn--disabled');

    } catch (error) {
        console.error('Ошибка отправки запроса в друзья:', error);
        button.disabled = false;
        button.textContent = 'Добавить в друзья';
        button.classList.remove('profile-actions__btn--disabled');
        alert('Не удалось отправить запрос в друзья: ' + error.message);
    }
}

// Загрузка записей на стене
async function loadWallPosts(filter = 'all') {
    // Определяем ID пользователя из URL
    const path = window.location.pathname;
    const match = path.match(/^\/(\d+)$/);

    if (!match) {
        console.error('Не удалось определить ID пользователя из URL');
        return;
    }

    const userId = parseInt(match[1]);

    try {
        const res = await fetch(`/api/posts/wall/${userId}?filter=${filter}`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Не удалось загрузить стену');

        const data = await res.json();
        renderWallPosts(data.posts || []);
    } catch (error) {
        console.error('Ошибка загрузки стены:', error);
    }
}

// Отображение записей на стене
function renderWallPosts(posts) {
    const container = document.getElementById('wallPosts');
    if (!container) return;

    if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="wall__empty"><p>Пока нет записей на стене</p></div>';
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="wall__post" data-post-id="${post.id}">
            <div class="wall__post-header">
                <span class="wall__post-author">${post.authorName || 'Аноним'}</span>
                <span class="wall__post-date">${formatDate(post.createdAt)}</span>
            </div>
            <div class="wall__post-content">${escapeHtml(post.text)}</div>
        </div>
    `).join('');
}

// Обработка отправки поста на стену
async function handleWallSubmit() {
    const textarea = document.getElementById('wallTextarea');
    if (!textarea) return;
    const text = textarea.value.trim();
    if (!text) return;

    try {
        // Определяем ID пользователя из URL
        const path = window.location.pathname;
        const match = path.match(/^\/(\d+)$/);

        if (!match) {
            console.error('Не удалось определить ID пользователя из URL');
            return;
        }

        const userId = parseInt(match[1]);

        const res = await fetch(`/api/posts/wall/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'credentials': 'include'
            },
            body: JSON.stringify({ content: text })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Не удалось опубликовать');
        }

        textarea.value = '';
        await loadWallPosts('all');
    } catch (error) {
        console.error('Ошибка публикации:', error);
        alert('Не удалось опубликовать запись: ' + error.message);
    }
}

// Переключение фильтров стены
function switchWallFilter(filter) {
    document.querySelectorAll('.wall__filter-btn').forEach(btn => {
        btn.classList.remove('wall__filter-btn--active');
    });
    const activeBtn = document.querySelector(`.wall__filter-btn[data-filter="${filter}"]`);
    if (activeBtn) activeBtn.classList.add('wall__filter-btn--active');
    loadWallPosts(filter);
}

// Обработка сохранения формы редактирования профиля
async function handleEditProfileSubmit(e) {
    e.preventDefault();

    try {
        // Получаем свой ID для обновления
        const profileRes = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        if (!profileRes.ok) throw new Error('Не авторизован');
        const { user } = await profileRes.json();

        const data = {
            city: document.getElementById('editCity')?.value || '',
            phone: document.getElementById('editPhone')?.value || '',
            website: document.getElementById('editWebsite')?.value || '',
            familyStatus: document.getElementById('editFamily')?.value || '',
            about: document.getElementById('editAbout')?.value || '',
            // Добавляем пол, если поле существует в форме редактирования
            gender: document.getElementById('editGender')?.value || undefined
        };

        // Убираем undefined значения
        Object.keys(data).forEach(key => {
            if (data[key] === undefined) {
                delete data[key];
            }
        });

        const res = await fetch(`/api/users/${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'credentials': 'include'
            },
            body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error('Не удалось сохранить');

        closeEditModalFn();
        await loadProfileData();
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Не удалось сохранить изменения');
    }
}

// Закрытие модального окна
function closeEditModalFn() {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
}

// Инициализация профиля
function initProfile() {
    // Ждем, когда DOM будет готов
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initializeProfileElements();
        });
    } else {
        initializeProfileElements();
    }
}

// Вспомогательная функция инициализации элементов
function initializeProfileElements() {
    const wallSubmitBtn = document.getElementById('wallSubmitBtn');
    if (wallSubmitBtn) wallSubmitBtn.onclick = handleWallSubmit;

    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) editProfileForm.onsubmit = handleEditProfileSubmit;

    const closeEditModal = document.getElementById('closeEditModal');
    if (closeEditModal) closeEditModal.onclick = closeEditModalFn;

    const cancelEdit = document.getElementById('cancelEdit');
    if (cancelEdit) cancelEdit.onclick = closeEditModalFn;

    const filterBtns = document.querySelectorAll('.wall__filter-btn');
    filterBtns.forEach(btn => {
        btn.onclick = () => switchWallFilter(btn.dataset.filter);
    });

    // Загружаем данные профиля после инициализации элементов
    setTimeout(loadProfileData, 100); // Небольшая задержка для гарантии загрузки DOM
}

// Экспортируем функцию для использования в других модулях
window.initProfile = initProfile;