let books = [];
let rawBooks = [];
let allUsersData = {};
const storageKey = 'myLibraryBooks';

// State variables
let currentFilterType = 'all';
let currentSearchQuery = '';
let currentSortOrder = 'date-new';
let currentPublisher = 'all';

const header = document.querySelector('header');
const modal = document.getElementById('addBookModal');
const openModalBtn = document.getElementById('openModalBtn');
const addBookForm = document.getElementById('addBookForm');
const bookList = document.getElementById('bookList');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const publisherFilter = document.getElementById('publisherFilter');
const coverPreview = document.getElementById('cover-preview');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');


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
        updateScrollToTopVisibility();
    };
}

function closeModal() { 
    modal.style.display = "none"; 
    updateCoverPreview(''); // Clear preview on close
    clearSuggestions();
    updateScrollToTopVisibility();
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
    const syncAndDisplay = () => {
        if (!rawBooks.length) return;
        
        const myData = allUsersData[currentUser] || {};

        // Об'єднуємо загальні дані про книги з особистими даними користувача
        books = rawBooks.map(book => {
            const stats = myData[book.id] || {};
            return {
                id: book.id,
                title: book.title || 'Без назви',
                author: book.author || 'Невідомий автор',
                imageURL: book.imageURL || '',
                pages: book.pages || null,
                publisher: book.publisher || '',
                type: book.type || 'paper',
                // Особисті дані користувача
                isRead: stats.isRead || false,
                rating: stats.rating || 0,
                isCurrentlyReading: stats.isCurrentlyReading || false,
                inWishlist: stats.inWishlist || false,
                readDate: stats.readDate || '',
                hidden: stats.hidden || false
            };
        }).filter(b => !b.hidden && b.id && b.title);

        console.log(`Синхронізовано! Книг: ${books.length}. Користувач: ${currentUser}`);
        displayBooks();
        updateCurrentlyReadingBanner();
        updateStats();
        renderReadHistory();
    };

    database.ref('books').on('value', (snapshot) => {
        rawBooks = snapshot.val() ? Object.values(snapshot.val()) : [];
        syncAndDisplay();
    });

    database.ref('user_data').on('value', (snapshot) => {
        allUsersData = snapshot.val() || {};
        syncAndDisplay();
    });
}

function saveBooks() {
    // Замість database.ref('books').set(books) — зберігаємо кожну книгу окремо
    const booksObj = {};
    books.forEach(book => {
        const { id, title, author, imageURL, pages, publisher, type } = book;
        // Важливо: зберігаємо ТІЛЬКИ метадані, щоб не затерти чужі оцінки своїми
        booksObj[id] = { id, title, author, imageURL, pages, publisher, type };
    });
    database.ref('books').set(booksObj)
        .catch(error => console.error("Помилка:", error));
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
    (b.title || '').toLowerCase().includes(query) || 
    (b.author || '').toLowerCase().includes(query)
);
    }

    // Фільтр по видавництву
    if (currentPublisher !== 'all') {
        booksToDisplay = booksToDisplay.filter(b => (b.publisher || '') === currentPublisher);
    }

    // Сортування
    switch (currentSortOrder) {
        case 'title-asc':
    booksToDisplay.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
        case 'title-desc':
    booksToDisplay.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
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

function renderReadHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;
    container.innerHTML = '';

    // Відображаємо блок лише для поточного користувача (того, хто зайшов у додаток)
    const myData = allUsersData[currentUser] || {};
    const myReadIds = Object.keys(myData).filter(id => myData[id] && myData[id].isRead);

    if (myReadIds.length === 0) {
        container.innerHTML = '<p class="empty-message" style="padding: 20px; text-align: center; color: var(--text-muted);">Ви ще не позначили жодну книгу як прочитану 📚</p>';
        return;
    }

    // Викликаємо рендеринг секції лише для себе
    renderUserHistorySection("Мої прочитані книги", myReadIds, myData, container);
}

