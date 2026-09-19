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

// Экранирование HTML (Ваша отличная функция!)
function escapeHtml(text) {
    if (!text) return '';
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
        el.textContent = text; // ✅ Безопасно: textContent автоматически экранирует
        // Убираем класс скелетона, если он был
        el.classList.remove('skeleton', 'skeleton--medium', 'skeleton--short', 'skeleton--long');
    }
}

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

        if (meResponse.ok) {
            const meData = await meResponse.json();
            isMyProfile = meData.user.id === userId;
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
                    `; // ✅ Безопасно: здесь нет переменных пользователя, только статический HTML
                    return;
                }
                throw new Error('Не удалось загрузить профиль');
            }
            const data = await response.json();
            userData = data.user;
        }

        // Заполняем данные (функция setText внутри использует textContent, так что это безопасно)
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
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            if (isMyProfile) {
                // Не показываем кнопку "Добавить в друзья" для своего профиля
                addFriendBtn.style.display = 'none';
            } else {
                // Для чужого профиля проверяем статус дружбы
                addFriendBtn.style.display = 'block';
                await checkFriendshipStatus(userId, addFriendBtn);
            }
        }

        // Загружаем стену пользователя
        await loadWallPosts('all');

    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        // ✅ УЛУЧШЕНО: Добавлено escapeHtml для error.message на случай, если сервер вернет что-то странное
        document.getElementById('main-content').innerHTML = `
            <div class="error-card">
                <div class="error-content">
                    <h2>Ошибка загрузки профиля</h2>
                    <p>${escapeHtml(error.message)}</p>
                    <button onclick="location.reload()" class="btn btn-primary">Попробовать снова</button>
                </div>
            </div>
        `;
    }
}

// Проверка статуса дружбы и обновление кнопки
async function checkFriendshipStatus(userId, button) {
    console.log('🔥 Проверка статуса дружбы для userId:', userId);

    try {
        const response = await fetch(`/api/friends/status/${userId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('Ошибка проверки статуса дружбы:', response.statusText);
            return;
        }

        const data = await response.json();
        console.log(' Данные статуса дружбы:', data);

        // 🔥 ИСПРАВЛЕНИЕ: Правильно извлекаем статус из вложенной структуры
        const status = data.status?.status || data.status;
        console.log('🔥 Извлеченный статус:', status);

        updateButtonByStatus(button, status, userId);

    } catch (error) {
        console.error('Ошибка проверки статуса дружбы:', error);
    }
}

// Вспомогательная функция для обновления кнопки по статусу
function updateButtonByStatus(button, status, userId) {
    console.log('🔥 updateButtonByStatus вызвана:', { status, userId, button });

    if (!button) {
        console.error('Кнопка не найдена');
        return;
    }

    // Очищаем предыдущий обработчик, чтобы избежать дублирования кликов
    button.onclick = null;

    switch (status) {
        case 'friends':
            // 🔥 ИЗМЕНЕНИЕ: Кнопка теперь активна и предлагает удаление
            button.textContent = 'Удалить из друзей';
            button.disabled = false;
            button.classList.remove('profile-actions__btn--disabled');
            button.classList.add('profile-actions__btn--gray');
            button.onclick = () => removeFriend(userId, button);
            break;

        case 'request_sent':
            button.textContent = 'Заявка отправлена';
            button.disabled = true;
            button.classList.add('profile-actions__btn--disabled');
            break;

        case 'request_received':
            button.textContent = 'Принять заявку';
            button.disabled = false;
            button.classList.remove('profile-actions__btn--disabled');
            button.onclick = () => acceptFriendRequest(userId, button);
            break;

        case 'none':
        default:
            button.textContent = 'Добавить в друзья';
            button.disabled = false;
            button.classList.remove('profile-actions__btn--disabled');
            button.onclick = () => sendFriendRequest(userId, button);
            break;
    }
}

