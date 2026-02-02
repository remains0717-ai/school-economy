// 전역 상태 관리
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
        this.initEvents();
        this.listenToAuth();
    }

    initEvents() {
        document.getElementById('login-btn')?.addEventListener('click', () => this.openModal('login'));
        document.getElementById('signup-btn')?.addEventListener('click', () => this.openModal('signup'));
        document.querySelector('.close-modal')?.addEventListener('click', () => document.getElementById('auth-modal').style.display='none');
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('user-display-name')?.addEventListener('click', () => this.openMyInfo());
        document.getElementById('add-item-btn')?.addEventListener('click', () => this.addShopItem());
        document.getElementById('signup-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.signup(); });
        document.getElementById('login-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.login(); });
        
        document.getElementById('selectAllStudents')?.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.student-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            this.updateSelectedCount();
        });

        document.getElementById('selectAllJobs')?.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.job-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            this.updateSelectedJobCount();
        });

        window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; };
    }

    listenToAuth() {
        auth.onAuthStateChanged(user => {
            window.userState.unsubscribe.forEach(u => u());
            window.userState.unsubscribe = [];
            if (user) {
                const unsub = db.collection('users').doc(user.uid).onSnapshot(doc => {
                    if (doc.exists) {
                        window.userState.currentUser = { uid: user.uid, ...doc.data() };
                        window.userState.isLoggedIn = true;
                        this.updateUI();
                        this.simulation.sync(window.userState.currentUser);
                        const code = window.userState.currentUser.classCode || window.userState.currentUser.adminCode;
                        if (code) this.listenToClass(code);
                    }
                });
                window.userState.unsubscribe.push(unsub);
            } else {
                window.userState.currentUser = null; window.userState.isLoggedIn = false;
                this.updateUI(); this.simulation.reset();
            }
        });
    }

    listenToClass(code) {
        const unsub = db.collection('classes').doc(code).onSnapshot(doc => {
            if (doc.exists) {
                window.userState.classData = doc.data();
                this.updateClassUI();
            }
        });
        window.userState.unsubscribe.push(unsub);
    }

    updateUI() {
        const user = window.userState.currentUser;
        const loggedIn = window.userState.isLoggedIn;
        const els = {
            info: document.getElementById('user-info'),
            login: document.getElementById('login-btn'),
            signup: document.getElementById('signup-btn'),
            lHome: document.getElementById('logged-in-home'),
            oHome: document.getElementById('logged-out-home'),
            adminMenu: document.getElementById('admin-menu'),
            shopAdmin: document.getElementById('admin-shop-controls'),
            treasuryAdmin: document.getElementById('admin-treasury-controls')
        };

        if (els.info) els.info.classList.toggle('hidden', !loggedIn);
        if (els.login) els.login.classList.toggle('hidden', loggedIn);
        if (els.signup) els.signup.classList.toggle('hidden', loggedIn);
        if (els.lHome) els.lHome.classList.toggle('hidden', !loggedIn);
        if (els.oHome) els.oHome.classList.toggle('hidden', loggedIn);

        if (loggedIn) {
            const dn = document.getElementById('user-display-name');
            if (dn) dn.textContent = user.nickname || user.username;
            const isAdmin = user.role === 'admin';
            if (els.adminMenu) els.adminMenu.classList.toggle('hidden', !isAdmin);
            if (els.shopAdmin) els.shopAdmin.classList.toggle('hidden', !isAdmin);
            if (els.treasuryAdmin) els.treasuryAdmin.classList.toggle('hidden', !isAdmin);
            
            if (isAdmin) {
                const mc = document.getElementById('mgmt-class-code');
                if (mc) mc.textContent = user.classCode;
                this.loadAdminLists();
            }
        } else {
            if (els.adminMenu) els.adminMenu.classList.add('hidden');
            if (els.shopAdmin) els.shopAdmin.classList.add('hidden');
            if (els.treasuryAdmin) els.treasuryAdmin.classList.add('hidden');
        }
    }

    updateClassUI() {
        const data = window.userState.classData;
        if (!data) return;
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('class-treasury', `₩${(data.treasury || 0).toLocaleString()}`);
        setEl('treasury-amount', (data.treasury || 0).toLocaleString());
        setEl('debt-amount', (data.debt || 0).toLocaleString());
        if (data.news) {
            const tc = document.getElementById('news-ticker-container');
            const tt = document.getElementById('news-ticker');
            if (tc) tc.classList.remove('hidden');
            if (tt) tt.textContent = `📢 ${data.news}`;
        }
    }

    async loadAdminLists() {
        const code = window.userState.currentUser?.classCode;
        if (!code) return;

        // 학생 목록 (승인 관리용)
        db.collection('users').where('adminCode','==',code).where('role','==','student').onSnapshot(snap => {
            const body = document.getElementById('student-list-body');
            if(!body) return;
            body.innerHTML = '';
            snap.forEach(doc => {
                const d = doc.data();
                const tr = document.createElement('tr');
                const statusText = d.isAuthorized ? '<span style="color:var(--primary)">승인됨</span>' : '<span style="color:var(--danger)">미승인</span>';
                const actionBtn = d.isAuthorized 
                    ? `<button onclick="window.toggleApproval('${doc.id}', false)" style="background:var(--danger)">승인 취소</button>`
                    : `<button onclick="window.toggleApproval('${doc.id}', true)" style="background:var(--primary); color:#1a1a1a;">승인 하기</button>`;
                tr.innerHTML = `<td>${d.username}</td><td>${statusText}</td><td>${actionBtn}</td>`;
                body.appendChild(tr);
            });
        });

        // 자산 현황 테이블
        db.collection('users').where('adminCode','==',code).where('role','==','student').onSnapshot(snap => {
            const body = document.getElementById('asset-mgmt-body');
            if(!body) return;
            body.innerHTML = '';
            snap.forEach(doc => {
                const d = doc.data();
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><input type="checkbox" class="student-checkbox" value="${doc.id}"></td><td>${d.nickname||d.username}</td><td style="color:var(--primary)">₩${(d.balance||0).toLocaleString()}</td><td>₩0</td><td class="important-metric">₩${(d.balance||0).toLocaleString()}</td><td><button onclick="window.openModifyModal('${doc.id}','${d.username}',${d.balance||0})">수정</button></td>`;
                body.appendChild(tr);
                // 체크박스 이벤트 리스너 추가 (동적 생성 대응)
                tr.querySelector('.student-checkbox').addEventListener('change', () => this.updateSelectedCount());
            });
        });

        // 직업 관리 테이블
        db.collection('users').where('adminCode','==',code).where('role','==','student').onSnapshot(snap => {
            const body = document.getElementById('job-mgmt-body');
            if(!body) return;
            body.innerHTML = '';
            snap.forEach(doc => {
                const d = doc.data();
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="checkbox" class="job-checkbox" value="${doc.id}" data-salary="${d.salary||0}"></td>
                    <td>${d.nickname||d.username}</td>
                    <td><input type="text" value="${d.job||''}" placeholder="직업명" class="job-input" style="width:100px;"></td>
                    <td><input type="number" value="${d.salary||0}" placeholder="급여" class="salary-input" style="width:100px;"></td>
                    <td><button onclick="window.updateJobInfo('${doc.id}', this)">저장</button></td>
                `;
                body.appendChild(tr);
                // 체크박스 이벤트 리스너 추가
                tr.querySelector('.job-checkbox').addEventListener('change', () => this.updateSelectedJobCount());
            });
        });

        // 아이템 선택박스
        db.collection('items').where('classCode','==',code).onSnapshot(snap => {
            const select = document.getElementById('bulk-item-select');
            if(!select) return;
            select.innerHTML = '<option value="">아이템 선택</option>';
            snap.forEach(doc => {
                const item = doc.data();
                if(item.stock > 0) select.innerHTML += `<option value="${doc.id}">${item.name} (₩${item.price})</option>`;
            });
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
                await db.collection('classes').doc(classCode).set({ adminUid: cred.user.uid, adminEmail: finalEmail, treasury: 0, debt: 0, news: "" });
            }
            await db.collection('users').doc(cred.user.uid).set({
                username, role, email: finalEmail, balance: 1000, 
                classCode: role === 'admin' ? classCode : "", 
                adminCode: role === 'student' ? inputCode : "", 
                isAuthorized: false, creditScore: 500
            });
            alert("가입 완료!"); location.reload();
        } catch (err) { alert("실패: " + err.message); }
    }

    async login() {
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        const e = u.includes('@') ? u : `${u.toLowerCase()}@student.com`;
        try { await auth.signInWithEmailAndPassword(e, p); document.getElementById('auth-modal').style.display='none'; } catch(err) { alert("실패"); }
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
}

