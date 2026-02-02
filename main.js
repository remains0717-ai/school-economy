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
    constructor() { this.user = null; }
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
        const snap = await db.collection('users').doc(this.user.uid).collection('deposits').where('status','==','active').get();
        if (snap.empty) return alert("만기된 예금이 없습니다.");
        
        const batch = db.batch();
        let total = 0;
        let count = 0;
        snap.forEach(doc => {
            const d = doc.data();
            if (d.maturityAt.toDate() <= new Date()) {
                const interest = Math.floor(d.amount * (d.rate/100));
                total += (d.amount + interest);
                batch.update(doc.ref, { status: 'completed' });
                count++;
            }
        });
        if (count === 0) return alert("아직 만기 전입니다.");
        batch.update(db.collection('users').doc(this.user.uid), { balance: firebase.firestore.FieldValue.increment(total), bankBalance: firebase.firestore.FieldValue.increment(-(total-Math.floor(total*0.1))) }); // 단순화
        await batch.commit();
        alert("수령 완료!");
    }

    loadDeposits() {
        db.collection('users').doc(this.user.uid).collection('deposits').orderBy('timestamp','desc').onSnapshot(snap => {
            const body = document.getElementById('deposit-list-body');
            if (body) {
                body.innerHTML = '';
                snap.forEach(doc => {
                    const d = doc.data();
                    body.innerHTML += `<tr><td>₩${d.amount.toLocaleString()}</td><td>${d.rate}%</td><td>₩${Math.floor(d.amount*(d.rate/100)).toLocaleString()}</td><td>${d.maturityAt.toDate().toLocaleString()}</td><td>${d.status}</td></tr>`;
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