// Отправка запроса в друзья
async function sendFriendRequest(userId, button) {
    console.log('Отправка запроса в друзья для userId:', userId);

    try {
        // 🔥 Оптимистичное обновление: меняем кнопку сразу
        button.disabled = true;
        button.textContent = 'Отправка...'; // Промежуточный статус

        const response = await fetch(`/api/friends/${userId}`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Не удалось отправить запрос');
        }

        // Успех: окончательно меняем состояние кнопки
        button.textContent = 'Заявка отправлена';
        button.classList.add('profile-actions__btn--disabled');
        console.log('Заявка успешно отправлена');

    } catch (error) {
        console.error('Ошибка отправки запроса в друзья:', error);

        // 🔥 Откат при ошибке: возвращаем кнопку в исходное состояние
        button.disabled = false;
        button.textContent = 'Добавить в друзья';
        button.classList.remove('profile-actions__btn--disabled');
        button.onclick = () => sendFriendRequest(userId, button); // Восстанавливаем обработчик

        alert('Не удалось отправить запрос: ' + error.message);
    }
}

// Принятие заявки в друзья
async function acceptFriendRequest(userId, button) {
    try {
        button.disabled = true;
        button.textContent = 'Принимается...';

        const requestsResponse = await fetch('/api/friends/requests', {
            credentials: 'include'
        });

        if (!requestsResponse.ok) throw new Error('Не удалось получить список заявок');

        const requestsData = await requestsResponse.json();
        const request = requestsData.requests.find(r => r.fromUserId === userId);

        if (!request) throw new Error('Заявка не найдена');

        const response = await fetch(`/api/friends/accept/${request.id}`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Не удалось принять заявку');
        }

        // Успех: меняем состояние кнопки
        button.textContent = 'Друзья';
        button.disabled = true;
        button.classList.add('profile-actions__btn--disabled');

        if (window.updateFriendRequestsBadge) {
            window.updateFriendRequestsBadge();
        }

    } catch (error) {
        console.error('Ошибка принятия заявки:', error);

        // Откат при ошибке
        button.disabled = false;
        button.textContent = 'Принять заявку';
        button.classList.remove('profile-actions__btn--disabled');
        button.onclick = () => acceptFriendRequest(userId, button);

        alert('Не удалось принять заявку: ' + error.message);
    }
}

// Удаление из друзей
async function removeFriend(userId, button) {
    // 🔥 Подтверждение действия (хороший UX для деструктивных действий)
    if (!confirm('Вы уверены, что хотите удалить этого пользователя из друзей?')) {
        return;
    }

    try {
        // Промежуточное состояние
        button.disabled = true;
        button.textContent = 'Удаление...';

        // Отправляем запрос на удаление (используем метод DELETE)
        const response = await fetch(`/api/friends/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Не удалось удалить из друзей');
        }

        // 🔥 Успех: возвращаем кнопку в состояние "Добавить в друзья"
        button.textContent = 'Добавить в друзья';
        button.disabled = false;
        button.classList.remove('profile-actions__btn--disabled');
        button.onclick = () => sendFriendRequest(userId, button); // Возвращаем обработчик для повторной отправки

        console.log('Пользователь успешно удален из друзей');

        // Если у тебя есть глобальная функция обновления счетчика друзей в сайдбаре, вызови её:
        if (window.updateFriendsCountBadge) {
            window.updateFriendsCountBadge();
        }

    } catch (error) {
        console.error('Ошибка удаления из друзей:', error);

        // 🔥 Откат при ошибке: возвращаем кнопку в состояние "Удалить из друзей"
        button.disabled = false;
        button.textContent = 'Удалить из друзей';
        button.classList.remove('profile-actions__btn--disabled');
        button.onclick = () => removeFriend(userId, button);

        alert('Не удалось удалить из друзей: ' + error.message);
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

    // ✅ ОТЛИЧНО: Вы уже используете escapeHtml здесь! Это полностью защищает от XSS.
    container.innerHTML = posts.map(post => `
        <div class="wall__post" data-post-id="${post.id}">
            <div class="wall__post-avatar">
                <img src="/images/default-avatar.svg" alt="Аватар">
            </div>
            <div class="wall__post-content">
                <div class="wall__post-header">
                    <a href="/${post.authorId}" class="wall__post-author">${escapeHtml(post.authorName)}</a>
                    <span class="wall__post-time">${formatWallDate(post.createdAt)}</span>
                </div>
                <div class="wall__post-text">${escapeHtml(post.text)}</div>
                <div class="wall__post-actions">
                    <button class="wall__post-action" disabled>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span>${post.likes || 0}</span>
                    </button>
                    <button class="wall__post-action" disabled>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span>${post.comments || 0}</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function formatWallDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days === 1) return 'вчера';
    if (days < 7) return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Исправлено: credentials должен быть на уровне запроса, а не в headers
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

// Открытие модального окна редактирования
function openEditModalFn() {
    const modal = document.getElementById('profileEditorModal');
    if (modal) {
        // Загружаем текущие данные пользователя для заполнения формы
        loadUserDataForEditModal();
        modal.style.display = 'flex';
    }
    document.addEventListener('keydown', handleEscKey);
    modal.addEventListener('click', handleOutsideClick);
}

async function loadUserDataForEditModal() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Не авторизован');
        const { user } = await response.json();

        // Заполняем поля данными пользователя
        document.getElementById('editGender').value = user.gender || '';
        document.getElementById('editCity').value = user.city || '';
        document.getElementById('editPhone').value = user.phone || '';
        document.getElementById('editWebsite').value = user.website || '';
        document.getElementById('editFamily').value = user.familyStatus || '';
        document.getElementById('editAbout').value = user.about || '';
    } catch (error) {
        console.error('Ошибка загрузки данных для модального окна:', error);
    }
}