class EconomicSimulation {
    constructor() { this.user = null; }
    sync(user) { 
        this.user = user; 
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('current-cash', (user.balance||0).toLocaleString());
        setEl('total-assets', (user.balance||0).toLocaleString());
        setEl('display-job', user.job || "없음");
        setEl('display-credit', user.creditScore || 500);
        this.loadShopItems();
        this.loadUserInventory();
    }

    loadShopItems() {
        const code = this.user.role === 'admin' ? this.user.classCode : this.user.adminCode;
        if (!code) return;
        db.collection('items').where('classCode','==',code).onSnapshot(snap => {
            const container = document.getElementById('shop-content-container');
            if(!container) return; container.innerHTML = '';
            const groups = {};
            snap.forEach(doc => { const d = doc.data(); const cat = d.category || '기타'; if(!groups[cat]) groups[cat]=[]; groups[cat].push({id:doc.id, ...d}); });
            for (const cat in groups) {
                const section = document.createElement('div');
                section.innerHTML = `<h3 style="margin-top:30px; border-left:4px solid var(--primary); padding-left:15px;">${cat}</h3><div class="shop-grid"></div>`;
                const grid = section.querySelector('.shop-grid');
                groups[cat].forEach(item => {
                    const soldOut = item.stock <= 0;
                    grid.innerHTML += `<div class="item-card ${soldOut?'out-of-stock':''}"><h4>${item.name}</h4><span class="item-price">₩ ${item.price.toLocaleString()}</span><p>재고: ${item.stock}</p><button class="submit-btn" onclick="window.buyItem('${item.id}','${item.name}',${item.price})" ${soldOut?'disabled':''}>구매하기</button></div>`;
                });
                container.appendChild(section);
            }
        });
    }

