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
            false,
            ["decrypt"]
        );
    },

    // 6. Экспорт публичного ключа в Base64 (для отправки на сервер)
    exportPublicKey: async (publicKey) => {
        const exported = await window.crypto.subtle.exportKey("spki", publicKey);
        return arrayBufferToBase64(exported);
    }
};