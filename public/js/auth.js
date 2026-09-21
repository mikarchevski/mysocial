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

    // === Обработчики кнопок "Показать/Скрыть пароль" ===
    document.querySelectorAll('.regForm__toggle-password').forEach(btn => {
        btn.addEventListener('click', function () {
            const input = this.previousElementSibling; // Находим input перед кнопкой
            const isPassword = input.getAttribute('type') === 'password';

            // Переключаем тип поля
            input.setAttribute('type', isPassword ? 'text' : 'password');

            // Меняем иконку (глаз / перечеркнутый глаз)
            const icon = this.querySelector('.regForm__toggle-icon');
            if (isPassword) {
                // Иконка "глаз перечеркнутый" (пароль виден)
                icon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
                this.setAttribute('aria-label', 'Скрыть пароль');
            } else {
                // Иконка "глаз" (пароль скрыт)
                icon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
                this.setAttribute('aria-label', 'Показать пароль');
            }
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
    window.sessionPrivateKey = null;
    const loginForm = document.getElementById('regForm-loginForm');
    const loginSubmitBtn = loginForm ? loginForm.querySelector('.regForm__button') : null;

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault(); // Всегда предотвращаем стандартную отправку

            const errorEl = document.getElementById('regForm-loginError');
            errorEl.textContent = '';
            errorEl.style.display = 'none';

            // 1. ПРОВЕРКА ВАЛИДНОСТИ (без браузерных подсказок благодаря novalidate)
            if (!loginForm.checkValidity()) {
                // Находим все невалидные поля и подсвечиваем их красным
                const invalidInputs = loginForm.querySelectorAll(':invalid');
                invalidInputs.forEach(input => {
                    input.classList.add('regForm__input--error');

                    // Показываем конкретную ошибку под полем
                    const fieldErrorId = input.id + 'Error';
                    const fieldErrorEl = document.getElementById(fieldErrorId);
                    if (fieldErrorEl) {
                        if (input.validity.valueMissing) {
                            fieldErrorEl.textContent = 'Это поле обязательно для заполнения';
                        } else if (input.validity.typeMismatch && input.type === 'email') {
                            fieldErrorEl.textContent = 'Введите корректный email';
                        }
                    }
                });

                errorEl.textContent = 'Пожалуйста, проверьте выделенные поля';
                errorEl.style.display = 'block';
                return; // ОСТАНАВЛИВАЕМ отправку, если форма невалидна
            }

            // 2. Если форма валидна, очищаем все классы ошибок перед отправкой
            loginForm.querySelectorAll('.regForm__input--error').forEach(input => {
                input.classList.remove('regForm__input--error');
            });
            loginForm.querySelectorAll('.regForm__field-error').forEach(el => {
                el.textContent = '';
            });

            // 3. Блокируем кнопку
            loginSubmitBtn.disabled = true;
            loginSubmitBtn.textContent = 'Вход...';

            try {
                // 4. Собираем данные
                const email = loginForm.querySelector('input[name="email"]').value;
                const password = loginForm.querySelector('input[name="password"]').value;
                const rememberMe = loginForm.querySelector('input[name="rememberMe"]');
                const rememberMeChecked = rememberMe ? rememberMe.checked : false;

                // 5. Отправка на сервер
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        email: email,
                        password: password,
                        rememberMe: rememberMeChecked
                    }),
                });

                const data = await response.json();
                if (response.status === 429) {
                    // Извлекаем время ожидания из сообщения (например, "Подождите 24 сек.")
                    const timeMatch = data.message.match(/Подождите\s+(\d+)\s*сек/);
                    const seconds = timeMatch ? parseInt(timeMatch[1]) : 30;

                    // Показываем ошибку с таймером
                    errorEl.classList.add('rate-limit');
                    errorEl.innerHTML = `
                    ⏱️ Слишком много попыток входа. 
                    <span class="timer" id="rateLimitTimer">${seconds}</span> сек.
                `;
                    errorEl.style.display = 'block';

                    // Запускаем обратный отсчет
                    let remainingSeconds = seconds;
                    const timerInterval = setInterval(() => {
                        remainingSeconds--;
                        const timerEl = document.getElementById('rateLimitTimer');
                        if (timerEl) {
                            timerEl.textContent = remainingSeconds;
                        }

                        if (remainingSeconds <= 0) {
                            clearInterval(timerInterval);
                            errorEl.style.display = 'none';
                        }
                    }, 1000);

                    // Разблокируем кнопку
                    loginSubmitBtn.disabled = false;
                    loginSubmitBtn.textContent = 'Войти';
                    return;
                }
                if (response.ok) {
                    console.log('🟢 Успешный ответ от сервера. Проверяем ключи...');

                    if (data.salt && data.encryptedPrivateKey) {
                        console.log('🟡 Начинаем процесс расшифровки...');
                        try {
                            let saltArray = data.salt;
                            if (typeof data.salt === 'string') {
                                saltArray = JSON.parse(data.salt);
                            }
                            const saltBuffer = new Uint8Array(saltArray);
                            console.log('🔑 Соль преобразована в Uint8Array');

                            const masterKey = await window.E2EECrypto.deriveMasterKey(password, saltBuffer);
                            console.log('🔑 Мастер-ключ успешно получен');

                            window.sessionPrivateKey = await window.E2EECrypto.decryptPrivateKey(
                                data.encryptedPrivateKey,
                                masterKey
                            );
                            console.log('✅ Приватный ключ успешно расшифрован!');

                            const jwk = await window.crypto.subtle.exportKey("jwk", window.sessionPrivateKey);
                            sessionStorage.setItem('temp_private_key_jwk', JSON.stringify(jwk));
                            console.log('💾 Ключ сохранён в sessionStorage!');

                        } catch (cryptoErr) {
                            console.error('🔴 КРИТИЧЕСКАЯ ОШИБКА РАСШИФРОВКИ:', cryptoErr);
                            // ВАЖНО: Показываем alert и ОСТАНАВЛИВАЕМ редирект, чтобы вы увидели ошибку
                            alert('Ошибка расшифровки ключа! Проверьте консоль (F12). Возможно, введен неверный пароль или данные ключа повреждены.');
                            loginSubmitBtn.disabled = false;
                            loginSubmitBtn.textContent = 'Войти';
                            return; // Прерываем выполнение, не делаем window.location.href
                        }
                    } else {
                        console.warn('⚠️ Поля salt или encryptedPrivateKey отсутствуют в ответе сервера!');
                    }

                    // Если всё прошло успешно, очищаем поле и делаем редирект
                    loginForm.querySelector('input[name="password"]').value = '';
                    window.location.href = '/';
                } else {
                    errorEl.textContent = data.error || 'Неверный email или пароль';
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

        // 6. УБИРАЕМ КРАСНУЮ РАМКУ И ОШИБКУ ПРИ НАЧАЛЕ ВВОДА
        loginForm.querySelectorAll('.regForm__input').forEach(input => {
            input.addEventListener('input', () => {
                if (input.classList.contains('regForm__input--error')) {
                    input.classList.remove('regForm__input--error');

                    // Скрываем ошибку конкретного поля
                    const fieldErrorId = input.id + 'Error';
                    const fieldErrorEl = document.getElementById(fieldErrorId);
                    if (fieldErrorEl) {
                        fieldErrorEl.textContent = '';
                    }
                }
            });
        });
    }

    // === 5. Обработка регистрации ===
    const registerForm = document.getElementById('regForm-registerForm');
    const registerSubmitBtn = registerForm ? registerForm.querySelector('.regForm__button') : null;

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const errorEl = document.getElementById('regForm-registerError');
            errorEl.textContent = '';
            errorEl.style.display = 'none';

            // 1. ПРОВЕРКА ВАЛИДНОСТИ
            if (!registerForm.checkValidity()) {
                const invalidInputs = registerForm.querySelectorAll(':invalid');
                invalidInputs.forEach(input => {
                    input.classList.add('regForm__input--error');
                    const fieldErrorId = input.id + 'Error';
                    const fieldErrorEl = document.getElementById(fieldErrorId);
                    if (fieldErrorEl) {
                        if (input.validity.valueMissing) {
                            fieldErrorEl.textContent = 'Это поле обязательно для заполнения';
                        } else if (input.validity.typeMismatch && input.type === 'email') {
                            fieldErrorEl.textContent = 'Введите корректный email';
                        } else if (input.validity.tooShort) {
                            fieldErrorEl.textContent = `Минимум ${input.minLength} символов`;
                        }
                    }
                });
                errorEl.textContent = 'Пожалуйста, проверьте выделенные поля';
                errorEl.style.display = 'block';
                return;
            }

            // 2. Очистка ошибок
            registerForm.querySelectorAll('.regForm__input--error').forEach(input => {
                input.classList.remove('regForm__input--error');
            });
            registerForm.querySelectorAll('.regForm__field-error').forEach(el => {
                el.textContent = '';
            });

            // 3. Блокировка кнопки
            registerSubmitBtn.disabled = true;
            registerSubmitBtn.textContent = 'Генерация ключей и создание аккаунта...';

            try {
                // 4. Криптография
                const formData = new FormData(registerForm);
                const data = Object.fromEntries(formData);

                const salt = window.E2EECrypto.generateSalt();
                const masterKey = await window.E2EECrypto.deriveMasterKey(data.password, salt);
                const { publicKey, privateKey } = await window.E2EECrypto.generateKeyPair();
                const encryptedPrivateKey = await window.E2EECrypto.encryptPrivateKey(privateKey, masterKey);
                const publicKeyBase64 = await window.E2EECrypto.exportPublicKey(publicKey);

                // ✅ ИСПРАВЛЕНИЕ 1: Конвертируем salt в Base64 строку для БД (тип text)
                const saltBase64 = btoa(String.fromCharCode(...salt));

                const payload = {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    dateOfBirth: data.dateOfBirth,
                    city: data.city || undefined,
                    password: data.password,
                    publicKey: publicKeyBase64,
                    encryptedPrivateKey: encryptedPrivateKey,
                    salt: Array.from(salt), // ✅ Отправляем строку, а не массив
                };

                // 5. Отправка на сервер
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });

                const result = await response.json();

                if (response.ok) {
                    // ✅ ИСПРАВЛЕНИЕ 2: Сохраняем ключ в sessionStorage, чтобы не просить пароль сразу после регистрации
                    const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
                    sessionStorage.setItem('temp_private_key_jwk', JSON.stringify(jwk));
                    window.sessionPrivateKey = privateKey;

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

        // 6. УБИРАЕМ КРАСНУЮ РАМКУ И ОШИБКУ ПРИ НАЧАЛЕ ВВОДА
        registerForm.querySelectorAll('.regForm__input').forEach(input => {
            input.addEventListener('input', () => {
                if (input.classList.contains('regForm__input--error')) {
                    input.classList.remove('regForm__input--error');
                    const fieldErrorId = input.id + 'Error';
                    const fieldErrorEl = document.getElementById(fieldErrorId);
                    if (fieldErrorEl) {
                        fieldErrorEl.textContent = '';
                    }
                }
            });
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

                // ✅ Очищаем ключ из памяти и хранилища
                window.sessionPrivateKey = null;
                sessionStorage.removeItem('temp_private_key_jwk');

                // Перенаправляем на страницу авторизации
                window.location.href = '/auth';
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = '/auth';
            }
        });
    }
    // === Валидация email в реальном времени ===
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function validateEmailField(inputId, errorId) {
        const input = document.getElementById(inputId);
        const errorEl = document.getElementById(errorId);

        if (!input || !errorEl) return;

        input.addEventListener('blur', () => {
            const value = input.value.trim();

            // Если поле пустое и обязательное — не показываем ошибку (это сделает браузер при submit)
            if (!value && input.required) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
                input.classList.remove('regForm__input--error');
                return;
            }

            // Если поле не пустое — проверяем формат
            if (value && !emailRegex.test(value)) {
                errorEl.textContent = 'Введите корректный email';
                errorEl.style.display = 'block';
                input.classList.add('regForm__input--error');
            } else {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
                input.classList.remove('regForm__input--error');
            }
        });

        // Убираем ошибку при начале ввода
        input.addEventListener('input', () => {
            if (input.classList.contains('regForm__input--error')) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
                input.classList.remove('regForm__input--error');
            }
        });
    }

    // Применяем валидацию к обоим полям email
    validateEmailField('regForm-loginEmail', 'regForm-loginEmailError');
    validateEmailField('regForm-registerEmail', 'regForm-registerEmailError');
});