    loadUserInventory() {
        if(!this.user || this.user.role === 'admin') return;
        db.collection('users').doc(this.user.uid).collection('inventory').orderBy('timestamp','desc').onSnapshot(snap => {
            const grid = document.getElementById('home-inventory-grid'); if(!grid) return; grid.innerHTML = '';
            snap.forEach(doc => { const d = doc.data(); grid.innerHTML += `<div class="inventory-item"><span>${d.itemName}</span></div>`; });
        });
    }

    async buyItem(id, name, price) {
        if (this.user.balance < price) return alert("잔액 부족");
        if (!confirm(`${name} 구매?`)) return;
        const userRef = db.collection('users').doc(this.user.uid);
        const itemRef = db.collection('items').doc(id);
        try {
            await db.runTransaction(async (t) => {
                const iDoc = await t.get(itemRef);
                if (iDoc.data().stock <= 0) throw "품절";
                t.update(userRef, { balance: this.user.balance - price });
                t.update(itemRef, { stock: iDoc.data().stock - 1 });
                t.set(userRef.collection('inventory').doc(), { itemName: name, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            });
            await this.logActivity('SHOP_PURCHASE', -price, `${name} 구매`);
        } catch (err) { alert(err); }
    }

    async logActivity(type, amount, description) {
        const u = window.userState.currentUser;
        await db.collection('class_activities').add({
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userUid: u.uid, userName: u.nickname || u.username,
            type, amount, description, classCode: u.adminCode || u.classCode
        });
    }
    reset() { this.user = null; }
}

// [신설] 관리자 국고 직접 조절 기능
window.adjustTreasury = async (mode) => {
    const input = document.getElementById('adj-treasury-amount');
    const amount = parseInt(input.value);
    if (isNaN(amount) || amount < 0) return alert("올바른 금액을 입력하세요.");

    const classCode = window.userState.currentUser.classCode;
    const currentTreasury = window.userState.classData.treasury || 0;
    const newAmount = mode === 'set' ? amount : currentTreasury + amount;

    if (!confirm(`학급 국고를 ₩${newAmount.toLocaleString()}으로 변경하시겠습니까?`)) return;

    try {
        await db.collection('classes').doc(classCode).update({ treasury: newAmount });
        alert(`국고가 성공적으로 ${mode === 'set' ? '설정' : '추가'}되었습니다.`);
        input.value = '';
    } catch (err) {
        alert("국고 조절 실패: " + err.message);
    }
};

// [개편] 관리자 전용 대량 자산 지급 시스템 (안정성 강화)
window.sendBulkAssets = async () => {
    console.log("Bulk Assets Process Started...");
    
    // 1. 선택된 학생 및 입력 금액 확인
    const checkboxes = document.querySelectorAll('.student-checkbox:checked');
    const selectedUids = Array.from(checkboxes).map(cb => cb.value);
    const amount = parseInt(document.getElementById('bulk-cash-amount')?.value);

    if (selectedUids.length === 0) return alert("지급할 학생을 먼저 선택해 주세요.");
    if (isNaN(amount) || amount <= 0) return alert("지급할 금액을 입력해 주세요.");

    // 2. 최신 학급 데이터 확보 (메모리 데이터가 없을 경우 서버에서 직접 로드)
    const classCode = window.userState.currentUser.classCode;
    let classSnap = await db.collection('classes').doc(classCode).get();
    let classData = classSnap.data();
    
    const treasury = classData.treasury || 0;
    const totalNeeded = selectedUids.length * amount;

    // 3. 국고 잔액 체크 및 국채 발행 확인
    let useBond = false;
    if (treasury < totalNeeded) {
        if (!confirm(`국고가 부족합니다 (잔액: ₩${treasury.toLocaleString()} / 필요: ₩${totalNeeded.toLocaleString()})\n\n부족분 ₩${(totalNeeded - treasury).toLocaleString()}을 국채 발행으로 충당하시겠습니까?`)) return;
        useBond = true;
    } else {
        if (!confirm(`${selectedUids.length}명에게 각 ₩${amount.toLocaleString()}씩 (총 ₩${totalNeeded.toLocaleString()}) 지급하시겠습니까?\n이 금액은 국고에서 자동 차감됩니다.`)) return;
    }

    try {
        const batch = db.batch();
        const classRef = db.collection('classes').doc(classCode);

        selectedUids.forEach(uid => {
            const userRef = db.collection('users').doc(uid);
            batch.update(userRef, { balance: firebase.firestore.FieldValue.increment(amount) });
            
            // 활동 로그 기록
            const logRef = db.collection('class_activities').doc();
            batch.set(logRef, {
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userUid: uid, userName: "선택된 학생", type: 'ADMIN_REWARD', amount: amount,
                description: `관리자 보상 (${useBond ? '국채 발행' : '국고 지출'})`,
                classCode: classCode
            });
        });

        // 4. 국고 및 부채 업데이트
        const newTreasury = useBond ? 0 : treasury - totalNeeded;
        const addedDebt = useBond ? totalNeeded - treasury : 0;
        
        batch.update(classRef, { 
            treasury: newTreasury, 
            debt: firebase.firestore.FieldValue.increment(addedDebt) 
        });

        await batch.commit();
        alert(`지급 완료! ${useBond ? '부족분만큼 국채가 발행되었습니다.' : '국고에서 정상 차감되었습니다.'}`);
        document.getElementById('bulk-cash-amount').value = '';
    } catch (err) {
        console.error("Critical Reward Error:", err);
        alert("지급 처리 중 오류가 발생했습니다: " + err.message);
    }
};

window.sendBulkItems = async () => {
    console.log("sendBulkItems 시작");
    const selected = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.value);
    const itemId = document.getElementById('bulk-item-select').value;
    if (selected.length === 0 || !itemId) return alert("학생과 아이템을 모두 선택해 주세요.");

    try {
        const itemRef = db.collection('items').doc(itemId);
        const itemDoc = await itemRef.get();
        const itemData = itemDoc.data();
        const totalCost = selected.length * itemData.price;
        const treasury = window.userState.classData.treasury || 0;
        const classCode = window.userState.currentUser.classCode;

        if (itemData.stock < selected.length) return alert(`상점 재고가 부족합니다 (현재 ${itemData.stock}개).`);
        if (treasury < totalCost) return alert(`국고가 부족하여 아이템을 구매할 수 없습니다 (필요: ₩${totalCost.toLocaleString()}).`);

        if (!confirm(`${selected.length}명에게 [${itemData.name}]을 선물하시겠습니까?\n(국고 ₩${totalCost.toLocaleString()} 지출)`)) return;

        const batch = db.batch();
        selected.forEach(uid => {
            const userRef = db.collection('users').doc(uid);
            batch.set(userRef.collection('inventory').doc(), {
                itemName: itemData.name,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        batch.update(itemRef, { stock: itemData.stock - selected.length });
        batch.update(db.collection('classes').doc(classCode), { treasury: treasury - totalCost });

        await batch.commit();
        alert("성공적으로 아이템을 선물했습니다!");
    } catch (err) {
        console.error("선물 에러:", err);
        alert("선물 실패: " + err.message);
    }
};

function setupNavigation() {
    document.querySelectorAll('.parent-link').forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); const currentItem = link.parentElement; document.querySelectorAll('.menu-item').forEach(item => { if(item !== currentItem) item.classList.remove('open'); }); currentItem.classList.toggle('open'); }); });
    document.querySelectorAll('.sidebar a:not(.parent-link)').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
            const target = document.getElementById(link.id.replace('-link', '-view'));
            if (target) { target.classList.add('active'); target.style.display = 'block'; }
        });
    });
}

