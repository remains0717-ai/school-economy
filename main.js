// [1] 전역 상태 및 파이어베이스 초기화
window.userState = { currentUser: null, classData: null, unsubscribe: [] };

const firebaseConfig = {
    apiKey: "AIzaSyBoVbtaw2BR29qyuFKPxBKVeEtkSLF49yg",
    authDomain: "school-economydata.firebaseapp.com",
    projectId: "school-economydata",
    storageBucket: "school-economydata.firebasestorage.app",
    messagingSenderId: "662631755029",
    appId: "1:662631755029:web:7c63e30355d9dd6136cd1c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

class AuthManager {
    constructor(simulation) {
        this.simulation = simulation;
        this.initEvents();
        this.listenToAuth();
    }

    initEvents() {
        document.getElementById('login-btn')?.addEventListener('click', () => this.openModal('login'));
        document.getElementById('signup-btn')?.addEventListener('click', () => this.openModal('signup'));
        document.querySelector('.close-modal')?.addEventListener('click', () => document.getElementById('auth-modal').style.display='none');
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('user-display-name')?.addEventListener('click', () => this.openMyInfo());
        document.querySelector('.close-my-info')?.addEventListener('click', () => document.getElementById('my-info-modal').style.display='none');
        
        // 관리자 통합 설정 이벤트
        document.getElementById('admin-fab')?.addEventListener('click', () => document.getElementById('admin-settings-modal').style.display='block');
        document.querySelector('.close-admin-settings')?.addEventListener('click', () => document.getElementById('admin-settings-modal').style.display='none');
        document.getElementById('publish-news-btn')?.addEventListener('click', () => this.publishNews());
        document.getElementById('pay-salary-btn')?.addEventListener('click', () => this.paySalaries());
        document.getElementById('add-job-btn')?.addEventListener('click', () => this.addJob());

        document.getElementById('login-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.login(); });
        document.getElementById('signup-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.signup(); });
        
        document.getElementById('signup-role')?.addEventListener('change', (e) => {
            const isAdmin = e.target.value === 'admin';
            document.getElementById('signup-email').classList.toggle('hidden', !isAdmin);
            document.getElementById('signup-username-container').classList.toggle('hidden', isAdmin);
            document.getElementById('signup-class-code-container').classList.toggle('hidden', isAdmin);
        });
    }

    listenToAuth() {
        auth.onAuthStateChanged(user => {
            window.userState.unsubscribe.forEach(u => u());
            window.userState.unsubscribe = [];

            if (user) {
                // [실시간 리스너 1] 내 정보 구독
                const unsubUser = db.collection('users').doc(user.uid).onSnapshot(doc => {
                    if (doc.exists) {
                        window.userState.currentUser = { uid: user.uid, ...doc.data() };
                        this.updateUI();
                        this.simulation.sync(window.userState.currentUser);
                        
                        // [실시간 리스너 2] 소속 학급 정보 구독 (국고, 뉴스 등)
                        const classCode = window.userState.currentUser.classCode || window.userState.currentUser.adminCode;
                        if (classCode) this.listenToClass(classCode);
                    }
                });
                window.userState.unsubscribe.push(unsubUser);
            } else {
                window.userState.currentUser = null;
                this.updateUI();
                this.simulation.reset();
            }
        });
    }

    listenToClass(classCode) {
        const unsubClass = db.collection('classes').doc(classCode).onSnapshot(doc => {
            if (doc.exists) {
                window.userState.classData = doc.data();
                this.updateClassUI();
            }
        });
        window.userState.unsubscribe.push(unsubClass);
    }

    updateUI() {
        const user = window.userState.currentUser;
        const loggedIn = !!user;
        document.getElementById('user-info').classList.toggle('hidden', !loggedIn);
        document.getElementById('login-btn').classList.toggle('hidden', loggedIn);
        document.getElementById('signup-btn').classList.toggle('hidden', loggedIn);
        document.getElementById('logged-in-home').classList.toggle('hidden', !loggedIn);
        document.getElementById('logged-out-home').classList.toggle('hidden', loggedIn);

        if (loggedIn) {
            document.getElementById('user-display-name').textContent = user.nickname || user.username;
            const isAdmin = user.role === 'admin';
            document.getElementById('admin-menu').classList.toggle('hidden', !isAdmin);
            document.getElementById('admin-fab').classList.toggle('hidden', !isAdmin);
            if (isAdmin) this.loadAdminLists();
        }
    }

    updateClassUI() {
        const classData = window.userState.classData;
        if (!classData) return;

        // 뉴스 티커 업데이트
        const ticker = document.getElementById('news-ticker-container');
        const tickerText = document.getElementById('news-ticker');
        if (classData.news) {
            ticker.classList.remove('hidden');
            tickerText.textContent = `📢 학급 뉴스: ${classData.news}`;
        }

        // 국고 대시보드 업데이트
        const treasury = classData.treasury || 0;
        document.getElementById('class-treasury').textContent = `₩${treasury.toLocaleString()}`;
        document.getElementById('treasury-amount').textContent = treasury.toLocaleString();
    }

    async publishNews() {
        const news = document.getElementById('news-input').value;
        const code = window.userState.currentUser.classCode;
        await db.collection('classes').doc(code).update({ news });
        alert("뉴스가 게시되었습니다.");
    }

    async paySalaries() {
        if (!confirm("전체 학생에게 월급을 지급하고 세금(10%)을 징수하시겠습니까?")) return;
        const code = window.userState.currentUser.classCode;
        const jobs = window.userState.classData.jobs || {};
        
        const students = await db.collection('users').where('adminCode','==',code).where('role','==','student').get();
        const batch = db.batch();
        let totalTax = 0;

        students.forEach(doc => {
            const student = doc.data();
            const jobInfo = jobs[student.job] || { salary: 0 };
            const salary = jobInfo.salary;
            const tax = Math.floor(salary * 0.1);
            const netPay = salary - tax;
            
            totalTax += tax;
            batch.update(db.collection('users').doc(doc.id), { balance: (student.balance || 0) + netPay });
        });

        // 국고 적립
        batch.update(db.collection('classes').doc(code), { treasury: (window.userState.classData.treasury || 0) + totalTax });
        await batch.commit();
        alert(`월급 지급 완료! 총 ₩${totalTax.toLocaleString()}의 세금이 국고에 적립되었습니다.`);
    }

    async addJob() {
        const name = document.getElementById('job-name-input').value;
        const salary = parseInt(document.getElementById('job-salary-input').value);
        const code = window.userState.currentUser.classCode;
        const jobs = window.userState.classData.jobs || {};
        jobs[name] = { salary };
        await db.collection('classes').doc(code).update({ jobs });
        alert("직업이 추가되었습니다.");
    }

    // 관리자용 학생 목록 (직업 할당 포함)
    async loadAdminLists() {
        const code = window.userState.currentUser.classCode;
        const snap = await db.collection('users').where('adminCode','==',code).get();
        const listBody = document.getElementById('student-list-body');
        listBody.innerHTML = '';
        const jobOptions = Object.keys(window.userState.classData?.jobs || {}).map(j => `<option value="${j}">${j}</option>`).join('');

        snap.forEach(doc => {
            const d = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${d.username}</td><td><input type="text" value="${d.nickname||''}" onchange="window.updateStudentInfo('${doc.id}',{nickname:this.value})"><select onchange="window.updateStudentInfo('${doc.id}',{job:this.value})"><option value="">직업선택</option>${jobOptions}</select></td><td>${d.isAuthorized?'인증':'비인증'}</td><td><button onclick="window.toggleStudentAuth('${doc.id}',${!d.isAuthorized})">승인</button></td>`;
            listBody.appendChild(tr);
        });
    }

    async login() {
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        const e = u.includes('@') ? u : `${u.toLowerCase()}@student.com`;
        try { await auth.signInWithEmailAndPassword(e, p); document.getElementById('auth-modal').style.display='none'; } catch(err) { alert("실패"); }
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
                if (!classDoc.exists) return alert("코드 오류");
            } else username = adminEmail.split('@')[0];

            const finalEmail = role === 'admin' ? adminEmail : `${username}@student.com`;
            const cred = await auth.createUserWithEmailAndPassword(finalEmail, pass);
            
            let classCode = null;
            if (role === 'admin') {
                classCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                await db.collection('classes').doc(classCode).set({ adminUid: cred.user.uid, adminEmail: finalEmail, treasury: 0, jobs: {}, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }

            await db.collection('users').doc(cred.user.uid).set({
                username, role, email: finalEmail, balance: 1000, 
                classCode: role === 'admin' ? classCode : "", 
                adminCode: role === 'student' ? inputCode : "", 
                job: "", isAuthorized: false, creditScore: 500,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("완료!"); location.reload();
        } catch (err) { alert("실패"); }
    }

    logout() { auth.signOut().then(() => location.reload()); }
    openModal(mode) { document.getElementById('auth-modal').style.display='block'; }
    openMyInfo() { document.getElementById('my-info-modal').style.display='block'; 
        const u = window.userState.currentUser;
        document.getElementById('info-username').textContent = u.username;
        document.getElementById('info-role').textContent = u.role;
        document.getElementById('info-job').textContent = u.job || "무직";
        document.getElementById('info-class-code').textContent = u.classCode || u.adminCode;
    }
}

class EconomicSimulation {
    constructor() { this.user = null; }
    sync(user) { 
        this.user = user; 
        document.getElementById('current-cash').textContent = (user.balance||0).toLocaleString();
        document.getElementById('display-job').textContent = user.job || "없음";
        document.getElementById('display-credit').textContent = user.creditScore || 500;
        this.updateTotal();
    }
    updateTotal() { /* 주식/예금 합산 로직 */ }
    reset() { this.user = null; }
}

function setupNavigation() {
    document.querySelectorAll('.parent-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            link.parentElement.classList.toggle('open');
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

window.updateStudentInfo = async (uid, data) => { await db.collection('users').doc(uid).update(data); };
window.toggleStudentAuth = async (uid, s) => { await db.collection('users').doc(uid).update({isAuthorized:s}); };

window.addEventListener('load', () => {
    const sim = new EconomicSimulation();
    window.authManager = new AuthManager(sim);
    setupNavigation();
});