let books = [];
const storageKey = 'myLibraryBooks';

// State variables
let currentFilterType = 'all';
let currentSearchQuery = '';
let currentSortOrder = 'date-new';
let currentPublisher = 'all';

const modal = document.getElementById('addBookModal');
const openModalBtn = document.getElementById('openModalBtn');
const addBookForm = document.getElementById('addBookForm');
const bookList = document.getElementById('bookList');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const publisherFilter = document.getElementById('publisherFilter');
const coverPreview = document.getElementById('cover-preview');


const googleBooksApiKey = "AIzaSyDpRIgEIg1n0OktGpHI0kNZV-2jHv8pFtM"; 
 const firebaseConfig = {
    apiKey: "AIzaSyD5NeqCcQ0A7OpIxfv07zBpp9GFLKWtrxE",
    authDomain: "mylibrary-pwa.firebaseapp.com",
    databaseURL: "https://mylibrary-pwa-default-rtdb.firebaseio.com",
    projectId: "mylibrary-pwa",
    storageBucket: "mylibrary-pwa.firebasestorage.app",
    messagingSenderId: "80873347860",
    appId: "1:80873347860:web:4938c700943b5cb6c60001"
  };


// --- Window Management ---
function toggleDropdown(event) {
    event.stopPropagation();
    document.getElementById('backupDropdown').classList.toggle('show');
}

if (openModalBtn) {
    openModalBtn.onclick = () => {
        addBookForm.reset();
        document.querySelector('#addBookModal h2').textContent = 'Додати книгу';
        addBookForm.onsubmit = onAddSubmit; // Restore original 'add' handler
        updateCoverPreview(''); // Clear preview
        modal.style.display = "flex";
    };
}

function closeModal() { 
    modal.style.display = "none"; 
    updateCoverPreview(''); // Clear preview on close
    clearSuggestions();
}

window.onclick = (event) => {
    if (!event.target.closest('.title-wrapper')) {
        const d = document.getElementById('backupDropdown');
        if (d) d.classList.remove('show');
    }
    if (event.target === modal) closeModal();
    const detailsModal = document.getElementById('detailsModal');
    if (event.target === detailsModal) closeDetailsModal(); 
};

// --- Data & Rendering ---
function loadBooks() {
    // 1. Спочатку слухаємо загальну базу книг, яка спільна для всіх
    database.ref('books').on('value', (booksSnapshot) => {
        const allBooks = booksSnapshot.val() ? Object.values(booksSnapshot.val()) : [];

        // 2. Всередині слухаємо особисту папку поточного користувача (Ігор)
        database.ref(`user_data/${currentUser}`).on('value', (userSnapshot) => {
            const myData = userSnapshot.val() || {};

            // 3. Об'єднуємо: беремо загальну книгу і додаємо до неї особисті статуси
            books = allBooks.map(book => {
                const myStats = myData[book.id] || { 
                    isRead: false, 
                    rating: 0, 
                    isCurrentlyReading: false,
                    readDate: '',
                    inWishlist: false 
                };

                return {
                    ...book,
                    isRead: myStats.isRead !== undefined ? myStats.isRead : (book.isRead || false),
                    rating: myStats.rating !== undefined ? myStats.rating : (book.rating || 0),
                    isCurrentlyReading: myStats.isCurrentlyReading !== undefined ? myStats.isCurrentlyReading : (book.isCurrentlyReading || false),
                    readDate: myStats.readDate || book.readDate || '',
                    inWishlist: myStats.inWishlist !== undefined ? myStats.inWishlist : (book.inWishlist || false)
                };
            });

            console.log(`Синхронізовано з Firebase! Спільних книг: ${books.length}. Користувач: ${currentUser}`);
            
            // 4. Оновлюємо інтерфейс та статистику
            displayBooks();
            updateCurrentlyReadingBanner();
            updateStats();
        });
    });
}

function saveBooks() {
    // Якщо у тебе є локальний масив, можеш залишати для страховки:
    // localStorage.setItem(storageKey, JSON.stringify(books)); 

    // Але головне — відправляємо весь масив або кожну книгу в Firebase:
    // Найпростіший варіант, щоб не переробляти твій код додавання: просто оновлюємо весь вузол 'books'
    database.ref('books').set(books)
        .then(() => console.log("Бібліотеку успішно збережено в хмарі!"))
        .catch(error => console.error("Помилка збереження в Firebase:", error));
}

