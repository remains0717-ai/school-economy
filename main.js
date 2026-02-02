class ResourcesPanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    background-color: #2b2b2b;
                    padding: 20px;
                    border-radius: 10px;
                    border: 1px solid #444;
                    box-shadow: 0 0 15px rgba(0, 255, 221, 0.1);
                }
                h2 {
                    color: #00ffdd;
                    border-bottom: 1px solid #444;
                    padding-bottom: 10px;
                    margin-top: 0;
                }
                p {
                    margin: 10px 0;
                }
                span {
                    color: #00ffdd;
                    font-weight: bold;
                }
            </style>
            <div>
                <h2>자원</h2>
                <p>현금: <span id="cash">1000</span></p>
                <p>상품: <span id="goods">0</span></p>
            </div>
        `;
    }

    update(cash, goods) {
        this.shadowRoot.getElementById('cash').textContent = cash;
        this.shadowRoot.getElementById('goods').textContent = goods;
    }
}

customElements.define('resources-panel', ResourcesPanel);

class ActionsPanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                button {
                    background-color: #00ffdd;
                    color: #1a1a1a;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    text-transform: uppercase;
                    transition: background-color 0.3s, box-shadow 0.3s;
                    margin-right: 10px;
                }
                button:hover {
                    background-color: #00b3a4;
                    box-shadow: 0 0 10px #00ffdd;
                }
            </style>
            <div>
                <h2>활동</h2>
                <button id="produce-btn">생산 (비용: 50)</button>
                <button id="trade-btn">판매</button>
            </div>
        `;
    }
}

customElements.define('actions-panel', ActionsPanel);

class MarketPanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    background-color: #2b2b2b;
                    padding: 20px;
                    border-radius: 10px;
                    border: 1px solid #444;
                    box-shadow: 0 0 15px rgba(0, 255, 221, 0.1);
                }
                h2 {
                    color: #00ffdd;
                    border-bottom: 1px solid #444;
                    padding-bottom: 10px;
                    margin-top: 0;
                }
                p {
                    margin: 10px 0;
                }
                span {
                    color: #00ffdd;
                    font-weight: bold;
                }
            </style>
            <div>
                <h2>시장</h2>
                <p>상품 가격: <span id="price">10</span></p>
            </div>
        `;
    }

    update(price) {
        this.shadowRoot.getElementById('price').textContent = price.toFixed(2);
    }
}

customElements.define('market-panel', MarketPanel);

class LogPanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    background-color: #2b2b2b;
                    padding: 20px;
                    border-radius: 10px;
                    border: 1px solid #444;
                    box-shadow: 0 0 15px rgba(0, 255, 221, 0.1);
                }
                h2 {
                    color: #00ffdd;
                    border-bottom: 1px solid #444;
                    padding-bottom: 10px;
                    margin-top: 0;
                }
                ul {
                    list-style-type: none;
                    padding: 0;
                    margin: 0;
                    max-height: 200px;
                    overflow-y: auto;
                }
                li {
                    padding: 5px 0;
                    border-bottom: 1px solid #444;
                }
            </style>
            <div>
                <h2>로그</h2>
                <ul id="log"></ul>
            </div>
        `;
        this.log = this.shadowRoot.getElementById('log');
    }

    addMessage(message) {
        const li = document.createElement('li');
        li.textContent = message;
        this.log.prepend(li);
    }
}

customElements.define('log-panel', LogPanel);

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

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

class AuthManager {
    constructor(simulation) {
        this.simulation = simulation;
        this.currentUser = null;

        this.modal = document.getElementById('auth-modal');
        this.loginContainer = document.getElementById('login-form-container');
        this.signupContainer = document.getElementById('signup-form-container');
        this.toggleLink = document.getElementById('toggle-to-signup');
        this.toggleText = document.getElementById('auth-toggle-text');

        this.initEvents();
        this.listenToAuthChanges();
    }

