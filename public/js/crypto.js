// public/js/crypto.js

// Вспомогательные функции для конвертации ArrayBuffer <-> Base64 (для передачи в JSON)
const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

window.E2EECrypto = {
    // 1. Генерация случайной соли (16 байт)
    generateSalt: () => {
        return window.crypto.getRandomValues(new Uint8Array(16));
    },

    // 2. Получение мастер-ключа из пароля и соли (PBKDF2, 100 000 итераций)
    deriveMasterKey: async (password, saltBuffer) => {
        const enc = new TextEncoder();
        const passwordKey = await window.crypto.subtle.importKey(
            "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
        );

        return await window.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: saltBuffer, iterations: 100000, hash: "SHA-256" },
            passwordKey,
            { name: "AES-GCM", length: 256 },
            false, // Ключ нельзя экспортировать (дополнительная защита)
            ["encrypt", "decrypt"]
        );
    },

    // 3. Генерация пары ключей для E2EE шифрования сообщений (RSA-OAEP)
    generateKeyPair: async () => {
        return await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true, // Можно экспортировать публичный ключ
            ["encrypt", "decrypt"]
        );
    },

    // 4. Шифрование приватного ключа мастер-ключом
    encryptPrivateKey: async (privateKey, masterKey) => {
        // Экспортируем приватный ключ в формат PKCS#8 (ArrayBuffer)
        const exportedKey = await window.crypto.subtle.exportKey("pkcs8", privateKey);
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Вектор инициализации для AES-GCM

        const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            masterKey,
            exportedKey
        );

        // Объединяем IV и зашифрованные данные для хранения
        const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encryptedBuffer), iv.length);

        return arrayBufferToBase64(combined.buffer);
    },

    // 5. Расшифровка приватного ключа мастер-ключом
    decryptPrivateKey: async (encryptedBase64, masterKey) => {
        const combined = new Uint8Array(base64ToArrayBuffer(encryptedBase64));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            masterKey,
            data
        );

        // Импортируем обратно как CryptoKey
        return await window.crypto.subtle.importKey(
            "pkcs8",
            decryptedBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["decrypt"]
        );
    },

    // 6. Экспорт публичного ключа в Base64 (для отправки на сервер)
    exportPublicKey: async (publicKey) => {
        const exported = await window.crypto.subtle.exportKey("spki", publicKey);
        return arrayBufferToBase64(exported);
    }
};

// ==========================================
// ✅ ДОБАВЛЕНО: Глобальные функции для совместимости с dialogs.js
// (Упаковывают IV и данные в одну JSON-строку, чтобы не менять БД)
// ==========================================

window.encryptMessage = async (plaintext, publicKeyBase64) => {
    try {
        // 1. Очистка ключа от возможных PEM-заголовков и пробелов
        const cleanKey = publicKeyBase64.replace(/-----BEGIN PUBLIC KEY-----/g, '')
            .replace(/-----END PUBLIC KEY-----/g, '')
            .replace(/\s/g, '');

        // 2. Импорт публичного ключа (формат SPKI)
        const publicKeyBuffer = base64ToArrayBuffer(cleanKey);
        const publicKey = await window.crypto.subtle.importKey(
            "spki", publicKeyBuffer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]
        );

        // 3. Генерация временного AES ключа и вектора инициализации (IV)
        const aesKey = await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
        );
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();

        // 4. Шифрование самого текста сообщения
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv }, aesKey, encoder.encode(plaintext)
        );

        // 5. Шифрование AES-ключа публичным ключом получателя
        const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
        const encryptedAesKey = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" }, publicKey, rawAesKey
        );

        // 6. Возвращаем 2 поля (как требует ваша текущая схема БД)
        return {
            encryptedContent: JSON.stringify({
                iv: arrayBufferToBase64(iv),
                data: arrayBufferToBase64(ciphertext)
            }),
            encryptedKey: arrayBufferToBase64(encryptedAesKey)
        };
    } catch (error) {
        console.error("Ошибка шифрования:", error);
        throw new Error("Не удалось зашифровать сообщение");
    }
};

window.decryptMessage = async (encryptedContentJsonString, encryptedKeyBase64, privateKey) => {
    try {
        let actualPrivateKey = privateKey;

        // Если ключ пришел как строка (старый JWK формат), импортируем его
        if (typeof privateKey === 'string') {
            const jwk = JSON.parse(privateKey);
            actualPrivateKey = await window.crypto.subtle.importKey(
                "jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]
            );
        }
        // Если это уже объект CryptoKey (новый формат через window.sessionPrivateKey), используем как есть

        // 1. Расшифровываем AES-ключ своим приватным ключом
        const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKeyBase64);
        const rawAesKey = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" }, actualPrivateKey, encryptedKeyBuffer
        );

        // 2. Импортируем расшифрованный AES-ключ
        const aesKey = await window.crypto.subtle.importKey(
            "raw", rawAesKey, { name: "AES-GCM" }, true, ["decrypt"]
        );

        // 3. Распаковываем JSON, чтобы достать IV и зашифрованные данные
        const content = JSON.parse(encryptedContentJsonString);
        const iv = base64ToArrayBuffer(content.iv);
        const ciphertext = base64ToArrayBuffer(content.data);

        // 4. Расшифровываем само сообщение
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv }, aesKey, ciphertext
        );

        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.error('Ошибка при расшифровке:', error);
        throw new Error("Не удалось расшифровать сообщение");
    }
};