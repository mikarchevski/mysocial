// public/js/profile.js

// ✅ Мгновенный рендер из кэша — убираем скелетоны до загрузки DOM
(() => {
    const cachedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (cachedUser) {
        const currentUsernameEl = document.getElementById('currentUsername');
        if (currentUsernameEl) {
            currentUsernameEl.className = '';
            currentUsernameEl.textContent = `${cachedUser.firstName} ${cachedUser.lastName}`;
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.style.display = 'block';

        // Если свой профиль — сразу подставляем имя (убираем скелетон)
        const pathParts = window.location.pathname.split('/');
        const reqId = parseInt(pathParts[1], 10);
        if (cachedUser.id === reqId) {
            const profileNameEl = document.getElementById('profileName');
            if (profileNameEl) {
                profileNameEl.textContent = `${cachedUser.firstName} ${cachedUser.lastName}`;
            }
        }
    }
})();

document.addEventListener('DOMContentLoaded', async () => {
    const pathParts = window.location.pathname.split('/');
    const requestedUserId = pathParts[1];

    if (!requestedUserId) {
        window.location.href = '/';
        return;
    }

    let currentUser = null;
    try {
        const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
        if (meResponse.ok) {
            const meData = await meResponse.json();
            currentUser = meData.user;

            // ✅ Сохраняем в кэш для мгновенного рендера при следующем визите
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            const currentUsernameEl = document.getElementById('currentUsername');
            if (currentUsernameEl) {
                currentUsernameEl.className = '';
                currentUsernameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
            }

            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'block';
        } else {
            window.location.href = '/auth';
            return;
        }
    } catch (err) {
        console.error('Error fetching current user data:', err);
        window.location.href = '/auth';
        return;
    }

    const targetUserId = parseInt(requestedUserId, 10);
    const isOwnProfile = currentUser.id === targetUserId;

    // Показываем пункт "Редактировать профиль" в меню только на своём профиле
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn && isOwnProfile) {
        editProfileBtn.style.display = 'inline-block';
    }

    // Скрываем форму нового поста, если это не свой профиль
    const wallNewPost = document.getElementById('wallNewPost');
    if (wallNewPost && !isOwnProfile) {
        wallNewPost.style.display = 'none';
    }

    // Загружаем данные профиля
    let userProfile = null;
    try {
        const response = await fetch(`/api/users/${targetUserId}`, { credentials: 'include' });

        if (!response.ok) {
            if (response.status === 404) {
                // ✅ Очищаем скелетоны и показываем текст
                const clearSkeleton = (id, fallback) => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.textContent = fallback;
                    }
                };
                clearSkeleton('profileName', 'Пользователь не найден');
                clearSkeleton('userCity', 'Не указан');
                clearSkeleton('userBirthday', 'Не указана');
                clearSkeleton('userEmail', 'Не указан');
                clearSkeleton('userPhone', 'Не указан');
                clearSkeleton('userWebsite', 'Не указан');
                clearSkeleton('userFamily', 'Не указано');
                clearSkeleton('userAbout', 'Не указано');
            } else {
                throw new Error('Ошибка загрузки профиля');
            }
            return;
        }

        const data = await response.json();
        userProfile = data.user;

        // ✅ textContent автоматически заменяет innerHTML (включая skeleton span)
        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        set('profileName', `${userProfile.firstName} ${userProfile.lastName}`);
        set('userCity', userProfile.city || 'Не указан');
        set('userBirthday', formatDateOfBirth(userProfile.dateOfBirth));
        set('userFamily', userProfile.familyStatus || 'Не указано');
        set('userAbout', userProfile.about || 'Не указано');
        set('userPhone', userProfile.phone || 'Не указан');

        // Сайт — через innerHTML, т.к. может быть ссылкой
        const userWebsiteEl = document.getElementById('userWebsite');
        if (userWebsiteEl) {
            userWebsiteEl.innerHTML = userProfile.website ? formatWebsite(userProfile.website) : 'Не указан';
        }

        document.title = `${userProfile.firstName} ${userProfile.lastName} | MySocial`;

        // Инициализируем модалку редактирования
        if (isOwnProfile) {
            initEditModal(userProfile);
        }

    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        const profileNameEl = document.getElementById('profileName');
        if (profileNameEl) profileNameEl.textContent = 'Ошибка загрузки';
    }

    // === Стена ===
    initWall(targetUserId, currentUser, isOwnProfile);

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
                    // ✅ Очищаем кэш при выходе
                    localStorage.removeItem('currentUser');
                    window.location.href = '/auth';
                }
            } catch (err) {
                console.error('Ошибка при выходе:', err);
            }
        });
    }
});

