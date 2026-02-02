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
                const usernameInput = document.getElementById('signup-username');
                const classCodeInput = document.getElementById('signup-class-code');

                if (e.target.value === 'admin') {
                    if (emailInput) { emailInput.classList.remove('hidden'); emailInput.required = true; }
                    if (usernameContainer) usernameContainer.classList.add('hidden');
                    if (usernameInput) usernameInput.required = false;
                    if (classCodeContainer) classCodeContainer.classList.add('hidden');
                    if (classCodeInput) classCodeInput.required = false;
                } else {
                    if (emailInput) { emailInput.classList.add('hidden'); emailInput.required = false; }
                    if (usernameContainer) usernameContainer.classList.remove('hidden');
                    if (usernameInput) usernameInput.required = true;
                    if (classCodeContainer) classCodeContainer.classList.remove('hidden');
                    if (classCodeInput) classCodeInput.required = true;
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

        const infoUsername = document.getElementById('info-username');
        const infoRole = document.getElementById('info-role');
        const infoEmailRow = document.getElementById('info-email-row');
        const infoEmail = document.getElementById('info-email');
        const infoClassCode = document.getElementById('info-class-code');

        if (infoUsername) infoUsername.textContent = this.currentUser.username;
        if (infoRole) infoRole.textContent = this.currentUser.role === 'admin' ? '관리자' : (this.currentUser.role === 'loading' ? '로딩 중...' : '학생');
        
        if (this.currentUser.role === 'admin') {
            if (infoEmailRow) infoEmailRow.classList.remove('hidden');
            if (infoEmail) infoEmail.textContent = auth.currentUser ? auth.currentUser.email : "";
        } else {
            if (infoEmailRow) infoEmailRow.classList.add('hidden');
        }
        
        if (infoClassCode) {
            infoClassCode.textContent = this.currentUser.classCode || '소속 없음';
        }
        
        myInfoModal.style.display = 'block';
    }

    listenToAuthChanges() {
        auth.onAuthStateChanged(async (user) => {
            console.log("Auth Status Changed:", user ? user.email : "No User");
            if (user) {
                this.currentUser = { uid: user.uid, username: user.email.split('@')[0], role: 'loading', isAuthorized: false };
                this.updateUI();

                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        this.currentUser = { 
                            uid: user.uid, 
                            username: userData.username || user.email.split('@')[0], 
                            role: userData.role || 'student',
                            classCode: userData.classCode || null,
                            adminCode: userData.adminCode || null,
                            nickname: userData.nickname || "",
                            isAuthorized: userData.isAuthorized || false 
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

    updateUI() {
        const els = {
            loginBtn: document.getElementById('login-btn'),
            signupBtn: document.getElementById('signup-btn'),
            userInfo: document.getElementById('user-info'),
            userDisplay: document.getElementById('user-display-name'),
            roleBadge: document.getElementById('user-role-badge'),
            adminMenu: document.getElementById('admin-menu'),
            adminBankMgmt: document.getElementById('admin-bank-mgmt'),
            sidebarLinks: document.querySelectorAll('.sidebar li:not(#admin-menu) a:not(#home-link)')
        };

        if (this.currentUser) {
            if (els.loginBtn) els.loginBtn.classList.add('hidden');
            if (els.signupBtn) els.signupBtn.classList.add('hidden');
            if (els.userInfo) els.userInfo.classList.remove('hidden');
            
            const nameToDisplay = this.currentUser.nickname || this.currentUser.username;
            if (els.userDisplay) {
                els.userDisplay.textContent = nameToDisplay;
                const code = this.currentUser.classCode || this.currentUser.adminCode;
                if (code) els.userDisplay.textContent += ` [${code}]`;
            }

            if (els.roleBadge) {
                let statusText = this.currentUser.role === 'admin' ? '관리자' : '학생';
                if (this.currentUser.role === 'student' && !this.currentUser.isAuthorized) {
                    statusText = '비인증 학생';
                    els.roleBadge.style.color = '#ff9800';
                } else {
                    els.roleBadge.style.color = this.currentUser.role === 'admin' ? '#ff4d4d' : '#00ffdd';
                }
                els.roleBadge.textContent = statusText;
            }

            // 권한 제한: 비인증 학생 접근 차단
            const isRestricted = this.currentUser.role === 'student' && !this.currentUser.isAuthorized;
            els.sidebarLinks.forEach(link => {
                link.style.opacity = isRestricted ? '0.3' : '1';
                link.style.pointerEvents = isRestricted ? 'none' : 'auto';
            });
            
            if (this.currentUser.role === 'admin') {
                if (els.adminMenu) els.adminMenu.classList.remove('hidden');
                if (els.adminBankMgmt) els.adminBankMgmt.classList.remove('hidden');
                const mgmtCode = document.getElementById('mgmt-class-code');
                if (mgmtCode) mgmtCode.textContent = this.currentUser.classCode;
                this.loadStudentList();
                this.loadStudentAssets();
                if (this.simulation) this.simulation.loadClassLogs();
            } else {
                if (els.adminMenu) els.adminMenu.classList.add('hidden');
                if (els.adminBankMgmt) els.adminBankMgmt.classList.add('hidden');
            }
        } else {
            if (els.loginBtn) els.loginBtn.classList.remove('hidden');
            if (els.signupBtn) els.signupBtn.classList.remove('hidden');
            if (els.userInfo) els.userInfo.classList.add('hidden');
            if (els.adminMenu) els.adminMenu.classList.add('hidden');
            if (els.adminBankMgmt) els.adminBankMgmt.classList.add('hidden');
            els.sidebarLinks.forEach(link => {
                link.style.opacity = '0.3';
                link.style.pointerEvents = 'none';
            });
        }
    }

    async loadStudentList() {
        if (!this.currentUser || this.currentUser.role !== 'admin') return;
        const tbody = document.getElementById('student-list-body');
        if (!tbody) return;

        const snapshot = await db.collection('users')
            .where('role', '==', 'student')
            .where('adminCode', '==', this.currentUser.classCode)
            .get();

        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            const isAuth = data.isAuthorized || false;
            
            tr.innerHTML = `
                <td>${data.username}</td>
                <td>
                    <input type="text" value="${data.nickname || ''}" placeholder="실명 입력" 
                        onchange="window.updateStudentNickname('${doc.id}', this.value)" 
                        style="background:#1a1a1a; border:1px solid #444; color:white; padding:5px; width:100px;">
                </td>
                <td style="color: ${isAuth ? '#00ffdd' : '#ff4d4d'}">
                    ${isAuth ? '인증됨' : '비인증'}
                </td>
                <td>
                    <button class="auth-btn" style="font-size: 0.8em; padding: 5px 10px; margin-right:5px; background: ${isAuth ? '#444' : '#00ffdd'}" 
                        onclick="window.toggleStudentAuth('${doc.id}', ${!isAuth})">
                        ${isAuth ? '인증 취소' : '인증 승인'}
                    </button>
                    <button class="auth-btn" style="font-size: 0.8em; padding: 5px 10px; background: #ff4d4d" 
                        onclick="window.deleteStudentAccount('${doc.id}', '${data.username}')">삭제</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async loadStudentAssets() {
        if (!this.currentUser || this.currentUser.role !== 'admin') return;
        const tbody = document.getElementById('asset-mgmt-body');
        if (!tbody) return;

        // [실시간 리스너] 학급 학생 목록 감시
        db.collection('users')
            .where('role', '==', 'student')
            .where('adminCode', '==', this.currentUser.classCode)
            .onSnapshot(async (studentSnapshot) => {
                tbody.innerHTML = '';
                for (const studentDoc of studentSnapshot.docs) {
                    const student = studentDoc.data();
                    const uid = studentDoc.id;
                    
                    // 자산 데이터 실시간으로 가져오기 위해 각 학생별 리스너 대신 정기적 업데이트 또는 호출 방식 사용
                    const assetDoc = await db.collection('playerData').doc(uid).get();
                    const assets = assetDoc.exists ? assetDoc.data() : { cash: 0, bankBalance: 0, portfolio: {} };

                    let stockValue = 0;
                    if (assets.portfolio) {
                        for (const sym in assets.portfolio) {
                            const p = assets.portfolio[sym];
                            const curPrice = (sym === this.simulation.currentStockSymbol ? this.simulation.currentStockPrice : p.avgPrice);
                            stockValue += p.amount * curPrice;
                        }
                    }

                    const total = (assets.cash || 0) + (assets.bankBalance || 0) + stockValue;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${student.nickname || student.username} <small style="color:#666">(${student.username})</small></td>
                        <td>₩${Math.floor(assets.cash || 0).toLocaleString()}</td>
                        <td>₩${Math.floor(assets.bankBalance || 0).toLocaleString()}</td>
                        <td>₩${Math.floor(stockValue).toLocaleString()}</td>
                        <td style="color: #00ffdd; font-weight: bold;">₩${Math.floor(total).toLocaleString()}</td>
                        <td>
                            <button class="auth-btn" style="font-size: 0.7em; padding: 4px 8px;" onclick="window.openModifyModal('${uid}', '${student.nickname || student.username}', ${assets.cash || 0})">수정</button>
                            <button class="auth-btn" style="font-size: 0.7em; padding: 4px 8px; background: #444;" onclick="window.openActivityModal('${uid}', '${student.nickname || student.username}')">기록</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                }
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

        this.classCode = null;

        this.cash = 0;

        this.bankBalance = 0;

        this.goods = 0;

        this.portfolio = {};

        this.deposits = []; // Array of {amount, rate, interest, maturity, status}



        this.bankSettings = { interestRate: 2.5, period: 60 };

        this.price = 10;

        this.currentStockSymbol = null;

        this.currentStockPrice = 0;



        this.initEvents();

        setInterval(() => this.updateMarket(), 2000);

        setInterval(() => this.updateSimulationStockPrices(), 5000);

        setInterval(() => this.checkMaturity(), 5000);

    }



    initEvents() {

        document.getElementById('deposit-btn')?.addEventListener('click', () => this.deposit());

        document.getElementById('withdraw-btn')?.addEventListener('click', () => this.withdraw());

        document.getElementById('load-stock-btn')?.addEventListener('click', () => this.loadStock());

        document.getElementById('buy-stock-btn')?.addEventListener('click', () => this.buyStock());

        document.getElementById('sell-stock-btn')?.addEventListener('click', () => this.sellStock());

        document.getElementById('save-bank-settings')?.addEventListener('click', () => this.saveBankSettings());

    }



    async addLog(message) {

        if (!this.classCode) return;

        await db.collection('logs').add({

            classCode: this.classCode,

            uid: this.uid,

            username: document.getElementById('user-display-name')?.textContent || '알수없음',

            message: message,

            timestamp: firebase.firestore.FieldValue.serverTimestamp()

        });

    }



    async loadClassLogs() {

        if (!this.classCode) return;

        const logList = document.getElementById('class-logs');

        if (!logList) return;



        db.collection('logs')

            .where('classCode', '==', this.classCode)

            .orderBy('timestamp', 'desc')

            .limit(50)

            .onSnapshot(snapshot => {

                logList.innerHTML = '';

                snapshot.forEach(doc => {

                    const data = doc.data();

                    const li = document.createElement('li');

                    li.style.padding = '8px 0';

                    li.style.borderBottom = '1px solid #333';

                    const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString() : '...';

                    li.innerHTML = `<small style="color: #888;">[${time}]</small> <strong>${data.username}</strong>: ${data.message}`;

                    logList.appendChild(li);

                });

            });

    }



    async saveBankSettings() {

        if (!this.classCode) return;

        const rate = parseFloat(document.getElementById('setting-interest-rate').value);

        const period = parseInt(document.getElementById('setting-deposit-period').value);

        

        await db.collection('classes').doc(this.classCode).update({

            bankSettings: { interestRate: rate, period: period }

        });

        alert('은행 설정이 저장되었습니다.');

        this.addLog(`관리자가 은행 설정을 변경했습니다. (이자율: ${rate}%)`);

    }



    async loadUserData(uid) {

        this.uid = uid;

        const userDoc = await db.collection('users').doc(uid).get();

        const userData = userDoc.data();

        this.classCode = userData.role === 'admin' ? userData.classCode : userData.adminCode;



        // Load Bank Settings from Class

        if (this.classCode) {

            const classDoc = await db.collection('classes').doc(this.classCode).get();

            if (classDoc.exists && classDoc.data().bankSettings) {

                this.bankSettings = classDoc.data().bankSettings;

                const settingsEl = document.getElementById('bank-current-settings');

                if (settingsEl) settingsEl.textContent = `연 이자율: ${this.bankSettings.interestRate}% / 만기: ${this.bankSettings.period}초`;

            }

        }



        const doc = await db.collection('playerData').doc(uid).get();

        if (doc.exists) {

            const data = doc.data();

            this.cash = data.cash || 1000;

            this.bankBalance = data.bankBalance || 0;

            this.goods = data.goods || 0;

            this.portfolio = data.portfolio || {};

            this.deposits = data.deposits || [];

            this.updateUI();

        } else {

            this.resetData();

            await this.saveUserData();

        }

    }



    async saveUserData() {

        if (!this.uid) return;

        await db.collection('playerData').doc(this.uid).set({

            cash: this.cash, bankBalance: this.bankBalance, goods: this.goods,

            portfolio: this.portfolio, deposits: this.deposits,

            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()

        });

    }



    async deposit() {

        if (!this.uid) return;

        const amount = parseInt(document.getElementById('bank-amount').value);

        if (isNaN(amount) || amount <= 0 || this.cash < amount) return;



        const maturity = new Date();

        maturity.setSeconds(maturity.getSeconds() + (this.bankSettings.period || 60));

        

        const interest = Math.floor(amount * (this.bankSettings.interestRate / 100));



        this.cash -= amount;

        this.bankBalance += amount;

        this.deposits.push({

            amount: amount,

            rate: this.bankSettings.interestRate,

            interest: interest,

            maturity: maturity.getTime(),

            status: 'active'

        });



        await this.addLog(`은행에 ₩${amount.toLocaleString()}을 예금했습니다.`);

        this.updateUI(); await this.saveUserData();

    }



    async checkMaturity() {

        let changed = false;

        const now = new Date().getTime();

        this.deposits.forEach(d => {

            if (d.status === 'active' && now >= d.maturity) {

                d.status = 'matured';

                changed = true;

                this.addLog(`예금 ₩${d.amount.toLocaleString()}이 만기되었습니다! 이자 ₩${d.interest.toLocaleString()} 발생.`);

            }

        });

        if (changed) { this.updateUI(); await this.saveUserData(); }

    }



    async withdraw() {

        if (!this.uid) return;

        // Simple withdraw: takes all matured deposits

        let total = 0;

        this.deposits = this.deposits.filter(d => {

            if (d.status === 'matured') {

                total += (d.amount + d.interest);

                return false;

            }

            return true;

        });



        if (total > 0) {

            this.cash += total;

            this.bankBalance -= (total - (total * 0.1)); // Rough logic for balance tracking

            await this.addLog(`만기 예금 ₩${total.toLocaleString()}을 수령했습니다.`);

            this.updateUI(); await this.saveUserData();

        } else {

            alert('만기된 예금이 없습니다.');

        }

    }



    updateMarket() {

        this.price = Math.max(1, this.price + (Math.random() - 0.5) * 2);

        this.updateUI();

    }



    async buyStock() {

        if (!this.uid || !this.currentStockSymbol) return;

        const amount = parseInt(document.getElementById('trade-amount').value);

        const cost = this.currentStockPrice * amount;

        if (this.cash >= cost) {

            this.cash -= cost;

            if (!this.portfolio[this.currentStockSymbol]) this.portfolio[this.currentStockSymbol] = { amount: 0, avgPrice: 0 };

            const p = this.portfolio[this.currentStockSymbol];

            p.avgPrice = (p.amount * p.avgPrice + cost) / (p.amount + amount);

            p.amount += amount;

            await this.addLog(`${this.currentStockSymbol} ${amount}주를 매수했습니다.`);

            this.updateUI(); await this.saveUserData();

        }

    }



    async sellStock() {

        if (!this.uid || !this.currentStockSymbol) return;

        const amount = parseInt(document.getElementById('trade-amount').value);

        const p = this.portfolio[this.currentStockSymbol];

        if (p && p.amount >= amount) {

            this.cash += this.currentStockPrice * amount;

            p.amount -= amount;

            if (p.amount === 0) delete this.portfolio[this.currentStockSymbol];

            await this.addLog(`${this.currentStockSymbol} ${amount}주를 매도했습니다.`);

            this.updateUI(); await this.saveUserData();

        }

    }



    updateUI() {

        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setEl('current-cash', Math.floor(this.cash).toLocaleString());

        setEl('bank-balance-amount', Math.floor(this.bankBalance).toLocaleString());

        

        let stockValue = 0;

        for (const sym in this.portfolio) {

            stockValue += this.portfolio[sym].amount * (sym === this.currentStockSymbol ? this.currentStockPrice : this.portfolio[sym].avgPrice);

        }

        setEl('total-assets', Math.floor(this.cash + this.bankBalance + stockValue).toLocaleString());



        const tbody = document.getElementById('deposit-list-body');

        if (tbody) {

            tbody.innerHTML = '';

            this.deposits.forEach(d => {

                const tr = document.createElement('tr');

                const timeStr = new Date(d.maturity).toLocaleTimeString();

                tr.innerHTML = `<td>₩${d.amount.toLocaleString()}</td><td>${d.rate}%</td><td>₩${d.interest.toLocaleString()}</td><td>${timeStr}</td><td style="color: ${d.status === 'matured' ? '#00ffdd' : '#888'}">${d.status === 'matured' ? '만기' : '예치중'}</td>`;

                tbody.appendChild(tr);

            });

        }

        // Portfolio UI remains similar...

    }

    resetData() { this.uid = null; this.cash = 0; this.bankBalance = 0; this.deposits = []; this.updateUI(); }

    loadStock() {

        const symbol = document.getElementById('stock-symbol').value.toUpperCase().trim();

        if (!symbol) return;

        this.currentStockSymbol = symbol;

        const container = document.getElementById('stock-chart-container');

        if (container) container.innerHTML = ''; 

        const script = document.createElement('script');

        script.src = "https://s3.tradingview.com/tv.js"; script.async = true;

        script.onload = () => { if (typeof TradingView !== 'undefined') new TradingView.widget({"width": "100%", "height": "100%", "symbol": symbol, "interval": "D", "timezone": "Etc/UTC", "theme": "dark", "style": "1", "locale": "kr", "container_id": "stock-chart-container"}); };

        document.head.appendChild(script);

        this.currentStockPrice = 100 + Math.random() * 900; this.updateUI();

    }

    updateSimulationStockPrices() { if (this.currentStockSymbol) { this.currentStockPrice *= (1 + (Math.random() - 0.5) * 0.02); this.updateUI(); } }

}



window.updateStudentNickname = async (uid, newNickname) => {
    try {
        await db.collection('users').doc(uid).update({ nickname: newNickname });
        // 알림 없이 조용히 데이터만 갱신하거나, 가벼운 알림만 띄움
        console.log("Nickname updated for", uid);
    } catch (error) {
        alert('업데이트 실패: ' + error.message);
    }
};

window.toggleStudentAuth = async (uid, newStatus) => {
    try {
        await db.collection('users').doc(uid).update({ isAuthorized: newStatus });
        // 전역 AuthManager 인스턴스를 찾아 목록만 새로고침
        if (window.authManager) {
            await window.authManager.loadStudentList();
        }
        alert(newStatus ? '인증 승인되었습니다.' : '인증 취소되었습니다.');
    } catch (error) {
        alert('권한 변경 실패: ' + error.message);
    }
};

window.deleteStudentAccount = async (uid, username) => {
    if (confirm(`[${username}] 학생의 계정을 삭제하시겠습니까?`)) {
        try {
            await db.collection('users').doc(uid).delete();
            await db.collection('playerData').doc(uid).delete();
            if (window.authManager) {
                await window.authManager.loadStudentList();
            }
            alert('계정 정보가 삭제되었습니다.');
        } catch (error) {
            alert('삭제 실패: ' + error.message);
        }
    }
};

window.openModifyModal = (uid, name, currentCash) => {

    document.getElementById('modify-target-name').textContent = name;

    document.getElementById('modify-cash-amount').value = currentCash;

    document.getElementById('modify-asset-modal').style.display = 'block';

    window.currentModifyUid = uid;

};



window.openActivityModal = async (uid, name) => {

    document.getElementById('activity-target-name').textContent = name;

    const tbody = document.getElementById('activity-list-body');

    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">로딩 중...</td></tr>';

    

    document.getElementById('activity-detail-modal').style.display = 'block';



    db.collection('playerData').doc(uid).collection('activities')

        .orderBy('timestamp', 'desc')

        .limit(30)

        .get().then(snapshot => {

            tbody.innerHTML = '';

            if (snapshot.empty) {

                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">기록이 없습니다.</td></tr>';

                return;

            }

            snapshot.forEach(doc => {

                const data = doc.data();

                const tr = document.createElement('tr');

                const time = data.timestamp ? data.timestamp.toDate().toLocaleString() : '-';

                tr.innerHTML = `

                    <td style="padding:10px; font-size:0.8em; color:#888;">${time}</td>

                    <td>${data.type}</td>

                    <td style="text-align:right; padding:10px; color:#00ffdd;">₩${data.amount.toLocaleString()}</td>

                `;

                tbody.appendChild(tr);

            });

        });

};



window.batchAction = async (type) => {

    if (!window.authManager || !window.authManager.currentUser) return;

    const classCode = window.authManager.currentUser.classCode;

    const actionName = type === 'bonus' ? '지원금 지급' : '자산 초기화';

    

    if (!confirm(`학급 전체 학생에게 [${actionName}]을 진행하시겠습니까?`)) return;



    try {

        const studentSnapshot = await db.collection('users')

            .where('role', '==', 'student')

            .where('adminCode', '==', classCode)

            .get();



        const batch = db.batch();

        for (const student of studentSnapshot.docs) {

            const ref = db.collection('playerData').doc(student.id);

            if (type === 'bonus') {

                const doc = await ref.get();

                const currentCash = doc.exists ? doc.data().cash : 0;

                batch.update(ref, { cash: currentCash + 1000 });

            } else {

                batch.set(ref, { cash: 0, bankBalance: 0, portfolio: {}, deposits: [] });

            }

        }

        await batch.commit();

        alert(`${actionName}가 완료되었습니다.`);

    } catch (error) {

        alert('일괄 처리 실패: ' + error.message);

    }

};



window.addEventListener('load', () => {

    setupNavigation();

    const simulation = new EconomicSimulation();

    window.authManager = new AuthManager(simulation);



    // 모달 닫기 이벤트 등록

    document.querySelector('.close-modify-asset')?.addEventListener('click', () => {

        document.getElementById('modify-asset-modal').style.display = 'none';

    });

    document.querySelector('.close-activity-detail')?.addEventListener('click', () => {

        document.getElementById('activity-detail-modal').style.display = 'none';

    });

    document.getElementById('confirm-modify-asset')?.addEventListener('click', async () => {

        const uid = window.currentModifyUid;

        const newCash = parseInt(document.getElementById('modify-cash-amount').value);

        const reason = document.getElementById('modify-reason').value;



        if (isNaN(newCash)) return alert('금액을 입력하세요.');

        if (!reason) return alert('수정 사유를 입력하세요.');



        try {

            await db.collection('playerData').doc(uid).update({ cash: newCash });

            await db.collection('admin_logs').add({

                adminUid: auth.currentUser.uid,

                targetUid: uid,

                amount: newCash,

                reason: reason,

                timestamp: firebase.firestore.FieldValue.serverTimestamp()

            });

            alert('자산이 수정되었습니다.');

            document.getElementById('modify-asset-modal').style.display = 'none';

        } catch (err) {

            alert('수정 실패: ' + err.message);

        }

    });

});
