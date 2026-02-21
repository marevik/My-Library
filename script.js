// 1. ПОЧАТКОВІ ДАНІ ТА НАЛАШТУВАННЯ
let books = [];
let editModeId = null; 
const storageKey = 'myLibraryBooks'; // Ваш поточний ключ сховища

// Елементи DOM
const modal = document.getElementById('addBookModal');
const openModalBtn = document.getElementById('openModalBtn');
const addBookForm = document.getElementById('addBookForm');
const bookList = document.getElementById('bookList');
const bookCountElement = document.getElementById('bookCount');
const searchInput = document.getElementById('searchInput');

// --- 2. МОДАЛЬНЕ ВІКНО ---

// Відкрити
openModalBtn.onclick = function() {
    editModeId = null;
    addBookForm.reset();
    document.querySelector('#addBookModal h2').textContent = 'Додати нову книгу';
    modal.style.display = "flex"; // Використовуємо flex для центрування
}

// Закрити
function closeModal() {
    modal.style.display = "none";
}

// Закрити при кліку поза вікном
window.onclick = function(event) {
    if (event.target === modal) closeModal();
}

// --- 3. РОБОТА З ДАНИМИ (localStorage) ---

function loadBooks() {
    const storedBooks = localStorage.getItem(storageKey);
    if (storedBooks) {
        books = JSON.parse(storedBooks);
    } else {
        // Тестові книги, якщо порожньо
        books = [
            { id: Date.now() + 1, title: 'Сто років самотності', author: 'Габріель Гарсіа Маркес', imageURL: 'https://cdn.photos.litres.ru/pub/c/pdf-22122699.jpg' },
            { id: Date.now() + 2, title: 'Кобзар', author: 'Тарас Шевченко', imageURL: 'https://nashformat.ua/wp-content/uploads/2021/07/kobzar-nashformat.jpg' }
        ];
    }
    renderBooks(books);
}

function saveBooks() {
    localStorage.setItem(storageKey, JSON.stringify(books));
}

// --- 4. ВІДОБРАЖЕННЯ ---

function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
        <img src="${book.imageURL}" alt="${book.title}" onerror="this.src='https://via.placeholder.com/180x200?text=Помилка+фото'">
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
    bookList.innerHTML = '';
    
    // Оновлення лічильника
    if (bookCountElement) {
        bookCountElement.textContent = `Усього книг: ${books.length}`;
    }

    if (bookArray.length === 0) {
        bookList.innerHTML = '<p style="text-align: center; width: 100%;">Список порожній.</p>';
        return;
    }

    bookArray.forEach(book => {
        bookList.appendChild(createBookCard(book));
    });
}

// --- 5. ДОДАВАННЯ ТА РЕДАГУВАННЯ ---

addBookForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;
    let imageURL = document.getElementById('imageURL').value;

    if (!imageURL) {
        imageURL = 'https://via.placeholder.com/180x200?text=Обкладинка+відсутня'; 
    }

    if (editModeId) {
        // Редагування
        const index = books.findIndex(b => b.id === editModeId);
        if (index !== -1) {
            books[index] = { ...books[index], title, author, imageURL };
        }
        editModeId = null;
    } else {
        // Додавання на початок
        const newBook = { id: Date.now(), title, author, imageURL };
        books.unshift(newBook);
    }

    saveBooks();
    renderBooks(books);
    this.reset();
    closeModal();
});

window.openEditModal = function(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;

    editModeId = id;
    document.getElementById('title').value = book.title;
    document.getElementById('author').value = book.author;
    document.getElementById('imageURL').value = book.imageURL.includes('placeholder') ? '' : book.imageURL;

    document.querySelector('#addBookModal h2').textContent = 'Редагувати книгу';
    modal.style.display = "flex";
}

// --- 6. ВИДАЛЕННЯ ТА ПОШУК ---

window.deleteBook = function(id) {
    const bookToDelete = books.find(book => book.id === id);
    if (confirm(`Ви впевнені, що хочете видалити книгу "${bookToDelete.title}"?`)) {
        books = books.filter(book => book.id !== id);
        saveBooks();
        renderBooks(books);
    }
}

// Додамо виклик пошуку через обробник подій (краще, ніж onclick)
if (searchInput) {
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filtered = books.filter(book => 
            book.title.toLowerCase().includes(searchTerm) || 
            book.author.toLowerCase().includes(searchTerm)
        );
        renderBooks(filtered);
    });
}

// --- 7. РЕЗЕРВНЕ КОПІЮВАННЯ (ЕКСПОРТ ТА ІМПОРТ) ---

window.exportBooks = function() {
    if (books.length === 0) {
        alert("Нічого зберігати!");
        return;
    }

    const dataStr = JSON.stringify(books, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `my_library_backup_${new Date().toISOString().slice(0,10)}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert("Копію створено!");
};

window.importBooks = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedBooks = JSON.parse(e.target.result);
            if (Array.isArray(importedBooks)) {
                if (confirm(`Замінити поточну бібліотеку (${books.length} кн.) даними з файлу (${importedBooks.length} кн.)?`)) {
                    books = importedBooks;
                    saveBooks();
                    renderBooks(books);
                    alert("Дані успішно відновлено!");
                }
            }
        } catch (err) {
            alert("Помилка: файл пошкоджений або має невірний формат.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Скидаємо вибір файлу
};

// Ініціалізація
document.addEventListener('DOMContentLoaded', loadBooks);
