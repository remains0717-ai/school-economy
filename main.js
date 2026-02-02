// [School Economy] Integrated Management System
window.userState = { currentUser: null, classData: null, isLoggedIn: false, unsubscribe: [] };

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
        this.classUnsub = null;
        this.adminListUnsub = null;
        this.initEvents();
        this.listenToAuth();
    }

    initEvents() {
        document.getElementById('login-btn')?.addEventListener('click', () => this.openModal('login'));
        document.getElementById('signup-btn')?.addEventListener('click', () => this.openModal('signup'));
        document.querySelector('.close-modal')?.addEventListener('click', () => document.getElementById('auth-modal').style.display='none');
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('user-display-name')?.addEventListener('click', () => this.openMyInfo());
        
        document.getElementById('deposit-btn')?.addEventListener('click', () => this.simulation.deposit());
        document.getElementById('withdraw-btn')?.addEventListener('click', () => this.simulation.withdraw());
        document.getElementById('apply-loan-btn')?.addEventListener('click', () => this.simulation.applyLoan());

        document.getElementById('signup-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.signup(); });
        document.getElementById('login-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.login(); });
        
        document.getElementById('selectAllStudents')?.addEventListener('change', (e) => {
            document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = e.target.checked);
            this.updateSelectedCount();
        });
        document.getElementById('selectAllJobs')?.addEventListener('change', (e) => {
            document.querySelectorAll('.job-checkbox').forEach(cb => cb.checked = e.target.checked);
            this.updateSelectedJobCount();
        });

        document.getElementById('selectAllDeposits')?.addEventListener('change', (e) => {
            document.querySelectorAll('.deposit-checkbox').forEach(cb => cb.checked = e.target.checked);
        });

        // 주식 관련
        document.getElementById('search-stock-btn')?.addEventListener('click', () => this.simulation.searchStock());
        document.getElementById('buy-action-btn')?.addEventListener('click', () => this.simulation.executeTrade('buy'));
        document.getElementById('sell-action-btn')?.addEventListener('click', () => this.simulation.executeTrade('sell'));

        window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; };
    }

    listenToAuth() {
        auth.onAuthStateChanged(user => {
            window.userState.unsubscribe.forEach(u => u());
            window.userState.unsubscribe = [];
            if (this.classUnsub) this.classUnsub();
            if (this.adminListUnsub) { this.adminListUnsub(); this.adminListUnsub = null; }

            if (user) {
                const unsub = db.collection('users').doc(user.uid).onSnapshot(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        window.userState.currentUser = { uid: user.uid, ...userData };
                        window.userState.isLoggedIn = true;
                        this.updateUI();
                        this.simulation.sync(window.userState.currentUser);
                        
                        const code = (userData.classCode || userData.adminCode || "").trim().toUpperCase();
                        if (code && this.currentCode !== code) {
                            this.currentCode = code;
                            this.listenToClass(code);
                        }
                    }
                });
                window.userState.unsubscribe.push(unsub);
            } else {
                this.resetState();
            }
        });
    }

    listenToClass(code) {
        if (this.classUnsub) this.classUnsub();
        this.classUnsub = db.collection('classes').doc(code).onSnapshot(doc => {
            if (doc.exists) {
                window.userState.classData = doc.data();
                this.updateClassUI();
                
                // 상점 로드 (공통)
                loadStudentShop(code);

                if (window.userState.currentUser?.role === 'admin') {
                    this.loadAdminLists();
                    loadTreasuryLogs(code);
                    loadAdminShopItems(code);
                }
            }
        });
    }

    updateUI() {
        const u = window.userState.currentUser;
        const loggedIn = window.userState.isLoggedIn;
        
        document.getElementById('user-info')?.classList.toggle('hidden', !loggedIn);
        document.getElementById('login-btn')?.classList.toggle('hidden', loggedIn);
        document.getElementById('signup-btn')?.classList.toggle('hidden', loggedIn);
        document.getElementById('logged-in-home')?.classList.toggle('hidden', !loggedIn);
        document.getElementById('logged-out-home')?.classList.toggle('hidden', loggedIn);

        if (loggedIn) {
            document.getElementById('user-display-name').textContent = u.nickname || u.username;
            const isAdmin = u.role === 'admin';
            document.getElementById('admin-menu')?.classList.toggle('hidden', !isAdmin);
            
            if (isAdmin) {
                document.getElementById('mgmt-class-code').textContent = u.classCode || u.adminCode;
                this.loadAdminLists();
            }
        }
    }

    updateClassUI() {
        const data = window.userState.classData;
        if (!data) return;

        const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const setV = (id, val) => { 
            const el = document.getElementById(id); 
            if (el && document.activeElement !== el) el.value = val; 
        };

        const br = data.baseRate !== undefined ? data.baseRate : 0;
        const mh = data.maturityHours || 24;
        const ls = data.loanSpread !== undefined ? data.loanSpread : 2.0;
        const bs = data.bondSpread !== undefined ? data.bondSpread : 1.0;

        setT('class-treasury', `₩${(data.treasury || 0).toLocaleString()}`);
        setT('treasury-amount', (data.treasury || 0).toLocaleString());
        setT('debt-amount', (data.debt || 0).toLocaleString());
        setT('display-base-rate', br);

        setT('current-deposit-rate', br);
        setT('current-loan-rate', (br + ls).toFixed(1));
        setT('current-bond-rate', (br + bs).toFixed(1));
        setT('display-loan-spread', ls);
        setT('display-bond-spread', bs);
        setT('current-maturity-display', mh);

        setV('policy-base-rate', br);
        setV('policy-maturity-hours', mh);
        setV('policy-loan-spread', ls);
        setV('policy-bond-spread', bs);

        setT('student-deposit-rate', `${br}%`);
        setT('student-maturity-hours', `${mh}시간`);
        setT('display-loan-rate', `${(br + ls).toFixed(1)}%`);

        if (data.news) {
            document.getElementById('news-ticker-container')?.classList.remove('hidden');
            setT('news-ticker', `📢 ${data.news}`);
        }
    }

    async loadAdminLists() {
        const code = this.currentCode;
        if (!code) return;

        if (this.adminListUnsub) {
            this.adminListUnsub();
            this.adminListUnsub = null;
        }

        // [1] 학생 목록 (onSnapshot으로 실시간 연동)
        this.adminListUnsub = db.collection('users').where('adminCode','==',code).where('role','==','student').onSnapshot(async snap => {
            const assetBody = document.getElementById('asset-mgmt-body');
            const accBody = document.getElementById('student-list-body');
            const jobBody = document.getElementById('job-mgmt-body');
            
            if (accBody) accBody.innerHTML = '';
            if (assetBody) assetBody.innerHTML = '';
            if (jobBody) jobBody.innerHTML = '';

            // 실시간 주가 정보를 한 번만 가져오기 위해 공통 심볼 목록 추출
            const allSymbols = new Set();
            
            snap.forEach(doc => {
                const d = doc.data();
                const uid = doc.id;

                // [학생 관리 탭]
                if (accBody) {
                    const status = d.isAuthorized ? '<span style="color:var(--primary)">승인됨</span>' : '<span style="color:var(--danger)">미승인</span>';
                    const btnText = d.isAuthorized ? "승인 취소" : "승인 하기";
                    const btnColor = d.isAuthorized ? "var(--danger)" : "var(--primary)";
                    accBody.innerHTML += `<tr><td>${d.username}</td><td>${status}</td><td><button onclick="window.toggleApproval('${uid}', ${!d.isAuthorized})" style="background:${btnColor}">${btnText}</button></td></tr>`;
                }

                // [직업 관리 탭]
                if (jobBody) {
                    jobBody.innerHTML += `<tr><td><input type="checkbox" class="job-checkbox" value="${uid}"></td><td>${d.nickname||d.username}</td><td><input type="text" value="${d.job||''}" class="job-input" style="width:80px"></td><td><input type="number" value="${d.salary||0}" class="salary-input" style="width:80px"></td><td><button onclick="window.updateJobInfo('${uid}', this)">저장</button></td></tr>`;
                }

                // [자산 관리 탭] 초기 로딩 (주식 제외)
                if (assetBody) {
                    const balance = Number(d.balance || 0);
                    const bankBalance = Number(d.bankBalance || 0);
                    const debt = Number(d.debt || 0);
                    
                    const rowId = `asset-row-${uid}`;
                    assetBody.innerHTML += `<tr id="${rowId}">
                        <td><input type="checkbox" class="student-checkbox" value="${uid}"></td>
                        <td>${d.nickname||d.username}</td>
                        <td style="color:var(--primary)">₩${balance.toLocaleString()}</td>
                        <td>₩${bankBalance.toLocaleString()}</td>
                        <td class="stock-cell" style="color:var(--secondary)">계산중...</td>
                        <td style="color:var(--danger)">₩${debt.toLocaleString()}</td>
                        <td class="total-cell important-metric">₩${(balance + bankBalance - debt).toLocaleString()}</td>
                        <td><button onclick="window.openModifyModal('${uid}','${d.username}',${balance})">수정</button></td>
                    </tr>`;

                    // 각 학생의 주식 정보 업데이트를 비동기로 실행
                    this.updateStudentStockAsset(uid, balance, bankBalance, debt);
                }
            });
            
            document.querySelectorAll('.student-checkbox').forEach(cb => cb.onchange = () => this.updateSelectedCount());
            document.querySelectorAll('.job-checkbox').forEach(cb => cb.onchange = () => this.updateSelectedJobCount());
        });

        db.collection('items').where('classCode','==',code).get().then(snap => {
            const select = document.getElementById('bulk-item-select');
            if (select) {
                select.innerHTML = '<option value="">아이템 선택</option>';
                snap.forEach(doc => {
                    const item = doc.data();
                    if (item.stock > 0) select.innerHTML += `<option value="${doc.id}">${item.name} (₩${item.price})</option>`;
                });
            }
        });
    }

    async updateStudentStockAsset(uid, balance, bankBalance, debt) {
        try {
            const portSnap = await db.collection('users').doc(uid).collection('portfolio').get();
            let stockTotal = 0;
            
            for (const pDoc of portSnap.docs) {
                const p = pDoc.data();
                const symbol = pDoc.id.replace('_', ':');
                const price = await this.simulation.getStockPrice(symbol);
                stockTotal += (price * p.count * this.simulation.exchangeRate);
            }

            const totalAssets = balance + bankBalance + stockTotal - debt;
            const row = document.getElementById(`asset-row-${uid}`);
            if (row) {
                row.querySelector('.stock-cell').textContent = `₩${Math.floor(stockTotal).toLocaleString()}`;
                row.querySelector('.total-cell').textContent = `₩${Math.floor(totalAssets).toLocaleString()}`;
            }
        } catch (err) {
            console.error("Stock update error:", err);
        }
    }

    updateSelectedCount() {
        const count = document.querySelectorAll('.student-checkbox:checked').length;
        const el = document.getElementById('selected-count');
        if (el) el.textContent = count;
    }

    updateSelectedJobCount() {
        const count = document.querySelectorAll('.job-checkbox:checked').length;
        const el = document.getElementById('selected-job-count');
        if (el) el.textContent = count;
    }

    async signup() {
        const role = document.getElementById('signup-role').value;
        const pass = document.getElementById('signup-password').value;
        const email = document.getElementById('signup-email').value.trim();
        const username = document.getElementById('signup-username').value.trim().toLowerCase();
        const code = document.getElementById('signup-class-code').value.trim().toUpperCase();

        try {
            if (role === 'student') {
                const classDoc = await db.collection('classes').doc(code).get();
                if (!classDoc.exists) return alert("학급 코드가 존재하지 않습니다.");
            }
            const finalEmail = role === 'admin' ? email : `${username}@student.com`;
            const cred = await auth.createUserWithEmailAndPassword(finalEmail, pass);
            
            let classCode = role === 'admin' ? Math.random().toString(36).substring(2, 8).toUpperCase() : "";
            if (role === 'admin') {
                await db.collection('classes').doc(classCode).set({ 
                    adminUid: cred.user.uid, treasury: 0, debt: 0, baseRate: 3.0, 
                    maturityHours: 24, loanSpread: 2.0, bondSpread: 1.0 
                });
            }

            await db.collection('users').doc(cred.user.uid).set({
                username, role, email: finalEmail, balance: 1000, bankBalance: 0,
                classCode: role === 'admin' ? classCode : "",
                adminCode: role === 'student' ? code : "",
                isAuthorized: false, creditScore: 500
            });
            alert("가입 성공!"); location.reload();
        } catch (err) { alert(err.message); }
    }

    async login() {
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        const e = u.includes('@') ? u : `${u.toLowerCase()}@student.com`;
        try { await auth.signInWithEmailAndPassword(e, p); document.getElementById('auth-modal').style.display='none'; } catch(err) { alert("로그인 실패"); }
    }

    logout() { auth.signOut().then(() => location.reload()); }
    openModal(mode) { document.getElementById('auth-modal').style.display='block'; }
    openMyInfo() {
        const u = window.userState.currentUser;
        if (!u) return;
        document.getElementById('my-info-modal').style.display='block'; 
        document.getElementById('info-username').textContent = u.username;
        document.getElementById('info-role').textContent = u.role;
        document.getElementById('info-job').textContent = u.job || "무직";
        document.getElementById('info-class-code').textContent = u.classCode || u.adminCode;
    }
    resetState() {
        window.userState.isLoggedIn = false;
        window.userState.currentUser = null;
        window.userState.classData = null;
        this.currentCode = null;
        this.updateUI();
        this.simulation.reset();
    }
}

