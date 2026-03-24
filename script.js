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
}

window.onclick = (event) => {
    if (!event.target.closest('.title-wrapper')) {
        const d = document.getElementById('backupDropdown');
        if (d) d.classList.remove('show');
    }
    if (event.target === modal) closeModal();
};

// --- Data & Rendering ---
function loadBooks() {
    const data = localStorage.getItem(storageKey);
    books = data ? JSON.parse(data) : [];
    displayBooks();
}

function saveBooks() {
    localStorage.setItem(storageKey, JSON.stringify(books));
}

function displayBooks() {
    let booksToDisplay = [...books];
        booksToDisplay = booksToDisplay.filter(b => !b.inWishlist);
    // 1. Filter by type
    if (currentFilterType !== 'all') {
        booksToDisplay = booksToDisplay.filter(b => (b.type || 'paper') === currentFilterType);
    }

    // 2. Filter by search
    if (currentSearchQuery) {
        const query = currentSearchQuery.toLowerCase();
        booksToDisplay = booksToDisplay.filter(b => 
            b.title.toLowerCase().includes(query) || 
            b.author.toLowerCase().includes(query)
        );
    }

    // 3. Filter by publisher
    if (currentPublisher !== 'all') {
        booksToDisplay = booksToDisplay.filter(b => (b.publisher || '') === currentPublisher);
    }

    // 4. Sort
    switch (currentSortOrder) {
        case 'title-asc':
            booksToDisplay.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'title-desc':
            booksToDisplay.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case 'publisher-asc':
            booksToDisplay.sort((a, b) => (a.publisher || '').localeCompare(b.publisher || ''));
            break;
        case 'publisher-desc':
            booksToDisplay.sort((a, b) => (b.publisher || '').localeCompare(a.publisher || ''));
            break;
        case 'date-old':
            booksToDisplay.sort((a, b) => a.id - b.id);
            break;
        case 'date-new':
        default:
            booksToDisplay.sort((a, b) => b.id - a.id);
            break;
    }

    renderBooks(booksToDisplay);
}

