// --- 1. ПЕРЕМІННІ ТА ІНІЦІАЛІЗАЦІЯ ---
let books = JSON.parse(localStorage.getItem('myBooks')) || [];
let editModeId = null; // null = додавання, ID = редагування

const bookList = document.getElementById('bookList');
const bookCountElement = document.getElementById('bookCount');
const addBookForm = document.getElementById('addBookForm');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('addBookModal');
const modalTitle = modal.querySelector('h2');

// --- 2. ФУНКЦІЇ ЗБЕРЕЖЕННЯ ТА ВІДОБРАЖЕННЯ ---

// Збереження в LocalStorage
function saveBooks() {
    localStorage.setItem('myBooks', JSON.stringify(books));
}

// Відображення списку книг та оновлення лічильника
function renderBooks(bookArray = books) {
    bookList.innerHTML = '';
    
    // Оновлюємо лічильник (завжди загальна кількість)
    bookCountElement.textContent = `Усього книг: ${books.length}`;

    if (bookArray.length === 0) {
        bookList.innerHTML = '<p style="text-align: center; width: 100%;">Список порожній.</p>';
        return;
    }

    bookArray.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <img src="${book.imageURL}" alt="${book.title}">
            <div class="book-info">
                <h3>${book.title}</h3>
                <p>${book.author}</p>
                <div class="card-btns">
                    <button class="edit-btn" onclick="openEditModal(${book.id})">✎ Ред.</button>
                    <button class="delete-btn" onclick="deleteBook(${book.id})">🗑 Вид.</button>
                </div>
            </div>
        `;
        bookList.appendChild(card);
    });
}

// --- 3. ЛОГІКА МОДАЛЬНОГО ВІКНА ---

function openModal() {
    modal.style.display = 'flex';
}

function closeModal() {
    modal.style.display = 'none';
    addBookForm.reset();
    editModeId = null;
    modalTitle.textContent = 'Додати нову книгу';
}

// Закриття при кліку поза вікном
window.onclick = function(event) {
    if (event.target == modal) closeModal();
}

// Кнопка "Додати книгу" (відкриття порожньої форми)
document.getElementById('openModalBtn').addEventListener('click', () => {
    editModeId = null;
    modalTitle.textContent = 'Додати нову книгу';
    openModal();
});

// --- 4. ДОДАВАННЯ ТА РЕДАГУВАННЯ ---

addBookForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;
    let imageURL = document.getElementById('imageURL').value;

    // Якщо фото не додано — ставимо заглушку
    if (!imageURL) {
        imageURL = 'https://via.placeholder.com/180x200?text=Немає+фото';
    }

    if (editModeId) {
        // Редагування існуючої книги
        const index = books.findIndex(b => b.id === editModeId);
        if (index !== -1) {
            books[index] = { ...books[index], title, author, imageURL };
        }
    } else {
        // Додавання нової книги (в початок списку)
        const newBook = {
            id: Date.now(),
            title,
            author,
            imageURL
        };
        books.unshift(newBook);
    }

    saveBooks();
    renderBooks();
    closeModal();
});

// Відкриття форми для редагування
window.openEditModal = function(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;

    editModeId = id;
    document.getElementById('title').value = book.title;
    document.getElementById('author').value = book.author;
    // Якщо там заглушка, залишаємо поле порожнім
    document.getElementById('imageURL').value = book.imageURL.includes('placeholder') ? '' : book.imageURL;

    modalTitle.textContent = 'Редагувати книгу';
    openModal();
};

// --- 5. ВИДАЛЕННЯ ТА ПОШУК ---

window.deleteBook = function(id) {
    if (confirm('Ви впевнені, що хочете видалити цю книгу?')) {
        books = books.filter(book => book.id !== id);
        saveBooks();
        renderBooks();
    }
};

searchInput.addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    const filtered = books.filter(book => 
        book.title.toLowerCase().includes(term) || 
        book.author.toLowerCase().includes(term)
    );
    renderBooks(filtered);
});

// --- СТАРТ ПРИ ЗАВАНТАЖЕННІ ---
renderBooks();
