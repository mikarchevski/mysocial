// public/js/crypto.js

// 1. Генерация пары ключей (RSA-OAEP)
async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // извлекаемый
    ["encrypt", "decrypt"]
  );

  const pubJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return {
    publicKey: JSON.stringify(pubJwk),
    privateKey: JSON.stringify(privJwk),
  };
}

// 2. Шифрование сообщения (для отправителя)
async function encryptMessage(plaintext, recipientPublicKeyJwkString) {
  const pubJwk = JSON.parse(recipientPublicKeyJwkString);
  const publicKey = await window.crypto.subtle.importKey(
    "jwk", pubJwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]
  );

  // Генерируем одноразовый AES ключ для этого сообщения
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
  );

  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 байт для GCM
  
  // Шифруем текст AES-ключом
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, aesKey, encoder.encode(plaintext)
  );

  // Шифруем сам AES-ключ публичным ключом получателя
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" }, publicKey, rawAesKey
  );

  // Конвертируем в base64 для удобной передачи по сети
  const toBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
  
  return {
    // Храним IV и данные вместе в JSON
    encryptedContent: JSON.stringify({ 
      iv: toBase64(iv), 
      data: toBase64(ciphertext) 
    }),
    encryptedKey: toBase64(encryptedAesKey),
  };
}

// 3. Расшифровка сообщения (для получателя)
// 3. Расшифровка сообщения (для получателя)
// 3. Расшифровка сообщения (для получателя)
async function decryptMessage(encryptedContentJsonString, encryptedKeyBase64, privateKeyJwkString) {
  const privJwk = JSON.parse(privateKeyJwkString);
  const privateKey = await window.crypto.subtle.importKey(
    "jwk", privJwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]
  );

  // Функция для безопасного декодирования Base64
  const fromBase64 = (base64) => {
    // Удаляем пробелы, новые строки и другие пробельные символы
    const cleanBase64 = base64.replace(/\s/g, '');
    // Проверяем, содержит ли строка только допустимые символы Base64
    if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      throw new Error('Недопустимые символы в строке Base64');
    }
    // Убедимся, что строка имеет правильную длину для Base64 (кратна 4)
    const paddedBase64 = cleanBase64.padEnd((Math.ceil(cleanBase64.length / 4) * 4), '=');
    const binaryString = atob(paddedBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  try {
    // 1. Расшифровываем AES-ключ своим приватным ключом
    const encryptedKeyBytes = fromBase64(encryptedKeyBase64);
    const rawAesKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" }, privateKey, encryptedKeyBytes
    );

    // 2. Импортируем AES-ключ
    const aesKey = await window.crypto.subtle.importKey(
      "raw", rawAesKey, { name: "AES-GCM" }, true, ["decrypt"]
    );

    // 3. Расшифровываем само сообщение
    // Парсим JSON и проверяем его структуру
    let content;
    try {
      content = JSON.parse(encryptedContentJsonString);
    } catch (parseErr) {
      console.error('Ошибка парсинга JSON зашифрованного содержимого:', parseErr);
      throw new Error('Некорректный формат зашифрованного содержимого');
    }

    if (!content.iv || !content.data) {
      throw new Error('Отсутствуют необходимые поля в зашифрованном содержимом');
    }

    const iv = fromBase64(content.iv);
    const ciphertext = fromBase64(content.data);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, aesKey, ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Ошибка при расшифровке:', error);
    throw error;
  }
}

// Делаем функции доступными глобально
window.generateKeyPair = generateKeyPair;
window.encryptMessage = encryptMessage;
window.decryptMessage = decryptMessage;