class EconomicSimulation {
    constructor() { 
        this.user = null; 
        this.depositUnsub = null;
        this.loanUnsub = null;
        this.currentStock = null;
        this.tradeMode = 'buy';
        this.exchangeRate = 1350; // 고정 환율 시뮬레이션
        this.tvWidget = null;
        this.lastStockTotal = 0;
        
        this.topStocks = [
            { symbol: 'NASDAQ:AAPL', name: '애플' }, { symbol: 'NASDAQ:TSLA', name: '테슬라' },
            { symbol: 'NASDAQ:NVDA', name: '엔비디아' }, { symbol: 'NASDAQ:MSFT', name: '마이크로소프트' },
            { symbol: 'NASDAQ:AMZN', name: '아마존' }, { symbol: 'NASDAQ:GOOGL', name: '구글' },
            { symbol: 'NASDAQ:META', name: '메타' }, { symbol: 'NASDAQ:NFLX', name: '넷플릭스' },
            { symbol: 'BINANCE:BTCUSDT', name: '비트코인' }, { symbol: 'NYSE:DIS', name: '디즈니' }
        ];
    }

    initTradingView(symbol = 'NASDAQ:AAPL') {
        if (typeof TradingView === 'undefined') return;
        
        this.tvWidget = new TradingView.widget({
            "autosize": true,
            "symbol": symbol,
            "interval": "D",
            "timezone": "Asia/Seoul",
            "theme": "dark",
            "style": "1",
            "locale": "ko",
            "toolbar_bg": "#f1f3f6",
            "enable_publishing": false,
            "allow_symbol_change": true,
            "container_id": "tradingview_chart"
        });
    }

