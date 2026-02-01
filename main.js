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

class EconomicSimulation {
    constructor() {
        this.cash = 1000;
        this.goods = 0;
        this.price = 10;
        this.productionCost = 50;

        this.resourcesPanel = document.querySelector('resources-panel');
        this.actionsPanel = document.querySelector('actions-panel');
        this.marketPanel = document.querySelector('market-panel');
        this.logPanel = document.querySelector('log-panel');

        this.actionsPanel.shadowRoot.getElementById('produce-btn').addEventListener('click', () => this.produce());
        this.actionsPanel.shadowRoot.getElementById('trade-btn').addEventListener('click', () => this.sell());

        this.updateUI();
        setInterval(() => this.updateMarket(), 2000);
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
        this.logPanel.addMessage(`시장 가격이 ₩${this.price.toFixed(2)}으로 변경되었습니다.`);
        this.updateUI();
    }

    updateUI() {
        this.resourcesPanel.update(this.cash, this.goods);
        this.marketPanel.update(this.price);
    }
}

window.addEventListener('load', () => {
    new EconomicSimulation();
});