function renderBooks(arr) {
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
    books.unshift({ 
        id: Date.now(), 
        title: document.getElementById('title').value, 
        author: document.getElementById('author').value, 
        imageURL: document.getElementById('imageURL').value,
        publisher: document.getElementById('publisher').value,
        type: 'paper', 
        isRead: false, 
        rating: 0 
    });
    saveBooks();
    displayBooks();
    closeModal();
};
addBookForm.onsubmit = onAddSubmit;

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
                alert('Error: Invalid file format.');
            }
        } catch (error) {
            alert('Error reading file.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
};

// --- Details Modal ---
let currentDetailsId = null;
let tempRating = 0;

function updateCoverPreview(url) {
    if (url) {
        coverPreview.src = url;
        coverPreview.style.display = 'block';
    } else {
        coverPreview.src = '';
        coverPreview.style.display = 'none';
    }
}

function openEditModal(id) {
    const book = books.find(x => x.id === id);
    if (!book) return;

    document.querySelector('#addBookModal h2').textContent = 'Редагувати книгу';
    document.getElementById('title').value = book.title;
    document.getElementById('author').value = book.author;
    document.getElementById('imageURL').value = book.imageURL || '';
    document.getElementById('publisher').value = book.publisher || '';
    
    updateCoverPreview(book.imageURL || ''); // Show existing cover
    
    addBookForm.onsubmit = (e) => {
        e.preventDefault();
        const index = books.findIndex(b => b.id === id);
        if (index !== -1) {
            books[index].title = document.getElementById('title').value;
            books[index].author = document.getElementById('author').value;
            books[index].imageURL = document.getElementById('imageURL').value;
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
    document.getElementById('detailsModal').style.display = "flex";
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

function startScanner() {
    if (typeof Quagga === 'undefined') {
        alert('Scanner library not loaded!');
        return;
    }

    Quagga.init({
        inputStream : {
            name : "Live",
            type : "LiveStream",
            target: document.querySelector('#interactive'),
            constraints: {
                width: 480,
                height: 320,
                facingMode: "environment" // 'user' for front camera
            },
        },
        decoder : {
            readers : ["ean_reader"]
        },
        locate: true, // try to locate barcodes in the image
    }, function(err) {
        if (err) {
            console.error(err);
            alert("Error starting scanner: " + err);
            return;
        }
        console.log("Initialization finished. Ready to start");
        Quagga.start();
    });

    Quagga.onDetected(function(result) {
        var code = result.codeResult.code;
        
        // Stop the scanner
        Quagga.stop();

        // Switch back to home screen to show the modal
        switchSection('home');
        
        // Fetch book info from Google Books API
        fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${code}`)
            .then(response => response.json())
            .then(data => {
                if (data.items && data.items.length > 0) {
                    const book = data.items[0].volumeInfo;
                    
                    // Pre-fill the add book form
                    document.getElementById('title').value = book.title || '';
                    document.getElementById('author').value = book.authors ? book.authors.join(', ') : '';
                    document.getElementById('imageURL').value = book.imageLinks ? book.imageLinks.thumbnail : '';
                    
                    // Open the add book modal
                    document.querySelector('#addBookModal h2').textContent = 'Додати знайдену книгу';
                    addBookForm.onsubmit = onAddSubmit;
                    modal.style.display = "flex";
                } else {
                    alert(`Книгу з ISBN ${code} не знайдено.`);
                }
            })
            .catch(error => {
                console.error('Error fetching book data:', error);
                alert('Помилка при пошуку книги.');
            });
    });
}

function switchSection(sectionId) {
    // Hide all app sections
    document.querySelectorAll('.app-section').forEach(s => s.style.display = 'none');
    
    // Show the selected section
    const activeSection = document.getElementById(sectionId + '-section');
    if (activeSection) {
        activeSection.style.display = 'block';
    }

    // Update active state on nav buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(`'${sectionId}'`)) {
            btn.classList.add('active');
        }
    });
    
    // Handle scanner state
    if (sectionId === 'scanner') {
        startScanner();
    } else {
        if (typeof Quagga !== 'undefined' && Quagga.running) {
            Quagga.stop();
        }
    }
    
    // Update stats when switching to the stats section
    if (sectionId === 'stats') {
        updateStats();
    }
    if (sectionId === 'wishlist') {
    renderWishlist();
}
}

function updateStats() {
    // Basic stats
    document.getElementById('statTotal').textContent = books.length;
    document.getElementById('statRead').textContent = books.filter(b => b.isRead).length;
    document.getElementById('statPaper').textContent = books.filter(b => b.type === 'paper' || !b.type).length;
    document.getElementById('statEbook').textContent = books.filter(b => b.type === 'ebook').length;
    document.getElementById('statAudio').textContent = books.filter(b => b.type === 'audio').length;

    // Average Rating
    const ratedBooks = books.filter(b => b.rating > 0);
    const avgRating = ratedBooks.length > 0
        ? (ratedBooks.reduce((sum, b) => sum + b.rating, 0) / ratedBooks.length).toFixed(1)
        : 'N/A';
    document.getElementById('statAvgRating').textContent = avgRating;

    // Helper for Top Authors/Publishers
    const getTopItems = (items, limit = 15) => {
        const counts = items.reduce((acc, item) => {
            if (item) acc[item] = (acc[item] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit);
    };

    // Top Authors
    const authors = books.map(b => b.author);
    const topAuthors = getTopItems(authors);
    const topAuthorsList = document.getElementById('statTopAuthors');
    topAuthorsList.innerHTML = topAuthors.length > 0 
        ?topAuthors.map(a => `<li>${a[0]} <span>(${a[1]})</span></li>`).join('')
        : '<li>Немає даних</li>';
    document.getElementById('topAuthorsCard').style.display = authors.some(a => a) ? 'block' : 'none';

    // Top Publishers
    const publishers = books.map(b => b.publisher);
    const topPublishers = getTopItems(publishers);
    const topPublishersList = document.getElementById('statTopPublishers');
    topPublishersList.innerHTML = topPublishers.length > 0
        ? topPublishers.map(p => `<li>${p[0]} <span>(${p[1]})</span></li>`).join('')
        : '<li>Немає даних</li>';
    document.getElementById('topPublishersCard').style.display = publishers.some(p => p) ? 'block' : 'none';

    // Rating Distribution
    const ratingDist = [1, 2, 3, 4, 5].reduce((acc, rating) => {
        acc[rating] = books.filter(b => b.rating === rating).length;
        return acc;
    }, {});
    const maxRatingCount = Math.max(...Object.values(ratingDist));
    const ratingDistContainer = document.getElementById('ratingDist');
    ratingDistContainer.innerHTML = Object.entries(ratingDist).map(([rating, count]) => {
        const width = maxRatingCount > 0 ? (count / maxRatingCount) * 100 : 0;
        return `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="width: 25px;">${'★'.repeat(rating)}</span>
                <div style="flex: 1; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div class="bar" style="width: ${width}%;"></div>
                </div>
                <span style="width: 30px; text-align: right; color: var(--text-muted);">${count}</span>
            </div>
        `;
    }).join('');
    document.getElementById('ratingDistCard').style.display = ratedBooks.length > 0 ? 'block' : 'none';


    // Wishlist
const wishlistBooks = books.filter(b => b.inWishlist);
const wishlistEl = document.getElementById('statWishlist');
wishlistEl.innerHTML = wishlistBooks.length > 0
    ? wishlistBooks.map(b => `
    <li>
        <span style="color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">${b.title}</span>
        <span style="color:var(--text-muted); white-space:nowrap; flex-shrink:0;">— ${b.author}</span>
    </li>
`).join('')
    : '<li>Список порожній</li>';
document.getElementById('wishlistCard').style.display = 'block';

// Прогрес читання (прогрес-бар)
const totalBooks = books.filter(b => !b.inWishlist).length;
const readBooks = books.filter(b => b.isRead).length;
const readPercent = totalBooks > 0 ? Math.round((readBooks / totalBooks) * 100) : 0;
document.getElementById('readProgress').innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9rem; color: var(--text-muted);">
        <span>Прочитано ${readBooks} з ${totalBooks}</span>
        <span>${readPercent}%</span>
    </div>
    <div style="background: var(--border-color); border-radius: 8px; overflow: hidden; height: 14px;">
        <div style="width: ${readPercent}%; height: 100%; background: var(--accent-color); border-radius: 8px; transition: width 0.5s;"></div>
    </div>
`;
document.getElementById('readProgressCard').style.display = 'block';

// Деталі по типах
const typeData = [
    { label: '📖 Паперові', count: books.filter(b => (b.type || 'paper') === 'paper' && !b.inWishlist).length },
    { label: '📱 Електронні', count: books.filter(b => b.type === 'ebook' && !b.inWishlist).length },
    { label: '🎧 Аудіо', count: books.filter(b => b.type === 'audio' && !b.inWishlist).length },
];
document.getElementById('statTypeBreakdown').innerHTML = typeData
    .map(t => `<li>${t.label} <strong>${t.count}</strong> <span>(${totalBooks > 0 ? Math.round(t.count/totalBooks*100) : 0}%)</span></li>`)
    .join('');
document.getElementById('typeBreakdownCard').style.display = 'block';

// Топ оцінені книги
const topRated = [...books]
    .filter(b => b.rating > 0 && !b.inWishlist)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);
const topRatedEl = document.getElementById('statTopRated');
topRatedEl.innerHTML = topRated.length > 0
    ? topRated.map(b => `
    <li>
        <span style="color:#ffca08; font-size:0.75rem; white-space:nowrap; flex-shrink:0;">${'★'.repeat(b.rating)}${'☆'.repeat(5-b.rating)}</span>
        <span style="color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">${b.title}</span>
        <span style="color:var(--text-muted); white-space:nowrap; flex-shrink:0;">— ${b.author}</span>
    </li>
`).join('')
    : '<li>Немає оцінених книг</li>';
document.getElementById('topRatedCard').style.display = topRated.length > 0 ? 'block' : 'none';

// Непрочитані книги — по одній від кожного автора чиї книги вже читав
const readAuthors = [...new Set(books.filter(b => b.isRead).map(b => b.author))];
const unread = readAuthors
    .map(author => books.find(b => b.author === author && !b.isRead && !b.inWishlist))
    .filter(Boolean)
    .slice(0, 5);

const unreadEl = document.getElementById('statUnread');
unreadEl.innerHTML = unread.length > 0
    ? unread.map(b => `
    <li>
        <span style="color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">${b.title}</span>
        <span style="color:var(--text-muted); white-space:nowrap; flex-shrink:0;">— ${b.author}</span>
    </li>
`).join('')
    : '<li>Немає рекомендацій — додайте більше книг одного автора</li>';
document.getElementById('unreadCard').style.display = 'block';
}

document.getElementById('saveDetailsBtn').onclick = () => {
    const index = books.findIndex(b => b.id === currentDetailsId);
    if (index !== -1) {
        books[index].isRead = document.getElementById('detailsReadStatus').checked;
        books[index].rating = tempRating;
        books[index].type = document.getElementById('detailsBookType').value;
        books[index].publisher = document.getElementById('detailsPublisher').value;
        saveBooks();
        displayBooks();
        closeDetailsModal();
    }
};

document.getElementById('deleteInDetailsBtn').onclick = function() {
    if (currentDetailsId && confirm("Видалити цю книгу?")) {
        books = books.filter(x => x.id !== currentDetailsId);
        saveBooks();
        displayBooks();
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
    const index = books.findIndex(b => b.id === currentDetailsId);
    if (index !== -1) {
        books[index].inWishlist = !books[index].inWishlist;
        saveBooks();
        displayBooks();
        renderWishlist();
        updateWishlistBtn(books[index].inWishlist);
    }
};

function updateWishlistBtn(isInWishlist) {
    const btn = document.getElementById('wishlistToggleBtn');
    if (isInWishlist) {
        btn.textContent = '💔 Видалити зі списку';
        btn.style.color = '#f85149';
        btn.style.borderColor = 'rgba(248,81,73,0.3)';
    } else {
        btn.textContent = '❤️ В список бажань';
        btn.style.color = 'var(--text-muted)';
        btn.style.borderColor = 'var(--border-color)';
    }
}

// --- Autocomplete ---
let autocompleteTimeout;
let currentSuggestions = [];
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const imageURLInput = document.getElementById('imageURL');
const suggestionsContainer = document.getElementById('autocomplete-suggestions');

imageURLInput.addEventListener('input', () => {
    updateCoverPreview(imageURLInput.value);
});

function debounce(func, delay) {
    clearTimeout(autocompleteTimeout);
    autocompleteTimeout = setTimeout(func, delay);
}

titleInput.addEventListener('input', () => {
    debounce(fetchAutocompleteSuggestions, 300);
});

function fetchAutocompleteSuggestions() {
    const query = titleInput.value;
    if (query.length < 3) {
        clearSuggestions();
        return;
    }

    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`)
        .then(response => response.json())
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
            clearSuggestions();
        });
}

function renderAutocompleteSuggestions(suggestions) {
    suggestionsContainer.innerHTML = '';
    const itemsWrapper = document.createElement('div');
    itemsWrapper.className = 'autocomplete-items';

    suggestions.forEach((book, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `
            <strong>${book.volumeInfo.title}</strong>
            <small>${book.volumeInfo.authors ? book.volumeInfo.authors.join(', ') : 'Unknown Author'}</small>
        `;
        item.addEventListener('click', () => onSuggestionClick(index));
        itemsWrapper.appendChild(item);
    });
    suggestionsContainer.appendChild(itemsWrapper);
}

function onSuggestionClick(index) {
    const selectedBook = currentSuggestions[index].volumeInfo;
    titleInput.value = selectedBook.title || '';
    authorInput.value = selectedBook.authors ? selectedBook.authors.join(', ') : '';
    const imageUrl = selectedBook.imageLinks ? selectedBook.imageLinks.thumbnail : '';
    imageURLInput.value = imageUrl;
    updateCoverPreview(imageUrl);
    clearSuggestions();
}

function clearSuggestions() {
    suggestionsContainer.innerHTML = '';
    currentSuggestions = [];
}

// Close suggestions when clicking outside
document.addEventListener('click', function(event) {
    if (!suggestionsContainer.contains(event.target) && event.target !== titleInput) {
        clearSuggestions();
    }
});
// --- Wishlist ---
function renderWishlist() {
    const wishlistBooks = books.filter(b => b.inWishlist);
    const container = document.getElementById('wishlistList');
    container.innerHTML = '';
    
    if (wishlistBooks.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 40px;">Список порожній. Додайте книги через кнопку ❤️</p>';
        return;
    }

    wishlistBooks.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.addEventListener('click', () => openDetailsModal(book.id));
        card.innerHTML = `
            <div class="type-badge">❤️</div>
            <img src="${book.imageURL || 'https://placehold.co/200x280/161b22/white?text=No+Photo'}" 
                 onerror="this.src='https://placehold.co/200x280/161b22/white?text=Error'">
            <div class="book-info">
                <h3>${book.title}</h3>
                <p>${book.author}</p>
                ${book.publisher ? `<p class="publisher">${book.publisher}</p>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', loadBooks);
