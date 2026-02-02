// [1] 전역 상태 관리 (Single Source of Truth)
window.userState = {
    currentUser: null,
    isLoggedIn: false,
    unsubscribeUser: null,
    unsubscribeStudents: null
};

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
        
        // 역할 변경 시 입력 필드 동적 제어
        document.getElementById('signup-role')?.addEventListener('change', (e) => {
            const isAdmin = e.target.value === 'admin';
            this.toggleSignupFields(isAdmin);
        });

        // 폼 제출
        document.getElementById('login-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.login(); });
        document.getElementById('signup-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.signup(); });
    }

    // [중요] 중앙 서버형 실시간 리스너
    listenToAuth() {
        auth.onAuthStateChanged(user => {
            if (window.userState.unsubscribeUser) window.userState.unsubscribeUser();
            
            if (user) {
                // 유저의 고유 문서를 실시간 구독 (onSnapshot)
                window.userState.unsubscribeUser = db.collection('users').doc(user.uid).onSnapshot(doc => {
                    if (doc.exists) {
                        window.userState.currentUser = { uid: user.uid, ...doc.data() };
                        window.userState.isLoggedIn = true;
                        this.updateUI();
                        if (this.simulation) this.simulation.sync(window.userState.currentUser);
                    }
                });
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

        // 헤더 및 홈 화면 토글
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
            
            if (isAdmin) {
                document.getElementById('mgmt-class-code').textContent = user.classCode;
                this.loadClassData(user.classCode);
            }
        }
    }

    // [중요] 관리자: 본인 학급 코드 기반 실시간 쿼리 통합
    loadClassData(classCode) {
        if (window.userState.unsubscribeStudents) window.userState.unsubscribeStudents();

        window.userState.unsubscribeStudents = db.collection('users')
            .where('adminCode', '==', classCode)
            .where('role', '==', 'student')
            .onSnapshot(snap => {
                this.renderStudentLists(snap);
            });
    }

    renderStudentLists(snap) {
        const listBody = document.getElementById('student-list-body');
        const assetBody = document.getElementById('asset-mgmt-body');
        if (!listBody || !assetBody) return;

        listBody.innerHTML = '';
        assetBody.innerHTML = '';

        snap.forEach(doc => {
            const data = doc.data();
            const uid = doc.id;

            // 1. 계정 관리 테이블
            const tr1 = document.createElement('tr');
            tr1.innerHTML = `<td>${data.username}</td><td><input type="text" value="${data.nickname||''}" onchange="window.updateStudentNickname('${uid}',this.value)"></td><td>${data.isAuthorized?'인증':'비인증'}</td><td><button class="auth-btn" onclick="window.toggleStudentAuth('${uid}',${!data.isAuthorized})">${data.isAuthorized?'취소':'승인'}</button></td>`;
            listBody.appendChild(tr1);

            // 2. 자산 관리 테이블 (Single Source: data.balance 사용)
            const tr2 = document.createElement('tr');
            tr2.innerHTML = `<td>${data.nickname||data.username}</td><td style="color:#00ffdd">₩${(data.balance||0).toLocaleString()}</td><td>₩0</td><td>-</td><td class="important-metric">₩${(data.balance||0).toLocaleString()}</td><td><button class="auth-btn" style="font-size:0.7em" onclick="window.openModifyModal('${uid}','${data.nickname||data.username}',${data.balance||0})">수정</button></td>`;
            assetBody.appendChild(tr2);
        });
    }

    async login() {
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        const e = u.includes('@') ? u : `${u.toLowerCase()}@student.com`;
        try { await auth.signInWithEmailAndPassword(e, p); this.closeModal(); } 
        catch (err) { alert("로그인 실패: 아이디 또는 비밀번호가 틀립니다."); }
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
                if (!classDoc.exists) return alert("유효하지 않은 학급 코드입니다.");
            } else { username = adminEmail.split('@')[0]; }

            const finalEmail = role === 'admin' ? adminEmail : `${username}@student.com`;
            const userCredential = await auth.createUserWithEmailAndPassword(finalEmail, pass);
            const user = userCredential.user;

            let classCode = null;
            if (role === 'admin') {
                classCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                await db.collection('classes').doc(classCode).set({ adminUid: user.uid, adminEmail: finalEmail, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }

            // [통합 데이터 저장] balance 포함
            await db.collection('users').doc(user.uid).set({
                username, role, email: finalEmail, balance: 1000,
                classCode: role === 'admin' ? classCode : "",
                adminCode: role === 'student' ? inputCode : "",
                isAuthorized: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert(role === 'admin' ? `관리자 가입 완료! 코드: [${classCode}]` : "가입 완료! 로그인을 해주세요.");
            await auth.signOut();
            this.closeModal();
        } catch (err) { alert("가입 실패: " + err.message); }
    }

    async logout() { await auth.signOut(); window.location.reload(); }
    openModal(mode) { this.modal.style.display = 'block'; this.switchMode(mode); }
    closeModal() { this.modal.style.display = 'none'; }
    switchMode(mode) {
        const isLogin = mode === 'login';
        document.getElementById('login-form-container').classList.toggle('hidden', !isLogin);
        document.getElementById('signup-form-container').classList.toggle('hidden', isLogin);
        document.getElementById('auth-toggle-text').innerHTML = isLogin 
            ? `계정이 없으신가요? <a href="#" onclick="window.authManager.switchMode('signup'); return false;">회원가입</a>`
            : `이미 계정이 있으신가요? <a href="#" onclick="window.authManager.switchMode('login'); return false;">로그인</a>`;
    }
    toggleSignupFields(isAdmin) {
        document.getElementById('signup-email').classList.toggle('hidden', !isAdmin);
        document.getElementById('signup-username-container').classList.toggle('hidden', isAdmin);
        document.getElementById('signup-class-code-container').classList.toggle('hidden', isAdmin);
    }
    openMyInfo() { document.getElementById('my-info-modal').style.display = 'block'; }
}

class EconomicSimulation {
    constructor() { this.user = null; }
    sync(userData) {
        this.user = userData;
        this.updateUI();
    }
    updateUI() {
        if (!this.user) return;
        const bal = this.user.balance || 0;
        document.getElementById('current-cash').textContent = bal.toLocaleString();
        document.getElementById('total-assets').textContent = bal.toLocaleString();
    }
    reset() { this.user = null; }
    loadClassLogs() { /* 실시간 로그 리스너 */ }
}

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
        if (isNaN(amount)) return alert("금액을 입력하세요.");
        try {
            await db.collection('users').doc(uid).update({ balance: amount });
            alert("수정되었습니다.");
            document.getElementById('modify-asset-modal').style.display = 'none';
        } catch (err) { alert("권한이 없습니다."); }
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