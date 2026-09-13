// public/js/friends.js

let currentFriendsTab = 'friends';

function initFriends() {
    const filterBtns = document.querySelectorAll('.friends-filter-btn');
    filterBtns.forEach(btn => {
        btn.onclick = () => switchFriendsTab(btn.dataset.tab);
    });
    loadFriendsData(currentFriendsTab);
}

function switchFriendsTab(tab) {
    currentFriendsTab = tab;
    document.querySelectorAll('.friends-filter-btn').forEach(btn => {
        btn.classList.remove('friends-filter-btn--active');
    });
    const activeBtn = document.querySelector(`.friends-filter-btn[data-tab="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('friends-filter-btn--active');
    loadFriendsData(tab);
}

async function loadFriendsData(tab) {
    const container = document.getElementById('friendsList');
    if (!container) return;
    container.innerHTML = '<div class="loading">Загрузка...</div>';

    try {
        // <-- ИСПРАВЛЕНО: /api/friends/list и /api/friends/requests
        const endpoint = tab === 'requests' ? '/api/friends/requests' : '/api/friends/list';
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('Не удалось загрузить');

        const data = await res.json();
        if (tab === 'requests') {
            renderFriendRequests(data.requests || []);
        } else {
            renderFriendsList(data.friends || []);
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        container.innerHTML = '<div class="friends-list__empty"><p>Ошибка загрузки</p></div>';
    }
}

function renderFriendsList(friends) {
    const container = document.getElementById('friendsList');
    if (!container) return;
    if (!friends || friends.length === 0) {
        container.innerHTML = '<div class="friends-list__empty"><p>У вас пока нет друзей</p></div>';
        return;
    }
    container.innerHTML = friends.map(friend => `
        <div class="friends-list__item" data-user-id="${friend.id}">
            <div class="friends-list__avatar">
                <img src="${friend.avatar || '/images/default-avatar.svg'}" alt="${friend.name}">
            </div>
            <div class="friends-list__info">
                <a href="/${friend.id}" class="friends-list__name spa-link">${friend.name}</a>
            </div>
        </div>
    `).join('');
}

function renderFriendRequests(requests) {
    const container = document.getElementById('friendsList');
    if (!container) return;
    if (!requests || requests.length === 0) {
        container.innerHTML = '<div class="friends-list__empty"><p>У вас нет заявок в друзья</p></div>';
        return;
    }
    container.innerHTML = requests.map(req => `
        <div class="friends-list__item friends-list__item--request" data-user-id="${req.id}">
            <div class="friends-list__avatar">
                <img src="${req.avatar || '/images/default-avatar.svg'}" alt="${req.name}">
            </div>
            <div class="friends-list__info">
                <a href="/${req.id}" class="friends-list__name spa-link">${req.name}</a>
            </div>
            <div class="friends-list__actions">
                <!-- <-- ИСПРАВЛЕНО: используем requestId из объекта заявки -->
                <button class="friends-list__accept-btn" onclick="acceptFriendRequest(${req.id})">Принять</button>
                <button class="friends-list__reject-btn" onclick="rejectFriendRequest(${req.id})">Отклонить</button>
            </div>
        </div>
    `).join('');
}

async function acceptFriendRequest(requestId) {
    try {
        // <-- ИСПРАВЛЕНО: /api/friends/accept/:requestId
        const res = await fetch(`/api/friends/accept/${requestId}`, { method: 'POST' });
        if (!res.ok) throw new Error('Не удалось принять');
        await loadFriendsData(currentFriendsTab);
        if (window.updateFriendRequestsBadge) window.updateFriendRequestsBadge();
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function rejectFriendRequest(requestId) {
    try {
        // <-- ИСПРАВЛЕНО: /api/friends/decline/:requestId
        const res = await fetch(`/api/friends/decline/${requestId}`, { method: 'POST' });
        if (!res.ok) throw new Error('Не удалось отклонить');
        await loadFriendsData(currentFriendsTab);
        if (window.updateFriendRequestsBadge) window.updateFriendRequestsBadge();
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

window.initFriends = initFriends;