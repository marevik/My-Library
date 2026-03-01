let books = [];
let editModeId = null; 
const storageKey = 'myLibraryBooks';

const modal = document.getElementById('addBookModal');
const openModalBtn = document.getElementById('openModalBtn');
const addBookForm = document.getElementById('addBookForm');
const bookList = document.getElementById('bookList');
const bookCountElement = document.getElementById('bookCount');
const searchInput = document.getElementById('searchInput');

// --- Управління вікнами ---
function toggleDropdown(event) {
    event.stopPropagation();
    document.getElementById('backupDropdown').classList.toggle('show');
}

if (openModalBtn) {
    openModalBtn.onclick = () => {
        editModeId = null;
        addBookForm.reset();
        document.querySelector('#addBookModal h2').textContent = 'Додати книгу';
        modal.style.display = "flex";
    };
}

function closeModal() { modal.style.display = "none"; }

window.onclick = (event) => {
    if (!event.target.closest('.title-wrapper')) {
        const d = document.getElementById('backupDropdown');
        if (d) d.classList.remove('show');
    }
    if (event.target === modal) closeModal();
};

// --- Дані ---
function loadBooks() {
    const data = localStorage.getItem(storageKey);
    books = data ? JSON.parse(data) : [];
    renderBooks(books);
}

function saveBooks() {
    localStorage.setItem(storageKey, JSON.stringify(books));
}
function renderBooks(arr) {
    bookList.innerHTML = '';
    if (bookCountElement) bookCountElement.textContent = `Книг: ${books.length}`;
    
    arr.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        
        // Використовуємо addEventListener замість .onclick
        card.addEventListener('click', () => {
            openDetailsModal(book.id);
        });
        
        const stars = '★'.repeat(book.rating || 0) + '☆'.repeat(5 - (book.rating || 0));
        
        card.innerHTML = `
            ${book.isRead ? '<div class="read-badge">✅</div>' : ''}
            <img src="${book.imageURL || 'https://placehold.co/200x280/161b22/white?text=No+Photo'}" 
                 onerror="this.src='https://placehold.co/200x280/161b22/white?text=Error'">
            <div class="book-info">
                <div style="color: #ffca08; font-size: 0.8rem; margin-bottom: 4px;">${stars}</div>
                <h3>${book.title}</h3>
                <p>${book.author}</p>
            </div>
        `;
        bookList.appendChild(card);
    });
}


// --- Дії ---
// 1. Оновлюємо додавання/редагування книги
addBookForm.onsubmit = (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;
    const imageURL = document.getElementById('imageURL').value;
    
    // ВАЖЛИВО: переконайтеся, що ID співпадає з тим, що у вашому HTML всередині форми
    const typeSelect = document.getElementById('addBookType'); 
    const type = typeSelect ? typeSelect.value : 'paper'; 

    if (editModeId) {
        const i = books.findIndex(b => b.id === editModeId);
        books[i] = { ...books[i], title, author, imageURL, type };
        editModeId = null;
    } else {
        books.unshift({ 
            id: Date.now(), 
            title, 
            author, 
            imageURL, 
            type, 
            isRead: false, 
            rating: 0 
        });
    }
    
    saveBooks();
    renderBooks(books);
    closeModal();
};

window.openEditModal = (id) => {
    const b = books.find(x => x.id === id);
    editModeId = id;
    document.getElementById('title').value = b.title;
    document.getElementById('author').value = b.author;
    document.getElementById('imageURL').value = b.imageURL;
    modal.style.display = "flex";
};

window.deleteBook = (id) => {
    if (confirm("Видалити книгу?")) {
        books = books.filter(x => x.id !== id);
        saveBooks();
        renderBooks(books);
    }
};

if (searchInput) {
    searchInput.oninput = function() {
        const val = this.value.toLowerCase();
        renderBooks(books.filter(b => b.title.toLowerCase().includes(val) || b.author.toLowerCase().includes(val)));
    };
}

// Імпорт/Експорт
window.exportBooks = () => {
    const blob = new Blob([JSON.stringify(books)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'library.json';
    a.click();
};

window.importBooks = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        books = JSON.parse(ev.target.result);
        saveBooks();
        renderBooks(books);
    };
    reader.readAsText(e.target.files[0]);
};


let currentDetailsId = null;
let tempRating = 0;