window.buyItem = (id, name, price) => window.simulation.buyItem(id, name, price);
window.updateStudentInfo = async (uid, data) => { await db.collection('users').doc(uid).update(data); };
window.toggleApproval = async (uid, status) => {
    try {
        await db.collection('users').doc(uid).update({ isAuthorized: status });
        alert(status ? "승인되었습니다." : "승인이 취소되었습니다.");
    } catch (err) {
        alert("처리 실패: " + err.message);
    }
};

window.updateJobInfo = async (uid, btn) => {
    const row = btn.closest('tr');
    const job = row.querySelector('.job-input').value;
    const salary = parseInt(row.querySelector('.salary-input').value) || 0;
    try {
        await db.collection('users').doc(uid).update({ job, salary });
        alert("저장되었습니다.");
    } catch (err) {
        alert("저장 실패: " + err.message);
    }
};

window.sendBulkSalaries = async () => {
    const checkboxes = document.querySelectorAll('.job-checkbox:checked');
    if (checkboxes.length === 0) return alert("급여를 보낼 학생을 선택해 주세요.");

    const classCode = window.userState.currentUser.classCode;
    const classData = window.userState.classData;
    const treasury = classData.treasury || 0;
    
    let totalSalary = 0;
    const students = [];
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        const salary = parseInt(row.querySelector('.salary-input').value) || 0;
        totalSalary += salary;
        students.push({ uid: cb.value, salary: salary });
    });

    if (totalSalary === 0) return alert("선택된 학생들의 급여가 모두 0원입니다.");

    let useBond = false;
    if (treasury < totalSalary) {
        if (!confirm(`국고가 부족합니다 (잔액: ₩${treasury.toLocaleString()} / 필요: ₩${totalSalary.toLocaleString()})\n부족분 ₩${(totalSalary - treasury).toLocaleString()}을 국채 발행으로 충당하시겠습니까?`)) return;
        useBond = true;
    } else {
        if (!confirm(`${students.length}명에게 총 ₩${totalSalary.toLocaleString()}의 급여를 지급하시겠습니까?`)) return;
    }

    try {
        const batch = db.batch();
        const classRef = db.collection('classes').doc(classCode);

        students.forEach(s => {
            if (s.salary > 0) {
                const userRef = db.collection('users').doc(s.uid);
                batch.update(userRef, { balance: firebase.firestore.FieldValue.increment(s.salary) });
                
                const logRef = db.collection('class_activities').doc();
                batch.set(logRef, {
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    userUid: s.uid, userName: "선택된 학생", type: 'SALARY_PAYMENT', amount: s.salary,
                    description: `정기 급여 지급 (${useBond ? '국채 발행' : '국고 지출'})`,
                    classCode: classCode
                });
            }
        });

        const newTreasury = useBond ? 0 : treasury - totalSalary;
        const addedDebt = useBond ? totalSalary - treasury : 0;
        
        batch.update(classRef, { 
            treasury: newTreasury, 
            debt: firebase.firestore.FieldValue.increment(addedDebt) 
        });

        await batch.commit();
        alert(`급여 지급 완료! ${useBond ? '부족분만큼 국채가 발행되었습니다.' : '국고에서 정상 차감되었습니다.'}`);
    } catch (err) {
        alert("급여 지급 실패: " + err.message);
    }
};

window.toggleStudentAuth = async (uid, s) => { await db.collection('users').doc(uid).update({isAuthorized:s}); };
window.openModifyModal = (uid, name, balance) => {
    document.getElementById('modify-target-name').textContent = name;
    document.getElementById('modify-cash-amount').value = balance;
    document.getElementById('modify-asset-modal').style.display = 'block';
    window.currentModifyUid = uid;
};

window.addEventListener('load', () => {
    window.simulation = new EconomicSimulation();
    window.authManager = new AuthManager(window.simulation);
    setupNavigation();
});
