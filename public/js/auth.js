// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // === 1. Переключение табов ===
    const tabs = document.querySelectorAll('.regForm-tab');
    const formWrappers = document.querySelectorAll('.regForm-form-wrapper');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('regForm-tab--active'));
            formWrappers.forEach(w => w.classList.remove('regForm-form-wrapper--active'));

            tab.classList.add('regForm-tab--active');
            const targetWrapper = document.getElementById(`regForm-${targetTab}FormWrapper`);
            if (targetWrapper) {
                targetWrapper.classList.add('regForm-form-wrapper--active');
            }

            clearErrors();
        });
    });

    // === 2. Функция для очистки ошибок ===
    const clearErrors = () => {
        document.querySelectorAll('.regForm__error').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    };

    // === 3. Функция для отображения ошибки ===
    function showError(formElement, message) {
        // Ищем существующий элемент ошибки внутри формы
        let errorElement = formElement.querySelector('.regForm__error');

        if (!errorElement) {
            // Создаём элемент ошибки, если его нет (на будущее)
            errorElement = document.createElement('div');
            errorElement.className = 'regForm__error';
            errorElement.style.display = 'block';
            formElement.appendChild(errorElement);
        }

        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    // === 4. Обработка входа ===
    // Глобальная переменная (в памяти) для хранения расшифрованного ключа текущей сессии.
    // Она обнулится при перезагрузке страницы, что и является нашей целью безопасности!
    window.sessionPrivateKey = null;

    // === ОБРАБОТКА ВХОДА ===
    const loginForm = document.getElementById('regForm-loginForm');
    const loginSubmitBtn = loginForm ? loginForm.querySelector('.regForm__button') : null;

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const errorEl = document.getElementById('regForm-loginError');
            errorEl.textContent = '';
            errorEl.style.display = 'none';

            const email = loginForm.querySelector('input[name="email"]').value;
            const password = loginForm.querySelector('input[name="password"]').value;
            const rememberMe = loginForm.querySelector('input[name="rememberMe"]');
            const rememberMeChecked = rememberMe ? rememberMe.checked : false;

            loginSubmitBtn.disabled = true;
            loginSubmitBtn.textContent = 'Вход и расшифровка ключа...';

            try {
                // 1. Сначала пытаемся войти стандартным способом
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        email: email,
                        password: password,
                        rememberMe: rememberMeChecked
                    }),
                });

                const data = await response.json();

                if (response.ok) {
                    // 2. Если вход успешен, сервер должен ВЕРНУТЬ нам salt и encryptedPrivateKey этого пользователя
                    // (Убедитесь, что ваш бэкенд добавляет эти поля в успешный ответ при логине!)
                    if (data.salt && data.encryptedPrivateKey) {
                        try {
                            const saltBuffer = new Uint8Array(data.salt);
                            const masterKey = await window.E2EECrypto.deriveMasterKey(password, saltBuffer);

                            // 3. Расшифровываем ключ и сохраняем ТОЛЬКО в переменную в памяти
                            window.sessionPrivateKey = await window.E2EECrypto.decryptPrivateKey(
                                data.encryptedPrivateKey,
                                masterKey
                            );
                            console.log('✅ Приватный ключ успешно расшифрован и находится в оперативной памяти.');
                        } catch (cryptoErr) {
                            console.error('Ошибка расшифровки ключа:', cryptoErr);
                            // Не прерываем вход, но ключ не будет работать (можно показать предупреждение)
                        }
                    }

                    // 4. Очищаем поле пароля в форме из соображений безопасности
                    loginForm.querySelector('input[name="password"]').value = '';

                    window.location.href = '/';
                } else {
                    errorEl.textContent = 'Неверный email или пароль'; // Универсальная ошибка!
                    errorEl.style.display = 'block';
                    loginSubmitBtn.disabled = false;
                    loginSubmitBtn.textContent = 'Войти';
                }
            } catch (error) {
                console.error('Login error:', error);
                errorEl.textContent = 'Ошибка соединения с сервером';
                errorEl.style.display = 'block';
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.textContent = 'Войти';
            }
        });
    }

    // === 5. Обработка регистрации ===
    // === ОБРАБОТКА РЕГИСТРАЦИИ ===
    const registerForm = document.getElementById('regForm-registerForm');
    const registerSubmitBtn = registerForm ? registerForm.querySelector('.regForm__button') : null;

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('regForm-registerError');
            errorEl.textContent = '';
            errorEl.style.display = 'none';


            // 1. Собираем данные из формы
            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData);

            // 2. Клиентская валидация (дублируем для мгновенного отклика)
            if (data.password !== data.confirmPassword) {
                errorEl.textContent = 'Пароли не совпадают';
                errorEl.style.display = 'block';
                registerSubmitBtn.disabled = false;
                registerSubmitBtn.textContent = 'Зарегистрироваться';
                return;
            }

            // 3. Блокируем кнопку
            registerSubmitBtn.disabled = true;
            registerSubmitBtn.textContent = 'Генерация ключей и создание аккаунта...';

            try {
                // 4. Криптография
                const salt = window.E2EECrypto.generateSalt();
                const masterKey = await window.E2EECrypto.deriveMasterKey(data.password, salt);
                const { publicKey, privateKey } = await window.E2EECrypto.generateKeyPair();
                const encryptedPrivateKey = await window.E2EECrypto.encryptPrivateKey(privateKey, masterKey);
                const publicKeyBase64 = await window.E2EECrypto.exportPublicKey(publicKey);

                // 5. ФОРМИРУЕМ PAYLOAD (Вот здесь была пропущена строка!)
                const payload = {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    dateOfBirth: data.dateOfBirth,
                    city: data.city || undefined,
                    password: data.password,
                    // Строка confirmPassword: data.confirmPassword УДАЛЕНА отсюда
                    publicKey: publicKeyBase64,
                    encryptedPrivateKey: encryptedPrivateKey,
                    salt: Array.from(salt),
                };

                console.log("📦 Отправляем на сервер:", payload); // Для отладки

                // 6. Отправка на сервер
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });

                const result = await response.json();

                if (response.ok) {
                    window.location.href = '/';
                } else {
                    errorEl.textContent = result.error || 'Ошибка регистрации';
                    errorEl.style.display = 'block';
                    registerSubmitBtn.disabled = false;
                    registerSubmitBtn.textContent = 'Зарегистрироваться';
                }
            } catch (err) {
                console.error('Register crypto error:', err);
                errorEl.textContent = 'Ошибка при генерации ключей шифрования.';
                errorEl.style.display = 'block';
                registerSubmitBtn.disabled = false;
                registerSubmitBtn.textContent = 'Зарегистрироваться';
            }
        });
    }

    // === 6. Обработка выхода (logout) ===
    const logoutBtn = document.querySelector('.header__logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });

                // Удаляем локальный ключ при выходе
                localStorage.removeItem('my_private_key');

                // Перенаправляем на страницу авторизации независимо от ответа сервера
                window.location.href = '/auth';
            } catch (error) {
                console.error('Logout error:', error);
                // Даже при ошибке сети перенаправляем
                window.location.href = '/auth';
            }
        });
    }
});