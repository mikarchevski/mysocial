// public/js/auth.js

// Удаляем неправильный импорт и используем глобальную функцию
// import generateKeyPair from './crypto.js'; // УДАЛИТЬ ЭТУ СТРОКУ

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

    // Функция для очистки ошибок
    const clearErrors = () => {
        document.querySelectorAll('.form-error').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    };

    // Обработка входа
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Очистить предыдущие ошибки
            clearErrors();
            
            const email = loginForm.querySelector('input[name="email"]').value;
            const password = loginForm.querySelector('input[name="password"]').value;
            const rememberMe = loginForm.querySelector('input[name="rememberMe"]');
            const rememberMeChecked = rememberMe ? rememberMe.checked : false;
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        email: email, 
                        password: password, 
                        rememberMe: rememberMeChecked 
                    }),
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Авторизация успешна - перенаправить на главную
                    window.location.href = '/';
                } else {
                    // Показать сообщение об ошибке
                    showError(loginForm, data.error || 'Ошибка входа');
                }
            } catch (error) {
                console.error('Login error:', error);
                showError(loginForm, 'Ошибка соединения с сервером');
            }
        });
    }

    // Функция для отображения ошибки
    function showError(formElement, message) {
        // Проверить, существует ли уже элемент ошибки
        let errorElement = formElement.querySelector('.form-error');
        
        if (!errorElement) {
            // Создать элемент ошибки
            errorElement = document.createElement('div');
            errorElement.className = 'form-error';
            errorElement.style.cssText = `
                background-color: #f8d7da;
                color: #721c24;
                padding: 10px;
                margin-top: 15px;
                border: 1px solid #f5c6cb;
                border-radius: 4px;
                font-size: 14px;
                text-align: center;
            `;
            
            // Вставить после последнего элемента формы
            formElement.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
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
                showError(registerForm, 'Пароли не совпадают');
                return;
            }

            try {
                // Используем глобальную функцию из crypto.js
                const { publicKey, privateKey } = await window.generateKeyPair();

                localStorage.setItem('my_private_key', privateKey);

                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        firstName: formData.get('firstName'),
                        lastName: formData.get('lastName'),
                        email: formData.get('email'),
                        dateOfBirth: formData.get('dateOfBirth'),
                        password: formData.get('password'),
                        confirmPassword: formData.get('confirmPassword'),
                        publicKey: publicKey,
                    }),
                });

                const result = await response.json();

                if (response.ok) {
                    window.location.href = '/';

                } else {
                    showError(registerForm, result.error || 'Ошибка регистрации');
                }
            } catch (err) {
                showError(registerForm, 'Ошибка сети. Попробуйте позже.');
            }
        });
    }
});