    updateTradingView(symbol) {
        if (this.tvWidget && typeof TradingView !== 'undefined') {
            this.initTradingView(symbol);
        }
    }

    sync(user) { 
        const isNewUser = !this.user || this.user.uid !== user.uid;
        this.user = user; 
        const balance = Number(user.balance || 0);
        const bankBalance = Number(user.bankBalance || 0);
        const debt = Number(user.debt || 0);
        const stockAssets = this.lastStockTotal || 0;

        const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setT('current-cash', balance.toLocaleString());
        setT('current-bank-balance', bankBalance.toLocaleString());
        setT('current-stock-assets', Math.floor(stockAssets).toLocaleString());
        setT('current-debt', debt.toLocaleString());
        setT('bank-balance-amount', bankBalance.toLocaleString());
        setT('total-assets', Math.floor(balance + bankBalance + stockAssets - debt).toLocaleString());
        setT('display-job', user.job || "없음");
        setT('display-credit', user.creditScore || 500);
        setT('trade-available-balance', `₩ ${balance.toLocaleString()}`);
        
        const grade = Math.max(1, Math.min(10, 11 - Math.floor((user.creditScore || 500) / 100)));
        setT('loan-credit-grade', `${grade}등급`);
        setT('loan-limit', ((11-grade)*5000).toLocaleString());
        
        if (isNewUser) {
            this.loadDeposits();
            this.loadLoans();
            this.loadPortfolio();
            this.loadInventory();
            this.initTradingView();
            this.setupTradeListeners();
        }
        
        if (this.currentStock) this.updateTradeSummary();
    }

    loadInventory() {
        db.collection('users').doc(this.user.uid).collection('inventory').orderBy('timestamp', 'desc').onSnapshot(snap => {
            const grid = document.getElementById('home-inventory-grid');
            if (!grid) return;
            grid.innerHTML = '';

            snap.forEach(doc => {
                const item = doc.data();
                const div = document.createElement('div');
                div.className = 'inventory-item';
                div.innerHTML = `
                    <span>${item.itemName}</span>
                    <small style="color:#666;">₩ ${item.price.toLocaleString()}</small>
                `;
                grid.appendChild(div);
            });

            if (snap.empty) {
                grid.innerHTML = '<p style="color:#666; grid-column: 1/-1;">보유 중인 아이템이 없습니다.</p>';
            }
        });
    }

