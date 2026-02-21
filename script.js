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
    
    if (arr.length === 0) {
        bookList.innerHTML = '<p style="text-align:center;width:100%;color:gray;">Тут поки порожньо</p>';
        return;
    }

    arr.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        const img = book.imageURL || `https://placehold.co/200x280/161b22/white?text=No+Photo`;
        card.innerHTML = `
            <img src="${img}" alt="cover" onerror="this.src='https://placehold.co/200x280/161b22/white?text=Error'">
            <div class="book-info">
                <h3>${book.title}</h3>
                <p>${book.author}</p>
                <div class="card-btns">
                    <button class="edit-btn" onclick="openEditModal(${book.id})">Ред.</button>
                    <button class="delete-btn" onclick="deleteBook(${book.id})">Вид.</button>
                </div>
            </div>
        `;
        bookList.appendChild(card);
    });
}

// --- Дії ---
addBookForm.onsubmit = (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;
    const imageURL = document.getElementById('imageURL').value;

    if (editModeId) {
        const i = books.findIndex(b => b.id === editModeId);
        books[i] = { ...books[i], title, author, imageURL };
        editModeId = null;
    } else {
        books.unshift({ id: Date.now(), title, author, imageURL });
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

document.addEventListener('DOMContentLoaded', loadBooks);
