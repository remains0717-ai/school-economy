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
        // [1] 모달 열기/닫기
        document.getElementById('login-btn')?.addEventListener('click', () => this.openModal('login'));
        document.getElementById('signup-btn')?.addEventListener('click', () => this.openModal('signup'));
        document.querySelector('.close-modal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('user-display-name')?.addEventListener('click', () => this.openMyInfo());
        document.querySelector('.close-my-info')?.addEventListener('click', () => document.getElementById('my-info-modal').style.display = 'none');

        // [2] 회원가입 역할 전환 (required 동적 제어)
        document.getElementById('signup-role')?.addEventListener('change', (e) => {
            const isAdmin = e.target.value === 'admin';
            document.getElementById('signup-email')?.classList.toggle('hidden', !isAdmin);
            document.getElementById('signup-email').required = isAdmin;
            document.getElementById('signup-username-container')?.classList.toggle('hidden', isAdmin);
            document.getElementById('signup-username').required = !isAdmin;
            document.getElementById('signup-class-code-container')?.classList.toggle('hidden', isAdmin);
            document.getElementById('signup-class-code').required = !isAdmin;
        });

        // [3] 로그인/회원가입 전환
        document.getElementById('toggle-to-signup')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchMode('signup');
        });

        // [4] 폼 제출
        document.getElementById('login-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.login(); });
        document.getElementById('signup-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.signup(); });

        window.onclick = (e) => {
            if (e.target.classList.contains('modal')) e.target.style.display = 'none';
        };
    }

    listenToAuthChanges() {
        auth.onAuthStateChanged(async (user) => {
            console.log("Auth State Changed:", user ? user.email : "Logged Out");
            if (user) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        this.currentUser = { uid: user.uid, ...userDoc.data() };
                        this.simulation.loadUserData(user.uid);
                    }
                } catch (err) { console.error("User Load Error:", err); }
            } else {
                this.currentUser = null;
                this.simulation.resetData();
            }
            this.updateUI();
        });
    }

    openModal(mode) {
        if (this.modal) {
            this.modal.style.display = 'block';
            this.switchMode(mode);
        }
    }

    closeModal() {
        if (this.modal) this.modal.style.display = 'none';
        document.getElementById('login-form')?.reset();
        document.getElementById('signup-form')?.reset();
    }

    switchMode(mode) {
        const isLogin = mode === 'login';
        this.loginContainer?.classList.toggle('hidden', !isLogin);
        this.signupContainer?.classList.toggle('hidden', isLogin);
        if (this.toggleText) {
            this.toggleText.innerHTML = isLogin 
                ? `계정이 없으신가요? <a href="#" onclick="window.authManager.switchMode('signup'); return false;">회원가입</a>`
                : `이미 계정이 있으신가요? <a href="#" onclick="window.authManager.switchMode('login'); return false;">로그인</a>`;
        }
    }

    async login() {
        const username = document.getElementById('login-username').value.trim();
        const pass = document.getElementById('login-password').value;
        const email = username.includes('@') ? username : `${username.toLowerCase()}@student.com`;

        try {
            await auth.signInWithEmailAndPassword(email, pass);
            this.closeModal();
            window.location.reload();
        } catch (err) { alert("로그인 실패: 아이디 또는 비밀번호를 확인하세요."); }
    }

    async signup() {
        const role = document.getElementById('signup-role').value;
        const pass = document.getElementById('signup-password').value;
        const adminEmail = document.getElementById('signup-email').value.trim();
        let username = document.getElementById('signup-username').value.trim().toLowerCase();
        const inputCode = document.getElementById('signup-class-code').value.trim().toUpperCase();

        if (pass.length < 6) return alert("비밀번호는 6자 이상이어야 합니다.");
        
        try {
            if (role === 'student') {
                const classDoc = await db.collection('classes').doc(inputCode).get();
                if (!classDoc.exists) return alert("유효하지 않은 학급 코드입니다.");
            } else {
                username = adminEmail.split('@')[0];
            }

            const finalEmail = role === 'admin' ? adminEmail : `${username}@student.com`;
            const userCredential = await auth.createUserWithEmailAndPassword(finalEmail, pass);
            const user = userCredential.user;

            let classCode = null;
            if (role === 'admin') {
                classCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                await db.collection('classes').doc(classCode).set({
                    adminUid: user.uid, adminEmail: finalEmail, className: `${username} 선생님 학급`, createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            await db.collection('users').doc(user.uid).set({
                username, role, email: finalEmail, classCode: role === 'admin' ? classCode : "", adminCode: role === 'student' ? inputCode : "", createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await db.collection('playerData').doc(user.uid).set({ cash: 1000, bankBalance: 0, portfolio: {}, deposits: [] });
            
            alert(role === 'admin' ? `관리자 가입 완료! 코드: [${classCode}]` : "가입 완료! 로그인해 주세요.");
            await auth.signOut();
            this.closeModal();
            window.location.reload();
        } catch (err) { alert("가입 실패: " + err.message); }
    }

    async logout() { await auth.signOut(); window.location.reload(); }

    openMyInfo() {
        if (!this.currentUser) return;
        const modal = document.getElementById('my-info-modal');
        document.getElementById('info-username').textContent = this.currentUser.username;
        document.getElementById('info-role').textContent = this.currentUser.role === 'admin' ? '관리자' : '학생';
        const emailRow = document.getElementById('info-email-row');
        if (this.currentUser.role === 'admin') {
            emailRow.classList.remove('hidden');
            document.getElementById('info-email').textContent = this.currentUser.email;
        } else emailRow.classList.add('hidden');
        document.getElementById('info-class-code').textContent = this.currentUser.classCode || this.currentUser.adminCode || "소속 없음";
        modal.style.display = 'block';
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

    // (loadStudentList, loadStudentAssets 등 기존 관리 기능 유지...)
    async loadStudentList() {
        const tbody = document.getElementById('student-list-body');
        if (!tbody || !this.currentUser) return;
        const snap = await db.collection('users').where('role','==','student').where('adminCode','==',this.currentUser.classCode).get();
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const d = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${d.username}</td><td><input type="text" value="${d.nickname||''}" onchange="window.updateStudentNickname('${doc.id}',this.value)"></td><td>${d.isAuthorized?'인증됨':'비인증'}</td><td><button onclick="window.toggleStudentAuth('${doc.id}',${!d.isAuthorized})">${d.isAuthorized?'취소':'승인'}</button></td>`;
            tbody.appendChild(tr);
        });
    }

    async loadStudentAssets() {
        const tbody = document.getElementById('asset-mgmt-body');
        if (!tbody || !this.currentUser) return;
        db.collection('users').where('role','==','student').where('adminCode','==',this.currentUser.classCode).onSnapshot(async snap => {
            tbody.innerHTML = '';
            for(const sDoc of snap.docs) {
                const s = sDoc.data();
                const aDoc = await db.collection('playerData').doc(sDoc.id).get();
                const a = aDoc.exists ? aDoc.data() : {cash:0, bankBalance:0};
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${s.nickname||s.username}</td><td>₩${a.cash.toLocaleString()}</td><td>₩${a.bankBalance.toLocaleString()}</td><td>-</td><td class="important-metric">₩${(a.cash+a.bankBalance).toLocaleString()}</td><td><button onclick="window.openModifyModal('${sDoc.id}','${s.username}',${a.cash})">수정</button></td>`;
                tbody.appendChild(tr);
            }
        });
    }
}

// Sidebar Accordion Toggle
function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const parentLinks = document.querySelectorAll('.parent-link');
    const subLinks = document.querySelectorAll('.sub-menu a, #home-link');

    // [1] 상위 메뉴 클릭 (아코디언 토글)
    parentLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const currentItem = link.parentElement;
            const isOpen = currentItem.classList.contains('open');

            // 다른 모든 메뉴 닫기 (useState 효과)
            menuItems.forEach(item => item.classList.remove('open'));

            // 현재 메뉴가 닫혀있었다면 열기
            if (!isOpen) {
                currentItem.classList.add('open');
            }
        });
    });

    // [2] 하위 메뉴 클릭 (페이지 전환)
    subLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // 액티브 상태 표시
            document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');

            // 뷰 전환
            const targetId = link.id.replace('-link', '-view');
            const targetView = document.getElementById(targetId);

            if (targetView) {
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                targetView.classList.add('active');
            }
        });
    });
}

