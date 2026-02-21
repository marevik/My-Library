let books = [];
let editModeId = null; 
const storageKey = 'myLibraryBooks';

// Елементи
const modal = document.getElementById('addBookModal');
const openModalBtn = document.getElementById('openModalBtn');
const addBookForm = document.getElementById('addBookForm');
const bookList = document.getElementById('bookList');
const bookCountElement = document.getElementById('bookCount');
const searchInput = document.getElementById('searchInput');

// --- 1. ЛОГІКА ВІКЕН (Dropdown та Modal) ---

// Відкриття/Закриття меню (Експорт/Імпорт)
function toggleDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('backupDropdown');
    if (dropdown) dropdown.classList.toggle('show');
}

// Відкриття модалки додавання книги
if (openModalBtn) {
    openModalBtn.onclick = function() {
        editModeId = null;
        addBookForm.reset();
        document.querySelector('#addBookModal h2').textContent = 'Додати нову книгу';
        modal.style.display = "flex";
    };
}

function closeModal() {
    modal.style.display = "none";
}

// Закриття всього при кліку зовні
window.onclick = function(event) {
    // Закриваємо меню, якщо клікнули не по заголовку
    if (!event.target.closest('.title-wrapper')) {
        const dropdown = document.getElementById('backupDropdown');
        if (dropdown) dropdown.classList.remove('show');
    }
    // Закриваємо модалку
    if (event.target === modal) {
        closeModal();
    }
};

// --- 2. ФУНКЦІЇ ДАНИХ ---

function loadBooks() {
    const storedBooks = localStorage.getItem(storageKey);
    if (storedBooks) {
        books = JSON.parse(storedBooks);
    } else {
        // Початкові дані
        books = [
            { id: Date.now(), title: 'Колір Магії', author: 'Террі Пратчетт', imageURL: '' }
        ];
    }
    renderBooks(books);
}

function saveBooks() {
    localStorage.setItem(storageKey, JSON.stringify(books));
}

// --- 3. ВІДОБРАЖЕННЯ (Modern UI) ---

function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    
    // Використовуємо локальну заглушку, якщо URL порожній або видає помилку
    const imgUrl = book.imageURL && book.imageURL.trim() !== "" ? book.imageURL : 'https://placehold.co/200x280/1a1d29/white?text=No+Photo';

    card.innerHTML = `
        <img src="${imgUrl}" alt="${book.title}" onerror="this.src='https://placehold.co/200x280/1a1d29/white?text=Error'">
        <div class="book-info">
            <h3>${book.title}</h3>
            <p>${book.author}</p>
            <div class="card-btns">
                <button class="edit-btn" onclick="openEditModal(${book.id})">✎ Ред.</button>
                <button class="delete-btn" onclick="deleteBook(${book.id})">🗑 Вид.</button>
            </div>
        </div>
    `;
    return card;
}

function renderBooks(bookArray) {
    if (!bookList) return;
    bookList.innerHTML = '';
    
    if (bookCountElement) {
        bookCountElement.textContent = `Усього книг: ${books.length}`;
    }

    if (bookArray.length === 0) {
        bookList.innerHTML = '<p style="text-align: center; width: 100%; color: #94a3b8; padding-top: 50px;">Бібліотека порожня.</p>';
        return;
    }

    bookArray.forEach(book => {
        bookList.appendChild(createBookCard(book));
    });
}

// --- 4. ДОДАВАННЯ ТА РЕДАГУВАННЯ ---

addBookForm.onsubmit = function(e) {
    e.preventDefault();

    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;
    const imageURL = document.getElementById('imageURL').value;

    if (editModeId) {
        const index = books.findIndex(b => b.id === editModeId);
        if (index !== -1) {
            books[index] = { ...books[index], title, author, imageURL };
        }
        editModeId = null;
    } else {
        const newBook = { id: Date.now(), title, author, imageURL };
        books.unshift(newBook);
    }

    saveBooks();
    renderBooks(books);
    closeModal();
};

window.openEditModal = function(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;

    editModeId = id;
    document.getElementById('title').value = book.title;
    document.getElementById('author').value = book.author;
    document.getElementById('imageURL').value = book.imageURL;

    document.querySelector('#addBookModal h2').textContent = 'Редагувати книгу';
    modal.style.display = "flex";
};

window.deleteBook = function(id) {
    if (confirm("Видалити цю книгу?")) {
        books = books.filter(b => b.id !== id);
        saveBooks();
        renderBooks(books);
    }
};

// Пошук
if (searchInput) {
    searchInput.oninput = function() {
        const term = this.value.toLowerCase();
        const filtered = books.filter(b => 
            b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term)
        );
        renderBooks(filtered);
    };
}

// Експорт та імпорт (з вашого коду)
window.exportBooks = function() {
    const dataStr = JSON.stringify(books, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `library_backup.json`;
    link.click();
};

window.importBooks = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                books = imported;
                saveBooks();
                renderBooks(books);
                alert("Дані відновлено!");
            }
        } catch (err) { alert("Помилка файлу!"); }
    };
    reader.readAsText(file);
};

document.addEventListener('DOMContentLoaded', loadBooks);
