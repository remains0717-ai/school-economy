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

// [Log Activity Helper]
async function logActivity(type, description) {
    const u = window.userState.currentUser;
    const code = (u.classCode || u.adminCode).trim().toUpperCase();
    if (!code) return;

    try {
        await db.collection('classes').doc(code).collection('activityLogs').add({
            timestamp: firebase.firestore.Timestamp.now(),
            uid: u.uid,
            username: u.username,
            nickname: u.nickname || u.username,
            type: type, // 'banking', 'stock', 'shop', 'admin' 등
            description: description
        });
    } catch (err) { console.error("Logging failed:", err); }
}

function loadClassLogs(code) {
    const unsub = db.collection('classes').doc(code).collection('activityLogs').orderBy('timestamp', 'desc').limit(200).onSnapshot(snap => {
        window.rawLogs = []; // 검색을 위해 원본 데이터 저장
        snap.forEach(doc => window.rawLogs.push({ id: doc.id, ...doc.data() }));
        renderLogs(window.rawLogs);
    });
    window.userState.unsubscribe.push(unsub);
}

function renderLogs(logs) {
    const body = document.getElementById('class-logs-body');
    if (!body) return;
    body.innerHTML = '';

    logs.forEach(l => {
        const date = l.timestamp?.toDate().toLocaleString() || '-';
        let typeColor = '#888';
        if (l.type === 'banking') typeColor = 'var(--secondary)';
        else if (l.type === 'stock') typeColor = 'var(--primary)';
        else if (l.type === 'shop') typeColor = '#e91e63';
        else if (l.type === 'admin') typeColor = 'var(--danger)';

        body.innerHTML += `<tr>
            <td><input type="checkbox" class="log-checkbox" value="${l.id}"></td>
            <td>${date}</td>
            <td><strong>${l.nickname}</strong></td>
            <td><span style="color:${typeColor}">${l.type.toUpperCase()}</span></td>
            <td>${l.description}</td>
        </tr>`;
    });
}

window.filterLogs = () => {
    const nickQuery = document.getElementById('log-search-nickname').value.trim().toLowerCase();
    const dateQuery = document.getElementById('log-search-date').value;
    
    let filtered = window.rawLogs || [];
    if (nickQuery) {
        filtered = filtered.filter(l => l.nickname.toLowerCase().includes(nickQuery) || l.username.toLowerCase().includes(nickQuery));
    }
    if (dateQuery) {
        filtered = filtered.filter(l => l.timestamp?.toDate().toISOString().split('T')[0] === dateQuery);
    }
    renderLogs(filtered);
};

window.resetLogFilter = () => {
    document.getElementById('log-search-nickname').value = '';
    document.getElementById('log-search-date').value = '';
    renderLogs(window.rawLogs || []);
};

window.toggleAllLogs = (el) => {
    document.querySelectorAll('.log-checkbox').forEach(cb => cb.checked = el.checked);
};