    loadPortfolio() {
        db.collection('users').doc(this.user.uid).collection('portfolio').onSnapshot(async (snap) => {
            const body = document.getElementById('portfolio-body');
            if (!body) return;
            body.innerHTML = '';
            
            let totalEval = 0;

            for (const doc of snap.docs) {
                const p = doc.data();
                const symbol = doc.id.replace('_', ':');
                const price = await this.getStockPrice(symbol);
                const evalAmount = price * p.count * this.exchangeRate;
                const investAmount = p.avgPrice * p.count * this.exchangeRate;
                const profit = evalAmount - investAmount;
                const profitRate = ((price / p.avgPrice) - 1) * 100;
                
                totalEval += evalAmount;

                const color = profit >= 0 ? 'var(--danger)' : '#2196f3';

                body.innerHTML += `<tr>
                    <td><strong>${symbol.split(':')[1]}</strong></td>
                    <td>${p.count} 주</td>
                    <td>$${p.avgPrice.toLocaleString()}</td>
                    <td>$${price.toLocaleString()}</td>
                    <td style="color:${color}">${profitRate.toFixed(2)}%<br><small>(₩${Math.floor(profit).toLocaleString()})</small></td>
                    <td><strong>₩${Math.floor(evalAmount).toLocaleString()}</strong></td>
                </tr>`;
            }
            
            this.lastStockTotal = totalEval;
            const balance = Number(this.user.balance || 0);
            const bankBalance = Number(this.user.bankBalance || 0);
            const debt = Number(this.user.debt || 0);
            
            document.getElementById('current-stock-assets').textContent = Math.floor(totalEval).toLocaleString();
            document.getElementById('total-assets').textContent = Math.floor(balance + bankBalance + totalEval - debt).toLocaleString();

            if (snap.empty) {
                body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#666; padding:40px;">보유 중인 주식이 없습니다.</td></tr>';
                this.lastStockTotal = 0;
            }
        });
    }

    setupTradeListeners() {
        document.getElementById('stock-trade-amount')?.addEventListener('input', () => this.updateTradeSummary());
        document.getElementById('execute-trade-btn')?.addEventListener('click', () => this.executeTrade());
    }

    setTradeMode(mode) {
        this.tradeMode = mode;
        const btn = document.getElementById('execute-trade-btn');
        const tabs = document.querySelectorAll('.trade-tab');
        
        tabs.forEach(t => {
            t.classList.toggle('active', t.textContent === (mode === 'buy' ? '매수' : '매도'));
        });

        if (mode === 'buy') {
            btn.textContent = '매수하기';
            btn.className = 'submit-btn trade-submit-buy';
        } else {
            btn.textContent = '매도하기';
            btn.className = 'submit-btn trade-submit-sell';
        }
        this.updateTradeSummary();
    }

    async loadTopStocks() {
        // 인기 종목 기능 삭제됨
    }

    async searchStock() {
        let query = document.getElementById('stock-search-input').value.trim().toUpperCase();
        if (!query) return;
        
        // 심볼 형식 보정
        if (!query.includes(':')) {
            if (['BTC', 'ETH', 'SOL', 'XRP'].includes(query)) query = `BINANCE:${query}USDT`;
            else query = `NASDAQ:${query}`;
        }

        this.selectStock(query, query.split(':')[1]);
    }

    async selectStock(symbol, name) {
        const price = await this.getStockPrice(symbol);
        this.currentStock = { symbol, name, price };
        this.updateTradingView(symbol);
        
        document.getElementById('selected-stock-name').textContent = name;
        document.getElementById('selected-stock-symbol').textContent = symbol;
        this.updateTradeSummary();
        
        // 보유 현황 로드
        const portSnap = await db.collection('users').doc(this.user.uid).collection('portfolio').doc(symbol.replace(':', '_')).get();
        const myData = portSnap.exists ? portSnap.data() : { count: 0, avgPrice: 0 };
        document.getElementById('my-stock-count').textContent = `${myData.count} 주`;
        document.getElementById('my-avg-price').textContent = `$${(myData.avgPrice || 0).toLocaleString()}`;
    }

    async getStockPrice(symbol) {
        // 2026-02-02 기준 시장가 근사치 (시연용)
        const basePrices = { 
            AAPL: 245.50, TSLA: 412.30, NVDA: 135.20, MSFT: 425.10, 
            AMZN: 195.80, GOOGL: 188.40, META: 512.60, NFLX: 625.00, 
            BTCUSDT: 102500.00, DIS: 115.40, SOLUSDT: 245.00, ETHUSDT: 3850.00 
        };
        const ticker = symbol.split(':')[1].replace('USDT', '');
        const base = basePrices[ticker] || 150.00;
        return Math.floor((base + (Math.random() - 0.5) * 0.5) * 100) / 100;
    }

    updateTradeSummary() {
        if (!this.currentStock) return;
        const amount = parseInt(document.getElementById('stock-trade-amount').value) || 0;
        const price = this.currentStock.price;
        const krwPrice = Math.floor(price * this.exchangeRate);
        const total = krwPrice * amount;

        document.getElementById('current-price-val').textContent = `$${price.toLocaleString()}`;
        document.getElementById('krw-price-val').textContent = krwPrice.toLocaleString();
        document.getElementById('order-total-price').textContent = `₩ ${total.toLocaleString()}`;
        
        const balance = this.tradeMode === 'buy' ? Number(this.user.balance) : 0;
        document.getElementById('trade-available-balance').textContent = this.tradeMode === 'buy' ? `₩ ${balance.toLocaleString()}` : '매도 가능 수량 확인';
    }

    async executeTrade() {
        if (!this.currentStock) return alert("종목을 먼저 선택하세요.");
        const amount = parseInt(document.getElementById('stock-trade-amount').value);
        if (isNaN(amount) || amount <= 0) return alert("수량을 입력하세요.");

        const symbol = this.currentStock.symbol;
        const safeSymbol = symbol.replace(':', '_');
        const price = this.currentStock.price;
        const totalCost = Math.floor(price * amount * this.exchangeRate);
        
        const userRef = db.collection('users').doc(this.user.uid);
        const portRef = userRef.collection('portfolio').doc(safeSymbol);

        try {
            await db.runTransaction(async (t) => {
                const uDoc = await t.get(userRef);
                const pDoc = await t.get(portRef);
                const uData = uDoc.data();
                const pData = pDoc.exists ? pDoc.data() : { count: 0, avgPrice: 0 };

                if (this.tradeMode === 'buy') {
                    if (uData.balance < totalCost) throw new Error("잔액이 부족합니다.");
                    const newCount = (pData.count || 0) + amount;
                    const newAvg = (((pData.avgPrice || 0) * (pData.count || 0)) + (price * amount)) / newCount;
                    t.update(userRef, { balance: uData.balance - totalCost });
                    t.set(portRef, { count: newCount, avgPrice: newAvg });
                } else {
                    if ((pData.count || 0) < amount) throw new Error("보유 수량이 부족합니다.");
                    t.update(userRef, { balance: uData.balance + totalCost });
                    const newCount = pData.count - amount;
                    if (newCount === 0) t.delete(portRef);
                    else t.update(portRef, { count: newCount });
                }
            });
            alert(`${this.tradeMode === 'buy' ? '매수' : '매도'} 완료!`);
            this.selectStock(symbol, this.currentStock.name); // UI 갱신
        } catch (err) { alert(err.message); }
    }