function renderUserHistorySection(title, ids, userData, container) {
    if (ids.length === 0) return;

    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'history-user-header';
    sectionHeader.innerHTML = `<h3>👤 ${title} <small>(${ids.length} кн.)</small></h3>`;
    container.appendChild(sectionHeader);

    const grid = document.createElement('div');
    grid.className = 'book-list-container history-grid';
    
    // Сортуємо книги від нових до старих
    const sortedIds = [...ids].sort((a, b) => b - a);

    sortedIds.forEach(id => {
        const bookMeta = rawBooks.find(b => b.id == id);
        if (bookMeta) {
            createBookCard({ ...bookMeta, isRead: true, rating: userData[id].rating || 0 }, grid);
        }
    });
    container.appendChild(grid);
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
    let coverUrl = book.imageURL || 'https://placehold.co/200x280/161b22/white?text=No+Photo';
if (coverUrl.startsWith('http://')) {
    coverUrl = coverUrl.replace('http://', 'https://');
}

    const ratingStars = '★'.repeat(book.rating || 0) + '☆'.repeat(5 - (book.rating || 0));

    card.innerHTML = `
        <div style="position: relative;">
            ${book.isRead ? '<div class="read-badge">✅</div>' : ''}
            <img src="${coverUrl}" alt="${book.title}" onerror="this.src='https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200&auto=format&fit=crop'">
        </div>
        <div class="book-info">
            <h3>${book.title}</h3>
            <p>${book.author}</p>
            <div class="rating-display">${ratingStars}</div>
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
    const titleVal = document.getElementById('title').value.trim();
    const authorVal = document.getElementById('author').value.trim();

    // Перевірка що поля не порожні
    if (!titleVal || !authorVal) {
        alert('Введіть назву і автора книги!');
        return;
    }
    
    // Перевірка на дублікат
    const duplicate = books.find(b => 
    (b.title || '').toLowerCase() === titleVal.toLowerCase() && 
    (b.author || '').toLowerCase() === authorVal.toLowerCase()
);
    if (duplicate) {
        if (!confirm(`Книга "${titleVal}" вже є в бібліотеці. Додати ще раз?`)) return;
    }

    const newBookId = Date.now();
    const typeSelect = document.getElementById('addBookType');
    
    const newBook = { 
        id: newBookId, 
        title: titleVal, 
        author: authorVal, 
        imageURL: document.getElementById('imageURL').value,
        pages: parseInt(document.getElementById('pages').value) || null,
        publisher: document.getElementById('publisher').value,
        type: typeSelect ? typeSelect.value : 'paper'
    };

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
        if (clearSearchBtn) {
            clearSearchBtn.style.display = this.value ? 'flex' : 'none';
        }
        displayBooks();
    };
}

if (clearSearchBtn) {
    clearSearchBtn.onclick = function() {
        if (searchInput) {
            searchInput.value = '';
            currentSearchQuery = '';
            this.style.display = 'none';
            searchInput.focus();
            displayBooks();
        }
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
        const updatedBook = {
            title: document.getElementById('title').value,
            author: document.getElementById('author').value,
            imageURL: document.getElementById('imageURL').value,
            pages: parseInt(document.getElementById('pages').value) || null,
            publisher: document.getElementById('publisher').value
        };
        database.ref(`books/${id}`).update(updatedBook).then(() => closeModal());
    };
    
    modal.style.display = "flex";
}

window.openDetailsModal = (id) => {
    // Шукаємо спочатку в books, потім у rawBooks (якщо книга прихована для поточного користувача)
    const book = books.find(b => b.id === id) || rawBooks.find(b => b.id === id);
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
    updateScrollToTopVisibility();
    
    const readDateContainer = document.getElementById('readDateContainer');
    const readDate = book.readDate || '';
    document.getElementById('detailsReadDate').value = readDate;
    if (readDateContainer) {
        readDateContainer.style.display = book.isRead ? 'block' : 'none';
    }
};

function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = "none";
    updateScrollToTopVisibility();
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
    } else if (sectionId === 'history') {
        document.getElementById('history-section').style.display = 'block';
        renderReadHistory();
    } else if (sectionId === 'stats') {
        document.getElementById('stats-section').style.display = 'block';
        updateStats();
    }
    
    // Активуємо всі відповідні кнопки (наприклад, і в хедері, і в нижній панелі)
    document.querySelectorAll(`button[onclick="switchSection('${sectionId}')"]`).forEach(btn => {
        btn.classList.add('active');
    });
    
    // Перерендерюємо книги під нову секцію
    displayBooks();
    updateScrollToTopVisibility();
}
window.switchSection = switchSection;

// --- Stats & System Updates ---
function updateStats() {
    if (!books || books.length === 0) {
        ['statTotal','statRead','statPaper','statEbook','statAudio','statAvgRating']
            .forEach(id => { if(document.getElementById(id)) document.getElementById(id).textContent = '0'; });
        return;
    }

    const actualBooks = books.filter(b => !b.inWishlist);
    const readBooks = actualBooks.filter(b => b.isRead === true);
    const unreadBooks = actualBooks.filter(b => !b.isRead);
    const readCount = readBooks.length;
    const total = actualBooks.length;
    const percentage = total > 0 ? Math.round((readCount / total) * 100) : 0;

    // Основні цифри
    if(document.getElementById('statTotal')) document.getElementById('statTotal').textContent = total;
    if(document.getElementById('statRead')) document.getElementById('statRead').textContent = readCount;
    if(document.getElementById('statUnread')) document.getElementById('statUnread').textContent = unreadBooks.length;
    if(document.getElementById('statPercentage')) document.getElementById('statPercentage').textContent = percentage + '%';

    // Типи книг
    if(document.getElementById('statPaper')) document.getElementById('statPaper').textContent = actualBooks.filter(b => (b.type || 'paper') === 'paper').length;
    if(document.getElementById('statEbook')) document.getElementById('statEbook').textContent = actualBooks.filter(b => b.type === 'ebook').length;
    if(document.getElementById('statAudio')) document.getElementById('statAudio').textContent = actualBooks.filter(b => b.type === 'audio').length;

    // Середній рейтинг
    const ratedBooks = actualBooks.filter(b => b.rating > 0);
    const avgRating = ratedBooks.length > 0
        ? (ratedBooks.reduce((sum, b) => sum + b.rating, 0) / ratedBooks.length).toFixed(1)
        : 'N/A';
    if(document.getElementById('statAvgRating')) document.getElementById('statAvgRating').textContent = avgRating;

    // Топ авторів і видавництв
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
        const card = document.getElementById('topAuthorsCard');
        if (card) card.style.display = 'block';
    }

    const topPublishersUl = document.getElementById('statTopPublishers');
    if (topPublishersUl) {
        const topPublishers = getTopItems(actualBooks.map(b => b.publisher).filter(Boolean));
        topPublishersUl.innerHTML = topPublishers.map(p => `<li>${p[0]} <span>(${p[1]})</span></li>`).join('') || '<li>Немає даних</li>';
        const card = document.getElementById('topPublishersCard');
        if (card) card.style.display = 'block';
    }

    // Розподіл рейтингів
    const ratingDist = [1,2,3,4,5].reduce((acc, r) => {
        acc[r] = actualBooks.filter(b => b.rating === r).length;
        return acc;
    }, {});
    const maxRatingCount = Math.max(...Object.values(ratingDist), 1);
    const ratingDistContainer = document.getElementById('ratingDist');
    if (ratingDistContainer) {
        ratingDistContainer.innerHTML = Object.entries(ratingDist).map(([rating, count]) => {
            const width = Math.round((count / maxRatingCount) * 100);
            return `
                <div style="display:flex; align-items:center; margin-bottom:8px; gap:8px;">
                    <span style="width:60px; color:#ffca08;">${'★'.repeat(parseInt(rating))}</span>
                    <div style="flex:1; background:var(--border-color); border-radius:4px; overflow:hidden; height:10px;">
                        <div style="width:${width}%; height:100%; background:var(--accent-color); border-radius:4px;"></div>
                    </div>
                    <span style="width:25px; text-align:right; color:var(--text-muted); font-size:0.85rem;">${count}</span>
                </div>`;
        }).join('');
        const ratingDistCard = document.getElementById('ratingDistCard');
        if (ratingDistCard) ratingDistCard.style.display = ratedBooks.length > 0 ? 'block' : 'none';
    }

    // Прогрес читання
    const readPercent = total > 0 ? Math.round((readCount / total) * 100) : 0;
    const readProgressEl = document.getElementById('readProgress');
    if (readProgressEl) {
        readProgressEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.9rem; color:var(--text-muted);">
                <span>Прочитано ${readCount} з ${total}</span>
                <span>${readPercent}%</span>
            </div>
            <div style="background:var(--border-color); border-radius:8px; overflow:hidden; height:14px;">
                <div style="width:${readPercent}%; height:100%; background:var(--accent-color); border-radius:8px;"></div>
            </div>`;
        const card = document.getElementById('readProgressCard');
        if (card) card.style.display = 'block';
    }

    // Прочитано по місяцях
    const readByMonth = {};
    actualBooks.filter(b => b.isRead && b.readDate).forEach(b => {
        const [year, month] = b.readDate.split('-');
        const label = new Date(year, month - 1).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
        readByMonth[b.readDate] = readByMonth[b.readDate] || { label, count: 0 };
        readByMonth[b.readDate].count++;
    });
    const sortedMonths = Object.keys(readByMonth).sort().reverse();
    const maxMonthCount = Math.max(...sortedMonths.map(k => readByMonth[k].count), 1);
    const readByMonthEl = document.getElementById('statReadByMonth');
    if (readByMonthEl) {
        readByMonthEl.innerHTML = sortedMonths.length > 0
            ? sortedMonths.map(key => {
                const { label, count } = readByMonth[key];
                const width = Math.round((count / maxMonthCount) * 100);
                return `
                    <li style="flex-direction:column; align-items:flex-start; gap:4px;">
                        <div style="display:flex; justify-content:space-between; width:100%;">
                            <span>${label}</span>
                            <span style="color:var(--text-muted);">${count} кн.</span>
                        </div>
                        <div style="width:100%; background:var(--border-color); border-radius:4px; overflow:hidden; height:6px;">
                            <div style="width:${width}%; height:100%; background:var(--accent-color); border-radius:4px;"></div>
                        </div>
                    </li>`;
            }).join('')
            : '<li>Немає даних — вкажіть дату прочитання у деталях книги</li>';
        const card = document.getElementById('readByMonthCard');
        if (card) card.style.display = sortedMonths.length > 0 ? 'block' : 'none';
    }

    // Статистика сторінок
    const booksWithPages = readBooks.filter(b => b.pages > 0);
    const pagesUl = document.getElementById('statPages');
    if (pagesUl) {
        if (booksWithPages.length > 0) {
            const totalPagesCount = booksWithPages.reduce((sum, b) => sum + b.pages, 0);
            const avgPages = Math.round(totalPagesCount / booksWithPages.length);
            const maxBook = booksWithPages.reduce((a, b) => a.pages > b.pages ? a : b);
            const minBook = booksWithPages.reduce((a, b) => a.pages < b.pages ? a : b);
            pagesUl.innerHTML = `
                <li><span style="flex:1">📚 Всього сторінок прочитано</span><span>${totalPagesCount.toLocaleString('uk-UA')}</span></li>
                <li><span style="flex:1">📊 Середня кількість сторінок</span><span>${avgPages}</span></li>
                <li><span style="flex:1">🏆 Найбільша — ${maxBook.title}</span><span>${maxBook.pages} стор.</span></li>
                <li><span style="flex:1">🪶 Найменша — ${minBook.title}</span><span>${minBook.pages} стор.</span></li>`;
        } else {
            pagesUl.innerHTML = '<li>Немає даних — вкажіть кількість сторінок у деталях книги</li>';
        }
        const card = document.getElementById('pagesStatsCard');
        if (card) card.style.display = 'block';
    }

    // Розподіл за довжиною книг
    const lengthDistContainer = document.getElementById('lengthDist');
    if (lengthDistContainer) {
        const lengthGroups = [
            { label: '📗 Короткі (<200 стор.)', count: readBooks.filter(b => b.pages > 0 && b.pages < 200).length, color: '#32d74b' },
            { label: '📘 Середні (200-500 стор.)', count: readBooks.filter(b => b.pages >= 200 && b.pages <= 500).length, color: '#5e5ce6' },
            { label: '📕 Товсті (>500 стор.)', count: readBooks.filter(b => b.pages > 500).length, color: '#ff453a' }
        ];

        const totalWithPages = lengthGroups.reduce((sum, g) => sum + g.count, 0);
        
        lengthDistContainer.innerHTML = lengthGroups.map(group => {
            const width = totalWithPages > 0 ? Math.round((group.count / totalWithPages) * 100) : 0;
            return `
                <div style="margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
                        <span>${group.label}</span>
                        <span style="color:var(--text-muted);">${group.count} кн.</span>
                    </div>
                    <div style="background:var(--border-color); border-radius:4px; height:8px; overflow:hidden;">
                        <div style="width:${width}%; height:100%; background:${group.color}; border-radius:4px;"></div>
                    </div>
                </div>`;
        }).join('');
        document.getElementById('lengthDistCard').style.display = totalWithPages > 0 ? 'block' : 'none';
    }

    // Деталі по типах
    const typeCounts = actualBooks.reduce((acc, book) => {
        const t = book.type || 'paper';
        acc[t] = (acc[t] || 0) + 1;
        return acc;
    }, {});
    const typeLabels = { 'paper': '📖 Паперові', 'ebook': '📱 Електронні', 'audio': '🎧 Аудіокниги' };
    const typeBreakdownUl = document.getElementById('statTypeBreakdown');
    if (typeBreakdownUl) {
        typeBreakdownUl.innerHTML = Object.keys(typeLabels).map(t => {
            const count = typeCounts[t] || 0;
            const pct = total > 0 ? Math.round(count / total * 100) : 0;
            return `<li><span>${typeLabels[t]}</span><strong>${count}</strong><span>(${pct}%)</span></li>`;
        }).join('');
        const card = document.getElementById('typeBreakdownCard');
        if (card) card.style.display = 'block';
    }

    // Найвище оцінені
    const topRatedUl = document.getElementById('statTopRated');
    if (topRatedUl) {
        const topRated = actualBooks.filter(b => b.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 5);
        topRatedUl.innerHTML = topRated.length > 0
            ? topRated.map(b => `
                <li>
                    <span style="color:#ffca08; white-space:nowrap; flex-shrink:0;">${'★'.repeat(b.rating)}${'☆'.repeat(5-b.rating)}</span>
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${b.title}</span>
                    <span style="color:var(--text-muted); white-space:nowrap; flex-shrink:0;">— ${b.author}</span>
                </li>`).join('')
            : '<li>Немає оцінених книг</li>';
        const card = document.getElementById('topRatedCard');
        if (card) card.style.display = topRated.length > 0 ? 'block' : 'none';
    }

    // Ще не прочитано
    const unreadCardContainer = document.getElementById('unreadCard');
    const unreadListUl = unreadCardContainer ? unreadCardContainer.querySelector('ul') : null;
    if (unreadListUl) {
        const displayUnread = unreadBooks.slice(0, 10);
        unreadListUl.innerHTML = displayUnread.length === 0
            ? '<li>Усі книги прочитано! 🎉</li>'
            : displayUnread.map(b => `
                <li>
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${b.title}</span>
                    <span style="color:var(--text-muted); white-space:nowrap; flex-shrink:0;">— ${b.author}</span>
                </li>`).join('');
        if (unreadCardContainer) unreadCardContainer.style.display = 'block';
    }

    // Wishlist в статистиці
    const wishlistBooks = books.filter(b => b.inWishlist);
    const statWishlistEl = document.getElementById('statWishlist');
    if (statWishlistEl) {
        statWishlistEl.innerHTML = wishlistBooks.length > 0
            ? wishlistBooks.map(b => `
                <li>
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${b.title}</span>
                    <span style="color:var(--text-muted); white-space:nowrap; flex-shrink:0;">— ${b.author}</span>
                </li>`).join('')
            : '<li>Список порожній</li>';
        const card = document.getElementById('wishlistCard');
        if (card) card.style.display = 'block';
    }

    // Річна ціль
    updateYearGoal();
}