window.deleteSelectedLogs = async () => {
    const selected = document.querySelectorAll('.log-checkbox:checked');
    if (selected.length === 0) return alert("삭제할 로그를 선택하세요.");
    if (!confirm(`${selected.length}개의 로그를 영구 삭제하시겠습니까?`)) return;

    const u = window.userState.currentUser;
    const code = (u.classCode || u.adminCode).trim().toUpperCase();
    const batch = db.batch();

    selected.forEach(cb => {
        batch.delete(db.collection('classes').doc(code).collection('activityLogs').doc(cb.value));
    });

    try {
        await batch.commit();
        alert("삭제되었습니다.");
    } catch (err) { alert("삭제 실패: " + err.message); }
};

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
        
        document.getElementById('signup-role')?.addEventListener('change', (e) => {
            const isStudent = e.target.value === 'student';
            document.getElementById('signup-email')?.classList.toggle('hidden', isStudent);
            document.getElementById('signup-class-code-container')?.classList.toggle('hidden', !isStudent);
        });

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
                    loadClassLogs(code); // 로그 불러오기 추가
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
            
            // 관리자 전용 대시보드 컨트롤 표시
            document.getElementById('admin-treasury-controls')?.classList.toggle('hidden', !isAdmin);
            
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
        const setC = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

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
        setT('loan-maturity-display', `${mh}시간`);
        setT('display-loan-rate', `${(br + ls).toFixed(1)}%`);

        // 상점 설정 반영
        setC('config-refund-enabled', data.shopConfig?.refundEnabled || false);
        setV('config-refund-days', data.shopConfig?.refundDays || 7);

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

        // [1] 모든 계정 목록 (onSnapshot으로 실시간 연동)
        this.adminListUnsub = db.collection('users').where('adminCode','==',code).onSnapshot(async snap => {
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
                adminCode: role === 'student' ? code : classCode, // 관리자도 본인 코드를 adminCode에 저장
                isAuthorized: role === 'admin', // 관리자는 자동 승인
                creditScore: 500
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
    openModal(mode = 'login') {
        const modal = document.getElementById('auth-modal');
        const loginContainer = document.getElementById('login-form-container');
        const signupContainer = document.getElementById('signup-form-container');
        const toggleText = document.getElementById('auth-toggle-text');

        if (!modal) return;
        modal.style.display = 'block';
        
        if (mode === 'login') {
            loginContainer?.classList.remove('hidden');
            signupContainer?.classList.add('hidden');
            if (toggleText) {
                toggleText.innerHTML = '계정이 없으신가요? <a href="#" id="go-signup" style="color:var(--primary); text-decoration:underline; cursor:pointer;">회원가입 하기</a>';
                document.getElementById('go-signup')?.addEventListener('click', (e) => { e.preventDefault(); this.openModal('signup'); });
            }
        } else {
            loginContainer?.classList.add('hidden');
            signupContainer?.classList.remove('hidden');
            if (toggleText) {
                toggleText.innerHTML = '이미 계정이 있으신가요? <a href="#" id="go-login" style="color:var(--primary); text-decoration:underline; cursor:pointer;">로그인 하기</a>';
                document.getElementById('go-login')?.addEventListener('click', (e) => { e.preventDefault(); this.openModal('login'); });
            }
        }
    }
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
        this.exchangeRate = 1350;
        this.tvWidget = null;
        this.lastStockTotal = 0;
        this.searchTimeout = null;
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

            // 아이템 그룹화 (이름 기준)
            const groups = {};
            snap.forEach(doc => {
                const item = doc.data();
                if (!groups[item.itemName]) {
                    groups[item.itemName] = { ...item, count: 1, ids: [doc.id], latestDate: item.timestamp?.toDate() };
                } else {
                    groups[item.itemName].count++;
                    groups[item.itemName].ids.push(doc.id);
                }
            });

            Object.values(groups).forEach(group => {
                const div = document.createElement('div');
                div.className = 'inventory-item';
                div.style.cursor = 'pointer';
                div.innerHTML = `
                    <div style="position:relative;">
                        <span style="font-size:1.1rem;">${group.itemName}</span>
                        ${group.count > 1 ? `<span style="position:absolute; top:-5px; right:-15px; background:var(--primary); color:#1a1a1a; padding:2px 6px; border-radius:10px; font-size:0.7rem; font-weight:bold;">x${group.count}</span>` : ''}
                    </div>
                    <small style="color:#666; display:block; margin-top:5px;">평균 ₩${group.price.toLocaleString()}</small>
                `;
                div.onclick = () => window.openItemDetail(group);
                grid.appendChild(div);
            });

            if (snap.empty) {
                grid.innerHTML = '<p style="color:#666; grid-column: 1/-1;">보유 중인 아이템이 없습니다.</p>';
            }
        });
    }

    async refundItem(itemId, itemName, price) {
        const config = window.userState.classData?.shopConfig || {};
        if (!config.refundEnabled) return alert("현재 학급 상점에서 환불 기능이 비활성화되어 있습니다.");

        if (!confirm(`[${itemName}]을 환불하시겠습니까?\n₩${price.toLocaleString()}이 즉시 입금됩니다.`)) return;

        try {
            const userRef = db.collection('users').doc(this.user.uid);
            const invRef = userRef.collection('inventory').doc(itemId);

            await db.runTransaction(async (t) => {
                const iDoc = await t.get(invRef);
                if (!iDoc.exists) throw new Error("이미 처리된 아이템입니다.");
                
                t.update(userRef, { balance: firebase.firestore.FieldValue.increment(price) });
                t.delete(invRef);
            });

            alert("환불이 완료되었습니다.");
            document.getElementById('item-detail-modal').style.display = 'none';
            logActivity('shop', `[${itemName}] 환불 (₩${price.toLocaleString()} 입금)`);
        } catch (err) { alert("환불 실패: " + err.message); }
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
        
        const searchInput = document.getElementById('stock-search-input');
        const resultsBox = document.getElementById('stock-search-results');

        searchInput?.addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.searchStockAPI(), 300);
        });
        
        window.addEventListener('click', (e) => {
            if (!e.target.closest('.search-results-box') && e.target.id !== 'stock-search-input') {
                if (resultsBox) resultsBox.classList.add('hidden');
            }
        });

        if (!this.currentStock) this.selectStock('NASDAQ:AAPL', '애플');
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

    async searchStockAPI() {
        const query = document.getElementById('stock-search-input').value.trim();
        const resultsBox = document.getElementById('stock-search-results');
        if (!query || query.length < 1) { resultsBox?.classList.add('hidden'); return; }

        try {
            // TradingView의 공개 검색 API 활용 (CORS 우회를 위해 심볼 검색 최적화)
            const response = await fetch(`https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(query)}&hl=1&lang=ko&domain=ko`);
            const data = await response.json();
            
            if (data.symbols && data.symbols.length > 0) {
                resultsBox.innerHTML = '';
                data.symbols.slice(0, 10).forEach(s => {
                    const tvSymbol = `${s.exchange}:${s.symbol}`;
                    const div = document.createElement('div');
                    div.style.padding = '12px 15px';
                    div.style.cursor = 'pointer';
                    div.style.borderBottom = '1px solid #333';
                    div.style.display = 'flex';
                    div.style.justifyContent = 'space-between';
                    div.style.alignItems = 'center';
                    div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.05)';
                    div.onmouseout = () => div.style.background = 'transparent';
                    
                    div.innerHTML = `
                        <div>
                            <strong style="color:var(--primary)">${s.description}</strong>
                            <br><small style="color:#888;">${tvSymbol} (${s.type})</small>
                        </div>
                        <span style="font-size:0.8rem; color:#666;">${s.exchange}</span>
                    `;
                    div.onclick = () => {
                        this.selectStock(tvSymbol, s.description);
                        document.getElementById('stock-search-input').value = s.description;
                        resultsBox.classList.add('hidden');
                    };
                    resultsBox.appendChild(div);
                });
                resultsBox.classList.remove('hidden');
            }
        } catch (e) {
            console.error("Search API Error:", e);
        }
    }

    async selectStock(symbol, name) {
        const price = await this.getStockPrice(symbol);
        this.currentStock = { symbol, name, price };
        this.updateTradingView(symbol);
        
        const nameEl = document.getElementById('selected-stock-name');
        const symbolEl = document.getElementById('selected-stock-symbol');
        if (nameEl) nameEl.textContent = name;
        if (symbolEl) symbolEl.textContent = symbol;
        
        this.updateTradeSummary();
        
        const portSnap = await db.collection('users').doc(this.user.uid).collection('portfolio').doc(symbol.replace(':', '_')).get();
        const myData = portSnap.exists ? portSnap.data() : { count: 0, avgPrice: 0 };
        document.getElementById('my-stock-count').textContent = `${myData.count} 주`;
        document.getElementById('my-avg-price').textContent = `$${(myData.avgPrice || 0).toLocaleString()}`;
    }

    async getStockPrice(symbol) {
        // 실제 API 연동이 없으므로 시연용 가격 생성 로직 유지
        const basePrices = { 
            AAPL: 245.50, TSLA: 412.30, NVDA: 135.20, MSFT: 425.10, 
            AMZN: 195.80, GOOGL: 188.40, META: 512.60, NFLX: 625.00, 
            BTCUSDT: 102500.00, DIS: 115.40, SOLUSDT: 245.00, ETHUSDT: 3850.00,
            KO: 65.20, SBUX: 95.10, NKE: 105.30, COST: 750.40, TSM: 145.20,
            '005930': 55.50, '000660': 125.20 
        };
        const ticker = symbol.includes(':') ? symbol.split(':')[1].replace('USDT', '') : symbol;
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
            logActivity('stock', `${symbol.split(':')[1]} ${amount}주 ${this.tradeMode === 'buy' ? '매수' : '매도'} (총 ₩${totalCost.toLocaleString()})`);
            this.selectStock(symbol, this.currentStock.name); // UI 갱신
        } catch (err) { alert(err.message); }
    }

    async buyItem(itemId, itemName, price, currentStock, dailyLimit = 0, quantity = 1) {
        const totalCost = price * quantity;
        if (this.user.balance < totalCost) return alert(`현금이 부족합니다!\n(필요: ₩${totalCost.toLocaleString()} / 현재: ₩${this.user.balance.toLocaleString()})`);
        if (currentStock < quantity) return alert(`재고가 부족합니다. (남은 재고: ${currentStock}개)`);

        // 일일 구매 제한 체크 (모달에서도 했지만 보안을 위해 한번 더 체크)
        if (dailyLimit > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const pSnap = await db.collection('users').doc(this.user.uid)
                .collection('inventory')
                .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(today))
                .get();
            
            const todayBuyCount = pSnap.docs.filter(doc => doc.data().itemName === itemName).length;
            
            if (todayBuyCount + quantity > dailyLimit) {
                return alert(`일일 구매 제한을 초과했습니다. (오늘 이미 ${todayBuyCount}개 구매 / 남은 가능 수량: ${dailyLimit - todayBuyCount}개)`);
            }
        }

        if (!confirm(`[${itemName}] ${quantity}개를 총 ₩${totalCost.toLocaleString()}에 구매하시겠습니까?`)) return;

        try {
            const userRef = db.collection('users').doc(this.user.uid);
            const itemRef = db.collection('items').doc(itemId);

            await db.runTransaction(async (t) => {
                const iDoc = await t.get(itemRef);
                const iData = iDoc.data();
                
                if (iData.stock < quantity) throw new Error("방금 물건이 품절되었거나 재고가 부족해졌습니다.");

                t.update(userRef, { balance: firebase.firestore.FieldValue.increment(-totalCost) });
                t.update(itemRef, { stock: firebase.firestore.FieldValue.increment(-quantity) });
                
                // 수량만큼 인벤토리 아이템 생성
                for (let i = 0; i < quantity; i++) {
                    const invRef = userRef.collection('inventory').doc();
                    t.set(invRef, {
                        itemName,
                        price,
                        timestamp: firebase.firestore.Timestamp.now()
                    });
                }
            });
            alert(`${quantity}개의 물품 구매가 완료되었습니다! 가방에서 확인하세요.`);
            logActivity('shop', `[${itemName}] ${quantity}개 구매 (총 ₩${totalCost.toLocaleString()})`);
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
            logActivity('banking', `₩${amt.toLocaleString()} 저축 (이율 ${data.baseRate||0}%)`);
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
        const maturityDate = new Date();
        maturityDate.setHours(maturityDate.getHours() + (data.maturityHours || 24));

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
                timestamp: firebase.firestore.Timestamp.now(),
                maturityAt: firebase.firestore.Timestamp.fromDate(maturityDate)
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
                
                // 만기 기간(Term) 기반 이자 계산: 1만기당 설정된 금리 적용
                const maturityHours = window.userState.classData?.maturityHours || 24;
                const termsPassed = hoursPassed / maturityHours;
                
                // 현재까지 쌓인 실시간 이자
                const currentInterest = Math.floor(d.amount * (d.rate / 100) * termsPassed); 
                // 만기 시 지불할 총 이자
                const fullInterest = Math.floor(d.amount * (d.rate / 100));
                
                const totalToPay = d.amount + currentInterest;
                const maturityDate = d.maturityAt ? d.maturityAt.toDate() : new Date(loanDate.getTime() + maturityHours * 60 * 60 * 1000);

                totalDebt += d.amount;
                totalInterest += currentInterest;

                body.innerHTML += `<tr>
                    <td><strong class="text-highlight">₩${d.amount.toLocaleString()}</strong></td>
                    <td><span class="badge-rate">${d.rate}%</span></td>
                    <td class="text-danger">₩${currentInterest.toLocaleString()}</td>
                    <td class="text-dim">₩${fullInterest.toLocaleString()}</td>
                    <td><strong class="important-metric" style="font-size:1rem;">₩${totalToPay.toLocaleString()}</strong></td>
                    <td>
                        <div class="date-box">
                            <span class="start-date">${loanDate.toLocaleDateString()} ${loanDate.getHours()}:${loanDate.getMinutes()} 시작</span>
                            <span class="end-date">${maturityDate.toLocaleDateString()} ${maturityDate.getHours()}:${maturityDate.getMinutes()} 만기</span>
                        </div>
                    </td>
                    <td><button onclick="window.simulation.repayLoan('${doc.id}', ${totalToPay}, ${d.amount})" class="auth-btn" style="font-size:0.8rem; padding:8px 12px; background:#444;">상환</button></td>
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
    const limit = parseInt(document.getElementById('new-item-limit').value) || 0;

    if (!category || !name || isNaN(price) || isNaN(stock)) return alert("모든 정보를 올바르게 입력하세요.");

    const code = (window.userState.currentUser.classCode || window.userState.currentUser.adminCode).trim().toUpperCase();

    try {
        await db.collection('items').add({
            classCode: code,
            category,
            name,
            price,
            stock,
            dailyLimit: limit,
            createdAt: firebase.firestore.Timestamp.now()
        });
        alert("물품이 등록되었습니다.");
        document.getElementById('new-item-category').value = '';
        document.getElementById('new-item-name').value = '';
        document.getElementById('new-item-price').value = '';
        document.getElementById('new-item-stock').value = '';
        document.getElementById('new-item-limit').value = '0';
    } catch (err) { alert("등록 실패: " + err.message); }
};

window.openEditShopModal = async (itemId) => {
    try {
        const doc = await db.collection('items').doc(itemId).get();
        if (!doc.exists) return;
        const d = doc.data();
        document.getElementById('edit-item-id').value = itemId;
        document.getElementById('edit-item-category').value = d.category || '';
        document.getElementById('edit-item-name').value = d.name || '';
        document.getElementById('edit-item-price').value = d.price || 0;
        document.getElementById('edit-item-stock').value = d.stock || 0;
        document.getElementById('edit-item-limit').value = d.dailyLimit || 0;
        document.getElementById('edit-shop-modal').style.display = 'block';
    } catch (err) { alert("불러오기 실패"); }
};

window.confirmEditShopItem = async () => {
    const id = document.getElementById('edit-item-id').value;
    const category = document.getElementById('edit-item-category').value.trim();
    const name = document.getElementById('edit-item-name').value.trim();
    const price = parseInt(document.getElementById('edit-item-price').value);
    const stock = parseInt(document.getElementById('edit-item-stock').value);
    const limit = parseInt(document.getElementById('edit-item-limit').value) || 0;

    if (!id || !name || isNaN(price)) return alert("필수 정보를 입력하세요.");

    try {
        await db.collection('items').doc(id).update({
            category, name, price, stock, dailyLimit: limit
        });
        alert("수정되었습니다.");
        document.getElementById('edit-shop-modal').style.display = 'none';
        logActivity('admin', `상점 물품 수정: [${name}]`);
    } catch (err) { alert("수정 실패: " + err.message); }
};

window.deleteShopItem = async (itemId) => {
    if (!confirm("정말로 이 물품을 삭제하시겠습니까?")) return;
    try {
        await db.collection('items').doc(itemId).delete();
        alert("삭제되었습니다.");
    } catch (err) { alert("삭제 실패: " + err.message); }
};

function loadAdminShopItems(code) {
    // 모든 아이템이 누락 없이 뜨도록 orderBy를 제거하거나 보완된 쿼리를 사용합니다.
    db.collection('items').where('classCode', '==', code).onSnapshot(snap => {
        const body = document.getElementById('admin-shop-list-body');
        if (!body) return;
        body.innerHTML = '';
        
        // 스냅샷에서 데이터를 가져온 후 자바스크립트 단에서 정렬 (createdAt이 없는 옛날 데이터 대응)
        const items = [];
        snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        items.forEach(item => {
            const limitText = item.dailyLimit > 0 ? `${item.dailyLimit}개` : '무제한';
            body.innerHTML += `<tr>
                <td>${item.category || '기타'}</td>
                <td><strong>${item.name}</strong></td>
                <td>₩${item.price.toLocaleString()}</td>
                <td>${item.stock} 개</td>
                <td>${limitText}</td>
                <td>
                    <button onclick="window.openEditShopModal('${item.id}')" style="background:var(--secondary); color:#1a1a1a; font-size:0.8rem; margin-right:5px;">수정</button>
                    <button onclick="window.deleteShopItem('${item.id}')" style="background:var(--danger); font-size:0.8rem;">삭제</button>
                </td>
            </tr>`;
        });
    });
}

function loadStudentShop(code) {
    db.collection('items').where('classCode', '==', code).onSnapshot(snap => {
        const grid = document.getElementById('shop-items-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const items = [];
        snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        items.forEach(item => {
            const limitInfo = item.dailyLimit > 0 ? `<p style="font-size:0.8rem; color:#aaa; margin-top:5px;">1인당 일일 ${item.dailyLimit}개 제한</p>` : '';
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <small style="color:#888;">${item.category || '기타'}</small>
                <h3 style="margin:5px 0;">${item.name}</h3>
                <span class="item-price">₩ ${item.price.toLocaleString()}</span>
                <p style="font-size:0.9rem; color:${item.stock > 0 ? '#00ffdd' : 'var(--danger)'};">
                    재고: ${item.stock > 0 ? item.stock + '개' : '품절'}
                </p>
                ${limitInfo}
                <button onclick="window.openPurchaseModal('${item.id}', '${item.name}', ${item.price}, ${item.stock}, ${item.dailyLimit || 0})" 
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

window.openPurchaseModal = async (itemId, itemName, price, stock, dailyLimit) => {
    const modal = document.getElementById('purchase-modal');
    const nameEl = document.getElementById('buy-item-name');
    const priceUnitEl = document.getElementById('buy-item-price-unit');
    const qtyInput = document.getElementById('buy-quantity');
    const limitInfoEl = document.getElementById('buy-limit-info');
    const confirmBtn = document.getElementById('confirm-purchase-btn');

    if (!modal || !window.userState.currentUser) return;

    nameEl.textContent = itemName;
    priceUnitEl.textContent = `단가: ₩ ${price.toLocaleString()}`;
    qtyInput.value = 1;
    
    let remaining = dailyLimit || 9999;
    if (dailyLimit > 0) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // 인덱스 오류 방지를 위해 필터링을 최소화하고 가져온 후 자바스크립트에서 체크
            const pSnap = await db.collection('users').doc(window.userState.currentUser.uid)
                .collection('inventory')
                .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(today))
                .get();
            
            const todayBuyCount = pSnap.docs.filter(doc => doc.data().itemName === itemName).length;
            remaining = Math.max(0, dailyLimit - todayBuyCount);
            limitInfoEl.textContent = `오늘 구매 가능: ${remaining}개 (총 ${dailyLimit}개 제한)`;
        } catch (e) {
            console.error("Limit check error:", e);
            remaining = dailyLimit; // 오류 시 일단 제한 수치로 설정
        }
    } else {
        limitInfoEl.textContent = "일일 구매 제한이 없는 상품입니다.";
    }

    const updatePrice = () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val < 1) val = 1;
        if (val > stock) val = stock;
        if (val > remaining) val = remaining;
        qtyInput.value = val;
        document.getElementById('buy-total-price').textContent = `₩ ${(val * price).toLocaleString()}`;
    };

    window.adjustBuyQty = (diff) => {
        qtyInput.value = (parseInt(qtyInput.value) || 1) + diff;
        updatePrice();
    };

    qtyInput.oninput = updatePrice;
    updatePrice();

    confirmBtn.onclick = () => {
        const qty = parseInt(qtyInput.value);
        if (qty > 0) {
            window.simulation.buyItem(itemId, itemName, price, stock, dailyLimit, qty);
            modal.style.display = 'none';
        }
    };

    modal.style.display = 'block';
};

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
    const input = document.getElementById('adj-treasury-amount');
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

window.saveShopSettings = async () => {
    const refundEnabled = document.getElementById('config-refund-enabled').checked;
    const refundDays = parseInt(document.getElementById('config-refund-days').value) || 0;
    const code = (window.userState.currentUser.classCode || window.userState.currentUser.adminCode).trim().toUpperCase();

    try {
        await db.collection('classes').doc(code).update({
            shopConfig: { refundEnabled, refundDays }
        });
        alert("상점 설정이 저장되었습니다.");
    } catch (err) { alert("저장 실패: " + err.message); }
};

window.openItemDetail = (group) => {
    const modal = document.getElementById('item-detail-modal');
    const body = document.getElementById('item-detail-body');
    const config = window.userState.classData?.shopConfig || {};
    
    const now = new Date();
    const purchaseDate = group.latestDate;
    const diffDays = purchaseDate ? Math.floor((now - purchaseDate) / (1000 * 60 * 60 * 24)) : 999;
    const canRefund = config.refundEnabled && diffDays <= config.refundDays;

    let refundHtml = '';
    if (config.refundEnabled) {
        if (canRefund) {
            refundHtml = `
                <div style="margin-top:20px; padding:15px; border:1px solid var(--danger); border-radius:10px;">
                    <p style="color:var(--danger); font-size:0.9rem;">환불 가능 (${config.refundDays}일 이내)</p>
                    <button onclick="window.simulation.refundItem('${group.ids[0]}', '${group.itemName}', ${group.price})" 
                            class="submit-btn" style="background:var(--danger); color:white; margin-top:10px;">환불하기 (1개)</button>
                </div>
            `;
        } else {
            refundHtml = `<p style="color:#666; font-size:0.85rem; margin-top:20px;">환불 기간이 지났습니다. (구매 후 ${diffDays}일 경과)</p>`;
        }
    } else {
        refundHtml = `<p style="color:#666; font-size:0.85rem; margin-top:20px;">현재 상점 환불 기능이 비활성화되어 있습니다.</p>`;
    }

    body.innerHTML = `
        <h3 style="color:var(--primary); font-size:1.5rem;">${group.itemName}</h3>
        <p style="color:#888;">보유 수량: ${group.count}개</p>
        <p style="color:#888;">구매가: ₩${group.price.toLocaleString()}</p>
        ${refundHtml}
    `;
    modal.style.display = 'block';
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