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

// Global Error Logging
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error("Global Error: " + msg + " at " + url + ":" + lineNo);
    return false;
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
        const loginBtn = document.getElementById('login-btn');
        const signupBtn = document.getElementById('signup-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const closeModalBtn = document.querySelector('.close-modal');
        const userDisplayName = document.getElementById('user-display-name');

        if (loginBtn) loginBtn.addEventListener('click', () => this.openModal('login'));
        if (signupBtn) signupBtn.addEventListener('click', () => this.openModal('signup'));
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.closeModal());
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());
        if (userDisplayName) userDisplayName.addEventListener('click', () => this.openMyInfo());

        const closeMyInfoBtn = document.querySelector('.close-my-info');
        if (closeMyInfoBtn) {
            closeMyInfoBtn.addEventListener('click', () => {
                const modal = document.getElementById('my-info-modal');
                if (modal) modal.style.display = 'none';
            });
        }

        const signupRole = document.getElementById('signup-role');
        if (signupRole) {
            signupRole.addEventListener('change', (e) => {
                const emailInput = document.getElementById('signup-email');
                const usernameContainer = document.getElementById('signup-username-container');
                const classCodeContainer = document.getElementById('signup-class-code-container');

                if (e.target.value === 'admin') {
                    if (emailInput) { emailInput.classList.remove('hidden'); emailInput.required = true; }
                    if (usernameContainer) usernameContainer.classList.add('hidden');
                    if (classCodeContainer) classCodeContainer.classList.add('hidden');
                } else {
                    if (emailInput) { emailInput.classList.add('hidden'); emailInput.required = false; }
                    if (usernameContainer) usernameContainer.classList.remove('hidden');
                    if (classCodeContainer) classCodeContainer.classList.remove('hidden');
                }
            });
        }

        if (this.toggleLink) {
            this.toggleLink.addEventListener('click', (e) => {
                e.preventDefault();
                const isLogin = this.signupContainer.classList.contains('hidden');
                this.switchMode(isLogin ? 'signup' : 'login');
            });
        }

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }

        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.signup();
            });
        }

        window.onclick = (event) => {
            if (event.target == this.modal) this.closeModal();
            const myInfoModal = document.getElementById('my-info-modal');
            if (event.target == myInfoModal) myInfoModal.style.display = 'none';
        };
    }

    openMyInfo() {
        if (!this.currentUser) return;
        
        const myInfoModal = document.getElementById('my-info-modal');
        if (!myInfoModal) return;

        document.getElementById('info-username').textContent = this.currentUser.username;
        document.getElementById('info-role').textContent = this.currentUser.role === 'admin' ? '관리자' : '학생';
        
        const adminSection = document.getElementById('info-admin-section');
        if (this.currentUser.role === 'admin') {
            if (adminSection) adminSection.classList.remove('hidden');
            document.getElementById('info-email').textContent = auth.currentUser ? auth.currentUser.email : "";
            document.getElementById('info-class-code').textContent = this.currentUser.classCode || '발급되지 않음';
        } else {
            if (adminSection) adminSection.classList.add('hidden');
        }
        
        myInfoModal.style.display = 'block';
    }

    listenToAuthChanges() {
        auth.onAuthStateChanged(async (user) => {
            console.log("Auth Status Changed:", user ? user.email : "No User");
            if (user) {
                this.currentUser = { uid: user.uid, username: user.email.split('@')[0], role: 'loading' };
                this.updateUI();

                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        this.currentUser = { 
                            uid: user.uid, 
                            username: userData.username, 
                            role: userData.role,
                            classCode: userData.classCode || null
                        };
                        if (this.simulation) this.simulation.loadUserData(user.uid);
                    }
                } catch (error) {
                    console.error("Firestore loading error:", error);
                }
            } else {
                this.currentUser = null;
                if (this.simulation) this.simulation.resetData();
            }
            this.updateUI();
        });
    }

    closeModal() {
        if (this.modal) this.modal.style.display = 'none';
        
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        if (loginForm) loginForm.reset();
        if (signupForm) signupForm.reset();

        const signupEmail = document.getElementById('signup-email');
        const signupUsernameContainer = document.getElementById('signup-username-container');
        const classCodeContainer = document.getElementById('signup-class-code-container');

        if (signupEmail) signupEmail.classList.add('hidden');
        if (signupUsernameContainer) signupUsernameContainer.classList.remove('hidden');
        if (classCodeContainer) classCodeContainer.classList.remove('hidden');
    }

    openModal(mode) {
        if (this.modal) this.modal.style.display = 'block';
        this.switchMode(mode);
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
            
            const cc = document.getElementById('signup-class-code-container');
            const un = document.getElementById('signup-username-container');
            const em = document.getElementById('signup-email');
            if (cc) cc.classList.remove('hidden');
            if (un) un.classList.remove('hidden');
            if (em) em.classList.add('hidden');
            const roleSelect = document.getElementById('signup-role');
            if (roleSelect) roleSelect.value = 'student';
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
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value.trim();
        const pass = passwordInput.value;
        const email = (username.includes('@')) ? username : `${username.toLowerCase()}@school-economy.local`;

        try {
            await auth.signInWithEmailAndPassword(email, pass);
            this.closeModal();
            window.location.reload();
        } catch (error) {
            alert('아이디 또는 비밀번호가 틀렸습니다.');
        }
    }

    async signup() {
        const roleSelect = document.getElementById('signup-role');
        const passInput = document.getElementById('signup-password');
        const emailInput = document.getElementById('signup-email');
        const usernameInput = document.getElementById('signup-username');
        const classCodeInput = document.getElementById('signup-class-code');

        const role = roleSelect ? roleSelect.value : 'student';
        const pass = passInput ? passInput.value : '';
        const adminEmail = emailInput ? emailInput.value.trim() : '';
        let username = usernameInput ? usernameInput.value.trim().toLowerCase() : '';
        const studentClassCode = classCodeInput ? classCodeInput.value.trim().toUpperCase() : '';

        if (pass.length < 6) {
            alert('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }

        if (role === 'student' && !username) {
            alert('아이디를 입력해 주세요.');
            return;
        }

        if (role === 'student') {
            try {
                const classDoc = await db.collection('classes').doc(studentClassCode).get();
                if (!classDoc.exists) {
                    alert('유효하지 않은 학급 코드입니다. 관리자에게 확인해 주세요.');
                    return;
                }
            } catch (err) {
                alert('학급 코드 확인 중 오류가 발생했습니다.');
                return;
            }
        }

        if (role === 'admin') {
            if (!adminEmail) { alert('이메일을 입력해 주세요.'); return; }
            username = adminEmail.split('@')[0];
        }

        const email = role === 'admin' ? adminEmail : `${username}@school-economy.local`;

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
            const user = userCredential.user;
            
            let classCode = null;
            if (role === 'admin') {
                classCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                await db.collection('classes').doc(classCode).set({
                    adminUid: user.uid,
                    adminEmail: email,
                    className: `${username} 선생님의 학급`,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

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
                alert(`회원가입 완료! 학급 코드: [${classCode}]`);
            }
            this.closeModal();
            window.location.reload();
        } catch (error) {
            let msg = '회원가입 실패: ' + error.message;
            if (error.code === 'auth/email-already-in-use') msg = '이미 사용 중인 아이디 또는 이메일입니다.';
            alert(msg);
        }
    }

    async logout() {
        try {
            await auth.signOut();
            window.location.reload();
        } catch (error) {
            console.error('Logout Error:', error);
        }
    }

    updateUI() {
        const els = {
            loginBtn: document.getElementById('login-btn'),
            signupBtn: document.getElementById('signup-btn'),
            userInfo: document.getElementById('user-info'),
            userDisplay: document.getElementById('user-display-name'),
            roleBadge: document.getElementById('user-role-badge'),
            simulationLink: document.getElementById('simulation-link'),
            adminMenu: document.getElementById('admin-menu')
        };

        if (this.currentUser) {
            if (els.loginBtn) els.loginBtn.classList.add('hidden');
            if (els.signupBtn) els.signupBtn.classList.add('hidden');
            if (els.userInfo) els.userInfo.classList.remove('hidden');
            if (els.userDisplay) {
                els.userDisplay.textContent = this.currentUser.username;
                if (this.currentUser.classCode) els.userDisplay.textContent += ` [${this.currentUser.classCode}]`;
            }
            if (els.roleBadge) {
                els.roleBadge.textContent = this.currentUser.role === 'admin' ? '관리자' : (this.currentUser.role === 'loading' ? '로딩중...' : '학생');
                els.roleBadge.style.color = this.currentUser.role === 'admin' ? '#ff4d4d' : '#00ffdd';
            }
            if (this.currentUser.role === 'admin') {
                if (els.simulationLink) els.simulationLink.classList.remove('hidden');
                if (els.adminMenu) els.adminMenu.classList.remove('hidden');
                const mgmtCode = document.getElementById('mgmt-class-code');
                if (mgmtCode) mgmtCode.textContent = this.currentUser.classCode;
                this.loadStudentList();
            } else {
                if (els.simulationLink) els.simulationLink.classList.add('hidden');
                if (els.adminMenu) els.adminMenu.classList.add('hidden');
            }
        } else {
            if (els.loginBtn) els.loginBtn.classList.remove('hidden');
            if (els.signupBtn) els.signupBtn.classList.remove('hidden');
            if (els.userInfo) els.userInfo.classList.add('hidden');
            if (els.simulationLink) els.simulationLink.classList.add('hidden');
            if (els.adminMenu) els.adminMenu.classList.add('hidden');
        }
    }

    async loadStudentList() {
        if (!this.currentUser || this.currentUser.role !== 'admin') return;
        const tbody = document.getElementById('student-list-body');
        if (!tbody) return;
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
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.id === 'securities-link') return;
            e.preventDefault();
            document.querySelector('.sidebar a.active')?.classList.remove('active');
            document.querySelector('.view.active')?.classList.remove('active');
            link.classList.add('active');
            const targetViewId = link.id.replace('-link', '-view');
            const targetView = document.getElementById(targetViewId);
            if (targetView) targetView.classList.add('active');
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
        this.interestRate = 0.025;
        this.currentStockSymbol = null;
        this.currentStockPrice = 0;
        this.initEvents();
        setInterval(() => this.updateMarket(), 2000);
        setInterval(() => this.updateSimulationStockPrices(), 5000);
        setInterval(() => this.calculateInterest(), 10000);
    }

    initEvents() {
        const prodBtn = document.querySelector('actions-panel')?.shadowRoot.getElementById('produce-btn');
        const sellBtn = document.querySelector('actions-panel')?.shadowRoot.getElementById('trade-btn');
        if (prodBtn) prodBtn.addEventListener('click', () => this.produce());
        if (sellBtn) sellBtn.addEventListener('click', () => this.sell());
        document.getElementById('deposit-btn')?.addEventListener('click', () => this.deposit());
        document.getElementById('withdraw-btn')?.addEventListener('click', () => this.withdraw());
        document.getElementById('load-stock-btn')?.addEventListener('click', () => this.loadStock());
        document.getElementById('buy-stock-btn')?.addEventListener('click', () => this.buyStock());
        document.getElementById('sell-stock-btn')?.addEventListener('click', () => this.sellStock());
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
            this.resetData();
            await this.saveUserData();
        }
    }

    async saveUserData() {
        if (!this.uid) return;
        await db.collection('playerData').doc(this.uid).set({
            cash: this.cash, goods: this.goods, bankBalance: this.bankBalance,
            portfolio: this.portfolio, lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    resetData() {
        this.uid = null; this.cash = 0; this.goods = 0; this.bankBalance = 0; this.portfolio = {};
        this.updateUI();
    }

    async deposit() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        const amount = parseInt(document.getElementById('bank-amount').value);
        if (isNaN(amount) || amount <= 0) return;
        if (this.cash >= amount) {
            this.cash -= amount; this.bankBalance += amount;
            this.updateUI(); await this.saveUserData();
        }
    }

    async withdraw() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        const amount = parseInt(document.getElementById('bank-amount').value);
        if (isNaN(amount) || amount <= 0) return;
        if (this.bankBalance >= amount) {
            this.bankBalance -= amount; this.cash += amount;
            this.updateUI(); await this.saveUserData();
        }
    }

    async calculateInterest() {
        if (this.uid && this.bankBalance > 0) {
            const interest = Math.floor(this.bankBalance * this.interestRate);
            if (interest > 0) {
                this.bankBalance += interest; this.updateUI(); await this.saveUserData();
            }
        }
    }

    async produce() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        if (this.cash >= 50) {
            this.cash -= 50; this.goods++; this.updateUI(); await this.saveUserData();
        }
    }

    async sell() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        if (this.goods > 0) {
            this.cash += this.price; this.goods--; this.updateUI(); await this.saveUserData();
        }
    }

    updateMarket() {
        this.price = Math.max(1, this.price + (Math.random() - 0.5) * 2);
        this.updateUI();
    }

    loadStock() {
        const symbol = document.getElementById('stock-symbol').value.toUpperCase().trim();
        if (!symbol) return;
        this.currentStockSymbol = symbol;
        const container = document.getElementById('stock-chart-container');
        if (container) container.innerHTML = ''; 
        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => {
            if (typeof TradingView !== 'undefined') {
                new TradingView.widget({
                    "width": "100%", "height": "100%", "symbol": symbol, "interval": "D",
                    "timezone": "Etc/UTC", "theme": "dark", "style": "1", "locale": "kr",
                    "toolbar_bg": "#f1f3f6", "enable_publishing": false, "allow_symbol_change": true,
                    "container_id": "stock-chart-container"
                });
            }
        };
        document.head.appendChild(script);
        document.getElementById('display-stock-name').textContent = symbol;
        this.currentStockPrice = 100 + Math.random() * 900; 
        this.updateUI();
    }

    updateSimulationStockPrices() {
        if (this.currentStockSymbol) {
            this.currentStockPrice *= (1 + (Math.random() - 0.5) * 0.02);
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
            if (!this.portfolio[this.currentStockSymbol]) this.portfolio[this.currentStockSymbol] = { amount: 0, avgPrice: 0 };
            const p = this.portfolio[this.currentStockSymbol];
            p.avgPrice = (p.amount * p.avgPrice + totalCost) / (p.amount + amount);
            p.amount += amount;
            this.updateUI(); await this.saveUserData();
        }
    }

    async sellStock() {
        if (!this.uid) return alert('로그인이 필요합니다.');
        const amount = parseInt(document.getElementById('trade-amount').value);
        if (!this.currentStockSymbol || !this.portfolio[this.currentStockSymbol] || isNaN(amount) || amount <= 0) return;
        const p = this.portfolio[this.currentStockSymbol];
        if (p.amount >= amount) {
            this.cash += this.currentStockPrice * amount;
            p.amount -= amount;
            if (p.amount === 0) delete this.portfolio[this.currentStockSymbol];
            this.updateUI(); await this.saveUserData();
        }
    }

    updateUI() {
        document.querySelector('resources-panel')?.update(Math.floor(this.cash), this.goods);
        document.querySelector('market-panel')?.update(this.price);
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('current-cash', Math.floor(this.cash).toLocaleString());
        setEl('current-bank-balance', Math.floor(this.bankBalance).toLocaleString());
        setEl('current-goods', this.goods);
        let stockValue = 0;
        for (const sym in this.portfolio) {
            stockValue += this.portfolio[sym].amount * (sym === this.currentStockSymbol ? this.currentStockPrice : this.portfolio[sym].avgPrice);
        }
        setEl('current-stock-value', Math.floor(stockValue).toLocaleString());
        setEl('total-assets', Math.floor(this.cash + this.bankBalance + stockValue).toLocaleString());
        setEl('bank-balance-amount', Math.floor(this.bankBalance).toLocaleString());
        if (this.currentStockSymbol) setEl('current-stock-price', this.currentStockPrice.toFixed(2));
        const tbody = document.getElementById('portfolio-body');
        if (tbody) {
            tbody.innerHTML = '';
            for (const sym in this.portfolio) {
                const p = this.portfolio[sym];
                const curPrice = (sym === this.currentStockSymbol ? this.currentStockPrice : p.avgPrice);
                const roi = ((curPrice - p.avgPrice) / p.avgPrice * 100).toFixed(2);
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${sym}</td><td>${p.amount}</td><td>₩${p.avgPrice.toFixed(2)}</td><td>₩${curPrice.toFixed(2)}</td><td class="${roi >= 0 ? 'up-trend' : 'down-trend'}">${roi}%</td><td>₩${Math.floor(p.amount * curPrice).toLocaleString()}</td>`;
                tbody.appendChild(tr);
            }
        }
    }
}

window.deleteStudentAccount = async (uid, username) => {
    if (confirm(`[${username}] 학생의 계정을 삭제하시겠습니까?`)) {
        try {
            await db.collection('users').doc(uid).delete();
            await db.collection('playerData').doc(uid).delete();
            alert('계정 정보가 삭제되었습니다.');
            location.reload();
        } catch (error) { alert('삭제 실패: ' + error.message); }
    }
};

window.addEventListener('load', () => {
    setupNavigation();
    const simulation = new EconomicSimulation();
    new AuthManager(simulation);
});