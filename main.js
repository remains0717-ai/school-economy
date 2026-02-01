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
        this.cash = 1000;
        this.goods = 0;
        this.price = 10;
        this.productionCost = 50;

        // Stock Market Data
        this.portfolio = {}; // { 'AAPL': { amount: 10, avgPrice: 150 } }
        this.currentStockSymbol = null;
        this.currentStockPrice = 0;

        this.resourcesPanel = document.querySelector('resources-panel');
        this.actionsPanel = document.querySelector('actions-panel');
        this.marketPanel = document.querySelector('market-panel');
        this.logPanel = document.querySelector('log-panel');

        this.actionsPanel.shadowRoot.getElementById('produce-btn').addEventListener('click', () => this.produce());
        this.actionsPanel.shadowRoot.getElementById('trade-btn').addEventListener('click', () => this.sell());

        // Stock UI Events
        document.getElementById('load-stock-btn').addEventListener('click', () => this.loadStock());
        document.getElementById('buy-stock-btn').addEventListener('click', () => this.buyStock());
        document.getElementById('sell-stock-btn').addEventListener('click', () => this.sellStock());

        this.updateUI();
        setInterval(() => this.updateMarket(), 2000);
        setInterval(() => this.updateSimulationStockPrices(), 5000);
    }

    produce() {
        if (this.cash >= this.productionCost) {
            this.cash -= this.productionCost;
            this.goods++;
            this.logPanel.addMessage(`상품 1개를 ₩${this.productionCost}에 생산했습니다.`);
            this.updateUI();
        } else {
            this.logPanel.addMessage('생산에 필요한 현금이 부족합니다.');
        }
    }

    sell() {
        if (this.goods > 0) {
            this.cash += this.price;
            this.goods--;
            this.logPanel.addMessage(`상품 1개를 ₩${this.price.toFixed(2)}에 판매했습니다.`);
            this.updateUI();
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

        // Load TradingView Widget
        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => {
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
        };
        document.head.appendChild(script);

        document.getElementById('display-stock-name').textContent = symbol;
        
        // Mock current price (Real-time price requires a paid API, so we simulate it based on a base price)
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

    buyStock() {
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
        } else {
            this.logPanel.addMessage('주식 매수에 필요한 현금이 부족합니다.');
        }
    }

    sellStock() {
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
        } else {
            this.logPanel.addMessage('보유 수량이 부족하여 매도할 수 없습니다.');
        }
    }

    updateUI() {
        if (this.resourcesPanel) this.resourcesPanel.update(this.cash, this.goods);
        if (this.marketPanel) this.marketPanel.update(this.price);

        // Update Home View
        document.getElementById('current-cash').textContent = Math.floor(this.cash).toLocaleString();
        document.getElementById('current-goods').textContent = this.goods;
        
        let stockValue = 0;
        for (const sym in this.portfolio) {
            // In a real app, we'd fetch current prices for each sym
            // For now, we use currentStockPrice if it matches or a cached one
            stockValue += this.portfolio[sym].amount * (sym === this.currentStockSymbol ? this.currentStockPrice : this.portfolio[sym].avgPrice);
        }
        
        document.getElementById('current-stock-value').textContent = Math.floor(stockValue).toLocaleString();
        document.getElementById('total-assets').textContent = Math.floor(this.cash + stockValue).toLocaleString();

        // Update Stock Trading View
        if (this.currentStockSymbol) {
            document.getElementById('current-stock-price').textContent = this.currentStockPrice.toFixed(2);
        }

        // Update Portfolio Table
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
    new EconomicSimulation();
});