    initEvents() {
        document.getElementById('login-btn').addEventListener('click', () => this.openModal('login'));
        document.getElementById('signup-btn').addEventListener('click', () => this.openModal('signup'));
        document.querySelector('.close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // My Info events
        document.getElementById('user-display-name').addEventListener('click', () => this.openMyInfo());
        const closeMyInfoBtn = document.querySelector('.close-my-info');
        if (closeMyInfoBtn) {
            closeMyInfoBtn.addEventListener('click', () => {
                document.getElementById('my-info-modal').style.display = 'none';
            });
        }

        document.getElementById('signup-role').addEventListener('change', (e) => {
            const emailInput = document.getElementById('signup-email');
            const usernameContainer = document.getElementById('signup-username-container');
            const usernameInput = document.getElementById('signup-username');
            const classCodeContainer = document.getElementById('signup-class-code-container');
            const classCodeInput = document.getElementById('signup-class-code');

            if (e.target.value === 'admin') {
                emailInput.classList.remove('hidden');
                emailInput.required = true;
                usernameContainer.classList.add('hidden');
                usernameInput.required = false;
                classCodeContainer.classList.add('hidden');
                classCodeInput.required = false;
            } else {
                emailInput.classList.add('hidden');
                emailInput.required = false;
                usernameContainer.classList.remove('hidden');
                usernameInput.required = true;
                classCodeContainer.classList.remove('hidden');
                classCodeInput.required = true;
            }
        });

        this.toggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            const isLogin = this.signupContainer.classList.contains('hidden');
            this.switchMode(isLogin ? 'signup' : 'login');
        });

        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('signup-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.signup();
        });

        window.onclick = (event) => {
            if (event.target == this.modal) this.closeModal();
            const myInfoModal = document.getElementById('my-info-modal');
            if (event.target == myInfoModal) myInfoModal.style.display = 'none';
        };
    }

    openMyInfo() {
        if (!this.currentUser) return;
        
        const myInfoModal = document.getElementById('my-info-modal');
        document.getElementById('info-username').textContent = this.currentUser.username;
        document.getElementById('info-role').textContent = this.currentUser.role === 'admin' ? '관리자' : '학생';
        
        const adminSection = document.getElementById('info-admin-section');
        if (this.currentUser.role === 'admin') {
            adminSection.classList.remove('hidden');
            document.getElementById('info-email').textContent = auth.currentUser.email;
            document.getElementById('info-class-code').textContent = this.currentUser.classCode || '발급되지 않음';
        } else {
            adminSection.classList.add('hidden');
        }
        
        myInfoModal.style.display = 'block';
    }

    listenToAuthChanges() {
        auth.onAuthStateChanged(async (user) => {
            console.log("Auth State Changed. User:", user ? user.email : "Logged Out");
            if (user) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        console.log("User Data Found in Firestore:", userData);
                        this.currentUser = { 
                            uid: user.uid, 
                            username: userData.username, 
                            role: userData.role,
                            classCode: userData.classCode || null
                        };
                        this.simulation.loadUserData(user.uid);
                    } else {
                        console.error("Firestore에 사용자 문서가 없습니다! UID:", user.uid);
                        this.currentUser = null;
                    }
                } catch (error) {
                    console.error("사용자 데이터 로딩 오류:", error);
                    this.currentUser = null;
                }
            } else {
                this.currentUser = null;
                if (this.simulation) this.simulation.resetData();
            }
            this.updateUI();
        });
    }

    openModal(mode) {
        this.modal.style.display = 'block';
        this.switchMode(mode);
    }

    closeModal() {
        if (this.modal) this.modal.style.display = 'none';
        
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        if (loginForm) loginForm.reset();
        if (signupForm) signupForm.reset();

        const signupEmail = document.getElementById('signup-email');
        const signupUsernameContainer = document.getElementById('signup-username-container');
        const classCodeDisplay = document.getElementById('class-code-display');
        const classCodeContainer = document.getElementById('signup-class-code-container');

        if (signupEmail) signupEmail.classList.add('hidden');
        if (signupUsernameContainer) signupUsernameContainer.classList.remove('hidden');
        if (classCodeDisplay) classCodeDisplay.classList.add('hidden');
        if (classCodeContainer) classCodeContainer.classList.remove('hidden');
    }

    switchMode(mode) {
        if (mode === 'login') {
            this.loginContainer.classList.remove('hidden');
            this.signupContainer.classList.add('hidden');
            this.toggleText.innerHTML = `계정이 없으신가요? <a href="#" id="toggle-to-signup">회원가입</a>`;
        } else {
            this.loginContainer.classList.add('hidden');
            this.signupContainer.classList.remove('hidden');
            this.toggleText.innerHTML = `이미 계정이 있으신가요? <a href="#" id="toggle-to-login">로그인</a>`;
            
            document.getElementById('signup-class-code-container').classList.remove('hidden');
            document.getElementById('signup-username-container').classList.remove('hidden');
            document.getElementById('signup-email').classList.add('hidden');
            document.getElementById('signup-role').value = 'student';
        }
        
        const newToggle = mode === 'login' ? document.getElementById('toggle-to-signup') : document.getElementById('toggle-to-login');
        if (newToggle) {
            newToggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchMode(mode === 'login' ? 'signup' : 'login');
            });
        }
    }

    async login() {
        const username = document.getElementById('login-username').value.trim();
        const pass = document.getElementById('login-password').value;
        
        const email = (username.includes('@')) ? username : `${username.toLowerCase()}@school-economy.local`;

        try {
            await auth.signInWithEmailAndPassword(email, pass);
            this.closeModal();
            alert('로그인이 완료되었습니다. 환영합니다!');
        } catch (error) {
            console.error("Login Error Code:", error.code);
            let msg = '로그인에 실패했습니다.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    msg = '가입되지 않은 아이디입니다. 아이디를 확인하거나 회원가입을 해주세요.';
                    break;
                case 'auth/wrong-password':
                    msg = '비밀번호가 일치하지 않습니다.';
                    break;
                case 'auth/invalid-credential':
                    msg = '아이디가 존재하지 않거나 비밀번호가 틀렸습니다.\n(관리자 계정이라면 가입 시 입력한 이메일을 입력했는지 확인해주세요.)';
                    break;
                case 'auth/invalid-email':
                    msg = '아이디 또는 이메일 형식이 올바르지 않습니다.';
                    break;
                case 'auth/too-many-requests':
                    msg = '너무 많은 로그인 시도가 감지되었습니다. 잠시 후 다시 시도해주세요.';
                    break;
                default:
                    msg = '로그인 중 오류가 발생했습니다: ' + error.message;
            }
            alert(msg);
        }
    }

    async signup() {
        const role = document.getElementById('signup-role').value;
        const pass = document.getElementById('signup-password').value;
        const adminEmail = document.getElementById('signup-email').value.trim();
        let username = document.getElementById('signup-username').value.trim().toLowerCase();
        const studentClassCode = document.getElementById('signup-class-code').value.trim().toUpperCase();

        if (pass.length < 6) {
            alert('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }

        if (role === 'student' && !username) {
            alert('아이디를 입력해 주세요.');
            return;
        }

        // 학생 가입 시 학급 코드 검증 (classes 컬렉션에서 확인)
        if (role === 'student') {
            try {
                const classDoc = await db.collection('classes').doc(studentClassCode).get();
                if (!classDoc.exists) {
                    alert('유효하지 않은 학급 코드입니다. 관리자에게 확인해 주세요.');
                    return;
                }
            } catch (err) {
                alert('학급 코드 확인 중 오류가 발생했습니다: ' + err.message);
                return;
            }
        }

        // 관리자는 이메일 앞부분을 아이디로 자동 설정
        if (role === 'admin') {
            if (!adminEmail) {
                alert('이메일을 입력해 주세요.');
                return;
            }
            username = adminEmail.split('@')[0];
        }

        const email = role === 'admin' ? adminEmail : `${username}@school-economy.local`;

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
            const user = userCredential.user;
            
            let classCode = null;
            if (role === 'admin') {
                // 관리자는 새로운 학급 코드 생성 및 classes 컬렉션 등록
                classCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                await db.collection('classes').doc(classCode).set({
                    adminUid: user.uid,
                    adminEmail: email,
                    className: `${username} 선생님의 학급`,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // 사용자 정보 저장
            await db.collection('users').doc(user.uid).set({
                username: username,
                role: role,
                email: email,
                classCode: role === 'admin' ? classCode : studentClassCode,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await db.collection('playerData').doc(user.uid).set({
                cash: 1000,
                bankBalance: 0,
                goods: 0,
                portfolio: {}
            });

            if (role === 'student') {
                alert('회원가입이 완료되었습니다! 로그인해 주세요.');
            } else {
                alert(`회원가입 완료! 관리자 계정은 이메일로 로그인하세요.\n학급 코드: [${classCode}] (내 정보에서 확인 가능)`);
            }
            
            this.closeModal();
        } catch (error) {
            console.error("Signup Error:", error);
            let msg = '회원가입 실패: ' + error.message;
            if (error.code === 'auth/email-already-in-use') {
                msg = role === 'student' ? '이미 존재하는 아이디입니다.' : '이미 사용 중인 이메일입니다.';
            } else if (error.code === 'auth/invalid-email') {
                msg = '유효하지 않은 이메일 형식입니다.';
            } else if (error.code === 'auth/weak-password') {
                msg = '비밀번호가 너무 취약합니다.';
            }
            alert(msg);
        }
    }

    async logout() {
        try {
            await auth.signOut();
            alert('로그아웃 되었습니다.');
        } catch (error) {
            console.error('Logout Error:', error);
        }
    }

    updateUI() {
        console.log("updateUI 호출됨. 현재 사용자:", this.currentUser);
        try {
            const loginBtn = document.getElementById('login-btn');
            const signupBtn = document.getElementById('signup-btn');
            const userInfo = document.getElementById('user-info');
            const userDisplay = document.getElementById('user-display-name');
            const roleBadge = document.getElementById('user-role-badge');
            const simulationLink = document.getElementById('simulation-link');
            const adminMenu = document.getElementById('admin-menu');

            if (this.currentUser) {
                if (loginBtn) loginBtn.classList.add('hidden');
                if (signupBtn) signupBtn.classList.add('hidden');
                if (userInfo) userInfo.classList.remove('hidden');
                
                if (userDisplay) {
                    userDisplay.textContent = this.currentUser.username;
                    if (this.currentUser.role === 'admin' && this.currentUser.classCode) {
                        userDisplay.textContent += ` [코드: ${this.currentUser.classCode}]`;
                    }
                }

                if (roleBadge) {
                    roleBadge.textContent = this.currentUser.role === 'admin' ? '관리자' : '학생';
                    roleBadge.style.color = this.currentUser.role === 'admin' ? '#ff4d4d' : '#00ffdd';
                }
                
                if (this.currentUser.role === 'admin') {
                    if (simulationLink) simulationLink.classList.remove('hidden');
                    if (adminMenu) adminMenu.classList.remove('hidden');
                    const mgmtCode = document.getElementById('mgmt-class-code');
                    if (mgmtCode) mgmtCode.textContent = this.currentUser.classCode;
                    this.loadStudentList();
                } else {
                    if (simulationLink) simulationLink.classList.add('hidden');
                    if (adminMenu) adminMenu.classList.add('hidden');
                }
            } else {
                if (loginBtn) loginBtn.classList.remove('hidden');
                if (signupBtn) signupBtn.classList.remove('hidden');
                if (userInfo) userInfo.classList.add('hidden');
                if (simulationLink) simulationLink.classList.add('hidden');
                if (adminMenu) adminMenu.classList.add('hidden');
            }
        } catch (err) {
            console.error("UI 업데이트 중 에러 발생:", err);
        }
    }

    async loadStudentList() {
        if (!this.currentUser || this.currentUser.role !== 'admin') return;

        const tbody = document.getElementById('student-list-body');
        const snapshot = await db.collection('users')
            .where('role', '==', 'student')
            .where('classCode', '==', this.currentUser.classCode)
            .get();

        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.username}</td>
                <td>${data.createdAt ? data.createdAt.toDate().toLocaleDateString() : '-'}</td>
                <td>
                    <button class="auth-btn" style="font-size: 0.8em; padding: 5px 10px;" onclick="window.deleteStudentAccount('${doc.id}', '${data.username}')">계정 삭제</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar a');
    const views = document.querySelectorAll('.view');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.id === 'securities-link') return; // Don't prevent default for parents if needed, but here we use IDs
            
            e.preventDefault();

            // Remove active class from current active link and view
            document.querySelector('.sidebar a.active')?.classList.remove('active');
            document.querySelector('.view.active')?.classList.remove('active');

            // Add active class to clicked link
            link.classList.add('active');

            // Determine which view to show
            const targetViewId = link.id.replace('-link', '-view');
            const targetView = document.getElementById(targetViewId);

            if (targetView) {
                targetView.classList.add('active');
            }
        });
    });
}