document.getElementById('saveDetailsBtn').onclick = () => {
    // const index = books.find(b => b.id === currentDetailsId); 
    if (currentDetailsId) {
        const isCurrently = document.getElementById('detailsCurrentlyReading').checked;
        const isRead = document.getElementById('detailsReadStatus').checked;
        const type = document.getElementById('detailsBookType').value;
        const publisher = document.getElementById('detailsPublisher').value;
        const pages = parseInt(document.getElementById('detailsPages').value) || null;
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
    if (!currentDetailsId) return;
    
    const book = books.find(b => b.id === currentDetailsId);
    const isInWishlist = book && book.inWishlist;
    
    if (isInWishlist) {
        // Книга в wishlist — просто ховаємо її для себе
        if (!confirm("Видалити цю книгу зі свого списку бажань?")) return;
        database.ref(`user_data/${currentUser}/${currentDetailsId}`).update({
            inWishlist: false,
            hidden: true  // ← прихована тільки для тебе
        }).then(() => closeDetailsModal());
    } else {
        // Звичайна книга — видаляємо для всіх
        if (!confirm("Видалити цю книгу для всіх користувачів?")) return;
        database.ref(`books/${currentDetailsId}`).remove();
        database.ref(`user_data/${currentUser}/${currentDetailsId}`).remove();
        closeDetailsModal();
    }
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
    const count = books.filter(b => {
    if (!b.isRead || !b.readDate) return false;
    return parseInt(b.readDate.split('-')[0]) === currentYear;
}).length;
    const percent = goal > 0 ? Math.min(Math.round((count / goal) * 100), 100) : 0;
    
    // Розрахунок темпу
    const month = new Date().getMonth() + 1;
    const expected = (goal / 12) * month;
    const isOnTrack = count >= expected;
    const paceText = isOnTrack ? "Ви йдете за графіком! 🎉" : `Потрібно наздогнати: ще ${Math.ceil(expected - count)} кн.`;

    const goalProgressEl = document.getElementById('yearGoalProgress');
    if (!goalProgressEl) return;

    goalProgressEl.innerHTML = goal > 0 ? `
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-muted); margin-bottom:6px;">
            <span>Прочитано: <strong>${count}</strong> з <strong>${goal}</strong></span>
            <span>${percent}%</span>
        </div>
        <div style="background: var(--border-color); border-radius: 8px; overflow: hidden; height: 14px;">
            <div style="width:${percent}%; height:100%; background:var(--accent-color);"></div>
        </div>
        <p style="font-size: 0.75rem; color: ${isOnTrack ? 'var(--success)' : 'var(--danger)'}; margin: 8px 0 0;">${paceText}</p>
    ` : '<p style="color:var(--text-muted); font-size:0.85rem; margin:0;">Встановіть ціль, щоб відстежувати прогрес</p>';
}

function saveYearGoal() {
    const goal = parseInt(document.getElementById('yearGoalInput').value);
    if (!goal || goal < 1) return;
    localStorage.setItem('yearGoal', goal);
    updateYearGoal();
}
window.saveYearGoal = saveYearGoal;

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

// --- Scroll to Top Button Logic ---
let lastScrollY = window.scrollY;
function updateScrollToTopVisibility() {
    if (!scrollToTopBtn) return;
    
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const detailsModal = document.getElementById('detailsModal');
    
    // Перевірка, чи відкрите будь-яке модальне вікно
    const isModalOpen = (modal && modal.style.display === 'flex') || 
                        (detailsModal && detailsModal.style.display === 'flex');
                        
    // Перевірка, чи фокус зараз на полі вводу (клавіатура відкрита)
    const isInputFocused = document.activeElement && 
                           ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);

    // Логіка для хедера (ховаємо при скролі вниз, показуємо при скролі вгору)
    if (header && !isModalOpen) {
        if (scrollY > lastScrollY && scrollY > 100) {
            // Скролимо вниз
            header.classList.add('header-hidden');
        } else {
            // Скролимо вгору
            header.classList.remove('header-hidden');
        }
    }

    if (scrollY > 400 && !isModalOpen && !isInputFocused) {
        scrollToTopBtn.classList.add('show');
    } else {
        scrollToTopBtn.classList.remove('show');
    }

    lastScrollY = scrollY;
}

