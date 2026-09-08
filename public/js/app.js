// public/js/app.js
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include' // Отправляем куки с токеном
        });
        
        if (!response.ok) {
            // Если не авторизован, редирект на вход
            // window.location.href = '/auth';
            return;
        }
        
        const data = await response.json();
        const user = data.user;
        
        // Заполняем данные на странице
        document.getElementById('username').textContent = `${user.firstName} ${user.lastName}`;
        document.getElementById('profileName').textContent = `${user.firstName} ${user.lastName}`;
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('userCity').textContent = user.city || 'Не указан';
        document.getElementById('logoutBtn').style.display = 'block';
        
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        window.location.href = '/login.html';
    }
    
    // Обработчик выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            // Можно добавить вызов /api/auth/logout для очистки куки на сервере
            // Пока просто очистим локально и перезагрузим
            window.location.href = '/login.html';
        });
    }
});