    async buyItem(itemId, itemName, price, currentStock) {
        if (this.user.balance < price) return alert(`현금이 부족합니다!\n(필요: ₩${price.toLocaleString()} / 현재: ₩${this.user.balance.toLocaleString()})`);
        if (currentStock <= 0) return alert("재고가 없습니다.");

        if (!confirm(`[${itemName}]을 ₩${price.toLocaleString()}에 구매하시겠습니까?`)) return;

        try {
            const userRef = db.collection('users').doc(this.user.uid);
            const itemRef = db.collection('items').doc(itemId);
            const invRef = userRef.collection('inventory').doc();

            await db.runTransaction(async (t) => {
                const iDoc = await t.get(itemRef);
                const iData = iDoc.data();
                
                if (iData.stock <= 0) throw new Error("방금 물건이 품절되었습니다.");

                t.update(userRef, { balance: firebase.firestore.FieldValue.increment(-price) });
                t.update(itemRef, { stock: firebase.firestore.FieldValue.increment(-1) });
                t.set(invRef, {
                    itemName,
                    price,
                    timestamp: firebase.firestore.Timestamp.now()
                });
            });
            alert("구매가 완료되었습니다! 가방에서 확인하세요.");
        } catch (err) { alert("구매 실패: " + err.message); }
    }

    async deposit() {
        const amtInput = document.getElementById('bank-amount');
        const amt = parseInt(amtInput.value);
        const currentBalance = Number(this.user?.balance || 0);

        if (isNaN(amt) || amt <= 0) return alert("올바른 금액을 입력하세요.");
        if (currentBalance < amt) return alert(`잔액이 부족합니다. (현재 현금: ₩${currentBalance.toLocaleString()})`);
        
        const data = window.userState.classData;
        const maturityDate = new Date();
        maturityDate.setHours(maturityDate.getHours() + (data.maturityHours || 24));

        try {
            const batch = db.batch();
            const uRef = db.collection('users').doc(this.user.uid);
            batch.update(uRef, { 
                balance: firebase.firestore.FieldValue.increment(-amt), 
                bankBalance: firebase.firestore.FieldValue.increment(amt) 
            });
            batch.set(uRef.collection('deposits').doc(), { 
                amount: amt, 
                rate: data.baseRate||0, 
                status: 'active', 
                maturityAt: firebase.firestore.Timestamp.fromDate(maturityDate), 
                timestamp: firebase.firestore.Timestamp.now() 
            });
            await batch.commit();
            amtInput.value = '';
            alert("입금 완료!");
        } catch (err) { alert(err.message); }
    }

