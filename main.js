// 전역 상태 관리
window.userState = { currentUser: null, isLoggedIn: false, unsubscribe: [] };

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBoVbtaw2BR29qyuFKPxBKVeEtkSLF49yg",
    authDomain: "school-economydata.firebaseapp.com",
    projectId: "school-economydata",
    storageBucket: "school-economydata.firebasestorage.app",
    messagingSenderId: "662631755029",
    appId: "1:662631755029:web:7c63e30355d9dd6136cd1c",
    measurementId: "G-65086JEHVJ"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

class AuthManager {
    constructor(simulation) {
        this.simulation = simulation;
        this.modal = document.getElementById('auth-modal');
        this.initEvents();
        this.listenToAuth();
    }

    initEvents() {
        document.getElementById('login-btn')?.addEventListener('click', () => this.openModal('login'));
        document.getElementById('signup-btn')?.addEventListener('click', () => this.openModal('signup'));
        document.querySelector('.close-modal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('user-display-name')?.addEventListener('click', () => this.openMyInfo());
        document.querySelector('.close-my-info')?.addEventListener('click', () => document.getElementById('my-info-modal').style.display = 'none');
        
        // FAB & 상점 관리 이벤트
        document.getElementById('admin-fab')?.addEventListener('click', () => this.openShopMgmt());
        document.querySelector('.close-shop-mgmt')?.addEventListener('click', () => document.getElementById('shop-mgmt-modal').style.display = 'none');
        document.getElementById('add-item-btn')?.addEventListener('click', () => this.addShopItem());

        document.getElementById('signup-role')?.addEventListener('change', (e) => {
            const isAdmin = e.target.value === 'admin';
            document.getElementById('signup-email')?.classList.toggle('hidden', !isAdmin);
            document.getElementById('signup-username-container')?.classList.toggle('hidden', isAdmin);
            document.getElementById('signup-class-code-container')?.classList.toggle('hidden', isAdmin);
        });

        document.getElementById('login-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.login(); });
        document.getElementById('signup-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.signup(); });

        window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; };
    }

    listenToAuth() {
        auth.onAuthStateChanged(user => {
            window.userState.unsubscribe.forEach(unsub => unsub());
            window.userState.unsubscribe = [];

            if (user) {
                window.userState.unsubscribe.push(db.collection('users').doc(user.uid).onSnapshot(doc => {
                    if (doc.exists) {
                        window.userState.currentUser = { uid: user.uid, ...doc.data() };
                        window.userState.isLoggedIn = true;
                        this.updateUI();
                        if (this.simulation) this.simulation.init(window.userState.currentUser);
                    }
                }));
            } else {
                window.userState.currentUser = null;
                window.userState.isLoggedIn = false;
                this.updateUI();
                if (this.simulation) this.simulation.reset();
            }
        });
    }

    updateUI() {
        const user = window.userState.currentUser;
        const loggedIn = window.userState.isLoggedIn;

        document.getElementById('user-info')?.classList.toggle('hidden', !loggedIn);
        document.getElementById('login-btn')?.classList.toggle('hidden', loggedIn);
        document.getElementById('signup-btn')?.classList.toggle('hidden', loggedIn);
        document.getElementById('logged-in-home')?.classList.toggle('hidden', !loggedIn);
        document.getElementById('logged-out-home')?.classList.toggle('hidden', loggedIn);

        if (loggedIn) {
            document.getElementById('user-display-name').textContent = user.nickname || user.username;
            const isAdmin = user.role === 'admin';
            document.getElementById('admin-menu')?.classList.toggle('hidden', !isAdmin);
            document.getElementById('admin-bank-mgmt')?.classList.toggle('hidden', !isAdmin);
            document.getElementById('admin-fab')?.classList.toggle('hidden', !isAdmin);
            
            if (isAdmin) {
                document.getElementById('mgmt-class-code').textContent = user.classCode;
                this.loadAdminData(user.classCode);
            }
        }
    }

    // 관리자: 학생 목록 및 상점 물품 관리 목록 로드
    loadAdminData(classCode) {
        // 학생 목록 (실시간)
        window.userState.unsubscribe.push(db.collection('users')
            .where('adminCode', '==', classCode)
            .where('role', '==', 'student')
            .onSnapshot(snap => {
                const listBody = document.getElementById('student-list-body');
                const assetBody = document.getElementById('asset-mgmt-body');
                if (listBody) {
                    listBody.innerHTML = '';
                    snap.forEach(doc => {
                        const d = doc.data();
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td>${d.username}</td><td><input type="text" value="${d.nickname||''}" onchange="window.updateStudentNickname('${doc.id}',this.value)"></td><td>${d.isAuthorized?'인증':'비인증'}</td><td><button class="auth-btn" onclick="window.toggleStudentAuth('${doc.id}',${!d.isAuthorized})">${d.isAuthorized?'취소':'승인'}</button></td>`;
                        listBody.appendChild(tr);
                    });
                }
                if (assetBody) {
                    assetBody.innerHTML = '';
                    snap.forEach(doc => {
                        const d = doc.data();
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td>${d.nickname||d.username}</td><td style="color:#00ffdd">₩${(d.balance||0).toLocaleString()}</td><td>-</td><td>-</td><td class="important-metric">₩${(d.balance||0).toLocaleString()}</td><td><button class="auth-btn" style="font-size:0.7em" onclick="window.openModifyModal('${doc.id}','${d.nickname||d.username}',${d.balance||0})">수정</button></td>`;
                        assetBody.appendChild(tr);
                    });
                }
            }));

        // 상점 관리 목록 (실시간)
        window.userState.unsubscribe.push(db.collection('items')
            .where('classCode', '==', classCode)
            .onSnapshot(snap => {
                const adminList = document.getElementById('admin-item-list');
                if (adminList) {
                    adminList.innerHTML = '';
                    snap.forEach(doc => {
                        const item = doc.data();
                        const div = document.createElement('div');
                        div.style.padding = '10px'; div.style.borderBottom = '1px solid #333'; div.style.display = 'flex'; div.style.justifyContent = 'space-between';
                        div.innerHTML = `<span>${item.name} (₩${item.price}) - 재고: ${item.stock}</span><button onclick="window.deleteItem('${doc.id}')" style="color:red; background:none; border:none; cursor:pointer;">삭제</button>`;
                        adminList.appendChild(div);
                    });
                }
            }));
    }

    openShopMgmt() { document.getElementById('shop-mgmt-modal').style.display = 'block'; }

    async addShopItem() {
        const name = document.getElementById('item-name').value;
        const price = parseInt(document.getElementById('item-price').value);
        const stock = parseInt(document.getElementById('item-stock').value);
        const desc = document.getElementById('item-desc').value;
        const classCode = window.userState.currentUser.classCode;

        if (!name || isNaN(price) || isNaN(stock)) return alert("정보를 모두 입력하세요.");

        try {
            await db.collection('items').add({ name, price, stock, description: desc, classCode, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            alert("물품 등록 완료!");
            document.getElementById('item-name').value = ''; document.getElementById('item-price').value = ''; document.getElementById('item-stock').value = '';
        } catch (err) { alert("등록 실패"); }
    }

    async login() {
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        const e = u.includes('@') ? u : `${u.toLowerCase()}@student.com`;
        try { await auth.signInWithEmailAndPassword(e, p); document.getElementById('auth-modal').style.display = 'none'; } catch (err) { alert("로그인 실패"); }
    }

    async signup() {
        const role = document.getElementById('signup-role').value;
        const pass = document.getElementById('signup-password').value;
        const adminEmail = document.getElementById('signup-email').value.trim();
        let username = document.getElementById('signup-username').value.trim().toLowerCase();
        const inputCode = document.getElementById('signup-class-code').value.trim().toUpperCase();

        try {
            if (role === 'student') {
                const classDoc = await db.collection('classes').doc(inputCode).get();
                if (!classDoc.exists) return alert("유효하지 않은 코드");
            } else username = adminEmail.split('@')[0];

            const finalEmail = role === 'admin' ? adminEmail : `${username}@student.com`;
            const cred = await auth.createUserWithEmailAndPassword(finalEmail, pass);
            
            let classCode = null;
            if (role === 'admin') {
                classCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                await db.collection('classes').doc(classCode).set({ adminUid: cred.user.uid, adminEmail: finalEmail, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }

            await db.collection('users').doc(cred.user.uid).set({
                username, role, email: finalEmail, balance: 1000, 
                classCode: role === 'admin' ? classCode : "", 
                adminCode: role === 'student' ? inputCode : "", 
                isAuthorized: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("가입 완료!"); location.reload();
        } catch (err) { alert("가입 실패"); }
    }

    async logout() { await auth.signOut(); location.reload(); }
    openModal(mode) { 
        document.getElementById('auth-modal').style.display = 'block';
        const isLogin = mode === 'login';
        document.getElementById('login-form-container').classList.toggle('hidden', !isLogin);
        document.getElementById('signup-form-container').classList.toggle('hidden', isLogin);
    }
    closeModal() { document.getElementById('auth-modal').style.display = 'none'; }
    openMyInfo() { document.getElementById('my-info-modal').style.display = 'block'; 
        const u = window.userState.currentUser;
        document.getElementById('info-username').textContent = u.username;
        document.getElementById('info-role').textContent = u.role === 'admin' ? '관리자' : '학생';
        document.getElementById('info-class-code').textContent = u.classCode || u.adminCode;
    }
}

class EconomicSimulation {
    constructor() { this.user = null; }
    init(userData) {
        this.user = userData;
        this.loadShopItems();
        this.loadClassActivities();
        this.updateHomeUI();
    }

    updateHomeUI() {
        if (!this.user) return;
        document.getElementById('current-cash').textContent = (this.user.balance || 0).toLocaleString();
        document.getElementById('total-assets').textContent = (this.user.balance || 0).toLocaleString();
    }

    // [중요] 상점 물품 실시간 로드
    loadShopItems() {
        const classCode = this.user.role === 'admin' ? this.user.classCode : this.user.adminCode;
        window.userState.unsubscribe.push(db.collection('items')
            .where('classCode', '==', classCode)
            .onSnapshot(snap => {
                const grid = document.getElementById('shop-item-grid');
                if (!grid) return;
                grid.innerHTML = '';
                snap.forEach(doc => {
                    const item = doc.data();
                    const isSoldOut = item.stock <= 0;
                    const card = document.createElement('div');
                    card.className = `item-card ${isSoldOut ? 'out-of-stock' : ''}`;
                    card.innerHTML = `
                        ${isSoldOut ? '<span class="sold-out-badge">품절</span>' : ''}
                        <h3>${item.name}</h3>
                        <p style="font-size:0.9em; color:#888;">${item.description || ''}</p>
                        <span class="item-price">₩ ${item.price.toLocaleString()}</span>
                        <p class="item-stock">남은 수량: ${item.stock}</p>
                        <button class="submit-btn" onclick="window.buyItem('${doc.id}')" ${isSoldOut ? 'disabled' : ''}>
                            ${isSoldOut ? '구매 불가' : '구매하기'}
                        </button>
                    `;
                    grid.appendChild(card);
                });
            }));
    }

    // [중요] 통합 활동 로그 실시간 로드
    loadClassActivities() {
        const classCode = this.user.role === 'admin' ? this.user.classCode : this.user.adminCode;
        const logList = document.getElementById('class-logs');
        if (!logList) return;

        window.userState.unsubscribe.push(db.collection('class_activities')
            .where('classCode', '==', classCode)
            .orderBy('timestamp', 'desc').limit(50)
            .onSnapshot(snap => {
                logList.innerHTML = '';
                snap.forEach(doc => {
                    const d = doc.data();
                    const li = document.createElement('li');
                    li.style.padding = '10px 0'; li.style.borderBottom = '1px solid #222';
                    const time = d.timestamp ? d.timestamp.toDate().toLocaleTimeString() : '...';
                    li.innerHTML = `<small style="color:#666">[${time}]</small> <strong>${d.userName}</strong>: ${d.description} <span style="color:${d.amount < 0 ? '#ff4d4d':'#00ffdd'}">(${d.amount.toLocaleString()}원)</span>`;
                    logList.appendChild(li);
                });
            }));
    }

    // [중요] Firebase Transaction을 이용한 안전한 구매 로직
    async buyItem(itemId) {
        if (this.user.role === 'admin') return alert("관리자는 구매할 수 없습니다.");
        const userRef = db.collection('users').doc(this.user.uid);
        const itemRef = db.collection('items').doc(itemId);

        try {
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                const itemDoc = await transaction.get(itemRef);

                if (!itemDoc.exists) throw "아이템이 존재하지 않습니다.";
                const item = itemDoc.data();
                const userBalance = userDoc.data().balance || 0;

                if (item.stock <= 0) throw "재고가 부족합니다.";
                if (userBalance < item.price) throw "잔액이 부족합니다.";

                // 1. 잔액 차감
                transaction.update(userRef, { balance: userBalance - item.price });
                // 2. 재고 차감
                transaction.update(itemRef, { stock: item.stock - 1 });
                // 3. 인벤토리 추가
                const invRef = userRef.collection('inventory').doc();
                transaction.set(invRef, { itemName: item.name, price: item.price, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                
                // 4. 통합 로그 기록 (Transaction 내부에서는 add를 못하므로 밖에서 처리)
            });

            const itemSnap = await itemRef.get();
            await this.logActivity('SHOP_PURCHASE', -itemSnap.data().price, `상점에서 [${itemSnap.data().name}] 구매`);
            alert("구매가 완료되었습니다!");
        } catch (err) { alert("구매 실패: " + err); }
    }

    async logActivity(type, amount, description) {
        const u = window.userState.currentUser;
        await db.collection('class_activities').add({
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userUid: u.uid, userName: u.nickname || u.username,
            type, amount, description, classCode: u.adminCode || u.classCode
        });
    }

    reset() { this.user = null; }
}

// Helper: 전역 함수 등록
window.buyItem = (id) => window.simulation.buyItem(id);
window.deleteItem = async (id) => { if(confirm("삭제하시겠습니까?")) await db.collection('items').doc(id).delete(); };
window.updateStudentNickname = async (uid, n) => { await db.collection('users').doc(uid).update({nickname:n}); };
window.toggleStudentAuth = async (uid, s) => { await db.collection('users').doc(uid).update({isAuthorized:s}); };
window.openModifyModal = (uid, name, balance) => {
    document.getElementById('modify-target-name').textContent = name;
    document.getElementById('modify-cash-amount').value = balance;
    document.getElementById('modify-asset-modal').style.display = 'block';
    window.currentModifyUid = uid;
};

// Sidebar Toggle Logic
function setupNavigation() {
    document.querySelectorAll('.parent-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const currentItem = link.parentElement;
            document.querySelectorAll('.menu-item').forEach(item => { if(item !== currentItem) item.classList.remove('open'); });
            currentItem.classList.toggle('open');
        });
    });
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.classList.contains('parent-link')) return;
            e.preventDefault();
            document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            const target = document.getElementById(link.id.replace('-link', '-view'));
            if (target) {
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                target.classList.add('active');
            }
        });
    });
}

window.addEventListener('load', () => {
    window.simulation = new EconomicSimulation();
    window.authManager = new AuthManager(window.simulation);
    setupNavigation();

    document.getElementById('confirm-modify-asset')?.addEventListener('click', async () => {
        const uid = window.currentModifyUid;
        const amount = parseInt(document.getElementById('modify-cash-amount').value);
        if (isNaN(amount)) return alert("금액 입력");
        await db.collection('users').doc(uid).update({ balance: amount });
        document.getElementById('modify-asset-modal').style.display = 'none';
        alert("수정 완료");
    });
});
