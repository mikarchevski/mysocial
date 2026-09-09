// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // Переключение табов
    const tabs = document.querySelectorAll('.auth-tab');
    const formWrappers = document.querySelectorAll('.auth-form-wrapper');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('auth-tab--active'));
            formWrappers.forEach(w => w.classList.remove('auth-form-wrapper--active'));

            tab.classList.add('auth-tab--active');
            document.getElementById(`${targetTab}FormWrapper`).classList.add('auth-form-wrapper--active');

            clearErrors();
        });
    });

    const clearErrors = () => {
        document.querySelectorAll('.form-error').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    };

    const showError = (elementId, message) => {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    };

    // Обработка входа
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();

            const formData = new FormData(loginForm);
            const data = {
                email: formData.get('email'),
                password: formData.get('password'),
                rememberMe: formData.get('rememberMe') === 'on'
            };

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                    credentials: 'include'
                });

                const result = await response.json();

                if (response.ok) {
                    if (result.user && result.user.id) {
                        // ✅ Сохраняем пользователя в кэш для мгновенного рендера
                        localStorage.setItem('currentUser', JSON.stringify(result.user));
                        window.location.href = `/${result.user.id}`;
                    } else {
                        showError('loginError', 'Ошибка: не получен ID пользователя');
                    }
                } else {
                    showError('loginError', result.error || 'Ошибка входа');
                }
            } catch (err) {
                console.error('Ошибка входа:', err);
                showError('loginError', 'Ошибка сети. Попробуйте позже.');
            }
        });
    }

    // Обработка регистрации
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();

            const formData = new FormData(registerForm);
            const data = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                dateOfBirth: formData.get('dateOfBirth'),
                city: formData.get('city') || undefined,
                email: formData.get('email'),
                password: formData.get('password'),
                confirmPassword: formData.get('confirmPassword')
            };

            // Клиентская валидация паролей
            if (data.password !== data.confirmPassword) {
                showError('registerError', 'Пароли не совпадают');
                return;
            }

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    alert('Регистрация успешна! Теперь вы можете войти.');
                    document.querySelector('[data-tab="login"]').click();
                    loginForm.reset();
                } else {
                    showError('registerError', result.error || 'Ошибка регистрации');
                }
            } catch (err) {
                showError('registerError', 'Ошибка сети. Попробуйте позже.');
            }
        });
    }
});