    async withdraw() {
        const checkboxes = document.querySelectorAll('.deposit-checkbox:checked');
        if (checkboxes.length === 0) return alert("해지/수령할 항목을 선택해 주세요.");

        const batch = db.batch();
        let totalReceived = 0;
        let totalPrincipalOnly = 0;
        const now = new Date();

        for (const cb of checkboxes) {
            const docId = cb.value;
            const docRef = db.collection('users').doc(this.user.uid).collection('deposits').doc(docId);
            const dDoc = await docRef.get();
            const d = dDoc.data();

            if (d.status !== 'active') continue;

            const isMatured = d.maturityAt.toDate() <= now;
            const interest = isMatured ? Math.floor(d.amount * (d.rate / 100)) : 0;
            const receiveAmount = d.amount + interest;

            totalReceived += receiveAmount;
            totalPrincipalOnly += d.amount;

            batch.update(docRef, { 
                status: isMatured ? 'completed' : 'cancelled',
                cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        if (totalPrincipalOnly === 0) return alert("처리할 수 있는 항목이 없습니다.");

        try {
            const userRef = db.collection('users').doc(this.user.uid);
            batch.update(userRef, { 
                balance: firebase.firestore.FieldValue.increment(totalReceived),
                bankBalance: firebase.firestore.FieldValue.increment(-totalPrincipalOnly)
            });
            
            await batch.commit();
            alert(`선택한 항목의 처리가 완료되었습니다.\n총 수령액: ₩${totalReceived.toLocaleString()}`);
        } catch (err) { alert("오류: " + err.message); }
    }

    loadDeposits() {
        if (this.depositUnsub) this.depositUnsub();
        
        this.depositUnsub = db.collection('users').doc(this.user.uid).collection('deposits').orderBy('timestamp','desc').onSnapshot(snap => {
            const body = document.getElementById('deposit-list-body');
            if (body) {
                body.innerHTML = '';
                snap.forEach(doc => {
                    const d = doc.data();
                    const now = new Date();
                    const isMatured = d.maturityAt && d.maturityAt.toDate() <= now;
                    const interest = Math.floor(d.amount * (d.rate / 100));
                    
                    let statusText = d.status;
                    if (d.status === 'active') {
                        statusText = isMatured ? '<span style="color:var(--primary)">만기! (수령가능)</span>' : '거치중';
                    } else if (d.status === 'completed') {
                        statusText = '수령완료';
                    } else if (d.status === 'cancelled') {
                        statusText = '<span style="color:var(--danger)">중도해지</span>';
                    }

                    const checkbox = d.status === 'active' ? `<input type="checkbox" class="deposit-checkbox" value="${doc.id}">` : '';

                    body.innerHTML += `<tr>
                        <td>${checkbox}</td>
                        <td>₩${d.amount.toLocaleString()}</td>
                        <td>${d.rate}%</td>
                        <td>₩${interest.toLocaleString()}</td>
                        <td>${d.maturityAt ? d.maturityAt.toDate().toLocaleString() : '-'}</td>
                        <td>${statusText}</td>
                    </tr>`;
                });
            }
        });
    }

    async applyLoan() {
        const amtInput = document.getElementById('loan-request-amount');
        const amt = parseInt(amtInput.value);
        if (isNaN(amt) || amt <= 0) return alert("금액 오류");

        const grade = Math.max(1, Math.min(10, 11 - Math.floor((this.user.creditScore || 500) / 100)));
        const limit = (11 - grade) * 5000;
        const currentDebt = Number(this.user.debt || 0);

        if (currentDebt + amt > limit) return alert(`대출 한도를 초과했습니다. (가능 잔액: ₩${(limit - currentDebt).toLocaleString()})`);

        const data = window.userState.classData;
        const loanRate = (data.baseRate || 0) + (data.loanSpread || 2.0);

        try {
            const batch = db.batch();
            const uRef = db.collection('users').doc(this.user.uid);
            batch.update(uRef, { 
                balance: firebase.firestore.FieldValue.increment(amt), 
                debt: firebase.firestore.FieldValue.increment(amt) 
            });
            batch.set(uRef.collection('loans').doc(), {
                amount: amt,
                rate: loanRate,
                status: 'active',
                timestamp: firebase.firestore.Timestamp.now()
            });
            await batch.commit();
            amtInput.value = '';
            alert("대출이 완료되었습니다.");
        } catch (err) { alert(err.message); }
    }

    loadLoans() {
        if (this.loanUnsub) this.loanUnsub();

        this.loanUnsub = db.collection('users').doc(this.user.uid).collection('loans').orderBy('timestamp', 'desc').onSnapshot(snap => {
            const body = document.getElementById('loan-list-body');
            if (!body) return;
            body.innerHTML = '';
            
            let totalDebt = 0;
            let totalInterest = 0;

            snap.forEach(doc => {
                const d = doc.data();
                if (d.status !== 'active') return;

                const now = new Date();
                const loanDate = d.timestamp.toDate();
                const hoursPassed = Math.floor((now - loanDate) / (1000 * 60 * 60));
                
                // 간단한 이자 계산 시뮬레이션: 1시간당 (연리/8760) 적용
                const interest = Math.floor(d.amount * (d.rate / 100) * (hoursPassed / 8760) * 100); // 가독성을 위해 100배 가속 시뮬레이션 가능
                const totalToPay = d.amount + interest;

                totalDebt += d.amount;
                totalInterest += interest;

                body.innerHTML += `<tr>
                    <td>₩${d.amount.toLocaleString()}</td>
                    <td>${d.rate}%</td>
                    <td style="color:var(--danger)">₩${interest.toLocaleString()}</td>
                    <td><strong>₩${totalToPay.toLocaleString()}</strong></td>
                    <td>${loanDate.toLocaleString()}</td>
                    <td><button onclick="window.simulation.repayLoan('${doc.id}', ${totalToPay}, ${d.amount})" class="auth-btn" style="font-size:0.8rem; padding:5px 10px;">상환</button></td>
                </tr>`;
            });

            document.getElementById('loan-total-debt').textContent = `₩ ${totalDebt.toLocaleString()}`;
            document.getElementById('loan-total-interest').textContent = `₩ ${totalInterest.toLocaleString()}`;
        });
    }

    async repayLoan(loanId, totalToPay, principal) {
        if (this.user.balance < totalToPay) return alert("잔액이 부족하여 상환할 수 없습니다.");
        if (!confirm(`총 ₩${totalToPay.toLocaleString()}을 상환하시겠습니까?`)) return;

        try {
            const batch = db.batch();
            const uRef = db.collection('users').doc(this.user.uid);
            const lRef = uRef.collection('loans').doc(loanId);

            batch.update(uRef, { 
                balance: firebase.firestore.FieldValue.increment(-totalToPay),
                debt: firebase.firestore.FieldValue.increment(-principal)
            });
            batch.update(lRef, { status: 'repaid', repaidAt: firebase.firestore.Timestamp.now() });

            await batch.commit();
            alert("상환이 완료되었습니다.");
        } catch (err) { alert(err.message); }
    }

    reset() { 
        this.user = null; 
        if (this.depositUnsub) { this.depositUnsub(); this.depositUnsub = null; }
        if (this.loanUnsub) { this.loanUnsub(); this.loanUnsub = null; }
    }
}

// [Global Admin Functions]
window.addShopItem = async () => {
    const category = document.getElementById('new-item-category').value.trim();
    const name = document.getElementById('new-item-name').value.trim();
    const price = parseInt(document.getElementById('new-item-price').value);
    const stock = parseInt(document.getElementById('new-item-stock').value);

    if (!category || !name || isNaN(price) || isNaN(stock)) return alert("모든 정보를 올바르게 입력하세요.");

    const code = (window.userState.currentUser.classCode || window.userState.currentUser.adminCode).trim().toUpperCase();

    try {
        await db.collection('items').add({
            classCode: code,
            category,
            name,
            price,
            stock,
            createdAt: firebase.firestore.Timestamp.now()
        });
        alert("물품이 등록되었습니다.");
        document.getElementById('new-item-category').value = '';
        document.getElementById('new-item-name').value = '';
        document.getElementById('new-item-price').value = '';
        document.getElementById('new-item-stock').value = '';
    } catch (err) { alert("등록 실패: " + err.message); }
};

window.deleteShopItem = async (itemId) => {
    if (!confirm("정말로 이 물품을 삭제하시겠습니까?")) return;
    try {
        await db.collection('items').doc(itemId).delete();
        alert("삭제되었습니다.");
    } catch (err) { alert("삭제 실패: " + err.message); }
};

function loadAdminShopItems(code) {
    db.collection('items').where('classCode', '==', code).orderBy('createdAt', 'desc').onSnapshot(snap => {
        const body = document.getElementById('admin-shop-list-body');
        if (!body) return;
        body.innerHTML = '';
        
        snap.forEach(doc => {
            const item = doc.data();
            body.innerHTML += `<tr>
                <td>${item.category}</td>
                <td><strong>${item.name}</strong></td>
                <td>₩${item.price.toLocaleString()}</td>
                <td>${item.stock} 개</td>
                <td><button onclick="window.deleteShopItem('${doc.id}')" style="background:var(--danger); font-size:0.8rem;">삭제</button></td>
            </tr>`;
        });
    });
}

function loadStudentShop(code) {
    db.collection('items').where('classCode', '==', code).onSnapshot(snap => {
        const grid = document.getElementById('shop-items-grid');
        if (!grid) return;
        grid.innerHTML = '';

        snap.forEach(doc => {
            const item = doc.data();
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <small style="color:#888;">${item.category}</small>
                <h3 style="margin:5px 0;">${item.name}</h3>
                <span class="item-price">₩ ${item.price.toLocaleString()}</span>
                <p style="font-size:0.9rem; color:${item.stock > 0 ? '#00ffdd' : 'var(--danger)'};">
                    재고: ${item.stock > 0 ? item.stock + '개' : '품절'}
                </p>
                <button onclick="window.simulation.buyItem('${doc.id}', '${item.name}', ${item.price}, ${item.stock})" 
                        class="submit-btn" 
                        ${item.stock <= 0 ? 'disabled style="background:#444;"' : ''}>
                    ${item.stock > 0 ? '구매하기' : '품절'}
                </button>
            `;
            grid.appendChild(card);
        });

        if (snap.empty) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#666; padding:40px;">현재 판매 중인 물품이 없습니다.</p>';
        }
    });
}

window.issueCurrency = async () => {
    const input = document.getElementById('issue-amount');
    const amount = parseInt(input.value);
    if (isNaN(amount) || amount <= 0) return alert("발행할 올바른 금액을 입력하세요.");

    const u = window.userState.currentUser;
    const code = (u.classCode || u.adminCode).trim().toUpperCase();
    
    if (!confirm(`신규 화폐 ₩${amount.toLocaleString()}을 발행하시겠습니까?\n발행 후 국고 잔액에 즉시 합산됩니다.`)) return;

    try {
        const batch = db.batch();
        const classRef = db.collection('classes').doc(code);
        
        batch.update(classRef, { treasury: firebase.firestore.FieldValue.increment(amount) });
        
        // 국고 변동 로그 기록
        const logRef = classRef.collection('treasuryLogs').doc();
        batch.set(logRef, {
            type: 'issuance',
            amount: amount,
            description: '신규 화폐 발행 (중앙은행)',
            timestamp: firebase.firestore.Timestamp.now()
        });

        await batch.commit();
        alert("화폐 발행이 완료되었습니다.");
        input.value = '';
    } catch (err) { alert("발행 실패: " + err.message); }
};

window.adjustTreasury = async (mode) => {
    const input = document.getElementById('adj-treasury-amount');
    const amount = parseInt(input.value);
    if (isNaN(amount)) return alert("올바른 금액을 입력하세요.");

    const code = (window.userState.currentUser.classCode || window.userState.currentUser.adminCode).trim().toUpperCase();
    const current = window.userState.classData.treasury || 0;
    const next = mode === 'set' ? amount : current + amount;

    if (!confirm(`국고 잔액을 ₩${next.toLocaleString()}으로 조절하시겠습니까?`)) return;
    try {
        await db.collection('classes').doc(code).update({ treasury: next });
        alert("국고가 조정되었습니다.");
        input.value = '';
    } catch (err) { alert(err.message); }
};

function loadTreasuryLogs(code) {
    db.collection('classes').doc(code).collection('treasuryLogs').orderBy('timestamp', 'desc').limit(50).onSnapshot(snap => {
        const logList = document.getElementById('treasury-logs');
        if (!logList) return;
        logList.innerHTML = '';
        
        snap.forEach(doc => {
            const l = doc.data();
            const date = l.timestamp ? l.timestamp.toDate().toLocaleString() : '-';
            const color = l.type === 'issuance' ? 'var(--secondary)' : (l.amount < 0 ? 'var(--danger)' : 'var(--primary)');
            const sign = l.amount > 0 ? '+' : '';
            
            logList.innerHTML += `<li style="margin-bottom:8px; border-bottom:1px solid #222; padding-bottom:5px;">
                <small style="color:#666;">[${date}]</small><br>
                <span style="color:${color}; font-weight:bold;">${l.description}</span>: 
                <span style="color:${color}">${sign}${l.amount.toLocaleString()}</span>
            </li>`;
        });
    });
}

window.adjustDebt = async (mode) => {
    const input = document.getElementById('adj-debt-amount');
    const amount = parseInt(input.value);
    if (isNaN(amount)) return alert("올바른 금액을 입력하세요.");

    const code = (window.userState.currentUser.classCode || window.userState.currentUser.adminCode).trim().toUpperCase();
    const current = window.userState.classData.debt || 0;
    const next = mode === 'set' ? Math.max(0, amount) : Math.max(0, current + amount);

    if (!confirm(`미상환 국채를 ₩${next.toLocaleString()}으로 조절하시겠습니까?`)) return;
    try {
        await db.collection('classes').doc(code).update({ debt: next });
        alert("국채가 조정되었습니다.");
        input.value = '';
    } catch (err) { alert(err.message); }
};

window.updateBankPolicy = async () => {
    const br = parseFloat(document.getElementById('policy-base-rate').value);
    const mh = parseInt(document.getElementById('policy-maturity-hours').value);
    const ls = parseFloat(document.getElementById('policy-loan-spread').value);
    const bs = parseFloat(document.getElementById('policy-bond-spread').value);
    const code = (window.userState.currentUser.classCode || window.userState.currentUser.adminCode).trim().toUpperCase();

    try {
        await db.collection('classes').doc(code).set({ baseRate: br, maturityHours: mh, loanSpread: ls, bondSpread: bs }, { merge: true });
        alert("정책 반영 완료!");
    } catch (err) { alert(err.message); }
};

window.sendBulkSalaries = async () => {
    const selected = document.querySelectorAll('.job-checkbox:checked');
    const data = window.userState.classData;
    const code = (window.userState.currentUser.classCode || window.userState.currentUser.adminCode).trim().toUpperCase();
    
    let total = 0;
    const batch = db.batch();
    selected.forEach(cb => {
        const salary = parseInt(cb.closest('tr').querySelector('.salary-input').value);
        total += salary;
        batch.update(db.collection('users').doc(cb.value), { balance: firebase.firestore.FieldValue.increment(salary) });
    });

    const isBond = data.treasury < total;
    if (isBond && !confirm("국고 부족! 국채를 발행하시겠습니까?")) return;

    batch.update(db.collection('classes').doc(code), { 
        treasury: isBond ? 0 : data.treasury - total, 
        debt: firebase.firestore.FieldValue.increment(isBond ? total - data.treasury : 0) 
    });
    await batch.commit();
    alert("지급 완료!");
};

window.sendBulkAssets = async () => {
    const selected = document.querySelectorAll('.student-checkbox:checked');
    const amt = parseInt(document.getElementById('bulk-cash-amount').value);
    if (isNaN(amt) || amt <= 0) return alert("금액 오류");

    const u = window.userState.currentUser;
    const code = (u.classCode || u.adminCode).trim().toUpperCase();
    const data = window.userState.classData;
    const total = selected.length * amt;
    const treasury = data.treasury || 0;

    let useBond = false;
    if (treasury < total) {
        if (!confirm(`국고 부족! (잔액: ₩${treasury.toLocaleString()} / 필요: ₩${total.toLocaleString()})\n\n국채를 발행하시겠습니까?`)) return;
        useBond = true;
    } else {
        if (!confirm(`${selected.length}명에게 ₩${amt.toLocaleString()}씩 지급하시겠습니까?`)) return;
    }

    const batch = db.batch();
    selected.forEach(cb => batch.update(db.collection('users').doc(cb.value), { balance: firebase.firestore.FieldValue.increment(amt) }));
    
    batch.update(db.collection('classes').doc(code), { 
        treasury: useBond ? 0 : treasury - total, 
        debt: firebase.firestore.FieldValue.increment(useBond ? total - treasury : 0) 
    });
    await batch.commit();
    alert("지급 완료!");
    document.getElementById('bulk-cash-amount').value = '';
};

window.toggleApproval = async (uid, s) => { await db.collection('users').doc(uid).update({ isAuthorized: s }); };
window.updateJobInfo = async (uid, btn) => {
    const row = btn.closest('tr');
    const job = row.querySelector('.job-input').value;
    const salary = parseInt(row.querySelector('.salary-input').value);
    await db.collection('users').doc(uid).update({ job, salary });
    alert("저장 완료");
};

window.openModifyModal = (uid, name, balance) => {
    document.getElementById('modify-target-name').textContent = name;
    document.getElementById('modify-cash-amount').value = balance;
    document.getElementById('modify-asset-modal').style.display = 'block';
    window.currentModifyUid = uid;
};

window.confirmModifyAsset = async () => {
    const amt = parseInt(document.getElementById('modify-cash-amount').value);
    const uid = window.currentModifyUid;
    if (!uid || isNaN(amt)) return alert("입력 오류");
    try {
        await db.collection('users').doc(uid).update({ balance: amt });
        alert("자산이 강제 조정되었습니다.");
        document.getElementById('modify-asset-modal').style.display = 'none';
    } catch (err) { alert(err.message); }
};

window.sendBulkItems = async () => {
    const selected = document.querySelectorAll('.student-checkbox:checked');
    const itemId = document.getElementById('bulk-item-select').value;
    const data = window.userState.classData;
    const code = (window.userState.currentUser.classCode || window.userState.currentUser.adminCode).trim().toUpperCase();

    if (selected.length === 0 || !itemId) return alert("학생과 아이템을 선택하세요.");

    try {
        const iRef = db.collection('items').doc(itemId);
        const iDoc = await iRef.get();
        const item = iDoc.data();
        const totalCost = selected.length * item.price;

        if (item.stock < selected.length) return alert("상점 재고가 부족합니다.");

        let useBond = false;
        if (data.treasury < totalCost) {
            if (!confirm(`국고 부족! (잔액: ₩${data.treasury.toLocaleString()} / 필요: ₩${totalCost.toLocaleString()})\n\n국채를 발행하여 선물하시겠습니까?`)) return;
            useBond = true;
        } else {
            if (!confirm(`${selected.length}명에게 [${item.name}]을 선물하시겠습니까?\n(국고 ₩${totalCost.toLocaleString()} 차감)`)) return;
        }

        const batch = db.batch();
        selected.forEach(cb => {
            batch.set(db.collection('users').doc(cb.value).collection('inventory').doc(), {
                itemName: item.name, timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        batch.update(iRef, { stock: firebase.firestore.FieldValue.increment(-selected.length) });
        batch.update(db.collection('classes').doc(code), { 
            treasury: useBond ? 0 : data.treasury - totalCost,
            debt: firebase.firestore.FieldValue.increment(useBond ? totalCost - data.treasury : 0)
        });
        
        await batch.commit();
        alert("선물 완료!");
    } catch (err) { alert(err.message); }
};

window.addEventListener('load', () => {
    window.simulation = new EconomicSimulation();
    window.authManager = new AuthManager(window.simulation);
    setupNavigation();
    document.getElementById('confirm-modify-asset')?.addEventListener('click', window.confirmModifyAsset);
    document.querySelector('.close-modify-asset')?.addEventListener('click', () => document.getElementById('modify-asset-modal').style.display='none');
});

function setupNavigation() {
    document.querySelectorAll('.parent-link').forEach(link => { link.onclick = (e) => { e.preventDefault(); link.parentElement.classList.toggle('open'); }; });
    document.querySelectorAll('.sidebar a:not(.parent-link)').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
            const target = document.getElementById(link.id.replace('-link', '-view'));
            if (target) target.style.display = 'block';
        };
    });
}