function displayBooks() {
    let booksToDisplay = [...books].filter(b => !b.inWishlist);

    // Фільтр по типу
    if (currentFilterType === 'reading') {
        booksToDisplay = booksToDisplay.filter(b => b.isCurrentlyReading);
    } else if (currentFilterType === 'read') {
        booksToDisplay = booksToDisplay.filter(b => b.isRead);
    } else if (currentFilterType !== 'all') {
        booksToDisplay = booksToDisplay.filter(b => (b.type || 'paper') === currentFilterType);
    }

    // Пошук
    if (currentSearchQuery) {
        const query = currentSearchQuery.toLowerCase();
        booksToDisplay = booksToDisplay.filter(b =>
            b.title.toLowerCase().includes(query) ||
            b.author.toLowerCase().includes(query)
        );
    }

    // Фільтр по видавництву
    if (currentPublisher !== 'all') {
        booksToDisplay = booksToDisplay.filter(b => (b.publisher || '') === currentPublisher);
    }

    // Сортування
    switch (currentSortOrder) {
        case 'title-asc':
            booksToDisplay.sort((a, b) => a.title.localeCompare(b.title)); break;
        case 'title-desc':
            booksToDisplay.sort((a, b) => b.title.localeCompare(a.title)); break;
        case 'publisher-asc':
            booksToDisplay.sort((a, b) => (a.publisher || '').localeCompare(b.publisher || '')); break;
        case 'publisher-desc':
            booksToDisplay.sort((a, b) => (b.publisher || '').localeCompare(a.publisher || '')); break;
        case 'date-old':
            booksToDisplay.sort((a, b) => a.id - b.id); break;
        case 'date-new':
        default:
            booksToDisplay.sort((a, b) => b.id - a.id); break;
    }

    const mainContainer = document.getElementById('bookList');
    if (mainContainer) {
        mainContainer.innerHTML = '';
        if (booksToDisplay.length === 0) {
            mainContainer.innerHTML = '<p class="empty-message">Нічого не знайдено 📚</p>';
        } else {
            booksToDisplay.forEach(book => createBookCard(book, mainContainer));
        }
    }


    // Wishlist окремо
    renderWishlist();
}


    function renderWishlist() {
    const container = document.getElementById('wishlistList');
    if (!container) return;
    const wishlistBooks = books.filter(b => b.inWishlist);
    container.innerHTML = '';
    if (wishlistBooks.length === 0) {
        container.innerHTML = '<p class="empty-message">Список бажань порожній ❤️</p>';
        return;
    }
    wishlistBooks.forEach(book => createBookCard(book, container));
}

// Допоміжна функція для створення картки (щоб уникнути дублювання коду)
function createBookCard(book, container) {
    const card = document.createElement('div');
    card.className = 'book-card';
    if (book.isRead) card.classList.add('read');

    // Виправлення блокування картинок телефонами (Mixed Content)
    let coverUrl = book.imageURL || 'placeholder.png';
    if (coverUrl.startsWith('http://')) {
        coverUrl = coverUrl.replace('http://', 'https://');
    }

    const ratingStars = '★'.repeat(book.rating || 0) + '☆'.repeat(5 - (book.rating || 0));

    card.innerHTML = `
        <img src="${coverUrl}" alt="${book.title}" onerror="this.src='https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200&auto=format&fit=crop'">
        <div class="book-info">
            <h3>${book.title}</h3>
            <p>${book.author}</p>
            <div class="stars">${ratingStars}</div>
        </div>
    `;

    card.onclick = () => openDetailsModal(book.id);
    container.appendChild(card);
}

function renderBooks(arr) {
    if (!bookList) return;
    bookList.innerHTML = '';
    
    arr.forEach(book => {
        const bookType = book.type || 'paper';
        
        const card = document.createElement('div');
        card.className = 'book-card';
        card.addEventListener('click', () => openDetailsModal(book.id));
        
        const stars = '★'.repeat(book.rating || 0) + '☆'.repeat(5 - (book.rating || 0));
        const typeIcon = bookType === 'audio' ? '🎧' : (bookType === 'ebook' ? '📱' : '📖');
        const publisherHTML = book.publisher ? `<p class="publisher">${book.publisher}</p>` : '';

        card.innerHTML = `
            ${book.isRead ? '<div class="read-badge">✅</div>' : ''}
            <div class="type-badge">${typeIcon}</div>
            <img src="${book.imageURL || 'https://placehold.co/200x280/161b22/white?text=No+Photo'}" 
                 onerror="this.src='https://placehold.co/200x280/161b22/white?text=Error'">
            <div class="book-info">
                <div style="color: #ffca08; font-size: 0.8rem; margin-bottom: 4px;">${stars}</div>
                <h3>${book.title}</h3>
                <p>${book.author}</p>
                ${publisherHTML}
            </div>
        `;
        bookList.appendChild(card);
    });
}

