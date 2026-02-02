// Initialize Firebase
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
        this.currentUser = null;
        this.modal = document.getElementById('auth-modal');
        this.loginContainer = document.getElementById('login-form-container');
        this.signupContainer = document.getElementById('signup-form-container');
        this.toggleText = document.getElementById('auth-toggle-text');

        this.initEvents();
        this.listenToAuthChanges();
    }

    initEvents() {
        document.getElementById('login-btn')?.addEventListener('click', () => this.openModal('login'));
        document.getElementById('signup-btn')?.addEventListener('click', () => this.openModal('signup'));
        document.querySelector('.close-modal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('user-display-name')?.addEventListener('click', () => this.openMyInfo());
        document.querySelector('.close-my-info')?.addEventListener('click', () => document.getElementById('my-info-modal').style.display = 'none');

        document.getElementById('signup-role')?.addEventListener('change', (e) => {
            const isAdmin = e.target.value === 'admin';
            document.getElementById('signup-email')?.classList.toggle('hidden', !isAdmin);
            document.getElementById('signup-email').required = isAdmin;
            document.getElementById('signup-username-container')?.classList.toggle('hidden', isAdmin);
            document.getElementById('signup-username').required = !isAdmin;
            document.getElementById('signup-class-code-container')?.classList.toggle('hidden', isAdmin);
            document.getElementById('signup-class-code').required = !isAdmin;
        });

        window.onclick = (e) => {
            if (e.target.classList.contains('modal')) e.target.style.display = 'none';
        };
    }

    // [중요] 실시간 유저 정보 리스너 (단일 소스: users 컬렉션)
    listenToAuthChanges() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                // 실시간 리스너 연결
                db.collection('users').doc(user.uid).onSnapshot((doc) => {
                    if (doc.exists) {
                        this.currentUser = { uid: user.uid, ...doc.data() };
                        this.updateUI();
                        if (this.simulation) this.simulation.syncWithUser(this.currentUser);
                    }
                }, (err) => console.error("Snapshot Error:", err));
            } else {
                this.currentUser = null;
                if (this.simulation) this.simulation.resetData();
                this.updateUI();
            }
        });
    }

    updateUI() {
        const loggedIn = !!this.currentUser;
        document.getElementById('user-info').classList.toggle('hidden', !loggedIn);
        document.getElementById('login-btn').classList.toggle('hidden', loggedIn);
        document.getElementById('signup-btn').classList.toggle('hidden', loggedIn);
        document.getElementById('logged-in-home').classList.toggle('hidden', !loggedIn);
        document.getElementById('logged-out-home').classList.toggle('hidden', loggedIn);

        if (loggedIn) {
            document.getElementById('user-display-name').textContent = this.currentUser.nickname || this.currentUser.username;
            const isAdmin = this.currentUser.role === 'admin';
            document.getElementById('admin-menu').classList.toggle('hidden', !isAdmin);
            document.getElementById('admin-bank-mgmt').classList.toggle('hidden', !isAdmin);
            
            if (isAdmin) {
                document.getElementById('mgmt-class-code').textContent = this.currentUser.classCode;
                this.loadStudentList();
                this.loadStudentAssets();
                this.simulation.loadClassLogs();
            }
        }
    }

    // [중요] 관리자 화면: 학생 자산 실시간 감시 (users 컬렉션의 balance 기준)
    async loadStudentAssets() {
        const tbody = document.getElementById('asset-mgmt-body');
        if (!tbody || !this.currentUser || this.currentUser.role !== 'admin') return;

        db.collection('users')
            .where('role', '==', 'student')
            .where('adminCode', '==', this.currentUser.classCode)
            .onSnapshot(async (snap) => {
                tbody.innerHTML = '';
                for (const sDoc of snap.docs) {
                    const s = sDoc.data();
                    const balance = s.balance || 0;
                    
                    // 예금 데이터는 기존대로PlayerData에서 가져오되, 현금은 users.balance 사용
                    const pDoc = await db.collection('playerData').doc(sDoc.id).get();
                    const pData = pDoc.exists ? pDoc.data() : { bankBalance: 0 };
                    const bankBalance = pData.bankBalance || 0;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${s.nickname || s.username}</td>
                        <td style="color:#00ffdd">₩${balance.toLocaleString()}</td>
                        <td>₩${bankBalance.toLocaleString()}</td>
                        <td>-</td>
                        <td class="important-metric">₩${(balance + bankBalance).toLocaleString()}</td>
                        <td><button class="auth-btn" style="font-size:0.7em" onclick="window.openModifyModal('${sDoc.id}','${s.nickname || s.username}',${balance})">수정</button></td>
                    `;
                    tbody.appendChild(tr);
                }
            });
    }

    async loadStudentList() {
        const tbody = document.getElementById('student-list-body');
        if (!tbody || !this.currentUser) return;
        db.collection('users')
            .where('role', '==', 'student')
            .where('adminCode', '==', this.currentUser.classCode)
            .onSnapshot(snap => {
                tbody.innerHTML = '';
                snap.forEach(doc => {
                    const d = doc.data();
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${d.username}</td><td><input type="text" value="${d.nickname||''}" onchange="window.updateStudentNickname('${doc.id}',this.value)"></td><td>${d.isAuthorized?'인증됨':'비인증'}</td><td><button class="auth-btn" onclick="window.toggleStudentAuth('${doc.id}',${!d.isAuthorized})">${d.isAuthorized?'취소':'승인'}</button></td>`;
                    tbody.appendChild(tr);
                });
            });
    }

    openModal(mode) { if (this.modal) { this.modal.style.display = 'block'; this.switchMode(mode); } }
    closeModal() { if (this.modal) this.modal.style.display = 'none'; }
    switchMode(mode) {
        const isLogin = mode === 'login';
        document.getElementById('login-form-container').classList.toggle('hidden', !isLogin);
        document.getElementById('signup-form-container').classList.toggle('hidden', isLogin);
    }

    async login() {
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        const e = u.includes('@') ? u : `${u.toLowerCase()}@student.com`;
        try { await auth.signInWithEmailAndPassword(e, p); this.closeModal(); } catch (err) { alert("로그인 실패"); }
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
            } else { username = adminEmail.split('@')[0]; }

            const finalEmail = role === 'admin' ? adminEmail : `${username}@student.com`;
            const userCredential = await auth.createUserWithEmailAndPassword(finalEmail, pass);
            const user = userCredential.user;

            let classCode = null;
            if (role === 'admin') {
                classCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                await db.collection('classes').doc(classCode).set({ adminUid: user.uid, adminEmail: finalEmail, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }

            await db.collection('users').doc(user.uid).set({
                username, role, email: finalEmail, balance: 1000, 
                classCode: role === 'admin' ? classCode : "", 
                adminCode: role === 'student' ? inputCode : "", 
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("가입 완료!"); this.closeModal();
        } catch (err) { alert("가입 실패: " + err.message); }
    }

    async logout() { await auth.signOut(); window.location.reload(); }
    openMyInfo() { /* 기존과 동일 */ document.getElementById('my-info-modal').style.display = 'block'; }
}

class EconomicSimulation {
    constructor() {
        this.user = null;
        this.init();
    }
    init() { setInterval(() => this.updateMarket(), 2000); }
    
    // [중요] 사용자의 실시간 데이터(balance)와 화면 동기화
    syncWithUser(userData) {
        this.user = userData;
        this.updateUI();
    }

    updateUI() {
        if (!this.user) return;
        const balance = this.user.balance || 0;
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        
        // 홈 화면 및 은행 화면의 모든 현금 지표를 balance 하나로 통일
        setEl('current-cash', Math.floor(balance).toLocaleString());
        setEl('bank-balance-amount', "0"); // 예금은 추후PlayerData 연동
        setEl('total-assets', Math.floor(balance).toLocaleString());
    }

    resetData() { this.user = null; this.updateUI(); }
    updateMarket() { /* 가격 변동 */ }
    loadClassLogs() { /* 로그 로드 */ }
}

// Sidebar Accordion
function setupNavigation() {
    document.querySelectorAll('.parent-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const currentItem = link.parentElement;
            document.querySelectorAll('.menu-item').forEach(item => { if(item !== currentItem) item.classList.remove('open'); });
            currentItem.classList.toggle('open');
        });
    });
    document.querySelectorAll('.sub-menu a, #home-link').forEach(link => {
        link.addEventListener('click', (e) => {
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
    const simulation = new EconomicSimulation();
    window.authManager = new AuthManager(simulation);
    setupNavigation();

    document.getElementById('confirm-modify-asset')?.addEventListener('click', async () => {
        const uid = window.currentModifyUid;
        const amount = parseInt(document.getElementById('modify-cash-amount').value);
        const reason = document.getElementById('modify-reason').value;
        if (isNaN(amount) || !reason) return alert("입력 확인");

        try {
            // [중요] 관리자가 직접 users 컬렉션의 balance를 수정
            await db.collection('users').doc(uid).update({ balance: amount });
            await db.collection('admin_logs').add({ adminUid: auth.currentUser.uid, targetUid: uid, amount, reason, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            alert("수정 완료");
            document.getElementById('modify-asset-modal').style.display = 'none';
        } catch (err) { alert("권한 없음: " + err.message); }
    });
});

window.updateStudentNickname = async (uid, n) => { await db.collection('users').doc(uid).update({nickname:n}); };
window.toggleStudentAuth = async (uid, s) => { await db.collection('users').doc(uid).update({isAuthorized:s}); };
window.openModifyModal = (uid, name, balance) => {
    document.getElementById('modify-target-name').textContent = name;
    document.getElementById('modify-cash-amount').value = balance;
    document.getElementById('modify-asset-modal').style.display = 'block';
    window.currentModifyUid = uid;
};
