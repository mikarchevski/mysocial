// public/js/profile.js
// public/js/profile.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Profile.js loaded');
    
    // Получаем ID из URL (например, /1000000)
    const pathParts = window.location.pathname.split('/');
    const requestedUserId = pathParts[1]; // Первый сегмент после '/'

    console.log('Requested user ID from URL:', requestedUserId);

    if (!requestedUserId) {
        console.log('No user ID in URL, redirecting to home');
        window.location.href = '/';
        return;
    }

    // Загружаем данные текущего пользователя (для шапки и проверки авторизации)
    let currentUser = null;
    try {
        console.log('Fetching current user data...');
        const meResponse = await fetch('/api/auth/me', {
            credentials: 'include',
        });

        if (meResponse.ok) {
            const meData = await meResponse.json();
            currentUser = meData.user;
            console.log('Current user data:', currentUser);
            
            // Обновляем информацию в шапке
            const currentUsernameEl = document.getElementById('currentUsername');
            if (currentUsernameEl) {
                currentUsernameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
                console.log('Updated current username:', `${currentUser.firstName} ${currentUser.lastName}`);
            }
            
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.style.display = 'block';
                console.log('Showed logout button');
            }
        } else {
            console.error('Failed to get current user:', meResponse.status, await meResponse.text());
            // Если пользователь не авторизован, перенаправляем на страницу авторизации
            window.location.href = '/auth';
            return;
        }
    } catch (err) {
        console.error('Error fetching current user data:', err);
        window.location.href = '/auth';
        return;
    }

    // Определяем, чей профиль показывать
    const targetUserId = parseInt(requestedUserId, 10);
    console.log('Target user ID:', targetUserId);
    
    // Проверяем, является ли это собственным профилем
    const isOwnProfile = currentUser.id === targetUserId;
    console.log('Is own profile:', isOwnProfile);
    
    // Загружаем данные профиля по ID
    try {
        console.log('Fetching profile data for user ID:', targetUserId);
        const response = await fetch(`/api/users/${targetUserId}`, {
            credentials: 'include' // Важно для передачи JWT-куки
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                document.getElementById('profileName').textContent = 'Пользователь не найден';
                document.getElementById('profileId').textContent = targetUserId;
                document.getElementById('userCity').textContent = 'Не указан';
                document.getElementById('userBirthday').textContent = 'Не указана';
                document.getElementById('userEmail').textContent = 'Не указан';
            } else {
                console.error('Error response:', response.status, await response.text());
                throw new Error('Ошибка загрузки профиля');
            }
            return;
        }

        const data = await response.json();
        console.log('Profile data received:', data);
        const userProfile = data.user;

        // Обновляем основную информацию профиля
        document.getElementById('profileName').textContent = `${userProfile.firstName} ${userProfile.lastName}`;
        document.getElementById('profileId').textContent = userProfile.id;
        document.getElementById('userCity').textContent = userProfile.city || 'Не указан';
        document.getElementById('userBirthday').textContent = userProfile.dateOfBirth || 'Не указана';

        // Показываем email - если это наш профиль, используем данные из /api/auth/me
        // если это чужой профиль, используем данные из /api/users/:id
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) {
            if (isOwnProfile && currentUser.email) {
                userEmailEl.textContent = currentUser.email;
            } else if (userProfile.email) {
                userEmailEl.textContent = userProfile.email;
            } else {
                userEmailEl.textContent = 'Не указан';
            }
            console.log('Updated email field:', userEmailEl.textContent);
        }

        // Меняем заголовок страницы
        document.title = `${userProfile.firstName} ${userProfile.lastName} | MySocial`;
        console.log('Page title updated');

    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        document.getElementById('profileName').textContent = 'Ошибка загрузки';
    }

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
                    window.location.href = '/auth';
                }
            } catch (err) {
                console.error('Ошибка при выходе:', err);
            }
        });
    }
});