// --- Actions & Event Listeners ---
const onAddSubmit = (e) => {
    e.preventDefault();
    const typeSelect = document.getElementById('addBookType');
    const newBookId = Date.now();
    
    const newBook = { 
        id: newBookId, 
        title: document.getElementById('title').value, 
        author: document.getElementById('author').value, 
        imageURL: document.getElementById('imageURL').value,
        pages: parseInt(document.getElementById('pages').value) || 0,
        publisher: document.getElementById('publisher').value,
        type: typeSelect ? typeSelect.value : 'paper'
    };

    // Записуємо нову книгу безпосередньо в її особистий вузол за ID
    database.ref(`books/${newBookId}`).set(newBook)
        .then(() => {
            console.log("Нову книгу додано в спільну бібліотеку!");
            closeModal();
        })
        .catch(error => console.error("Помилка додавання книги:", error));
};
if (addBookForm) addBookForm.onsubmit = onAddSubmit;

if (searchInput) {
    searchInput.oninput = function() {
        currentSearchQuery = this.value;
        displayBooks();
    };
}

if (sortSelect) {
    sortSelect.onchange = function() {
        currentSortOrder = this.value;
        displayBooks();
    };
}

if (publisherFilter) {
    publisherFilter.onchange = function() {
        currentPublisher = this.value;
        displayBooks();
    };
}

window.filterByType = (type) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeButton = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.getAttribute('onclick').includes(`'${type}'`));
    if (activeButton) activeButton.classList.add('active');
    currentFilterType = type;
    displayBooks();
};