window.addEventListener('scroll', updateScrollToTopVisibility);

// Приховуємо кнопку, коли користувач починає друкувати
document.addEventListener('focusin', updateScrollToTopVisibility);
document.addEventListener('focusout', () => setTimeout(updateScrollToTopVisibility, 100));

if (scrollToTopBtn) {
    scrollToTopBtn.onclick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

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

function shareBookList() {
    const readBooks = books.filter(b => b.isRead && !b.inWishlist);
    const unreadBooks = books.filter(b => !b.isRead && !b.inWishlist);
    const wishlistBooks = books.filter(b => b.inWishlist);

    const renderSection = (title, list, showDate = false) => {
        if (list.length === 0) return '';
        return `
            <h2>${title} (${list.length})</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Назва</th>
                        <th>Автор</th>
                        <th>Видавництво</th>
                        <th>Сторінок</th>
                        <th>Рейтинг</th>
                        ${showDate ? '<th>Прочитано</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${list.map((b, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td><strong>${b.title}</strong></td>
                            <td>${b.author}</td>
                            <td>${b.publisher || '—'}</td>
                            <td>${b.pages || '—'}</td>
                            <td>${b.rating ? '★'.repeat(b.rating) : '—'}</td>
                            ${showDate ? `<td>${b.readDate ? new Date(b.readDate + '-01').toLocaleDateString('uk-UA', {month: 'long', year: 'numeric'}) : '—'}</td>` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    };

    const html = `<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <title>Моя бібліотека</title>
    <style>
        body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        h1 { font-size: 1.8rem; margin-bottom: 4px; }
        .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 30px; }
        h2 { font-size: 1.2rem; margin: 30px 0 10px; border-bottom: 2px solid #8b5cf6; padding-bottom: 6px; color: #8b5cf6; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        th { background: #8b5cf6; color: white; padding: 10px 12px; text-align: left; font-size: 0.85rem; }
        td { padding: 9px 12px; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #faf5ff; }
    </style>
</head>
<body>
    <h1>📚 Моя домашня бібліотека</h1>
    <p class="subtitle">Згенеровано: ${new Date().toLocaleDateString('uk-UA', {day: 'numeric', month: 'long', year: 'numeric'})} · Всього: ${books.filter(b => !b.inWishlist).length} книг</p>
    ${renderSection('✅ Прочитані', readBooks, true)}
    ${renderSection('📖 Непрочитані', unreadBooks)}
    ${renderSection('❤️ Список бажань', wishlistBooks)}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `бібліотека_${new Date().toLocaleDateString('uk-UA').replace(/\./g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
}
window.shareBookList = shareBookList;

function shareWishlist() {
    const wishlistBooks = books.filter(b => b.inWishlist);
    if (wishlistBooks.length === 0) {
        alert('Список бажань порожній!');
        return;
    }

    const html = `<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <title>Список бажань</title>
    <style>
        body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        h1 { font-size: 1.6rem; margin-bottom: 4px; }
        .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        th { background: #f85149; color: white; padding: 10px 12px; text-align: left; font-size: 0.85rem; }
        td { padding: 9px 12px; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #fff5f5; }
    </style>
</head>
<body>
    <h1>❤️ Список бажань</h1>
    <p class="subtitle">Згенеровано: ${new Date().toLocaleDateString('uk-UA', {day: 'numeric', month: 'long', year: 'numeric'})} · Книг: ${wishlistBooks.length}</p>
    <table>
        <thead>
            <tr><th>#</th><th>Назва</th><th>Автор</th><th>Видавництво</th><th>Сторінок</th></tr>
        </thead>
        <tbody>
            ${wishlistBooks.map((b, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${b.title}</strong></td>
                    <td>${b.author}</td>
                    <td>${b.publisher || '—'}</td>
                    <td>${b.pages || '—'}</td>
                </tr>`).join('')}
        </tbody>
    </table>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wishlist_${new Date().toLocaleDateString('uk-UA').replace(/\./g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
}
window.shareWishlist = shareWishlist;
// function migrateWifeData() {
//     const localData = localStorage.getItem('myLibraryBooks');
    
//     if (!localData) {
//         alert('Помилка: localStorage порожній на цьому телефоні!');
//         return;
//     }

//     const localBooks = JSON.parse(localData);
//     const userStatsUpdate = {};
//     let count = 0;

//     localBooks.forEach(book => {
//         // Переносимо тільки особисті статуси
//         if (book.isRead || book.rating > 0 || book.isCurrentlyReading || 
//             book.readDate || book.inWishlist) {
//             userStatsUpdate[book.id] = {
//                 isRead: book.isRead || false,
//                 rating: book.rating || 0,
//                 isCurrentlyReading: book.isCurrentlyReading || false,
//                 readDate: book.readDate || '',
//                 inWishlist: book.inWishlist || false
//             };
//             count++;
//         }
//     });

//     if (count === 0) {
//         alert('Не знайдено жодних особистих даних для міграції.');
//         return;
//     }

//     console.log(`Знайдено ${count} книг з особистими даними. Переносимо для: ${currentUser}...`);

//     database.ref(`user_data/${currentUser}`).update(userStatsUpdate)
//         .then(() => {
//             alert(`✅ Успішно перенесено ${count} книг для користувача: ${currentUser}!`);
//         })
//         .catch(error => {
//             console.error('Помилка міграції:', error);
//             alert('Помилка міграції: ' + error.message);
//         });
// }
// window.migrateWifeData = migrateWifeData;

document.addEventListener('DOMContentLoaded', loadBooks);