class EconomicSimulation {
    constructor() {
        this.uid = null;
        this.cash = 0;
        this.goods = 0;
        this.bankBalance = 0;
        this.portfolio = {};
        
        this.price = 10;
        this.productionCost = 50;
        this.interestRate = 0.025;
        this.currentStockSymbol = null;
        this.currentStockPrice = 0;

        this.resourcesPanel = document.querySelector('resources-panel');
        this.actionsPanel = document.querySelector('actions-panel');
        this.marketPanel = document.querySelector('market-panel');
        this.logPanel = document.querySelector('log-panel');

        this.initEvents();
        this.startIntervals();
    }

    initEvents() {
        this.actionsPanel.shadowRoot.getElementById('produce-btn').addEventListener('click', () => this.produce());
        this.actionsPanel.shadowRoot.getElementById('trade-btn').addEventListener('click', () => this.sell());

        document.getElementById('deposit-btn').addEventListener('click', () => this.deposit());
        document.getElementById('withdraw-btn').addEventListener('click', () => this.withdraw());

        document.getElementById('load-stock-btn').addEventListener('click', () => this.loadStock());
        document.getElementById('buy-stock-btn').addEventListener('click', () => this.buyStock());
        document.getElementById('sell-stock-btn').addEventListener('click', () => this.sellStock());
    }