window.exportBooks = () => {
    const blob = new Blob([JSON.stringify(books, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'library_backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
};

window.importBooks = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const importedBooks = JSON.parse(ev.target.result);
            if (Array.isArray(importedBooks)) {
                books = importedBooks;
                saveBooks();
                displayBooks();
            } else {
                alert('Помилка: Неправильний формат файлу.');
            }
        } catch (error) {
            alert('Помилка читання файлу.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
};

// --- Details Modal ---
let currentDetailsId = null;
let tempRating = 0;

function updateCoverPreview(url) {
    if (coverPreview) {
        if (url) {
            coverPreview.src = url;
            coverPreview.style.display = 'block';
        } else {
            coverPreview.src = '';
            coverPreview.style.display = 'none';
        }
    }
}

function openEditModal(id) {
    const book = books.find(x => x.id === id);
    if (!book) return;

    document.querySelector('#addBookModal h2').textContent = 'Редагувати книгу';
    document.getElementById('title').value = book.title;
    document.getElementById('author').value = book.author;
    document.getElementById('imageURL').value = book.imageURL || '';
    document.getElementById('pages').value = book.pages || '';
    document.getElementById('publisher').value = book.publisher || '';
    
    updateCoverPreview(book.imageURL || ''); // Show existing cover
    
    addBookForm.onsubmit = (e) => {
        e.preventDefault();
        const index = books.findIndex(b => b.id === id);
        if (index !== -1) {
            books[index].title = document.getElementById('title').value;
            books[index].author = document.getElementById('author').value;
            books[index].imageURL = document.getElementById('imageURL').value;
            books[index].pages = parseInt(document.getElementById('pages').value) || 0;
            books[index].publisher = document.getElementById('publisher').value;
            saveBooks();
            displayBooks();
            closeModal();
        }
    };
    
    modal.style.display = "flex";
}

window.openDetailsModal = (id) => {
    const book = books.find(b => b.id === id);
    if (!book) return;

    currentDetailsId = id;
    tempRating = book.rating || 0;
    
    document.getElementById('detailsTitle').textContent = book.title;
    document.getElementById('detailsAuthor').textContent = book.author;
    document.getElementById('detailsPublisher').value = book.publisher || '';
    document.getElementById('detailsReadStatus').checked = book.isRead || false;
    document.getElementById('detailsBookType').value = book.type || 'paper';
    updateWishlistBtn(book.inWishlist || false);
    updateStarsUI(tempRating);
    document.getElementById('detailsPages').value = book.pages || '';
    document.getElementById('detailsCurrentlyReading').checked = book.isCurrentlyReading || false;
    document.getElementById('detailsModal').style.display = "flex";
    
    const readDateContainer = document.getElementById('readDateContainer');
    const readDate = book.readDate || '';
    document.getElementById('detailsReadDate').value = readDate;
    if (readDateContainer) {
        readDateContainer.style.display = book.isRead ? 'block' : 'none';
    }
};

function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = "none";
}

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

// --- Scanner Logic ---
function startScanner() {
    if (typeof Quagga === 'undefined') {
        alert('Бібліотеку сканера не завантажено!');
        return;
    }

    const targetContainer = document.querySelector('#interactive');
    if (!targetContainer) return;

    Quagga.init({
        inputStream : {
            name : "Live",
            type : "LiveStream",
            target: targetContainer,
            constraints: {
                width: 480,
                height: 320,
                facingMode: "environment"
            },
        },
        decoder : {
            readers : ["ean_reader"]
        },
        locate: true,
    }, function(err) {
        if (err) {
            console.error(err);
            alert("Помилка запуску камери: " + err);
            return;
        }
        Quagga.start();
    });

    Quagga.onDetected(function(result) {
        var code = result.codeResult.code;
        Quagga.stop();
        switchSection('home');
        
        fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${code}`)
            .then(response => response.json())
            .then(data => {
                if (data.items && data.items.length > 0) {
                    const book = data.items[0].volumeInfo;
                    
                    document.getElementById('title').value = book.title || '';
                    document.getElementById('author').value = book.authors ? book.authors.join(', ') : '';
                    document.getElementById('imageURL').value = book.imageLinks ? book.imageLinks.thumbnail : '';
                    document.getElementById('pages').value = book.pageCount || '';
                    document.getElementById('publisher').value = book.publisher || '';
                    
                    document.querySelector('#addBookModal h2').textContent = 'Додати знайдену книгу';
                    addBookForm.onsubmit = onAddSubmit;
                    updateCoverPreview(book.imageLinks ? book.imageLinks.thumbnail : '');
                    modal.style.display = "flex";
                } else {
                    alert(`Книгу з ISBN ${code} не знайдено в мережі.`);
                }
            })
            .catch(error => {
                console.error('Error fetching book data:', error);
                alert('Помилка пошуку інформації про книгу.');
            });
    });
}

// --- Navigation Logic ---
function switchSection(sectionId) {
    // Ховаємо абсолютно всі секції
    document.querySelectorAll('.app-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Показуємо вибрану секцію
    if (sectionId === 'home') {
        document.getElementById('home-section').style.display = 'block';
        currentFilterType = 'all'; // Повертаємо показ усіх звичайних книг
    } else if (sectionId === 'wishlist') {
        document.getElementById('wishlist-section').style.display = 'block';
        currentFilterType = 'wishlist'; // Вказуємо, що ми у списку бажань
    } else if (sectionId === 'stats') {
        document.getElementById('stats-section').style.display = 'block';
        updateStats();
    }
    
    // Активуємо кнопку в меню
    const activeBtn = document.querySelector(`button[onclick="switchSection('${sectionId}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Перерендерюємо книги під нову секцію
    displayBooks();
}
window.switchSection = switchSection;

// --- Stats & System Updates ---
function updateStats() {
    // Якщо масив порожній — чистимо екрани й виходимо
    if (!books || books.length === 0) {
        if(document.getElementById('statTotal')) document.getElementById('statTotal').textContent = '0';
        if(document.getElementById('statRead')) document.getElementById('statRead').textContent = '0';
        
        if(document.getElementById('statPercentage')) document.getElementById('statPercentage').textContent = '0%';
       
        return;
    }

    // ВІДФІЛЬТРОВУЄМО: Статистика рахується ТІЛЬКИ по реальних книгах (без списку бажань)
    const actualBooks = books.filter(b => !b.inWishlist);

    // 1. Рахуємо загальні цифри
    const total = actualBooks.length;
    const readBooks = actualBooks.filter(b => b.isRead === true);
    const unreadBooks = actualBooks.filter(b => b.isRead !== true); 
    
    const readCount = readBooks.length;
    const unreadCount = unreadBooks.length;
    const percentage = total > 0 ? Math.round((readCount / total) * 100) : 0;
    // Статистика сторінок
const booksWithPages = readBooks.filter(b => b.pages > 0);
const pagesUl = document.getElementById('statPages');
if (pagesUl && pagesUl.tagName === 'UL') {
    if (booksWithPages.length > 0) {
        const totalPagesCount = booksWithPages.reduce((sum, b) => sum + b.pages, 0);
        const avgPages = Math.round(totalPagesCount / booksWithPages.length);
        const maxBook = booksWithPages.reduce((a, b) => a.pages > b.pages ? a : b);
        const minBook = booksWithPages.reduce((a, b) => a.pages < b.pages ? a : b);
        pagesUl.innerHTML = `
            <li><span style="flex:1">📚 Всього сторінок прочитано</span><span>${totalPagesCount.toLocaleString('uk-UA')}</span></li>
            <li><span style="flex:1">📊 Середня кількість сторінок</span><span>${avgPages}</span></li>
            <li><span style="flex:1">🏆 Найбільша — ${maxBook.title}</span><span>${maxBook.pages} стор.</span></li>
            <li><span style="flex:1">🪶 Найменша — ${minBook.title}</span><span>${minBook.pages} стор.</span></li>
        `;
    } else {
        pagesUl.innerHTML = '<li>Немає даних — вкажіть кількість сторінок у деталях книги</li>';
    }
}

// Топ авторів
const getTopItems = (items, limit = 15) => {
    const counts = items.reduce((acc, item) => {
        if (item) acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts).sort(([,a],[,b]) => b-a).slice(0, limit);
};

const topAuthorsUl = document.getElementById('statTopAuthors');
if (topAuthorsUl) {
    const topAuthors = getTopItems(actualBooks.map(b => b.author));
    topAuthorsUl.innerHTML = topAuthors.map(a => `<li>${a[0]} <span>(${a[1]})</span></li>`).join('') || '<li>Немає даних</li>';
}

const topPublishersUl = document.getElementById('statTopPublishers');
if (topPublishersUl) {
    const topPublishers = getTopItems(actualBooks.map(b => b.publisher).filter(Boolean));
    topPublishersUl.innerHTML = topPublishers.map(p => `<li>${p[0]} <span>(${p[1]})</span></li>`).join('') || '<li>Немає даних</li>';
}
    // Рахуємо сторінки
    const totalPages = readBooks.reduce((sum, book) => sum + (parseInt(book.pages) || 0), 0);

    // Виводимо цифри на екран (цифрова картка непрочитаних)
    if(document.getElementById('statTotal')) document.getElementById('statTotal').textContent = total;
    if(document.getElementById('statRead')) document.getElementById('statRead').textContent = readCount;
    if(document.getElementById('statUnread')) document.getElementById('statUnread').textContent = unreadCount;
    if(document.getElementById('statPercentage')) document.getElementById('statPercentage').textContent = percentage + '%';

    // 2. ДЕТАЛІ ПО ТИПАХ (Паперові, Електронні, Аудіо)
    const typeCounts = actualBooks.reduce((acc, book) => {
        const t = book.type || 'paper'; 
        acc[t] = (acc[t] || 0) + 1;
        return acc;
    }, {});

    const typeLabels = { 'paper': '📖 Паперові', 'ebook': '📱 Електронні', 'audio': '🎧 Аудіокниги' };
    const typeBreakdownUl = document.getElementById('statTypeBreakdown');
    
    if (typeBreakdownUl) {
        typeBreakdownUl.innerHTML = '';
        Object.keys(typeLabels).forEach(t => {
            const count = typeCounts[t] || 0;
            const li = document.createElement('li');
            li.innerHTML = `<span>${typeLabels[t]}</span><strong>${count}</strong>`;
            typeBreakdownUl.appendChild(li);
        });
    }

    // 3. ЩЕ НЕ ПРОЧИТАНО (Список книг) — ВИПРАВЛЕНО КОНФЛІКТ ID!
    // Замість пошуку по всьому документу, ми беремо саме списковий тег <ul> всередині картки #unreadCard
    const unreadCardContainer = document.getElementById('unreadCard');
    const unreadListUl = unreadCardContainer ? unreadCardContainer.querySelector('ul') : null;

    if (unreadListUl) {
        unreadListUl.innerHTML = '';
        const displayUnread = unreadBooks.slice(0, 10); 
        
        if (displayUnread.length === 0) {
            unreadListUl.innerHTML = '<li>Усі книги прочитано! 🎉</li>';
        } else {
            displayUnread.forEach(book => {
                const li = document.createElement('li');
                li.textContent = `${book.title} — ${book.author}`;
                unreadListUl.appendChild(li);
            });
        }
    }

    // 4. НАЙВИЩЕ ОЦІНЕНІ
    const topRatedUl = document.getElementById('statTopRated');
    if (topRatedUl) {
        topRatedUl.innerHTML = '';
        const ratedBooks = actualBooks.filter(b => b.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 5);
        
        if (ratedBooks.length === 0) {
            topRatedUl.innerHTML = '<li>Немає оцінених книг</li>';
        } else {
            ratedBooks.forEach(book => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${book.title}</span><strong>${'★'.repeat(book.rating)}</strong>`;
                topRatedUl.appendChild(li);
            });
        }
    }
}

document.getElementById('saveDetailsBtn').onclick = () => {
    // const index = books.find(b => b.id === currentDetailsId); 
    if (currentDetailsId) {
        const isCurrently = document.getElementById('detailsCurrentlyReading').checked;
        const isRead = document.getElementById('detailsReadStatus').checked;
        const type = document.getElementById('detailsBookType').value;
        const publisher = document.getElementById('detailsPublisher').value;
        const pages = parseInt(document.getElementById('detailsPages').value) || 0;
        const readDate = document.getElementById('detailsReadDate').value;

        // 1. Якщо цей пристрій вмикає "Зараз читаю", спочатку скидаємо цей статус 
        // для ВСІХ інших ОСОБИСТИХ книг цього користувача в Firebase
        if (isCurrently) {
            database.ref(`user_data/${currentUser}`).once('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    Object.keys(data).forEach(bookId => {
                        if (data[bookId].isCurrentlyReading) {
                            database.ref(`user_data/${currentUser}/${bookId}/isCurrentlyReading`).set(false);
                        }
                    });
                }
            });
        }

        // 2. Зберігаємо ОСОБИСТІ відмітки користувача в його окрему гілку
        // (Тут зберігаються: статус читання, оцінка, прогрес, дата і список бажань)
        const userBookData = {
            isRead: isRead,
            rating: tempRating,
            isCurrentlyReading: isCurrently,
            readDate: readDate,
            inWishlist: books.find(b => b.id === currentDetailsId)?.inWishlist || false
        };

        database.ref(`user_data/${currentUser}/${currentDetailsId}`).set(userBookData)
            .then(() => {
                console.log(`Особисті відмітки для "${currentUser}" успішно збережено в хмарі!`);
                closeDetailsModal();
            })
            .catch(error => console.error("Помилка збереження особистих даних:", error));
            
        // 3. Якщо тип книги, видавництво чи сторінки змінилися — це загальні характеристики книги, 
        // які мають бачити всі. Оновимо їх у загальній гілці книги (опціонально, для порядку)
        database.ref(`books/${currentDetailsId}`).update({
            type: type,
            publisher: publisher,
            pages: pages
        });
    }
};

document.getElementById('deleteInDetailsBtn').onclick = function() {
    if (!currentDetailsId || !confirm("Видалити цю книгу для всіх користувачів?")) return;
    
    closeDetailsModal();
    
    // Видаляємо книгу із загального списку
    database.ref(`books/${currentDetailsId}`).remove()
        .then(() => {
            console.log("Книгу видалено із загальної бази.");
            // Також чистимо особисті відмітки поточного користувача, щоб не займали місце
            database.ref(`user_data/${currentUser}/${currentDetailsId}`).remove();
        })
        .catch(error => console.error("Помилка видалення книги:", error));
};

document.getElementById('goToEditBtn').onclick = function() {
    if (currentDetailsId) {
        const bookId = currentDetailsId;
        closeDetailsModal();
        openEditModal(bookId);
    }
};

document.getElementById('wishlistToggleBtn').onclick = function() {
    const book = books.find(b => b.id === currentDetailsId);
    if (book) {
        const newWishlistStatus = !book.inWishlist;
        
        // Пишемо статус сердечка в особисту папку користувача
        database.ref(`user_data/${currentUser}/${currentDetailsId}/inWishlist`).set(newWishlistStatus)
            .then(() => {
                book.inWishlist = newWishlistStatus;
                updateWishlistBtn(newWishlistStatus);
            });
    }
};

function updateWishlistBtn(isInWishlist) {
    const btn = document.getElementById('wishlistToggleBtn');
    if (!btn) return;
    if (isInWishlist) {
        btn.textContent = '💔 Видалити зі списку';
        btn.style.color = '#f85149';
    } else {
        btn.textContent = '❤️ В список бажань';
        btn.style.color = 'var(--text-muted)';
    }
}

// --- Dynamic Search Autocomplete ---
let autocompleteTimeout;
let currentSuggestions = [];
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const imageURLInput = document.getElementById('imageURL');
const suggestionsContainer = document.getElementById('autocomplete-suggestions');

if (imageURLInput) {
    imageURLInput.addEventListener('input', () => updateCoverPreview(imageURLInput.value));
}

function debounce(func, delay) {
    clearTimeout(autocompleteTimeout);
    autocompleteTimeout = setTimeout(func, delay);
}

if (titleInput) {
    titleInput.addEventListener('input', () => {
        debounce(fetchAutocompleteSuggestions, 900);
    });
}


  // Ініціалізація додатку
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

function fetchAutocompleteSuggestions() {
    const query = titleInput.value.trim();
    if (query.length < 3) {
        clearSuggestions();
        return;
    }

    // Будуємо лінк. Якщо ключ є — додаємо його, якщо немає — пробуємо анонімно
    let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`;
    if (googleBooksApiKey) {
    url += `&key=${googleBooksApiKey}`;
}

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Помилка сервера: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.items) {
                currentSuggestions = data.items;
                renderAutocompleteSuggestions(data.items);
            } else {
                clearSuggestions();
            }
        })
        .catch(error => {
            console.error('Error fetching suggestions:', error);
            // Якщо все ще вилітає 429, виводимо зрозуміле попередження в консоль
            if (error.message.includes('429')) {
                console.warn("Google все ще блокує IP. Потрібно вставити валідний API Key.");
            }
            clearSuggestions();
        });
}

 

function renderAutocompleteSuggestions(suggestions) {
    if (!suggestionsContainer) return;
    suggestionsContainer.innerHTML = '';
    
    const itemsWrapper = document.createElement('div');
    itemsWrapper.className = 'autocomplete-items';

    suggestions.forEach((item, index) => {
        const info = item.volumeInfo;
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        
        const thumb = info.imageLinks ? info.imageLinks.smallThumbnail : 'https://placehold.co/30x40/161b22/white?text=✏️';
        const authorText = info.authors ? info.authors.join(', ') : 'Невідомий автор';
        
        div.innerHTML = `
            <img src="${thumb}" style="width:30px; height:40px; object-fit:cover; border-radius:4px;">
            <div style="display:flex; flex-direction:column; min-width:0;">
                <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${info.title}</strong>
                <small style="color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${authorText}</small>
            </div>
        `;
        div.addEventListener('click', () => onSuggestionClick(index));
        itemsWrapper.appendChild(div);
    });
    suggestionsContainer.appendChild(itemsWrapper);
}

function onSuggestionClick(index) {
    const selectedBook = currentSuggestions[index].volumeInfo;
    
    titleInput.value = selectedBook.title || '';
    authorInput.value = selectedBook.authors ? selectedBook.authors.join(', ') : '';
    document.getElementById('pages').value = selectedBook.pageCount || '';
    document.getElementById('publisher').value = selectedBook.publisher || '';
    
    const imageUrl = selectedBook.imageLinks ? selectedBook.imageLinks.thumbnail : '';
    imageURLInput.value = imageUrl;
    
    updateCoverPreview(imageUrl);
    clearSuggestions();
}

function clearSuggestions() {
    if (suggestionsContainer) suggestionsContainer.innerHTML = '';
    currentSuggestions = [];
}

document.addEventListener('click', function(event) {
    if (suggestionsContainer && !suggestionsContainer.contains(event.target) && event.target !== titleInput) {
        clearSuggestions();
    }
});

function updateYearGoal() {
    const goal = parseInt(localStorage.getItem('yearGoal')) || 0;
    const input = document.getElementById('yearGoalInput');
    if (input && goal > 0) input.value = goal;

    const currentYear = new Date().getFullYear();
    const count = books.filter(b => b.isRead && new Date(b.id).getFullYear() === currentYear).length;
    const percent = goal > 0 ? Math.min(Math.round((count / goal) * 100), 100) : 0;

    const goalProgressEl = document.getElementById('yearGoalProgress');
    if (!goalProgressEl) return;

    goalProgressEl.innerHTML = goal > 0 ? `
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-muted); margin-bottom:6px;">
            <span>Прочитано цього року: <strong>${count}</strong> з <strong>${goal}</strong></span>
            <span>${percent}%</span>
        </div>
        <div style="background: var(--border-color); border-radius: 8px; overflow: hidden; height: 14px;">
            <div style="width:${percent}%; height:100%; background:var(--accent-color);"></div>
        </div>
    ` : '<p style="color:var(--text-muted); font-size:0.85rem; margin:0;">Встановіть ціль, щоб відстежувати прогрес</p>';
}

function updateCurrentlyReadingBanner() {
    const current = books.find(b => b.isCurrentlyReading);
    const banner = document.getElementById('currentlyReadingBanner');
    if (banner) {
        if (current) {
            document.getElementById('currentlyReadingTitle').textContent = current.title;
            document.getElementById('currentlyReadingAuthor').textContent = current.author;
            banner.style.display = 'block';
            banner.onclick = () => openDetailsModal(current.id);
        } else {
            banner.style.display = 'none';
        }
    }
}

function toggleReadDate(isChecked) {
    const container = document.getElementById('readDateContainer');
    if (container) {
        container.style.display = isChecked ? 'block' : 'none';
    }
}
window.toggleReadDate = toggleReadDate; // Робимо функцію глобальною для HTML


// Перевіряємо, чи є вже збережене ім'я користувача на цьому телефоні
let currentUser = localStorage.getItem('library_user_id');

if (!currentUser) {
    // Якщо немає, запитуємо (спрацює один раз при першому вході)
    let name = prompt("Введіть ваше ім'я (наприклад: Ігор або Марія):", "");
    if (!name) name = 'User_' + Math.floor(Math.random() * 1000); // дефолт, якщо скасували
    
    currentUser = name.trim();
    localStorage.setItem('library_user_id', currentUser);
}

// function totalResetAndFullMigration() {
//     // 1. Повністю стираємо стару гілку книг у Firebase, де виникло задвоєння
//     database.ref('books').remove()
//         .then(() => {
//             console.log("1. Стару базу книг успішно очищено.");

//             // 2. Беремо оригінальний масив з твого localStorage на телефоні
//             const localData = localStorage.getItem('myLibraryBooks');
//             if (!localData) {
//                 alert("Помилка: Не знайдено localStorage на цьому телефоні! Перевірте, чи зайшли саме з того браузера.");
//                 return;
//             }

//             const localBooks = JSON.parse(localData);
//             const globalBooksUpdate = {};
//             const userStatsUpdate = {};

//             localBooks.forEach(book => {
              
//                 globalBooksUpdate[book.id] = {
//                     id: book.id,
//                     title: book.title || '',
//                     author: book.author || '',
//                     imageURL: book.imageURL || '',
//                     pages: parseInt(book.pages) || 0,
//                     publisher: book.publisher || '',
//                     type: book.type || 'paper'
//                 };

//                 // ВРАХОВУЄМО ВСІ ОЦІНКИ ТА ДАТИ: Якщо книга має позначки — готуємо їх для папки "Ігор"
//                 if (book.isRead || book.rating > 0 || book.isCurrentlyReading || book.readDate || book.inWishlist) {
//                     userStatsUpdate[book.id] = {
//                         isRead: book.isRead || false,
//                         rating: book.rating || 0,
//                         isCurrentlyReading: book.isCurrentlyReading || false,
//                         readDate: book.readDate || '',
//                         inWishlist: book.inWishlist || false
//                     };
//                 }
//             });

//             // 3. Заливаємо чисті книги в спільну гілку
//             return database.ref('books').set(globalBooksUpdate)
//                 .then(() => {
//                     console.log("2. Чисті книги успішно завантажено в спільну базу.");
                    
//                     // 4. Перезаписуємо твої особисті оцінки/дати в папку "Ігор"
//                     return database.ref(`user_data/${currentUser}`).set(userStatsUpdate);
//                 });
//         })
//         .then(() => {
//             console.log(`3. Усі особисті оцінки та дати успішно відновлено для користувача: ${currentUser}`);
//             alert("ІДЕАЛЬНО! Базу повністю очищено від дублів, книги залито наново, а твої оцінки, дати та статистика повністю відновлені!");
//         })
//         .catch(error => console.error("Помилка повної міграції:", error));
// }

// // Автоматичний запуск через 2.5 секунди після старту додатка
// setTimeout(totalResetAndFullMigration, 2500);

// function migrateWishlistToFirebase() {
//     // 1. Беремо старі дані з твого localStorage на телефоні
//     const localData = localStorage.getItem('myLibraryBooks');
    
//     if (!localData) {
//         console.warn("У localStorage не знайдено книг для міграції списку бажань.");
//         alert("Помилка: localStorage порожній на цьому пристрої.");
//         return;
//     }

//     const localBooks = JSON.parse(localData);
//     const wishlistUpdates = {};
//     let count = 0;

//     localBooks.forEach(book => {
//         // Якщо книга була в списку бажань, готуємо оновлення для Firebase
//         if (book.inWishlist === true) {
//             wishlistUpdates[`${book.id}/inWishlist`] = true;
//             count++;
//         }
//     });

//     if (count > 0) {
//         console.log(`Знайдено ${count} книг у списку бажань. Переносимо для користувача: ${currentUser}...`);
        
//         // 2. Оновлюємо тільки прапорці інтересу всередині папки поточного користувача
//         database.ref(`user_data/${currentUser}`).update(wishlistUpdates)
//             .then(() => {
//                 console.log("Список бажань успішно синхронізовано з хмарою!");
//                 alert(`Успішно перенесено книг у список бажань: ${count}!`);
//             })
//             .catch(error => console.error("Помилка міграції списку бажань:", error));
//     } else {
//         alert("У твоєму локальному localStorage не знайдено книг із позначкою списку бажань.");
//     }
// }

// // Запускаємо автоматично через 2.5 секунди після завантаження сторінки
// setTimeout(migrateWishlistToFirebase, 2500);


document.addEventListener('DOMContentLoaded', loadBooks);
