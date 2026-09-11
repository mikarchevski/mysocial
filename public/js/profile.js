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


// Обновляем обработку ошибки 404
        if (!response.ok) {
            if (response.status === 404) {
                // Перенаправляем на 404 страницу
                window.location.href = '/404.html';
                return;
            } else {
                throw new Error('Ошибка загрузки профиля');
            }
        }

        const data = await response.json();
        userProfile = data.user;

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
        set('userGender', 'Не указан');
        set('userEmail', userProfile.email || 'Не указан');

        const userWebsiteEl = document.getElementById('userWebsite');
        if (userWebsiteEl) {
            userWebsiteEl.innerHTML = userProfile.website ? formatWebsite(userProfile.website) : 'Не указан';
        }

        document.title = `${userProfile.firstName} ${userProfile.lastName} | MySocial`;

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

    // ✅ Загружаем с сервера
    loadWallPosts(profileUserId, postsContainer, currentUser, wallCurrentFilter);

    submitBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text) return;

        submitBtn.disabled = true;

        try {
            const response = await fetch(`/api/posts/wall/${profileUserId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content: text }),
            });

            if (response.ok) {
                textarea.value = '';
                textarea.style.height = 'auto';
                loadWallPosts(profileUserId, postsContainer, currentUser, wallCurrentFilter);
            }
        } catch (err) {
            console.error('Ошибка публикации:', err);
        } finally {
            submitBtn.disabled = false;
        }
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

// ✅ Загрузка постов с сервера
async function loadWallPosts(profileUserId, container, currentUser, filter = 'all') {
    try {
        const response = await fetch(`/api/posts/wall/${profileUserId}?filter=${filter}`, {
            credentials: 'include',
        });
        if (response.ok) {
            const data = await response.json();
            renderWallPosts(data.posts, container, currentUser, profileUserId);
        }
    } catch (err) {
        console.error('Ошибка загрузки записей:', err);
        container.innerHTML = '<div class="wall__empty"><p>Ошибка загрузки</p></div>';
    }
}

function renderWallPosts(posts, container, currentUser, profileUserId) {
    if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="wall__empty"><p>Пока нет записей на стене</p></div>';
        return;
    }

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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}