    startIntervals() {
        setInterval(() => this.updateMarket(), 2000);
        setInterval(() => this.updateSimulationStockPrices(), 5000);
        setInterval(() => this.calculateInterest(), 10000);
    }

    async loadUserData(uid) {
        this.uid = uid;
        const doc = await db.collection('playerData').doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            this.cash = data.cash || 1000;
            this.goods = data.goods || 0;
            this.bankBalance = data.bankBalance || 0;
            this.portfolio = data.portfolio || {};
            this.updateUI();
        } else {
            // New user initialization
            this.resetData();
            await this.saveUserData();
        }
    }

    async saveUserData() {
        if (!this.uid) return;
        await db.collection('playerData').doc(this.uid).set({
            cash: this.cash,
            goods: this.goods,
            bankBalance: this.bankBalance,
            portfolio: this.portfolio,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    resetData() {
        this.uid = null;
        this.cash = 0;
        this.goods = 0;
        this.bankBalance = 0;
        this.portfolio = {};
        this.updateUI();
    }

    // Bank Logic
    async deposit() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        const amount = parseInt(document.getElementById('bank-amount').value);
        if (isNaN(amount) || amount <= 0) return;

        if (this.cash >= amount) {
            this.cash -= amount;
            this.bankBalance += amount;
            this.logPanel.addMessage(`은행에 ₩${amount.toLocaleString()}을 예금했습니다.`);
            document.getElementById('bank-amount').value = '';
            this.updateUI();
            await this.saveUserData();
        } else {
            this.logPanel.addMessage('보유 현금이 부족하여 예금할 수 없습니다.');
        }
    }

    async withdraw() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        const amount = parseInt(document.getElementById('bank-amount').value);
        if (isNaN(amount) || amount <= 0) return;

        if (this.bankBalance >= amount) {
            this.bankBalance -= amount;
            this.cash += amount;
            this.logPanel.addMessage(`은행에서 ₩${amount.toLocaleString()}을 출금했습니다.`);
            document.getElementById('bank-amount').value = '';
            this.updateUI();
            await this.saveUserData();
        } else {
            this.logPanel.addMessage('예금 잔액이 부족하여 출금할 수 없습니다.');
        }
    }

    async calculateInterest() {
        if (this.uid && this.bankBalance > 0) {
            const interest = Math.floor(this.bankBalance * this.interestRate);
            if (interest > 0) {
                this.bankBalance += interest;
                this.logPanel.addMessage(`은행 이자가 ₩${interest.toLocaleString()} 발생했습니다.`);
                this.updateUI();
                await this.saveUserData();
            }
        }
    }

    async produce() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        if (this.cash >= this.productionCost) {
            this.cash -= this.productionCost;
            this.goods++;
            this.logPanel.addMessage(`상품 1개를 ₩${this.productionCost}에 생산했습니다.`);
            this.updateUI();
            await this.saveUserData();
        } else {
            this.logPanel.addMessage('생산에 필요한 현금이 부족합니다.');
        }
    }

    async sell() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        if (this.goods > 0) {
            this.cash += this.price;
            this.goods--;
            this.logPanel.addMessage(`상품 1개를 ₩${this.price.toFixed(2)}에 판매했습니다.`);
            this.updateUI();
            await this.saveUserData();
        } else {
            this.logPanel.addMessage('판매할 상품이 없습니다.');
        }
    }

    updateMarket() {
        const change = (Math.random() - 0.5) * 2;
        this.price = Math.max(1, this.price + change);
        this.updateUI();
    }

    // Stock Market Logic
    loadStock() {
        const symbol = document.getElementById('stock-symbol').value.toUpperCase().trim();
        if (!symbol) return;

        this.currentStockSymbol = symbol;
        const container = document.getElementById('stock-chart-container');
        container.innerHTML = ''; 

        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => {
            if (typeof TradingView !== 'undefined') {
                new TradingView.widget({
                    "width": "100%",
                    "height": "100%",
                    "symbol": symbol,
                    "interval": "D",
                    "timezone": "Etc/UTC",
                    "theme": "dark",
                    "style": "1",
                    "locale": "kr",
                    "toolbar_bg": "#f1f3f6",
                    "enable_publishing": false,
                    "allow_symbol_change": true,
                    "container_id": "stock-chart-container"
                });
            }
        };
        document.head.appendChild(script);

        document.getElementById('display-stock-name').textContent = symbol;
        this.currentStockPrice = 100 + Math.random() * 900; 
        this.logPanel.addMessage(`${symbol} 차트를 불러왔습니다.`);
        this.updateUI();
    }

    updateSimulationStockPrices() {
        if (this.currentStockSymbol) {
            const volatility = 0.02;
            this.currentStockPrice *= (1 + (Math.random() - 0.5) * volatility);
            this.updateUI();
        }
    }

    async buyStock() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        const amount = parseInt(document.getElementById('trade-amount').value);
        if (!this.currentStockSymbol || isNaN(amount) || amount <= 0) return;

        const totalCost = this.currentStockPrice * amount;
        if (this.cash >= totalCost) {
            this.cash -= totalCost;
            
            if (!this.portfolio[this.currentStockSymbol]) {
                this.portfolio[this.currentStockSymbol] = { amount: 0, avgPrice: 0 };
            }
            
            const p = this.portfolio[this.currentStockSymbol];
            const newTotalAmount = p.amount + amount;
            const newAvgPrice = (p.amount * p.avgPrice + totalCost) / newTotalAmount;
            
            p.amount = newTotalAmount;
            p.avgPrice = newAvgPrice;
            
            this.logPanel.addMessage(`${this.currentStockSymbol} ${amount}주를 ₩${this.currentStockPrice.toFixed(2)}에 매수했습니다.`);
            this.updateUI();
            await this.saveUserData();
        } else {
            this.logPanel.addMessage('주식 매수에 필요한 현금이 부족합니다.');
        }
    }

    async sellStock() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        const amount = parseInt(document.getElementById('trade-amount').value);
        if (!this.currentStockSymbol || !this.portfolio[this.currentStockSymbol] || isNaN(amount) || amount <= 0) return;

        const p = this.portfolio[this.currentStockSymbol];
        if (p.amount >= amount) {
            const gain = this.currentStockPrice * amount;
            this.cash += gain;
            p.amount -= amount;
            
            if (p.amount === 0) delete this.portfolio[this.currentStockSymbol];
            
            this.logPanel.addMessage(`${this.currentStockSymbol} ${amount}주를 ₩${this.currentStockPrice.toFixed(2)}에 매도했습니다.`);
            this.updateUI();
            await this.saveUserData();
        } else {
            this.logPanel.addMessage('보유 수량이 부족하여 매도할 수 없습니다.');
        }
    }

    updateUI() {
        if (this.resourcesPanel) this.resourcesPanel.update(Math.floor(this.cash), this.goods);
        if (this.marketPanel) this.marketPanel.update(this.price);

        document.getElementById('current-cash').textContent = Math.floor(this.cash).toLocaleString();
        document.getElementById('current-bank-balance').textContent = Math.floor(this.bankBalance).toLocaleString();
        document.getElementById('current-goods').textContent = this.goods;
        
        let stockValue = 0;
        for (const sym in this.portfolio) {
            stockValue += this.portfolio[sym].amount * (sym === this.currentStockSymbol ? this.currentStockPrice : this.portfolio[sym].avgPrice);
        }
        
        document.getElementById('current-stock-value').textContent = Math.floor(stockValue).toLocaleString();
        const totalAssets = this.cash + this.bankBalance + stockValue;
        document.getElementById('total-assets').textContent = Math.floor(totalAssets).toLocaleString();

        const bankBalanceEl = document.getElementById('bank-balance-amount');
        if (bankBalanceEl) bankBalanceEl.textContent = Math.floor(this.bankBalance).toLocaleString();

        if (this.currentStockSymbol) {
            document.getElementById('current-stock-price').textContent = this.currentStockPrice.toFixed(2);
        }

        const tbody = document.getElementById('portfolio-body');
        if (tbody) {
            tbody.innerHTML = '';
            for (const sym in this.portfolio) {
                const p = this.portfolio[sym];
                const curPrice = (sym === this.currentStockSymbol ? this.currentStockPrice : p.avgPrice);
                const roi = ((curPrice - p.avgPrice) / p.avgPrice * 100).toFixed(2);
                const evalVal = p.amount * curPrice;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${sym}</td>
                    <td>${p.amount}</td>
                    <td>₩${p.avgPrice.toFixed(2)}</td>
                    <td>₩${curPrice.toFixed(2)}</td>
                    <td class="${roi >= 0 ? 'up-trend' : 'down-trend'}">${roi}%</td>
                    <td>₩${Math.floor(evalVal).toLocaleString()}</td>
                `;
                tbody.appendChild(tr);
            }
        }
    }
}

window.deleteStudentAccount = async (uid, username) => {
    if (confirm(`[${username}] 학생의 계정을 삭제하시겠습니까? 학생이 다시 가입해야 합니다.`)) {
        try {
            // Note: Cloud Firestore deletion. Actual Auth user deletion requires Admin SDK or Cloud Functions.
            // For this simulation, we'll mark as deleted or remove from Firestore.
            await db.collection('users').doc(uid).delete();
            await db.collection('playerData').doc(uid).delete();
            alert('계정 정보가 삭제되었습니다.');
            location.reload(); // Refresh to update list
        } catch (error) {
            alert('삭제 실패: ' + error.message);
        }
    }
};

window.addEventListener('load', () => {
    setupNavigation();
    const simulation = new EconomicSimulation();
    new AuthManager(simulation);
});