function initApp() {
  const app = {
    url: 'http://localhost:5001',
    time: null,
    activeMenu: 'pos',
    moneys: [2000, 5000, 10000, 20000, 50000, 100000],
    itemTypes: [],
    keyword: "",
    cart: [],
    orders: [],
    lineItems: [],
    cash: 0,
    change: 0,
    isProductPage: true,
    isShowModalReceipt: false,
    receiptNo: null,
    receiptDate: null,
    orderQueue: [],
    circuitBreaker: {
      failureCount: 0,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failureThreshold: 3,
      retryTimeout: 500, // in ms
      nextTry: null,
    },
    async loadApp() {
      const response = await fetch("/reverse-proxy-url")
      const data = await response.json();
      this.url = data.url;

      this.loadProducts();
      //this.startOrderFlushLoop(); //Tian's circuit breaker
    },
    async loadProducts() {
      const response = await fetch(`${this.url}/v1/api/item-types`)
      const data = await response.json();
      this.itemTypes = data.itemTypes;
      console.log("itemTypes loaded", this.itemTypes);
    },
    async loadOrders() {
      this.orders = [];
      this.lineItems = [];
      const response = await fetch(`${this.url}/v1/fulfillment-orders`)
      const data = await response.json();
      this.orders = data.orders;
      console.log("orders loaded", this.orders);
    },
    /* Tian CB */
    async createOrder(order) {
      const cb = this.circuitBreaker;

      const trySend = async () => {
        try {
          const response = await fetch(`${this.url}/v1/api/orders`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(order)
          });

          if (!response.ok) throw new Error('Failed to send order');

          const data = await response.json();
          console.log("Order created", data);

          // Reset circuit breaker
          cb.failureCount = 0;
          cb.state = 'CLOSED';
          cb.nextTry = null;
        } catch (err) {
          console.warn("Order send failed:", err.message);
          cb.failureCount++;

          if (cb.failureCount >= cb.failureThreshold) {
            cb.state = 'OPEN';
            cb.nextTry = Date.now() + cb.retryTimeout;
            console.error("Circuit breaker OPENED");
          }

          // Buffer the order
          this.orderQueue.push(order);
        }
      };

      if (cb.state === 'OPEN') {
        const now = Date.now();
        if (cb.nextTry && now >= cb.nextTry) {
          // Try a half-open test
          cb.state = 'HALF_OPEN';
          console.log("Circuit breaker HALF_OPEN: testing backend...");
          await trySend(); // if fails, it goes back to OPEN
        } else {
          console.warn("Circuit breaker still OPEN. Buffering order.");
          this.orderQueue.push(order);
        }
      } else {
        await trySend();
      }
      },
    /*
    async createOrder(order) {
      const response = await fetch(`${this.url}/v1/api/orders`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(order)
      })
      const data = await response.json();
      console.log("orders created", data);
    },
    */

    // Call this periodically to flush the buffer
    async flushBufferedOrders() {
      if (this.orderQueue.length === 0) return;

      const ordersToRetry = [...this.orderQueue];
      this.orderQueue = [];

      for (const order of ordersToRetry) {
        await this.createOrder(order); // will re-check circuit breaker
      }
      },

    // Example: start periodic flush (call this once on app init)
    startOrderFlushLoop() {
      setInterval(() => {
        this.flushBufferedOrders();
        }, 3000); // try every 3 seconds
    },
    filteredProducts() {
      const rg = this.keyword ? new RegExp(this.keyword, "gi") : null;
      return this.itemTypes.filter((p) => !rg || p.name.match(rg));
    },
    addToCart(product) {
      const index = this.findCartIndex(product);
      if (index === -1) {
        this.cart.push({
          productType: product.type,
          image: product.image,
          name: product.name,
          price: product.price,
          qty: 1,
        });
      } else {
        this.cart[index].qty += 1;
      }
      this.beep();
      this.updateChange();
    },
    findCartIndex(product) {
      return this.cart.findIndex((p) => p.productType === product.type);
    },
    addQty(item, qty) {
      const index = this.cart.findIndex((i) => i.productType === item.productType);
      if (index === -1) {
        return;
      }
      const afterAdd = item.qty + qty;
      if (afterAdd === 0) {
        this.cart.splice(index, 1);
        this.clearSound();
      } else {
        this.cart[index].qty = afterAdd;
        this.beep();
      }
      this.updateChange();
    },
    addCash(amount) {
      this.cash = (this.cash || 0) + amount;
      this.updateChange();
      this.beep();
    },
    getItemsCount() {
      return this.cart.reduce((count, item) => count + item.qty, 0);
    },
    updateChange() {
      this.change = this.cash - this.getTotalPrice();
    },
    updateCash(value) {
      // this.cash = parseFloat(value.replace(/[^0-9]+/g, ""));
      this.cash = value;
      this.updateChange();
    },
    getTotalPrice() {
      return this.cart.reduce(
        (total, item) => total + item.qty * item.price,
        0
      );
    },
    submitable() {
      return this.change >= 0 && this.cart.length > 0;
    },
    submit() {
      const time = new Date();
      this.isShowModalReceipt = true;
      this.receiptNo = `TWPOS-KS-${Math.round(time.getTime() / 1000)}`;
      this.receiptDate = this.dateFormat(time);
    },
    closeModalReceipt() {
      this.isShowModalReceipt = false;
    },
    dateFormat(date) {
      const formatter = new Intl.DateTimeFormat('id', { dateStyle: 'short', timeStyle: 'short' });
      return formatter.format(date);
    },
    numberFormat(number) {
      // return (number || "")
      //   .toString()
      //   .replace(/^0|\./g, "")
      //   .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
      return number;
    },
    priceFormat(number) {
      return number ? `${this.numberFormat(number)}$` : `0$`;
    },
    resolveImage(image) {
      return `static/${image}`;
    },
    changeToProductPage() {
      this.loadProducts();
      this.isProductPage = true;
    },
    changeToOrderPage() {
      this.loadOrders();
      this.isProductPage = false;
    },
    clear() {
      this.cash = 0;
      this.cart = [];
      this.receiptNo = null;
      this.receiptDate = null;
      this.updateChange();
      this.clearSound();
    },
    beep() {
      this.playSound("static/sound/beep-29.mp3");
    },
    clearSound() {
      this.playSound("static/sound/button-21.mp3");
    },
    playSound(src) {
      const sound = new Audio();
      sound.src = src;
      sound.play();
      sound.onended = () => delete (sound);
    },
    printAndProceed() {
      const receiptContent = document.getElementById('receipt-content');
      const titleBefore = document.title;
      const printArea = document.getElementById('print-area');

      printArea.innerHTML = receiptContent.innerHTML;
      document.title = this.receiptNo;

      // window.print();
      this.isShowModalReceipt = false;

      printArea.innerHTML = '';
      document.title = titleBefore;

      // TODO save sale data to database

      let kitchens = [], baristas = [];
      for (let c of this.cart) {
        console.log("cart", c);
        if (c.productType > 5) {
          kitchens.push({ "itemType": c.productType });
        } else {
          baristas.push({ "itemType": c.productType });
        }
      }
      console.log("carts", {
        "commandType": 0,
        "orderSource": 0,
        "location": 0,
        "loyaltyMemberId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "timestamp": "2022-07-04T11:38:00.210Z",
        "baristaItems": baristas,
        "kitchenItems": kitchens
      });

      this.createOrder({
        "commandType": 0,
        "orderSource": 0,
        "location": 0,
        "loyaltyMemberId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "timestamp": "2022-07-04T11:38:00.210Z",
        "baristaItems": baristas,
        "kitchenItems": kitchens
      });

      this.clear();
    }
  };

  return app;
}