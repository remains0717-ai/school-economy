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

// Firebase Configuration (Replace with your actual config from Firebase Console)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-id",
    appId: "your-app-id"
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
        };
    }

    listenToAuthChanges() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                this.currentUser = { 
                    uid: user.uid, 
                    username: userData?.username || user.email.split('@')[0], 
                    role: userData?.role || 'student' 
                };
                this.simulation.loadUserData(user.uid);
            } else {
                this.currentUser = null;
                this.simulation.resetData();
            }
            this.updateUI();
        });
    }

    openModal(mode) {
        this.modal.style.display = 'block';
        this.switchMode(mode);
    }

    closeModal() {
        this.modal.style.display = 'none';
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
        }
        
        const newToggle = mode === 'login' ? document.getElementById('toggle-to-signup') : document.getElementById('toggle-to-login');
        newToggle.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchMode(mode === 'login' ? 'signup' : 'login');
        });
    }

    async login() {
        const username = document.getElementById('login-username').value;
        const pass = document.getElementById('login-password').value;
        const email = `${username}@school-economy.local`;

        try {
            await auth.signInWithEmailAndPassword(email, pass);
            this.closeModal();
        } catch (error) {
            alert('로그인 실패: ' + error.message);
        }
    }

    async signup() {
        const username = document.getElementById('signup-username').value;
        const pass = document.getElementById('signup-password').value;
        const role = document.getElementById('signup-role').value;
        const email = `${username}@school-economy.local`;

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
            const user = userCredential.user;
            
            await db.collection('users').doc(user.uid).set({
                username: username,
                role: role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Initialize player data
            await db.collection('playerData').doc(user.uid).set({
                cash: 1000,
                bankBalance: 0,
                goods: 0,
                portfolio: {}
            });

            alert('회원가입이 완료되었습니다!');
            this.closeModal();
        } catch (error) {
            alert('회원가입 실패: ' + error.message);
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
        const loginBtn = document.getElementById('login-btn');
        const signupBtn = document.getElementById('signup-btn');
        const userInfo = document.getElementById('user-info');
        const userDisplay = document.getElementById('user-display-name');
        const roleBadge = document.getElementById('user-role-badge');
        const simulationLink = document.getElementById('simulation-link');

        if (this.currentUser) {
            loginBtn.classList.add('hidden');
            signupBtn.classList.add('hidden');
            userInfo.classList.remove('hidden');
            userDisplay.textContent = this.currentUser.username;
            roleBadge.textContent = this.currentUser.role === 'admin' ? '관리자' : '학생';
            roleBadge.style.color = this.currentUser.role === 'admin' ? '#ff4d4d' : '#00ffdd';
            
            if (this.currentUser.role === 'admin') {
                simulationLink.classList.remove('hidden');
            } else {
                simulationLink.classList.add('hidden');
            }
        } else {
            loginBtn.classList.remove('hidden');
            signupBtn.classList.remove('hidden');
            userInfo.classList.add('hidden');
            simulationLink.classList.add('hidden');
        }
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

window.addEventListener('load', () => {
    setupNavigation();
    const simulation = new EconomicSimulation();
    new AuthManager(simulation);
});