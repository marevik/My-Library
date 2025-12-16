// Змінна для зберігання всіх книг
let books = [];

// --- ФУНКЦІЇ ДЛЯ МОДАЛЬНОГО ВІКНА ---

const modal = document.getElementById('addBookModal');
const openModalBtn = document.getElementById('openModalBtn');

// Відкрити модальне вікно
openModalBtn.onclick = function() {
  modal.style.display = "block";
}

// Закрити модальне вікно
function closeModal() {
  modal.style.display = "none";
}

// Закрити вікно при кліку поза ним
window.onclick = function(event) {
  if (event.target === modal) {
    closeModal();
  }
}

// --- ФУНКЦІЇ ДЛЯ ЗБЕРІГАННЯ ДАНИХ ТА ВІДОБРАЖЕННЯ ---

// 1. Завантаження книг з localStorage
function loadBooks() {
    const storedBooks = localStorage.getItem('myLibraryBooks');
    if (storedBooks) {
        books = JSON.parse(storedBooks);
    } else {
        // Додамо кілька тестових книг, якщо сховище порожнє
        books = [
            { id: Date.now() + 1, title: 'Сто років самотності', author: 'Габріель Гарсіа Маркес', imageURL: 'https://cdn.photos.litres.ru/pub/c/pdf-22122699.jpg' },
            { id: Date.now() + 2, title: 'Кобзар', author: 'Тарас Шевченко', imageURL: 'https://nashformat.ua/wp-content/uploads/2021/07/kobzar-nashformat.jpg' }
        ];
    }
    renderBooks(books); // Відображаємо всі завантажені книги
}

// 2. Збереження книг у localStorage
function saveBooks() {
    localStorage.setItem('myLibraryBooks', JSON.stringify(books));
}

// 3. Створення HTML-картки для книги
function createBookCard(book) {
    const card = document.createElement('div');
    card.classList.add('book-card');
    card.dataset.id = book.id; // Для можливості ідентифікації пізніше

    // Вставляємо структуру картки
    card.innerHTML = `
        <img src="${book.imageURL}" alt="Обкладинка книги: ${book.title}">
        <h3>${book.title}</h3>
        <p>${book.author}</p>
    `;
    return card;
}

// 4. Відображення списку книг
function renderBooks(bookArray) {
    const bookList = document.getElementById('bookList');
    const bookCountElement = document.getElementById('bookCount'); // Отримуємо елемент лічильника
    
    bookList.innerHTML = ''; // Очищаємо контейнер перед додаванням

    // ОНОВЛЕННЯ ЛІЧИЛЬНИКА
    const totalCount = books.length; // Використовуємо загальну кількість книг, незалежно від результатів пошуку
    bookCountElement.textContent = `Усього книг: ${totalCount}`;

    if (bookArray.length === 0) {
        bookList.innerHTML = '<p style="text-align: center; width: 100%;">Список книг порожній або нічого не знайдено.</p>';
        return;
    }

    // Додаємо картки до контейнера
    bookArray.forEach(book => {
        bookList.appendChild(createBookCard(book));
    });
}


// 5. ОНОВЛЕНА ФУНКЦІЯ: Обробка форми додавання книги
document.getElementById('addBookForm').addEventListener('submit', function(e) {
    e.preventDefault(); // Запобігаємо стандартній відправці форми

    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;
    let imageURL = document.getElementById('imageURL').value; // Використовуємо let, щоб мати можливість змінити

    // НОВА ЛОГІКА: Перевірка, чи введено URL зображення
    if (!imageURL) {
        // Якщо поле порожнє, встановлюємо стандартне зображення-заглушку
        imageURL = 'https://via.placeholder.com/180x200?text=Обкладинка+відсутня'; 
    }
    
    // Створення нового об'єкта книги
    const newBook = {
        id: Date.now(),
        title: title,
        author: author,
        imageURL: imageURL // Буде або введене користувачем, або заглушка
    };
    
    books.push(newBook);
    saveBooks();
    renderBooks(books);
    
    // Очищення форми та закриття модального вікна
    this.reset();
    closeModal();
    alert(`Книга "${title}" успішно додана!`);
});


// 6. Функція пошуку
function filterBooks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = books.filter(book => {
        const titleMatch = book.title.toLowerCase().includes(searchTerm);
        const authorMatch = book.author.toLowerCase().includes(searchTerm);
        
        // Повертаємо книгу, якщо вона відповідає назві АБО автору
        return titleMatch || authorMatch;
    });
    
    renderBooks(filtered); // Відображаємо тільки відфільтровані книги
}

// Ініціалізація: запуск при завантаженні сторінки
document.addEventListener('DOMContentLoaded', loadBooks);

// 3. ОНОВЛЕНА ФУНКЦІЯ: Створення HTML-картки для книги
function createBookCard(book) {
    const card = document.createElement('div');
    card.classList.add('book-card');
    card.dataset.id = book.id; // Унікальний ID для ідентифікації при видаленні

    // Вставляємо структуру картки, включаючи нову кнопку видалення
    card.innerHTML = `
        <button class="delete-btn" onclick="deleteBook(${book.id})">×</button>
        <img src="${book.imageURL}" alt="Обкладинка книги: ${book.title}">
        <h3>${book.title}</h3>
        <p>${book.author}</p>
    `;
    return card;
}

// 7. НОВА ФУНКЦІЯ: Видалення книги зі списку
function deleteBook(id) {
    // 1. Запитуємо підтвердження у користувача
    const bookToDelete = books.find(book => book.id === id);
    const confirmDelete = confirm(`Ви впевнені, що хочете видалити книгу "${bookToDelete.title}"?`);

    if (confirmDelete) {
        // 2. Фільтруємо масив, залишаючи тільки ті книги, ID яких НЕ збігається з потрібним
        books = books.filter(book => book.id !== id);
        
        // 3. Зберігаємо оновлений масив у сховищі
        saveBooks(); 
        
        // 4. Оновлюємо відображення на сторінці
        renderBooks(books);
        
        alert(`Книга "${bookToDelete.title}" видалена.`);
    }

}

