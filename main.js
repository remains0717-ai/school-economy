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
                if (window.userState.currentUser?.role === 'admin') this.loadAdminLists();
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

        // [1] 학생 목록 (onSnapshot으로 실시간 연동)
        db.collection('users').where('adminCode','==',code).where('role','==','student').onSnapshot(snap => {
            const accBody = document.getElementById('student-list-body');
            const assetBody = document.getElementById('asset-mgmt-body');
            const jobBody = document.getElementById('job-mgmt-body');
            
            if (accBody) accBody.innerHTML = '';
            if (assetBody) assetBody.innerHTML = '';
            if (jobBody) jobBody.innerHTML = '';

            snap.forEach(doc => {
                const d = doc.data();
                const uid = doc.id;

                if (accBody) {
                    const status = d.isAuthorized ? '<span style="color:var(--primary)">승인됨</span>' : '<span style="color:var(--danger)">미승인</span>';
                    const btnText = d.isAuthorized ? "승인 취소" : "승인 하기";
                    const btnColor = d.isAuthorized ? "var(--danger)" : "var(--primary)";
                    accBody.innerHTML += `<tr><td>${d.username}</td><td>${status}</td><td><button onclick="window.toggleApproval('${uid}', ${!d.isAuthorized})" style="background:${btnColor}">${btnText}</button></td></tr>`;
                }

                if (assetBody) {
                    assetBody.innerHTML += `<tr><td><input type="checkbox" class="student-checkbox" value="${uid}"></td><td>${d.nickname||d.username}</td><td style="color:var(--primary)">₩${(d.balance||0).toLocaleString()}</td><td>₩${(d.bankBalance||0).toLocaleString()}</td><td class="important-metric">₩${((d.balance||0)+(d.bankBalance||0)).toLocaleString()}</td><td><button onclick="window.openModifyModal('${uid}','${d.username}',${d.balance||0})">수정</button></td></tr>`;
                }

                if (jobBody) {
                    jobBody.innerHTML += `<tr><td><input type="checkbox" class="job-checkbox" value="${uid}"></td><td>${d.nickname||d.username}</td><td><input type="text" value="${d.job||''}" class="job-input" style="width:80px"></td><td><input type="number" value="${d.salary||0}" class="salary-input" style="width:80px"></td><td><button onclick="window.updateJobInfo('${uid}', this)">저장</button></td></tr>`;
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
        this.currentStock = null;
        this.topStocks = [
            { symbol: 'AAPL', name: '애플' }, { symbol: 'TSLA', name: '테슬라' },
            { symbol: 'NVDA', name: '엔비디아' }, { symbol: 'MSFT', name: '마이크로소프트' },
            { symbol: 'AMZN', name: '아마존' }, { symbol: 'GOOGL', name: '구글' },
            { symbol: 'META', name: '메타' }, { symbol: 'NFLX', name: '넷플릭스' },
            { symbol: 'BTC-USD', name: '비트코인' }, { symbol: 'DIS', name: '디즈니' }
        ];
    }
    sync(user) { 
        this.user = user; 
        const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setT('current-cash', (user.balance||0).toLocaleString());
        setT('current-bank-balance', (user.bankBalance||0).toLocaleString());
        setT('bank-balance-amount', (user.bankBalance||0).toLocaleString());
        setT('total-assets', ((user.balance||0) + (user.bankBalance||0)).toLocaleString());
        setT('display-job', user.job || "없음");
        setT('display-credit', user.creditScore || 500);
        
        const grade = Math.max(1, Math.min(10, 11 - Math.floor((user.creditScore || 500) / 100)));
        setT('loan-credit-grade', `${grade}등급`);
        setT('loan-limit', ((11-grade)*5000).toLocaleString());
        this.loadDeposits();
        this.loadTopStocks();
        if (this.currentStock) this.selectStock(this.currentStock.symbol, this.currentStock.name);
    }

    async loadTopStocks() {
        const listContainer = document.getElementById('top-stocks-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        for (const stock of this.topStocks) {
            const price = await this.getStockPrice(stock.symbol);
            const card = document.createElement('div');
            card.className = 'asset-status';
            card.style.cursor = 'pointer';
            card.style.border = '1px solid #333';
            card.onclick = () => this.selectStock(stock.symbol, stock.name);
            card.innerHTML = `
                <strong style="color:var(--primary)">${stock.name}</strong>
                <p style="margin:5px 0; font-size:0.9rem;">$${price.toLocaleString()}</p>
                <small style="color:#888;">${stock.symbol}</small>
            `;
            listContainer.appendChild(card);
        }
    }

    async searchStock() {
        const query = document.getElementById('stock-search-input').value.trim();
        if (!query) return;
        
        const resultsBox = document.getElementById('stock-search-results');
        resultsBox.innerHTML = '<p style="padding:10px; color:#888;">검색 중...</p>';
        resultsBox.classList.remove('hidden');

        try {
            // Yahoo Finance Search API (CORS 프록시 사용 권장되나 여기선 시연용으로 구성)
            // 실제 구현 시 백엔드 프록시나 공식 API 키 사용 필요
            // 여기서는 검색어와 매칭되는 주요 종목 필터링으로 대체하여 안정성 확보
            const matches = this.topStocks.filter(s => s.name.includes(query) || s.symbol.includes(query.toUpperCase()));
            
            if (matches.length === 0) {
                resultsBox.innerHTML = '<p style="padding:10px; color:#888;">결과가 없습니다.</p>';
            } else {
                resultsBox.innerHTML = '';
                matches.forEach(s => {
                    const div = document.createElement('div');
                    div.style.padding = '10px';
                    div.style.cursor = 'pointer';
                    div.style.borderBottom = '1px solid #333';
                    div.innerHTML = `<strong>${s.name}</strong> <small style="color:#888;">(${s.symbol})</small>`;
                    div.onclick = () => {
                        this.selectStock(s.symbol, s.name);
                        resultsBox.classList.add('hidden');
                    };
                    resultsBox.appendChild(div);
                });
            }
        } catch (err) { resultsBox.innerHTML = '<p style="padding:10px; color:var(--danger)">검색 실패</p>'; }
    }

    async selectStock(symbol, name) {
        const price = await this.getStockPrice(symbol);
        this.currentStock = { symbol, name, price };
        
        document.getElementById('stock-detail-panel').classList.remove('hidden');
        document.getElementById('selected-stock-name').textContent = name;
        document.getElementById('selected-stock-symbol').textContent = symbol;
        document.getElementById('current-price-val').textContent = `$${price.toLocaleString()}`;
        
        // 보유 현황 로드
        const portSnap = await db.collection('users').doc(this.user.uid).collection('portfolio').doc(symbol).get();
        const myData = portSnap.exists ? portSnap.data() : { count: 0, avgPrice: 0 };
        document.getElementById('my-stock-count').textContent = myData.count;
        document.getElementById('my-avg-price').textContent = `$${(myData.avgPrice || 0).toLocaleString()}`;
    }

    async getStockPrice(symbol) {
        // 실제 운영 시 Finnhub, Alpha Vantage 등 사용
        // 여기서는 시연을 위해 고정가에 약간의 변동성을 준 시뮬레이션 가격 반환
        const basePrices = { AAPL: 180, TSLA: 200, NVDA: 700, MSFT: 400, AMZN: 170, GOOGL: 140, META: 450, NFLX: 600, 'BTC-USD': 50000, DIS: 110 };
        const base = basePrices[symbol] || 100;
        const volatility = (Math.random() - 0.5) * (base * 0.02); // 1% 변동성
        return Math.floor((base + volatility) * 100) / 100;
    }

    async executeTrade(type) {
        if (!this.currentStock) return alert("종목을 먼저 선택하세요.");
        const amount = parseInt(document.getElementById('stock-trade-amount').value);
        if (isNaN(amount) || amount <= 0) return alert("수량을 입력하세요.");

        const symbol = this.currentStock.symbol;
        const price = this.currentStock.price;
        const totalCost = price * amount * 1300; // 환율 시뮬레이션 (1300원)
        
        const userRef = db.collection('users').doc(this.user.uid);
        const portRef = userRef.collection('portfolio').doc(symbol);

        try {
            await db.runTransaction(async (t) => {
                const uDoc = await t.get(userRef);
                const pDoc = await t.get(portRef);
                const uData = uDoc.data();
                const pData = pDoc.exists ? pDoc.data() : { count: 0, avgPrice: 0 };

                if (type === 'buy') {
                    if (uData.balance < totalCost) throw new Error("잔액이 부족합니다.");
                    const newCount = pData.count + amount;
                    const newAvg = ((pData.avgPrice * pData.count) + (price * amount)) / newCount;
                    t.update(userRef, { balance: uData.balance - totalCost });
                    t.set(portRef, { count: newCount, avgPrice: newAvg });
                } else {
                    if (pData.count < amount) throw new Error("보유 수량이 부족합니다.");
                    t.update(userRef, { balance: uData.balance + totalCost });
                    const newCount = pData.count - amount;
                    if (newCount === 0) t.delete(portRef);
                    else t.update(portRef, { count: newCount });
                }
            });
            alert(`${type === 'buy' ? '매수' : '매도'} 완료!`);
            this.sync(this.user);
        } catch (err) { alert(err.message); }
    }

    async deposit() {
        const amt = parseInt(document.getElementById('bank-amount').value);
        if (isNaN(amt) || amt <= 0 || this.user.balance < amt) return alert("금액 부족 또는 잘못된 입력");
        
        const data = window.userState.classData;
        const maturityDate = new Date();
        maturityDate.setHours(maturityDate.getHours() + (data.maturityHours || 24));

        try {
            const batch = db.batch();
            const uRef = db.collection('users').doc(this.user.uid);
            batch.update(uRef, { balance: firebase.firestore.FieldValue.increment(-amt), bankBalance: firebase.firestore.FieldValue.increment(amt) });
            batch.set(uRef.collection('deposits').doc(), { amount: amt, rate: data.baseRate||0, status: 'active', maturityAt: firebase.firestore.Timestamp.fromDate(maturityDate), timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            await batch.commit();
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
        db.collection('users').doc(this.user.uid).collection('deposits').orderBy('timestamp','desc').onSnapshot(snap => {
            const body = document.getElementById('deposit-list-body');
            if (body) {
                body.innerHTML = '';
                snap.forEach(doc => {
                    const d = doc.data();
                    const now = new Date();
                    const isMatured = d.maturityAt.toDate() <= now;
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
                        <td>${d.maturityAt.toDate().toLocaleString()}</td>
                        <td>${statusText}</td>
                    </tr>`;
                });
            }
        });
    }

    async applyLoan() {
        const amt = parseInt(document.getElementById('loan-request-amount').value);
        if (isNaN(amt) || amt <= 0) return alert("금액 오류");
        try {
            await db.collection('users').doc(this.user.uid).update({ balance: firebase.firestore.FieldValue.increment(amt), debt: firebase.firestore.FieldValue.increment(amt) });
            alert("대출 완료");
        } catch (err) { alert(err.message); }
    }
    reset() { this.user = null; }
}

// [Global Admin Functions]
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