const editProfileBtn = document.getElementById('editProfileBtn');
if (editProfileBtn) editProfileBtn.onclick = openEditModalFn;

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
async function handleEditProfileSubmit(event) {
    event.preventDefault();

    try {
        // Получаем ID текущего пользователя
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Не авторизован');
        const { user } = await response.json();

        const data = {
            city: document.getElementById('editCity').value || undefined,
            phone: document.getElementById('editPhone').value || undefined,
            website: document.getElementById('editWebsite').value || undefined,
            gender: document.getElementById('editGender').value || undefined,
            familyStatus: document.getElementById('editFamily').value || undefined,
            about: document.getElementById('editAbout').value || undefined
        };

        // Убираем undefined значения
        Object.keys(data).forEach(key => {
            if (data[key] === undefined || data[key] === '') {
                delete data[key];
            }
        });

        const res = await fetch(`/api/users/${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Исправлено: вынесено из headers
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Ошибка сервера: ${errorText}`);
        }

        closeEditModalFn();
        await loadProfileData(); // Обновляем данные профиля после сохранения
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Не удалось сохранить изменения: ' + error.message);
    }
}

// Закрытие модального окна
function closeEditModalFn() {
    const modal = document.getElementById('profileEditorModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.removeEventListener('keydown', handleEscKey);
        modal.removeEventListener('click', handleOutsideClick);
    }
}

// Обработчик клавиши Escape
function handleEscKey(event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
        closeEditModalFn();
    }
}

// Обработчик клика вне области модального окна
function handleOutsideClick(event) {
    // Проверяем, что клик был именно по фону модального окна, а не по его содержимому
    if (event.target === event.currentTarget) {
        closeEditModalFn();
    }
}

// Инициализация профиля
function initProfile() {
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
    // Устанавливаем обработчики после небольшой задержки для гарантии загрузки DOM
    setTimeout(() => {
        // Обработчики для стен
        const wallSubmitBtn = document.getElementById('wallSubmitBtn');
        if (wallSubmitBtn) wallSubmitBtn.onclick = handleWallSubmit;

        // Обработчики для формы редактирования (новые ID)
        const editProfileForm = document.getElementById('profileEditorForm');
        if (editProfileForm) editProfileForm.onsubmit = handleEditProfileSubmit;

        // Обработчики для кнопок закрытия модального окна (новые ID)
        const closeEditModalBtn = document.getElementById('profileEditorCloseBtn');
        if (closeEditModalBtn) closeEditModalBtn.onclick = closeEditModalFn;

        const cancelEditBtn = document.getElementById('profileEditorCancelBtn');
        if (cancelEditBtn) cancelEditBtn.onclick = closeEditModalFn;

        // Обработчики для фильтров стены
        const filterBtns = document.querySelectorAll('.wall__filter-btn');
        filterBtns.forEach(btn => {
            btn.onclick = () => switchWallFilter(btn.dataset.filter);
        });

        // Кнопка редактирования профиля - устанавливаем обработчик отдельно
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            // Очищаем предыдущие обработчики и устанавливаем новый
            editBtn.removeEventListener('click', openEditModalFn);
            editBtn.addEventListener('click', openEditModalFn);
        }

        // Загружаем данные профиля
        loadProfileData();
    }, 100);
}

// Экспортируем функцию для использования в других модулях
window.initProfile = initProfile;