class EconomicSimulation {
    constructor() { this.uid = null; this.init(); }
    init() { setInterval(() => this.updateMarket(), 2000); }
    loadUserData(uid) { this.uid = uid; this.updateUI(); }
    resetData() { this.uid = null; this.updateUI(); }
    updateMarket() { /* 가격 변동 로직 */ this.updateUI(); }
    loadClassLogs() { /* 로그 로드 */ }
    updateUI() { /* 시뮬레이션 관련 UI 업데이트 */ }
}

window.addEventListener('load', () => {
    const simulation = new EconomicSimulation();
    window.authManager = new AuthManager(simulation);
    setupNavigation();
});

// Admin Global Helpers
window.updateStudentNickname = async (uid, n) => { await db.collection('users').doc(uid).update({nickname:n}); };
window.toggleStudentAuth = async (uid, s) => { await db.collection('users').doc(uid).update({isAuthorized:s}); window.authManager.loadStudentList(); };
window.openModifyModal = (uid, name, cash) => {
    document.getElementById('modify-target-name').textContent = name;
    document.getElementById('modify-cash-amount').value = cash;
    document.getElementById('modify-asset-modal').style.display = 'block';
    window.currentModifyUid = uid;
};
window.batchAction = async (t) => { /* 배치 로직 */ };