// 2. Оновлюємо рендер, щоб книги без типу вважалися паперовими
function renderBooks(arr) {
    bookList.innerHTML = '';
    
    // Оновлення лічильників (ваш варіант)
    const total = books.length;
    const read = books.filter(b => b.isRead).length;
    if (document.getElementById('bookCount')) document.getElementById('bookCount').textContent = total;
    if (document.getElementById('readCount')) document.getElementById('readCount').textContent = read;

    arr.forEach(book => {
        // Якщо типу немає (старі книги), ставимо 'paper'
        const bookType = book.type || 'paper';
        
        const card = document.createElement('div');
        card.className = 'book-card';
        card.onclick = () => openDetailsModal(book.id);
        
        const stars = '★'.repeat(book.rating || 0) + '☆'.repeat(5 - (book.rating || 0));
        const typeIcon = bookType === 'audio' ? '🎧' : (bookType === 'ebook' ? '📱' : '📖');

        card.innerHTML = `
            ${book.isRead ? '<div class="read-badge">✅</div>' : ''}
            <div class="type-badge">${typeIcon}</div>
            <img src="${book.imageURL || 'https://placehold.co/200x280/161b22/white?text=No+Photo'}" 
                 onerror="this.src='https://placehold.co/200x280/161b22/white?text=Error'">
            <div class="book-info">
                <div style="color: #ffca08; font-size: 0.8rem; margin-bottom: 4px;">${stars}</div>
                <h3>${book.title}</h3>
                <p>${book.author}</p>
            </div>
        `;
        bookList.appendChild(card);
    });
}

// 3. Функція фільтрації для вкладок
window.filterByType = (type) => {
    // Знімаємо клас active з усіх кнопок і додаємо потрібній
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if (type === 'all') {
        renderBooks(books);
    } else {
        const filtered = books.filter(b => (b.type || 'paper') === type);
        renderBooks(filtered);
    }
};

// 2. Логіка видалення всередині вікна деталей
document.getElementById('deleteInDetailsBtn').onclick = function() {
    if (currentDetailsId && confirm("Видалити цю книгу?")) {
        books = books.filter(x => x.id !== currentDetailsId);
        saveBooks();
        renderBooks(books);
        closeDetailsModal();
    }
};

// 3. Перехід до редагування тексту
document.getElementById('goToEditBtn').onclick = function() {
    if (currentDetailsId) {
        const bookId = currentDetailsId;
        closeDetailsModal();
        openEditModal(bookId);
    }
};

// 2. Логіка для переходу з Деталей в Редагування
document.getElementById('goToEditBtn').onclick = function() {
    if (currentDetailsId) {
        closeDetailsModal();
        openEditModal(currentDetailsId);
    }
};

// Функції для вікна деталей
window.openDetailsModal = (id) => {
    const book = books.find(b => b.id === id);
    if (!book) return;

    currentDetailsId = id;
    tempRating = book.rating || 0;
    
    document.getElementById('detailsTitle').textContent = book.title;
    document.getElementById('detailsAuthor').textContent = book.author;
    document.getElementById('detailsReadStatus').checked = book.isRead || false;
    
    // Встановлюємо правильний тип у випадаючому списку (за замовчуванням paper)
    document.getElementById('detailsBookType').value = book.type || 'paper';
    
    updateStarsUI(tempRating);
    document.getElementById('detailsModal').style.display = "flex";
};

document.querySelectorAll('.star').forEach(star => {
    star.onclick = function() {
        tempRating = parseInt(this.getAttribute('data-value'));
        updateStarsUI(tempRating);
    };
});

function updateStarsUI(rating) {
    document.querySelectorAll('.star').forEach((s, i) => {
        s.textContent = i < rating ? '★' : '☆';
    });
}

document.getElementById('saveDetailsBtn').onclick = () => {
    const index = books.findIndex(b => b.id === currentDetailsId);
    if (index !== -1) {
        books[index].isRead = document.getElementById('detailsReadStatus').checked;
        books[index].rating = tempRating;
        
        // Зберігаємо змінений тип книги
        books[index].type = document.getElementById('detailsBookType').value;
        
        saveBooks();
        renderBooks(books);
        closeDetailsModal();
    }
};

function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = "none";
}
document.addEventListener('DOMContentLoaded', loadBooks);

