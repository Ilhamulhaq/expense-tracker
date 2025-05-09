class ExpenseTracker {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.recognition = null;
        this.isRecording = false;
        this.lastDeletedExpense = null;
        this.tabCounter = 1;
        this.tabContents = new Map();
        this.setupVoiceRecognition();
        this.setupEventListeners();
        this.loadTabs();
    }

    loadTabs() {
        // Load saved tabs from localStorage
        const savedTabs = JSON.parse(localStorage.getItem('expenseTabs')) || [];
        
        if (savedTabs.length === 0) {
            // If no saved tabs, create first tab with empty expenses
            this.initializeFirstTab();
        } else {
            // Clear existing tabs
            const tabsList = document.getElementById('tabsList');
            tabsList.innerHTML = '';
            
            // Restore saved tabs
            savedTabs.forEach((tabData, index) => {
                const tabId = `tab${index + 1}`;
                this.tabCounter = index + 1;
                
                // Create tab element
                const tab = document.createElement('div');
                tab.className = 'tab';
                if (index === 0) tab.classList.add('active');
                tab.dataset.tab = tabId;
                tab.innerHTML = `
                    <span class="tab-title">${tabData.title}</span>
                    <button class="close-tab">×</button>
                `;
                
                tabsList.appendChild(tab);
                this.tabContents.set(tabId, tabData.expenses);
            });
            
            // Show first tab's content
            const firstTabId = 'tab1';
            this.updateExpensesList(firstTabId);
            this.updateTabSummary(firstTabId);
        }
    }

    initializeFirstTab() {
        // Clear any existing tabs
        const tabsList = document.getElementById('tabsList');
        tabsList.innerHTML = '';
        
        // Ask for first tab name
        const tabName = prompt('Enter name for your first tab:', 'Expenses');
        if (tabName === null) {
            // If user cancels, use default name
            tabName = 'Expenses';
        }
        
        // Create first tab
        const tabId = 'tab1';
        const tab = document.createElement('div');
        tab.className = 'tab active';
        tab.dataset.tab = tabId;
        tab.innerHTML = `
            <span class="tab-title">${tabName}</span>
            <button class="close-tab">×</button>
        `;
        
        tabsList.appendChild(tab);
        this.tabContents.set(tabId, []);
        this.updateExpensesList(tabId);
        this.updateTabSummary(tabId);
        this.saveTabs();
    }

    saveTabs() {
        const tabsData = Array.from(this.tabContents.entries()).map(([tabId, expenses], index) => {
            const tabElement = document.querySelector(`.tab[data-tab="${tabId}"]`);
            return {
                title: tabElement.querySelector('.tab-title').textContent,
                expenses: expenses
            };
        });
        localStorage.setItem('expenseTabs', JSON.stringify(tabsData));
    }

    setupVoiceRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                this.processVoiceCommand(transcript);
            };

            this.recognition.onend = () => {
                this.stopRecording();
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.stopRecording();
            };
        } else {
            alert('Speech recognition is not supported in your browser. Please use Chrome.');
        }
    }

    setupEventListeners() {
        const startButton = document.getElementById('startRecording');
        const clearButton = document.getElementById('clearExpenses');
        const undoButton = document.getElementById('undoDelete');
        const newTabButton = document.getElementById('newTabBtn');
        const tabsList = document.getElementById('tabsList');
        
        startButton.addEventListener('click', () => this.toggleRecording());
        clearButton.addEventListener('click', () => this.clearExpenses());
        undoButton.addEventListener('click', () => this.undoLastDelete());
        
        // Tab functionality
        newTabButton.addEventListener('click', () => this.createNewTab());
        
        // Event delegation for tab clicks and close buttons
        tabsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                this.switchTab(e.target);
            } else if (e.target.classList.contains('close-tab')) {
                this.closeTab(e.target.parentElement);
            }
        });
    }

    toggleRecording() {
        if (!this.isRecording) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    startRecording() {
        if (this.recognition) {
            this.recognition.start();
            this.isRecording = true;
            document.getElementById('startRecording').classList.add('recording');
            document.getElementById('recordingStatus').textContent = 'Listening...';
        }
    }

    stopRecording() {
        if (this.recognition) {
            this.recognition.stop();
            this.isRecording = false;
            document.getElementById('startRecording').classList.remove('recording');
            document.getElementById('recordingStatus').textContent = '';
        }
    }

    processVoiceCommand(transcript) {
        console.log('Transcript:', transcript);
        
        // Convert Indian number formats to actual numbers
        let amount = null;
        const transcriptLower = transcript.toLowerCase();
        
        // Handle lakhs
        if (transcriptLower.includes('lakh')) {
            const lakhMatch = transcriptLower.match(/(\d+)\s*lakh/);
            if (lakhMatch) {
                amount = parseFloat(lakhMatch[1]) * 100000;
            }
        }
        // Handle crores
        else if (transcriptLower.includes('crore')) {
            const croreMatch = transcriptLower.match(/(\d+)\s*crore/);
            if (croreMatch) {
                amount = parseFloat(croreMatch[1]) * 10000000;
            }
        }
        // Handle regular numbers
        else {
            const amountMatch = transcriptLower.match(/\$?(\d+(?:\.\d{1,2})?)/);
            amount = amountMatch ? parseFloat(amountMatch[1]) : null;
        }

        const categories = ['food', 'transport', 'utilities', 'entertainment', 'other'];
        const category = categories.find(cat => transcriptLower.includes(cat)) || 'other';

        let description = transcriptLower
            .replace(/\$?\d+(?:\.\d{1,2})?/, '')
            .replace(/\d+\s*lakh/, '')
            .replace(/\d+\s*crore/, '')
            .replace(category, '')
            .trim();

        if (amount) {
            const expense = {
                id: Date.now(),
                description: description || 'Voice expense',
                amount,
                category,
                date: new Date().toISOString()
            };

            const activeTab = document.querySelector('.tab.active');
            const tabId = activeTab.dataset.tab;
            const tabExpenses = this.tabContents.get(tabId) || [];
            tabExpenses.push(expense);
            this.tabContents.set(tabId, tabExpenses);
            
            this.updateExpensesList(tabId);
            this.updateTabSummary(tabId);
            this.saveTabs();
            
            // Format the amount for display
            let displayAmount;
            if (amount >= 10000000) {
                displayAmount = `${(amount/10000000).toFixed(2)} crore`;
            } else if (amount >= 100000) {
                displayAmount = `${(amount/100000).toFixed(2)} lakh`;
            } else {
                displayAmount = `$${amount.toFixed(2)}`;
            }
            
            document.getElementById('recordingStatus').textContent = `Added: ${displayAmount} for ${category}`;
            setTimeout(() => {
                document.getElementById('recordingStatus').textContent = '';
            }, 2000);
        } else {
            document.getElementById('recordingStatus').textContent = 'Could not detect amount. Please try again.';
        }
    }

    clearExpenses() {
        if (confirm('Are you sure you want to clear all expenses in the current tab?')) {
            const activeTab = document.querySelector('.tab.active');
            const tabId = activeTab.dataset.tab;
            this.tabContents.set(tabId, []);
            this.updateExpensesList(tabId);
            this.updateTabSummary(tabId);
            this.saveTabs();
            document.getElementById('recordingStatus').textContent = 'All expenses cleared';
            setTimeout(() => {
                document.getElementById('recordingStatus').textContent = '';
            }, 2000);
        }
    }

    updateExpensesList(tabId) {
        const expensesList = document.getElementById('expensesList');
        expensesList.innerHTML = '';

        const tabExpenses = this.tabContents.get(tabId) || [];
        
        tabExpenses
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach(expense => {
                const expenseElement = document.createElement('div');
                expenseElement.className = 'expense-item';
                
                const expenseContent = document.createElement('div');
                expenseContent.className = 'expense-content';
                expenseContent.innerHTML = `
                    <div class="description">${expense.description}</div>
                    <div class="category">${expense.category}</div>
                    <div class="amount">$${expense.amount.toFixed(2)}</div>
                `;
                
                const deleteButton = document.createElement('button');
                deleteButton.className = 'delete-btn';
                deleteButton.innerHTML = '🗑️';
                deleteButton.title = 'Delete expense';
                deleteButton.onclick = () => {
                    if (confirm('Are you sure you want to delete this expense?')) {
                        this.lastDeletedExpense = expense;
                        const index = tabExpenses.findIndex(e => e.id === expense.id);
                        if (index !== -1) {
                            tabExpenses.splice(index, 1);
                            this.tabContents.set(tabId, tabExpenses);
                            expenseElement.remove();
                            this.updateTabSummary(tabId);
                            document.getElementById('undoDelete').disabled = false;
                            this.saveTabs();
                        }
                    }
                };
                
                expenseElement.appendChild(expenseContent);
                expenseElement.appendChild(deleteButton);
                expensesList.appendChild(expenseElement);
            });
    }

    updateTabSummary(tabId) {
        const tabExpenses = this.tabContents.get(tabId) || [];
        const total = tabExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        document.getElementById('totalExpenses').textContent = `Total: $${total.toFixed(2)}`;
    }

    saveExpenses() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    undoLastDelete() {
        if (this.lastDeletedExpense) {
            const activeTab = document.querySelector('.tab.active');
            const tabId = activeTab.dataset.tab;
            const tabExpenses = this.tabContents.get(tabId) || [];
            tabExpenses.push(this.lastDeletedExpense);
            this.tabContents.set(tabId, tabExpenses);
            this.updateExpensesList(tabId);
            this.updateTabSummary(tabId);
            this.saveTabs();
            this.lastDeletedExpense = null;
            document.getElementById('undoDelete').disabled = true;
        }
    }

    addExpenseFromForm() {
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const category = document.getElementById('expenseCategory').value;
        const description = document.getElementById('expenseDescription').value;

        if (amount && category && description) {
            const expense = {
                id: Date.now(),
                amount,
                category,
                description,
                date: new Date().toISOString()
            };

            this.expenses.push(expense);
            this.saveExpenses();
            this.updateExpensesList();
            this.updateTabSummary();

            // Reset form
            document.getElementById('addExpenseForm').reset();
        }
    }

    createNewTab() {
        const tabName = prompt('Enter tab name:', `New Tab ${this.tabCounter}`);
        if (tabName === null) return; // User cancelled the prompt
        
        this.tabCounter++;
        const tabId = `tab${this.tabCounter}`;
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.tab = tabId;
        tab.innerHTML = `
            <span class="tab-title">${tabName}</span>
            <button class="close-tab">×</button>
        `;
        
        document.getElementById('tabsList').appendChild(tab);
        this.tabContents.set(tabId, []); // Initialize empty list for new tab
        this.switchTab(tab);
        this.saveTabs();
    }

    switchTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        this.updateExpensesList(tabId);
        this.updateTabSummary(tabId);
    }

    closeTab(tab) {
        const tabId = tab.dataset.tab;
        const allTabs = document.querySelectorAll('.tab');
        
        // Remove the tab
        this.tabContents.delete(tabId);
        tab.remove();
        
        // If no tabs left, create a new one
        if (document.querySelectorAll('.tab').length === 0) {
            this.initializeFirstTab();
        } else {
            // Switch to another tab if the closed tab was active
            if (tab.classList.contains('active')) {
                const remainingTabs = document.querySelectorAll('.tab');
                if (remainingTabs.length > 0) {
                    this.switchTab(remainingTabs[0]);
                }
            }
        }
        
        this.saveTabs();
    }
}

// Initialize the expense tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ExpenseTracker();
});