// === Форматирование даты рождения ===
function formatDateOfBirth(dateStr) {
    if (!dateStr) return 'Не указана';
    const date = new Date(dateStr);
    const months = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// === Форматирование сайта ===
function formatWebsite(url) {
    if (!url) return 'Не указан';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
}

// === Модальное окно редактирования ===
function initEditModal(userProfile) {
    const editBtn = document.getElementById('editProfileBtn');
    const modal = document.getElementById('editModal');
    const closeBtn = document.getElementById('closeEditModal');
    const cancelBtn = document.getElementById('cancelEdit');
    const form = document.getElementById('editProfileForm');

    if (!editBtn || !modal || !form) return;

    const fillForm = () => {
        const cityEl = document.getElementById('editCity');
        const phoneEl = document.getElementById('editPhone');
        const websiteEl = document.getElementById('editWebsite');
        const familyEl = document.getElementById('editFamily');
        const aboutEl = document.getElementById('editAbout');

        if (cityEl) cityEl.value = userProfile.city || '';
        if (phoneEl) phoneEl.value = userProfile.phone || '';
        if (websiteEl) websiteEl.value = userProfile.website || '';
        if (familyEl) familyEl.value = userProfile.familyStatus || '';
        if (aboutEl) aboutEl.value = userProfile.about || '';
    };

    editBtn.addEventListener('click', () => {
        fillForm();
        modal.style.display = 'flex';
    });

    const closeModal = () => {
        modal.style.display = 'none';
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const body = {
            city: document.getElementById('editCity')?.value || '',
            phone: document.getElementById('editPhone')?.value || '',
            website: document.getElementById('editWebsite')?.value || '',
            familyStatus: document.getElementById('editFamily')?.value || '',
            about: document.getElementById('editAbout')?.value || '',
        };

        try {
            const response = await fetch(`/api/users/${userProfile.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            if (response.ok) {
                closeModal();
                window.location.reload();
            } else {
                const error = await response.json();
                alert(error.error || 'Ошибка сохранения');
            }
        } catch (err) {
            console.error('Ошибка сохранения:', err);
            alert('Ошибка сети. Попробуйте позже.');
        }
    });
}

// === Функции для стены ===

let wallCurrentFilter = 'all';

function initWall(profileUserId, currentUser, isOwnProfile) {
    const textarea = document.getElementById('wallTextarea');
    const submitBtn = document.getElementById('wallSubmitBtn');
    const postsContainer = document.getElementById('wallPosts');

    if (!textarea || !submitBtn || !postsContainer) return;

    loadWallPosts(profileUserId, postsContainer, currentUser, wallCurrentFilter);

    submitBtn.addEventListener('click', () => {
        const text = textarea.value.trim();
        if (!text) return;

        const post = {
            id: Date.now(),
            authorId: currentUser.id,
            authorName: `${currentUser.firstName} ${currentUser.lastName}`,
            text: text,
            createdAt: new Date().toISOString(),
            likes: 0,
            liked: false,
            comments: 0,
            shares: 0,
        };

        saveWallPost(profileUserId, post);
        textarea.value = '';
        textarea.style.height = 'auto';
        loadWallPosts(profileUserId, postsContainer, currentUser, wallCurrentFilter);
    });

    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            submitBtn.click();
        }
    });

    document.querySelectorAll('.wall__filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.wall__filter-btn').forEach(b => b.classList.remove('wall__filter-btn--active'));
            btn.classList.add('wall__filter-btn--active');
            wallCurrentFilter = btn.dataset.filter;
            loadWallPosts(profileUserId, postsContainer, currentUser, wallCurrentFilter);
        });
    });
}

function loadWallPosts(profileUserId, container, currentUser, filter = 'all') {
    const key = `wall_${profileUserId}`;
    let posts = JSON.parse(localStorage.getItem(key) || '[]');

    if (filter === 'owner') {
        posts = posts.filter(p => p.authorId === profileUserId);
    }

    if (posts.length === 0) {
        container.innerHTML = '<div class="wall__empty"><p>Пока нет записей на стене</p></div>';
        return;
    }

    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
                    <button class="wall__post-action wall__like-btn ${post.liked ? 'wall__post-action--liked' : ''}" data-post-id="${post.id}">
                        <svg viewBox="0 0 24 24" fill="${post.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span>${post.likes || 0}</span>
                    </button>
                    <button class="wall__post-action wall__post-action--comment" data-post-id="${post.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span>${post.comments || 0}</span>
                    </button>
                    <button class="wall__post-action wall__post-action--share" data-post-id="${post.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                            <polyline points="16 6 12 2 8 6"/>
                            <line x1="12" y1="2" x2="12" y2="15"/>
                        </svg>
                        <span>${post.shares || 0}</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.wall__like-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const postId = parseInt(btn.dataset.postId, 10);
            toggleLike(profileUserId, postId, container, currentUser);
        });
    });
}

function saveWallPost(profileUserId, post) {
    const key = `wall_${profileUserId}`;
    const posts = JSON.parse(localStorage.getItem(key) || '[]');
    posts.push(post);
    localStorage.setItem(key, JSON.stringify(posts));
}

function toggleLike(profileUserId, postId, container, currentUser) {
    const key = `wall_${profileUserId}`;
    const posts = JSON.parse(localStorage.getItem(key) || '[]');
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.liked) {
        post.likes = Math.max(0, (post.likes || 0) - 1);
        post.liked = false;
    } else {
        post.likes = (post.likes || 0) + 1;
        post.liked = true;
    }

    localStorage.setItem(key, JSON.stringify(posts));
    loadWallPosts(profileUserId, container, currentUser, wallCurrentFilter);
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}