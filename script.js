let books = [];
let rawBooks = [];
let allUsersData = {};
const storageKey = 'myLibraryBooks';
const allowedEditorEmails = ['igopko1996@gmail.com', 'marialys1995@gmail.com'];
let currentAuthUser = null;
let canEditLibrary = false;

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
const authBtn = document.getElementById('authBtn');


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

function isAllowedEditor(user) {
    return !!user && allowedEditorEmails.includes((user.email || '').toLowerCase());
}

function requireEditor(actionName = 'змінювати бібліотеку') {
    if (canEditLibrary) return true;
    alert(`Увійдіть через дозволений Google-акаунт, щоб ${actionName}.`);
    return false;
}

function setEditingEnabled(enabled) {
    canEditLibrary = enabled;

    if (openModalBtn) {
        openModalBtn.disabled = !enabled;
        openModalBtn.style.opacity = enabled ? '1' : '0.45';
        openModalBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
        openModalBtn.title = enabled ? '' : 'Увійдіть через Google, щоб додавати книги';
    }

    const importButton = document.querySelector('button[onclick="document.getElementById(\'importFile\').click()"]');
    if (importButton) {
        importButton.disabled = !enabled;
        importButton.style.opacity = enabled ? '1' : '0.45';
        importButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
        importButton.title = enabled ? '' : 'Увійдіть через Google, щоб імпортувати';
    }
}

function updateAuthUI() {
    if (!authBtn) return;

    if (currentAuthUser) {
        authBtn.textContent = canEditLibrary ? 'Admin' : 'Read only';
        authBtn.title = currentAuthUser.email || '';
        authBtn.style.borderColor = canEditLibrary ? 'var(--success)' : 'var(--danger)';
    } else {
        authBtn.textContent = 'Login';
        authBtn.title = 'Увійти через Google';
        authBtn.style.borderColor = 'var(--border-color)';
    }
}



// --- Window Management ---
function toggleDropdown(event) {
    event.stopPropagation();
    document.getElementById('backupDropdown').classList.toggle('show');
}

if (openModalBtn) {
    openModalBtn.onclick = () => {
        if (!requireEditor('додавати книги')) return;
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
let isBooksLoaded = false;

function loadBooks() {
    if (bookList && !isBooksLoaded) {
        bookList.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Завантаження бібліотеки...</p>
            </div>
        `;
    }

    const syncAndDisplay = () => {
        if (!isBooksLoaded) return;

        const myData = allUsersData[currentUser] || {};

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
                deleted: !!book.deleted,
                isRead: stats.isRead || false,
                rating: stats.rating || 0,
                isCurrentlyReading: stats.isCurrentlyReading || false,
                inWishlist: stats.inWishlist || false,
                readDate: stats.readDate || '',
                hidden: stats.hidden || false
            };
        }).filter(b => !b.deleted && !b.hidden && b.id && b.title);

        displayBooks();
        updateCurrentlyReadingBanner();
        updateStats();
        renderReadHistory();
        if (document.getElementById('deleted-section')?.style.display === 'block') {
            renderDeletedBooks();
        }
    };

    database.ref('books').on('value', (snapshot) => {
        rawBooks = snapshot.val() ? Object.values(snapshot.val()) : [];
        isBooksLoaded = true;
        syncAndDisplay();
    });

    database.ref('user_data').on('value', (snapshot) => {
        allUsersData = snapshot.val() || {};
        syncAndDisplay();
    });
}

function saveBooks() {
    if (!requireEditor('імпортувати книги')) return;

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
    } else if (currentFilterType === 'unread') {
        booksToDisplay = booksToDisplay.filter(b => !b.isRead);
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
    const myReadIds = Object.keys(myData).filter(id => myData[id] && myData[id].isRead && !myData[id].hidden);

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
        if (bookMeta && !bookMeta.deleted) {
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

const typeIcon = book.type === 'audio' ? '🎧' : (book.type === 'ebook' ? '📱' : '📖');
    const ratingHTML = book.rating > 0
        ? `<div class="rating-display">${'★'.repeat(book.rating)}${'☆'.repeat(5 - book.rating)}</div>`
        : '';

    card.innerHTML = `
        <div style="position: relative;">
            ${book.isRead ? '<div class="read-badge">✅</div>' : ''}
            <div class="type-icon-badge">${typeIcon}</div>
            <img src="${coverUrl}" alt="${book.title}" onerror="this.src='https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200&auto=format&fit=crop'">
        </div>
        <div class="book-info">
            <h3>${book.title}</h3>
            <p>${book.author}</p>
            ${ratingHTML}
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
    if (!requireEditor('додавати книги')) return;

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
    if (!rawBooks.length) {
        alert('Зачекайте, бібліотека ще завантажується або порожня.');
        return;
    }

    const booksMap = {};
    rawBooks.forEach(b => {
        if (b && b.id) booksMap[b.id] = b;
    });

    const backupPayload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        books: booksMap,
        user_data: allUsersData || {}
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `library_backup_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
};

window.importBooks = (e) => {
    if (!requireEditor('імпортувати книги')) {
        e.target.value = '';
        return;
    }

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const parsed = JSON.parse(ev.target.result);
            const booksUpdates = {};
            let userDataToRestore = null; // { userName: { bookId: {...} } }

            const sanitizeBook = (b) => ({
                id: b.id,
                title: String(b.title || 'Без назви'),
                author: String(b.author || 'Невідомий автор'),
                imageURL: b.imageURL || '',
                pages: parseInt(b.pages, 10) || null,
                publisher: b.publisher || '',
                type: b.type || 'paper',
                deleted: !!b.deleted,
                deletedAt: b.deletedAt || null
            });

            const sanitizeStats = (st) => ({
                isRead: !!st.isRead,
                rating: Number(st.rating) || 0,
                isCurrentlyReading: !!st.isCurrentlyReading,
                readDate: st.readDate || '',
                inWishlist: !!st.inWishlist,
                hidden: !!st.hidden
            });

            // Формат 1 або 2: Повний бекап ({ books, user_data }) або експорт із Firebase Console
            if (parsed && !Array.isArray(parsed) && parsed.books && typeof parsed.books === 'object') {
                const list = Array.isArray(parsed.books) ? parsed.books : Object.values(parsed.books);
                list.forEach(b => {
                    if (b && b.id && b.title) booksUpdates[b.id] = sanitizeBook(b);
                });

                if (parsed.user_data && typeof parsed.user_data === 'object') {
                    userDataToRestore = {};
                    Object.entries(parsed.user_data).forEach(([userName, userMap]) => {
                        if (!userMap || typeof userMap !== 'object') return;
                        const cleanMap = {};
                        Object.entries(userMap).forEach(([bookId, st]) => {
                            if (st && typeof st === 'object') cleanMap[bookId] = sanitizeStats(st);
                        });
                        if (Object.keys(cleanMap).length > 0) {
                            userDataToRestore[userName] = cleanMap;
                        }
                    });
                }
            }
            // Формат 3: Старий масив книг [ { id, title, isRead, rating, ... } ]
            else if (Array.isArray(parsed)) {
                const legacyUserMap = {};
                parsed.forEach(b => {
                    if (!b || !b.id || !b.title) return;
                    booksUpdates[b.id] = sanitizeBook(b);
                    if (b.isRead || b.rating > 0 || b.isCurrentlyReading || b.readDate || b.inWishlist || b.hidden) {
                        legacyUserMap[b.id] = sanitizeStats(b);
                    }
                });
                if (Object.keys(legacyUserMap).length > 0) {
                    userDataToRestore = { [currentUser]: legacyUserMap };
                }
            } else {
                alert('Помилка: Невідомий формат файлу бекапу.');
                return;
            }

            const booksCount = Object.keys(booksUpdates).length;
            if (booksCount === 0) {
                alert('У файлі не знайдено жодної коректної книги.');
                return;
            }

            const hasStats = userDataToRestore && Object.keys(userDataToRestore).length > 0;
            const confirmMsg = `У файлі знайдено книг: ${booksCount}${hasStats ? ' (разом з оцінками та статусами)' : ''}.\n\nВідновити/оновити ці записи без видалення інших наявних книг?`;
            if (!confirm(confirmMsg)) return;

            await database.ref('books').update(booksUpdates);

            if (hasStats) {
                for (const [userName, statsMap] of Object.entries(userDataToRestore)) {
                    try {
                        await database.ref(`user_data/${userName}`).update(statsMap);
                    } catch (err) {
                        console.warn(`Не вдалося оновити user_data/${userName}:`, err);
                    }
                }
            }

            alert(`✅ Успішно відновлено книг: ${booksCount}!`);
        } catch (error) {
            console.error('Import error:', error);
            alert('Помилка читання або відновлення файлу.');
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
    if (!requireEditor('редагувати книги')) return;

    const book = books.find(x => x.id === id);
    if (!book) return;

    document.querySelector('#addBookModal h2').textContent = 'Редагувати книгу';
    document.getElementById('title').value = book.title;
    document.getElementById('author').value = book.author;
    document.getElementById('imageURL').value = book.imageURL || '';
    document.getElementById('pages').value = book.pages || '';
    document.getElementById('publisher').value = book.publisher || '';

    const typeEl = document.getElementById('addBookType');
    if (typeEl) typeEl.value = book.type || 'paper';

    updateCoverPreview(book.imageURL || ''); // Show existing cover

    addBookForm.onsubmit = (e) => {
        e.preventDefault();
        const updatedBook = {
            title: document.getElementById('title').value,
            author: document.getElementById('author').value,
            imageURL: document.getElementById('imageURL').value,
            pages: parseInt(document.getElementById('pages').value) || null,
            publisher: document.getElementById('publisher').value,
            type: typeEl ? typeEl.value : (book.type || 'paper')
        };
        database.ref(`books/${id}`).update(updatedBook).then(() => closeModal());
    };

    modal.style.display = "flex";
    updateScrollToTopVisibility();
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
    const detailsCover = document.getElementById('detailsCover');
    if (detailsCover) {
        let coverUrl = book.imageURL || '';
        if (coverUrl.startsWith('http://')) coverUrl = coverUrl.replace('http://', 'https://');
        if (coverUrl) {
            detailsCover.src = coverUrl;
            detailsCover.style.display = 'block';
            detailsCover.onerror = () => { detailsCover.style.display = 'none'; };
        } else {
            detailsCover.style.display = 'none';
        }
    }

    const partnerBox = document.getElementById('partnerStatusBox');
    if (partnerBox) {
        const esc = (s) => String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const otherUsers = Object.keys(allUsersData || {}).filter(name => {
            if (name === currentUser || name.startsWith('User_')) return false;
            const entries = allUsersData[name];
            return entries && typeof entries === 'object' && Object.keys(entries).length > 0;
        });

        if (otherUsers.length > 0) {
            partnerBox.innerHTML = otherUsers.map(name => {
                const st = allUsersData[name][id] || {};
                const parts = [];

                if (st.isCurrentlyReading) parts.push('<span style="color:#9e9cff;">📖 Зараз читає</span>');
                if (st.isRead) {
                    let dateLabel = '';
                    if (st.readDate && /^\d{4}-\d{2}$/.test(st.readDate)) {
                        const [y, m] = st.readDate.split('-');
                        dateLabel = ` (${new Date(Number(y), Number(m) - 1).toLocaleDateString('uk-UA', { month: 'short', year: 'numeric' })})`;
                    }
                    parts.push(`<span style="color:var(--success);">✅ Прочитано${esc(dateLabel)}</span>`);
                }
                if (st.inWishlist) parts.push('<span>❤️ У бажаннях</span>');
                if (Number(st.rating) > 0) {
                    const r = Math.min(5, Math.max(0, Number(st.rating)));
                    parts.push(`<span class="partner-stars">${'★'.repeat(r)}${'☆'.repeat(5 - r)}</span>`);
                }

                const statusHtml = parts.length > 0 ? parts.join('') : '<span>Ще не відмічено</span>';

                return `
                    <div class="partner-status-row">
                        <span class="partner-name">👤 ${esc(name)}</span>
                        <div class="partner-badges">${statusHtml}</div>
                    </div>
                `;
            }).join('');
            partnerBox.style.display = 'flex';
        } else {
            partnerBox.style.display = 'none';
            partnerBox.innerHTML = '';
        }
    }

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

// --- Scanner Logic ---
let isScannerRunning = false;
let isScannerListenerAttached = false;
let isProcessingScan = false;

function stopScanner() {
    if (typeof Quagga !== 'undefined' && isScannerRunning) {
        try {
            Quagga.stop();
        } catch (e) {
            console.warn('Помилка зупинки сканера:', e);
        }
        isScannerRunning = false;
    }
    const targetContainer = document.querySelector('#interactive');
    if (targetContainer) targetContainer.innerHTML = '';
}

function fillAddModalFromScan(data) {
    document.getElementById('title').value = data.title || '';
    document.getElementById('author').value = data.author || '';
    let cover = data.imageURL || '';
    if (cover.startsWith('http://')) cover = cover.replace('http://', 'https://');
    document.getElementById('imageURL').value = cover;
    document.getElementById('pages').value = data.pages || '';
    document.getElementById('publisher').value = data.publisher || '';

    document.querySelector('#addBookModal h2').textContent = data.title
        ? 'Додати знайдену книгу'
        : 'Додати книгу вручну';
    addBookForm.onsubmit = onAddSubmit;
    updateCoverPreview(cover);
    modal.style.display = "flex";
    updateScrollToTopVisibility();
}

function lookupBookByISBN(code) {
    let googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(code)}`;
    if (googleBooksApiKey) googleUrl += `&key=${googleBooksApiKey}`;

    fetch(googleUrl)
        .then(r => r.json())
        .then(data => {
            if (data.items && data.items.length > 0) {
                const book = data.items[0].volumeInfo;
                fillAddModalFromScan({
                    title: book.title || '',
                    author: book.authors ? book.authors.join(', ') : '',
                    imageURL: book.imageLinks ? book.imageLinks.thumbnail : '',
                    pages: book.pageCount || '',
                    publisher: book.publisher || ''
                });
                return null;
            }
            // Запасний пошук в Open Library, якщо Google Books не знайшов
            return fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(code)}&format=json&jscmd=data`)
                .then(r => r.json())
                .then(olData => {
                    const olBook = olData[`ISBN:${code}`];
                    if (olBook) {
                        fillAddModalFromScan({
                            title: olBook.title || '',
                            author: olBook.authors ? olBook.authors.map(a => a.name).join(', ') : '',
                            imageURL: olBook.cover ? (olBook.cover.large || olBook.cover.medium || '') : '',
                            pages: olBook.number_of_pages || '',
                            publisher: olBook.publishers && olBook.publishers[0] ? olBook.publishers[0].name : ''
                        });
                    } else {
                        alert(`Книгу з ISBN ${code} не знайдено в базах. Можете ввести назву вручну через пошук.`);
                        fillAddModalFromScan({});
                    }
                });
        })
        .catch(error => {
            console.error('Error fetching book data:', error);
            alert('Помилка пошуку інформації про книгу.');
        });
}

function startScanner() {
    if (typeof Quagga === 'undefined') {
        alert('Бібліотеку сканера не завантажено!');
        return;
    }

    const targetContainer = document.querySelector('#interactive');
    if (!targetContainer) return;

    stopScanner();
    isProcessingScan = false;

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: targetContainer,
            constraints: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "environment"
            }
        },
        locator: {
            patchSize: "medium",
            halfSample: true
        },
        decoder: {
            readers: ["ean_reader"]
        },
        locate: true
    }, function(err) {
        if (err) {
            console.error(err);
            alert("Не вдалося запустити камеру (перевірте дозвіл на камеру для сайту).");
            switchSection('home');
            return;
        }
        Quagga.start();
        isScannerRunning = true;
    });

    if (!isScannerListenerAttached) {
        isScannerListenerAttached = true;
        Quagga.onDetected(function(result) {
            if (isProcessingScan) return;
            const code = result && result.codeResult ? result.codeResult.code : '';
            // Книжкові ISBN-13 завжди починаються з 978 або 979 — це відсіює хибні зчитування
            if (!/^(978|979)\d{10}$/.test(code)) return;

            isProcessingScan = true;
            stopScanner();
            switchSection('home');
            lookupBookByISBN(code);
        });
    }
}

// --- Navigation Logic ---
function switchSection(sectionId) {
    if (sectionId !== 'scanner') {
        stopScanner();
    }

    document.querySelectorAll('.app-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    if (sectionId === 'home') {
        document.getElementById('home-section').style.display = 'block';
        currentFilterType = 'all';
        document.querySelectorAll('.tab-btn').forEach((btn, idx) => btn.classList.toggle('active', idx === 0));
    } else if (sectionId === 'wishlist') {
        document.getElementById('wishlist-section').style.display = 'block';
        currentFilterType = 'wishlist';
    }  else if (sectionId === 'deleted') {
        document.getElementById('deleted-section').style.display = 'block';
        renderDeletedBooks();
    }
    else if (sectionId === 'history') {
        document.getElementById('history-section').style.display = 'block';
        renderReadHistory();
    } else if (sectionId === 'stats') {
        document.getElementById('stats-section').style.display = 'block';
        updateStats();
    } else if (sectionId === 'scanner') {
        if (!requireEditor('додавати книги сканером')) {
            switchSection('home');
            return;
        }
        document.getElementById('scanner-section').style.display = 'block';
        startScanner();
    }

    document.querySelectorAll(`button[onclick="switchSection('${sectionId}')"]`).forEach(btn => {
        btn.classList.add('active');
    });

    displayBooks();
    updateScrollToTopVisibility();
}
window.switchSection = switchSection;


// --- Stats & System Updates ---
// --- Interactive Stats Helpers ---
let isMonthCardCollapsed = localStorage.getItem('statsMonthCollapsed') === '1';
let isMonthListOpen = false;
let activeWaveMonthKey = null;
let selectedStatsYear = 'all';
let activeStatsGroup = 'all';
let showAllTopAuthors = false;
let showAllUnread = false;

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function makeSafeHttps(url) {
    if (!url) return 'https://placehold.co/60x90/1c1c1e/white?text=Book';
    return url.startsWith('http://') ? url.replace('http://', 'https://') : url;
}

function buildProgressRingSVG(percent, label, isSuccess = false) {
    const r = 38;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, percent));
    const offset = c * (1 - clamped / 100);
    return `
        <div class="progress-ring-wrap">
            <svg class="progress-ring-svg" viewBox="0 0 92 92">
                <circle class="progress-ring-bg" cx="46" cy="46" r="${r}"></circle>
                <circle class="progress-ring-fill ${isSuccess ? 'success' : ''}" cx="46" cy="46" r="${r}"
                    stroke-dasharray="${c.toFixed(1)}"
                    stroke-dashoffset="${offset.toFixed(1)}"></circle>
            </svg>
            <div class="progress-ring-center">
                ${clamped}%
                <small>${escapeHtml(label)}</small>
            </div>
        </div>
    `;
}

function renderMiniBookRows(list) {
    if (!list.length) return '<p style="margin:4px 0; color:var(--text-muted); font-size:0.8rem;">Немає книг</p>';
    return list.map(b => `
        <div class="stat-mini-book" data-book-id="${b.id}">
            <img src="${makeSafeHttps(b.imageURL)}" alt="" onerror="this.src='https://placehold.co/60x90/1c1c1e/white?text=Book'">
            <div class="stat-mini-book-info">
                <strong>${escapeHtml(b.title)}</strong>
                <span>${escapeHtml(b.author)}${b.rating ? ' · ' + '★'.repeat(b.rating) : ''}${b.pages ? ' · ' + b.pages + ' с.' : ''}</span>
            </div>
        </div>
    `).join('');
}

window.filterStatsSection = (group, btn) => {
    activeStatsGroup = group;
    document.querySelectorAll('.stats-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');

    document.querySelectorAll('#stats-section [data-stats-group]').forEach(card => {
        const cardGroup = card.getAttribute('data-stats-group');
        const wasHiddenByData = card.dataset.emptyHidden === '1';
        if (wasHiddenByData) {
            card.style.display = 'none';
            return;
        }
        card.style.display = (group === 'all' || cardGroup === group) ? 'block' : 'none';
    });
};

function initStatsClickDelegation() {
    const statsSection = document.getElementById('stats-section');
    if (!statsSection || statsSection.dataset.delegated === '1') return;
    statsSection.dataset.delegated = '1';

    statsSection.addEventListener('click', (e) => {
        // 1. Клік по міні-книзі або книзі в списку
        const bookEl = e.target.closest('[data-book-id]');
        if (bookEl) {
            const id = Number(bookEl.getAttribute('data-book-id'));
            if (id) openDetailsModal(id);
            return;
        }

        // 2. Клік по верхніх KPI-картках або типах
        const actionEl = e.target.closest('[data-stat-action]');
        if (actionEl) {
            const action = actionEl.getAttribute('data-stat-action');
            if (action === 'read') {
                switchSection('history');
            } else if (action === 'ratings') {
                const target = document.getElementById('ratingDistCard');
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (['all', 'paper', 'ebook', 'audio'].includes(action)) {
                switchSection('home');
                filterByType(action);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }

        // 3. Клік по автору
        const authorEl = e.target.closest('[data-author-filter]');
        if (authorEl) {
            const author = decodeURIComponent(authorEl.getAttribute('data-author-filter'));
            switchSection('home');
            if (searchInput) {
                searchInput.value = author;
                currentSearchQuery = author;
                if (clearSearchBtn) clearSearchBtn.style.display = 'flex';
            }
            displayBooks();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // 4. Клік по видавництву
        const pubEl = e.target.closest('[data-publisher-filter]');
        if (pubEl) {
            const pub = decodeURIComponent(pubEl.getAttribute('data-publisher-filter'));
            switchSection('home');
            if (publisherFilter) {
                if (!Array.from(publisherFilter.options).some(o => o.value === pub)) {
                    publisherFilter.add(new Option(pub, pub));
                }
                publisherFilter.value = pub;
                currentPublisher = pub;
            }
            displayBooks();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // 5. Акордеон для рейтингу / місяця / обсягу
        const accTrigger = e.target.closest('[data-accordion-target]');
        if (accTrigger) {
            const targetId = accTrigger.getAttribute('data-accordion-target');
            const box = document.getElementById(targetId);
            if (box) box.classList.toggle('open');
            return;
        }

        // 6. Перемикач року в статистиці по місяцях
        const yearBtn = e.target.closest('[data-stats-year]');
        if (yearBtn) {
            selectedStatsYear = yearBtn.getAttribute('data-stats-year');
            updateStats();
            return;
        }

        // 7. Кнопки "Показати всі"
        if (e.target.id === 'toggleAllAuthorsBtn') {
            showAllTopAuthors = !showAllTopAuthors;
            updateStats();
            return;
        }
        if (e.target.id === 'toggleAllUnreadBtn') {
            showAllUnread = !showAllUnread;
            updateStats();
        }
        // 8. Згортання всього блоку "Прочитано по місяцях"
        if (e.target.id === 'toggleMonthCardBtn') {
            isMonthCardCollapsed = !isMonthCardCollapsed;
            localStorage.setItem('statsMonthCollapsed', isMonthCardCollapsed ? '1' : '0');
            const card = document.getElementById('readByMonthCard');
            if (card) card.classList.toggle('is-collapsed', isMonthCardCollapsed);
            e.target.textContent = isMonthCardCollapsed ? 'Показати ▾' : 'Сховати ▴';
            return;
        }

        // 9. Клік по точці на графіку-синусоїді
        const wavePt = e.target.closest('[data-wave-month]');
        if (wavePt) {
            const key = wavePt.getAttribute('data-wave-month');
            activeWaveMonthKey = (activeWaveMonthKey === key) ? null : key;
            updateStats();
            return;
        }

        // 10. Закрити прев'ю обраного місяця або розгорнути повний список
        if (e.target.id === 'closeWavePreviewBtn') {
            activeWaveMonthKey = null;
            updateStats();
            return;
        }

        if (e.target.id === 'toggleMonthListBtn') {
            isMonthListOpen = !isMonthListOpen;
            updateStats();
            return;
        }
    });
}

function updateStats() {
    initStatsClickDelegation();

    if (!books || books.length === 0) {
        ['statTotal', 'statRead', 'statPaper', 'statEbook', 'statAudio', 'statAvgRating']
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '0';
            });
        return;
    }

    const actualBooks = books.filter(b => !b.inWishlist);
    const readBooks = actualBooks.filter(b => b.isRead === true);
    const unreadBooks = actualBooks.filter(b => !b.isRead);
    const readCount = readBooks.length;
    const total = actualBooks.length;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    const paperCount = actualBooks.filter(b => (b.type || 'paper') === 'paper').length;
    const ebookCount = actualBooks.filter(b => b.type === 'ebook').length;
    const audioCount = actualBooks.filter(b => b.type === 'audio').length;

    setVal('statTotal', total);
    setVal('statRead', readCount);
    setVal('statPaper', paperCount);
    setVal('statEbook', ebookCount);
    setVal('statAudio', audioCount);

    const ratedBooks = actualBooks.filter(b => Number(b.rating) > 0);
    const avgRating = ratedBooks.length > 0
        ? (ratedBooks.reduce((sum, b) => sum + Number(b.rating), 0) / ratedBooks.length).toFixed(1)
        : '—';
    setVal('statAvgRating', avgRating);

    // --- Прогрес читання (кільце) ---
    const readPercent = total > 0 ? Math.round((readCount / total) * 100) : 0;
    const readProgressEl = document.getElementById('readProgress');
    if (readProgressEl) {
        readProgressEl.innerHTML = `
            <div class="ring-widget">
                ${buildProgressRingSVG(readPercent, 'прочитано', true)}
                <div class="ring-details">
                    <p>Прочитано: <strong>${readCount}</strong> з <strong>${total}</strong> книг</p>
                    <p>Залишилось: <strong>${unreadBooks.length}</strong> книг</p>
                    <p>Оцінено на 5★: <strong>${ratedBooks.filter(b => Number(b.rating) === 5).length}</strong></p>
                </div>
            </div>
        `;
    }

    // --- Формати (сегментована шкала) ---
    const segContainer = document.getElementById('typeSegmentedBar');
    const typeBreakdownUl = document.getElementById('statTypeBreakdown');
    const typesMeta = [
        { key: 'paper', label: '📖 Паперові', count: paperCount, cls: 'seg-paper', color: '#5e5ce6' },
        { key: 'ebook', label: '📱 Електронні', count: ebookCount, cls: 'seg-ebook', color: '#32d74b' },
        { key: 'audio', label: '🎧 Аудіокниги', count: audioCount, cls: 'seg-audio', color: '#ff9f0a' }
    ];
    if (segContainer) {
        segContainer.innerHTML = total > 0 ? `
            <div class="segmented-bar">
                ${typesMeta.map(t => `<div class="seg-part ${t.cls}" style="width:${(t.count / total * 100).toFixed(1)}%"></div>`).join('')}
            </div>
        ` : '';
    }
    if (typeBreakdownUl) {
        typeBreakdownUl.innerHTML = typesMeta.map(t => {
            const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
            return `
                <li class="type-legend-row" data-stat-action="${t.key}">
                    <span><i class="type-dot" style="background:${t.color}"></i>${t.label}</span>
                    <span><strong>${t.count}</strong> · ${pct}% ›</span>
                </li>
            `;
        }).join('');
    }

    // --- Топ авторів (клікабельні + шкала) ---
    const getTopGroups = (items) => {
        const counts = items.reduce((acc, item) => {
            if (item) acc[item] = (acc[item] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).sort(([, a], [, b]) => b - a);
    };

    const topAuthorsUl = document.getElementById('statTopAuthors');
    if (topAuthorsUl) {
        const allAuthors = getTopGroups(actualBooks.map(b => b.author));
        const limit = showAllTopAuthors ? 20 : 6;
        const visibleAuthors = allAuthors.slice(0, limit);
        const maxAuthorCount = visibleAuthors.length ? visibleAuthors[0][1] : 1;
        const medals = ['🥇 ', '🥈 ', '🥉 '];

        topAuthorsUl.innerHTML = visibleAuthors.length ? visibleAuthors.map(([name, count], idx) => `
            <li class="stat-interactive-row" data-author-filter="${encodeURIComponent(name)}">
                <div class="stat-row-top">
                    <span class="stat-row-title">${medals[idx] || ''}${escapeHtml(name)}</span>
                    <span class="stat-row-count">${count} кн. ›</span>
                </div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill" style="width:${Math.round((count / maxAuthorCount) * 100)}%"></div>
                </div>
            </li>
        `).join('') + (allAuthors.length > 6
            ? `<button type="button" id="toggleAllAuthorsBtn" class="stat-expand-btn">${showAllTopAuthors ? 'Згорнути' : `Показати більше (${Math.min(allAuthors.length, 20)})`}</button>`
            : '') : '<li>Немає даних</li>';
    }

    // --- Топ видавництв (клікабельні + шкала) ---
    const topPublishersUl = document.getElementById('statTopPublishers');
    if (topPublishersUl) {
        const topPubs = getTopGroups(actualBooks.map(b => b.publisher).filter(Boolean)).slice(0, 10);
        const maxPubCount = topPubs.length ? topPubs[0][1] : 1;
        topPublishersUl.innerHTML = topPubs.length ? topPubs.map(([name, count]) => `
            <li class="stat-interactive-row" data-publisher-filter="${encodeURIComponent(name)}">
                <div class="stat-row-top">
                    <span class="stat-row-title">${escapeHtml(name)}</span>
                    <span class="stat-row-count">${count} кн. ›</span>
                </div>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill" style="width:${Math.round((count / maxPubCount) * 100)}%; background:#32d74b;"></div>
                </div>
            </li>
        `).join('') : '<li>Немає даних</li>';
    }

    // --- Розподіл рейтингів (інтерактивний акордеон) ---
    const ratingDistContainer = document.getElementById('ratingDist');
    const ratingDistCard = document.getElementById('ratingDistCard');
    if (ratingDistContainer) {
        const ratingGroups = [5, 4, 3, 2, 1].map(r => ({
            r,
            list: actualBooks.filter(b => Number(b.rating) === r)
        }));
        const maxRatingCount = Math.max(...ratingGroups.map(g => g.list.length), 1);

        ratingDistContainer.innerHTML = ratingGroups.map(g => {
            const width = Math.round((g.list.length / maxRatingCount) * 100);
            const accId = `rating-acc-${g.r}`;
            return `
                <div class="stat-interactive-row" data-accordion-target="${accId}">
                    <div class="stat-row-top">
                        <span style="color:#ffca08;">${'★'.repeat(g.r)}${'☆'.repeat(5 - g.r)}</span>
                        <span class="stat-row-count">${g.list.length} кн. ▾</span>
                    </div>
                    <div class="stat-bar-track">
                        <div class="stat-bar-fill" style="width:${width}%; background:#ffca08;"></div>
                    </div>
                </div>
                <div id="${accId}" class="stat-accordion-box">
                    ${renderMiniBookRows(g.list)}
                </div>
            `;
        }).join('');
        if (ratingDistCard) {
            ratingDistCard.dataset.emptyHidden = ratedBooks.length > 0 ? '0' : '1';
            ratingDistCard.style.display = ratedBooks.length > 0 ? 'block' : 'none';
        }
    }

    // --- Прочитано по місяцях (графік + фільтр року + акордеон) ---
// --- Прочитано по місяцях (синусоїда + кнопка згортання) ---
    const datedReadBooks = actualBooks.filter(b => b.isRead && b.readDate && /^\d{4}-\d{2}$/.test(b.readDate));
    const availableYears = [...new Set(datedReadBooks.map(b => b.readDate.split('-')[0]))].sort().reverse();
    if (selectedStatsYear !== 'all' && !availableYears.includes(selectedStatsYear)) {
        selectedStatsYear = 'all';
    }

    const readByMonthCard = document.getElementById('readByMonthCard');
    if (readByMonthCard) {
        // Робимо заголовок з кнопкою "Сховати / Показати"
        let headerRow = readByMonthCard.querySelector('.month-card-header');
        if (!headerRow) {
            const h4 = readByMonthCard.querySelector('h4');
            if (h4) {
                headerRow = document.createElement('div');
                headerRow.className = 'month-card-header';
                h4.parentNode.insertBefore(headerRow, h4);
                headerRow.appendChild(h4);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.id = 'toggleMonthCardBtn';
                btn.className = 'card-collapse-btn';
                headerRow.appendChild(btn);
            }
        }
        const toggleBtn = document.getElementById('toggleMonthCardBtn');
        if (toggleBtn) toggleBtn.textContent = isMonthCardCollapsed ? 'Показати ▾' : 'Сховати ▴';
        readByMonthCard.classList.toggle('is-collapsed', isMonthCardCollapsed);
    }

    const yearTabsEl = document.getElementById('statsYearTabs');
    if (yearTabsEl) {
        yearTabsEl.innerHTML = availableYears.length > 0 ? `
            <button type="button" class="year-chip ${selectedStatsYear === 'all' ? 'active' : ''}" data-stats-year="all">Усі роки</button>
            ${availableYears.map(y => `
                <button type="button" class="year-chip ${selectedStatsYear === y ? 'active' : ''}" data-stats-year="${y}">${y}</button>
            `).join('')}
        ` : '';
    }

    const filteredByYear = selectedStatsYear === 'all'
        ? datedReadBooks
        : datedReadBooks.filter(b => b.readDate.startsWith(selectedStatsYear + '-'));

    const readByMonth = {};
    filteredByYear.forEach(b => {
        const [year, month] = b.readDate.split('-');
        const dt = new Date(Number(year), Number(month) - 1);
        const label = dt.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
        const shortLabel = selectedStatsYear === 'all' && availableYears.length > 1
            ? `${month}.${year.slice(-2)}`
            : dt.toLocaleDateString('uk-UA', { month: 'short' }).replace('.', '');
        if (!readByMonth[b.readDate]) readByMonth[b.readDate] = { key: b.readDate, label, shortLabel, list: [] };
        readByMonth[b.readDate].list.push(b);
    });

    const sortedMonthsDesc = Object.keys(readByMonth).sort().reverse();
    let chartMonthsAsc = sortedMonthsDesc.slice(0, 12).reverse().map(k => readByMonth[k]);

    // Якщо обрано конкретний рік — заповнюємо пропущені місяці нулями, щоб була плавна хвиля
    if (selectedStatsYear !== 'all' && chartMonthsAsc.length > 1) {
        const minM = parseInt(chartMonthsAsc[0].key.split('-')[1], 10);
        const maxM = parseInt(chartMonthsAsc[chartMonthsAsc.length - 1].key.split('-')[1], 10);
        const filled = [];
        for (let m = minM; m <= maxM; m++) {
            const mm = String(m).padStart(2, '0');
            const key = `${selectedStatsYear}-${mm}`;
            if (readByMonth[key]) {
                filled.push(readByMonth[key]);
            } else {
                const dt = new Date(Number(selectedStatsYear), m - 1);
                filled.push({
                    key,
                    label: dt.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }),
                    shortLabel: dt.toLocaleDateString('uk-UA', { month: 'short' }).replace('.', ''),
                    list: []
                });
            }
        }
        chartMonthsAsc = filled;
    }

    const maxMonthCount = Math.max(...sortedMonthsDesc.map(k => readByMonth[k].list.length), 1);

    // Побудова плавної SVG-синусоїди
    const renderWaveChart = (items) => {
        if (!items.length) return '';
        const W = 360, H = 138;
        const padX = 22, padTop = 24, padBottom = 26;
        const plotW = W - padX * 2;
        const plotH = H - padTop - padBottom;
        const baseY = padTop + plotH;

        const pts = items.map((item, i) => {
            const x = items.length === 1 ? W / 2 : padX + (i / (items.length - 1)) * plotW;
            const y = baseY - (item.list.length / maxMonthCount) * plotH;
            return { x, y, item };
        });

        let lineD = '';
        let areaD = '';
        if (pts.length >= 2) {
            lineD = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
            for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[i];
                const p1 = pts[i + 1];
                const midX = ((p0.x + p1.x) / 2).toFixed(1);
                lineD += ` C ${midX},${p0.y.toFixed(1)} ${midX},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
            }
            areaD = `${lineD} L ${pts[pts.length - 1].x.toFixed(1)},${baseY} L ${pts[0].x.toFixed(1)},${baseY} Z`;
        }

        return `
            <div class="wave-chart-wrap">
                <svg class="wave-chart-svg" viewBox="0 0 ${W} ${H}">
                    <defs>
                        <linearGradient id="waveAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#5e5ce6" stop-opacity="0.45"></stop>
                            <stop offset="100%" stop-color="#5e5ce6" stop-opacity="0.0"></stop>
                        </linearGradient>
                    </defs>
                    <line x1="${padX}" y1="${baseY}" x2="${W - padX}" y2="${baseY}" stroke="rgba(255,255,255,0.1)" stroke-width="1"></line>
                    <line x1="${padX}" y1="${(padTop + plotH / 2).toFixed(1)}" x2="${W - padX}" y2="${(padTop + plotH / 2).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3" stroke-width="1"></line>
                    ${areaD ? `<path d="${areaD}" fill="url(#waveAreaGrad)"></path>` : ''}
                    ${lineD ? `<path d="${lineD}" fill="none" stroke="#7d7aff" stroke-width="2.6" stroke-linecap="round"></path>` : ''}
                    ${pts.map(p => {
                        const count = p.item.list.length;
                        const isActive = activeWaveMonthKey === p.item.key;
                        return `
                            <g class="wave-point-group" ${count > 0 ? `data-wave-month="${p.item.key}"` : ''}>
                                <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="14" fill="transparent"></circle>
                                ${isActive ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8" fill="rgba(94, 92, 230, 0.35)"></circle>` : ''}
                                <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}"
                                    r="${isActive ? 5.5 : (count > 0 ? 4 : 2.5)}"
                                    fill="${count > 0 ? (isActive ? '#ffffff' : '#7d7aff') : '#48484a'}"
                                    stroke="${count > 0 ? '#5e5ce6' : 'none'}" stroke-width="2"></circle>
                                ${count > 0 ? `<text x="${p.x.toFixed(1)}" y="${(p.y - 9).toFixed(1)}" text-anchor="middle" fill="${isActive ? '#ffffff' : '#c7c7cc'}" font-size="10" font-weight="600">${count}</text>` : ''}
                                <text x="${p.x.toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="${isActive ? '#b8b6ff' : '#8e8e93'}" font-size="9">${escapeHtml(p.item.shortLabel)}</text>
                            </g>
                        `;
                    }).join('')}
                </svg>
            </div>
        `;
    };

    const activeMonthData = activeWaveMonthKey ? readByMonth[activeWaveMonthKey] : null;
    const monthChartEl = document.getElementById('monthChartContainer');
    if (monthChartEl) {
        monthChartEl.innerHTML = sortedMonthsDesc.length > 0 ? `
            ${renderWaveChart(chartMonthsAsc)}
            ${activeMonthData ? `
                <div class="month-selected-preview">
                    <div class="month-selected-header">
                        <span>📅 ${escapeHtml(activeMonthData.label)} (${activeMonthData.list.length} кн.)</span>
                        <button type="button" id="closeWavePreviewBtn" class="month-preview-close">✕</button>
                    </div>
                    ${renderMiniBookRows(activeMonthData.list)}
                </div>
            ` : ''}
            <button type="button" id="toggleMonthListBtn" class="stat-expand-btn">
                ${isMonthListOpen ? 'Сховати список по місяцях ▴' : `📋 Список по місяцях (${sortedMonthsDesc.length}) ▾`}
            </button>
        ` : '';
    }

    const readByMonthEl = document.getElementById('statReadByMonth');
    if (readByMonthEl) {
        readByMonthEl.classList.toggle('open', isMonthListOpen);
        readByMonthEl.innerHTML = sortedMonthsDesc.length > 0 ? sortedMonthsDesc.map(key => {
            const { label, list } = readByMonth[key];
            const width = Math.round((list.length / maxMonthCount) * 100);
            const accId = `month-acc-${key}`;
            return `
                <li class="stat-interactive-row" data-accordion-target="${accId}">
                    <div class="stat-row-top">
                        <span class="stat-row-title" style="text-transform:capitalize;">${escapeHtml(label)}</span>
                        <span class="stat-row-count">${list.length} кн. ▾</span>
                    </div>
                    <div class="stat-bar-track">
                        <div class="stat-bar-fill" style="width:${width}%"></div>
                    </div>
                    <div id="${accId}" class="stat-accordion-box">
                        ${renderMiniBookRows(list)}
                    </div>
                </li>
            `;
        }).join('') : '<li>Немає даних — вкажіть дату прочитання у деталях книги</li>';

        if (readByMonthCard) {
            readByMonthCard.dataset.emptyHidden = datedReadBooks.length > 0 ? '0' : '1';
            readByMonthCard.style.display = datedReadBooks.length > 0 ? 'block' : 'none';
        }
    }

    // --- Статистика сторінок (клікабельні рекордсмени) ---
    const booksWithPages = readBooks.filter(b => Number(b.pages) > 0);
    const pagesUl = document.getElementById('statPages');
    if (pagesUl) {
        if (booksWithPages.length > 0) {
            const totalPagesCount = booksWithPages.reduce((sum, b) => sum + Number(b.pages), 0);
            const avgPages = Math.round(totalPagesCount / booksWithPages.length);
            const maxBook = booksWithPages.reduce((a, b) => Number(a.pages) > Number(b.pages) ? a : b);
            const minBook = booksWithPages.reduce((a, b) => Number(a.pages) < Number(b.pages) ? a : b);

            pagesUl.innerHTML = `
                <li><span style="flex:1">📚 Всього сторінок прочитано</span><strong>${totalPagesCount.toLocaleString('uk-UA')}</strong></li>
                <li><span style="flex:1">📊 Середній обсяг книги</span><strong>${avgPages} стор.</strong></li>
                <li class="stat-book-clickable" data-book-id="${maxBook.id}">
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis;">🏆 Найбільша — ${escapeHtml(maxBook.title)}</span>
                    <strong>${maxBook.pages} с. ›</strong>
                </li>
                <li class="stat-book-clickable" data-book-id="${minBook.id}">
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis;">🪶 Найменша — ${escapeHtml(minBook.title)}</span>
                    <strong>${minBook.pages} с. ›</strong>
                </li>
            `;
        } else {
            pagesUl.innerHTML = '<li>Немає даних — вкажіть кількість сторінок у деталях книги</li>';
        }
    }

    // --- Розподіл за обсягом (інтерактивний акордеон) ---
    const lengthDistContainer = document.getElementById('lengthDist');
    const lengthDistCard = document.getElementById('lengthDistCard');
    if (lengthDistContainer) {
        const lengthGroups = [
            { id: 'len-short', label: '📗 Короткі (< 200 стор.)', list: readBooks.filter(b => Number(b.pages) > 0 && Number(b.pages) < 200), color: '#32d74b' },
            { id: 'len-med', label: '📘 Середні (200–500 стор.)', list: readBooks.filter(b => Number(b.pages) >= 200 && Number(b.pages) <= 500), color: '#5e5ce6' },
            { id: 'len-long', label: '📕 Товсті (> 500 стор.)', list: readBooks.filter(b => Number(b.pages) > 500), color: '#ff453a' }
        ];
        const totalWithPages = lengthGroups.reduce((sum, g) => sum + g.list.length, 0);

        lengthDistContainer.innerHTML = lengthGroups.map(g => {
            const width = totalWithPages > 0 ? Math.round((g.list.length / totalWithPages) * 100) : 0;
            return `
                <div class="stat-interactive-row" data-accordion-target="${g.id}">
                    <div class="stat-row-top">
                        <span>${g.label}</span>
                        <span class="stat-row-count">${g.list.length} кн. ▾</span>
                    </div>
                    <div class="stat-bar-track">
                        <div class="stat-bar-fill" style="width:${width}%; background:${g.color};"></div>
                    </div>
                </div>
                <div id="${g.id}" class="stat-accordion-box">
                    ${renderMiniBookRows(g.list)}
                </div>
            `;
        }).join('');

        if (lengthDistCard) {
            lengthDistCard.dataset.emptyHidden = totalWithPages > 0 ? '0' : '1';
            lengthDistCard.style.display = totalWithPages > 0 ? 'block' : 'none';
        }
    }

    // --- Найвище оцінені (клікабельні) ---
    const topRatedUl = document.getElementById('statTopRated');
    const topRatedCard = document.getElementById('topRatedCard');
    if (topRatedUl) {
        const topRated = actualBooks.filter(b => Number(b.rating) > 0)
            .sort((a, b) => Number(b.rating) - Number(a.rating))
            .slice(0, 7);
        topRatedUl.innerHTML = topRated.length > 0
            ? topRated.map(b => `
                <li class="stat-book-clickable" data-book-id="${b.id}">
                    <span style="color:#ffca08;">${'★'.repeat(b.rating)}</span>
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; color:var(--text-main);">${escapeHtml(b.title)}</span>
                    <span>— ${escapeHtml(b.author)} ›</span>
                </li>
            `).join('')
            : '<li>Немає оцінених книг</li>';
        if (topRatedCard) {
            topRatedCard.dataset.emptyHidden = topRated.length > 0 ? '0' : '1';
            topRatedCard.style.display = topRated.length > 0 ? 'block' : 'none';
        }
    }

    // --- Wishlist (клікабельні) ---
    const wishlistBooks = books.filter(b => b.inWishlist);
    const statWishlistEl = document.getElementById('statWishlist');
    if (statWishlistEl) {
        statWishlistEl.innerHTML = wishlistBooks.length > 0
            ? wishlistBooks.map(b => `
                <li class="stat-book-clickable" data-book-id="${b.id}">
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; color:var(--text-main);">${escapeHtml(b.title)}</span>
                    <span>— ${escapeHtml(b.author)} ›</span>
                </li>
            `).join('')
            : '<li>Список порожній</li>';
    }

    // --- Ще не прочитано (клікабельні + розгортання) ---
    const unreadListUl = document.getElementById('statUnread');
    if (unreadListUl) {
        const visibleUnread = showAllUnread ? unreadBooks : unreadBooks.slice(0, 8);
        unreadListUl.innerHTML = unreadBooks.length === 0
            ? '<li>Усі книги прочитано! 🎉</li>'
            : visibleUnread.map(b => `
                <li class="stat-book-clickable" data-book-id="${b.id}">
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; color:var(--text-main);">${escapeHtml(b.title)}</span>
                    <span>— ${escapeHtml(b.author)} ›</span>
                </li>
            `).join('') + (unreadBooks.length > 8
                ? `<button type="button" id="toggleAllUnreadBtn" class="stat-expand-btn">${showAllUnread ? 'Згорнути' : `Показати всі (${unreadBooks.length})`}</button>`
                : '');
    }

    updateYearGoal();

    if (activeStatsGroup !== 'all') {
    const activePill = document.querySelector('.stats-pill.active');
    filterStatsSection(activeStatsGroup, activePill);
}
}

document.getElementById('saveDetailsBtn').onclick = () => {
    if (!requireEditor('зберігати зміни')) return;
    if (!currentDetailsId) return;

    const isCurrently = document.getElementById('detailsCurrentlyReading').checked;
    const isRead = document.getElementById('detailsReadStatus').checked;
    const type = document.getElementById('detailsBookType').value;
    const publisher = document.getElementById('detailsPublisher').value;
    const pages = parseInt(document.getElementById('detailsPages').value) || null;
    const readDate = document.getElementById('detailsReadDate').value;

    const currentBook = books.find(b => b.id === currentDetailsId) || rawBooks.find(b => b.id === currentDetailsId);
    const inWishlist = currentBook ? (currentBook.inWishlist || false) : false;

    const savePromise = database.ref(`user_data/${currentUser}`).once('value').then((snapshot) => {
        const data = snapshot.val() || {};
        const updates = {};

        // 1. Якщо вмикаємо "Зараз читаю" — скидаємо цей статус лише в ІНШИХ книг
        if (isCurrently) {
            Object.keys(data).forEach(bookId => {
                if (String(bookId) !== String(currentDetailsId) && data[bookId] && data[bookId].isCurrentlyReading) {
                    updates[`${bookId}/isCurrentlyReading`] = false;
                }
            });
        }

        // 2. Оновлюємо поля поточної книги без затирання інших властивостей (напр. hidden)
        updates[`${currentDetailsId}/isRead`] = isRead;
        updates[`${currentDetailsId}/rating`] = tempRating;
        updates[`${currentDetailsId}/isCurrentlyReading`] = isCurrently;
        updates[`${currentDetailsId}/readDate`] = readDate;
        updates[`${currentDetailsId}/inWishlist`] = inWishlist;

        return database.ref(`user_data/${currentUser}`).update(updates);
    });

    const metaPromise = database.ref(`books/${currentDetailsId}`).update({
        type: type,
        publisher: publisher,
        pages: pages
    });

    Promise.all([savePromise, metaPromise])
        .then(() => {
            console.log(`Зміни для "${currentUser}" збережено!`);
            closeDetailsModal();
        })
        .catch(error => console.error("Помилка збереження даних:", error));
};

document.getElementById('deleteInDetailsBtn').onclick = function() {
    if (!requireEditor('видаляти книги')) return;
    if (!currentDetailsId) return;

    const book = books.find(b => b.id === currentDetailsId);
    const isInWishlist = book && book.inWishlist;

    if (isInWishlist) {
        if (!confirm("Прибрати цю книгу зі списку бажань (вона залишиться у «Видалених»)?")) return;
        database.ref(`user_data/${currentUser}/${currentDetailsId}`).update({
            inWishlist: false,
            hidden: true
        }).then(() => closeDetailsModal());
    } else {
        if (!confirm("Перемістити цю книгу у розділ «Видалені»?")) return;
        database.ref(`books/${currentDetailsId}`).update({
            deleted: true,
            deletedAt: Date.now()
        }).then(() => closeDetailsModal());
    }
};

function renderDeletedBooks() {
    const container = document.getElementById('deletedList');
    if (!container) return;

    const myData = allUsersData[currentUser] || {};
    const deletedItems = rawBooks.filter(b =>
        b && b.id && (b.deleted === true || (myData[b.id] && myData[b.id].hidden === true))
    );

    container.innerHTML = '';
    if (deletedItems.length === 0) {
        container.innerHTML = '<p class="empty-message">У видалених порожньо ✨</p>';
        return;
    }

    deletedItems.sort((a, b) => (b.deletedAt || b.id) - (a.deletedAt || a.id));

    deletedItems.forEach(book => {
        let coverUrl = book.imageURL || 'https://placehold.co/200x280/161b22/white?text=No+Photo';
        if (coverUrl.startsWith('http://')) coverUrl = coverUrl.replace('http://', 'https://');

        const isHiddenOnly = !book.deleted && myData[book.id]?.hidden;
        const card = document.createElement('div');
        card.className = 'book-card deleted-card';

        const img = document.createElement('img');
        img.src = coverUrl;
        img.alt = book.title || '';
        img.onerror = () => { img.src = 'https://placehold.co/200x280/161b22/white?text=No+Photo'; };

        const info = document.createElement('div');
        info.className = 'book-info';
        const h3 = document.createElement('h3');
        h3.textContent = book.title || 'Без назви';
        const p = document.createElement('p');
        p.textContent = book.author || '';
        const note = document.createElement('p');
        note.style.fontSize = '0.7rem';
        note.textContent = isHiddenOnly ? 'Зі списку бажань' : 'Видалено з бібліотеки';
        info.append(h3, p, note);

        const actions = document.createElement('div');
        actions.className = 'deleted-actions';

        const restoreBtn = document.createElement('button');
        restoreBtn.type = 'button';
        restoreBtn.className = 'restore-btn';
        restoreBtn.textContent = '♻️ Відновити';
        restoreBtn.onclick = () => restoreDeletedBook(book.id, isHiddenOnly);

        const purgeBtn = document.createElement('button');
        purgeBtn.type = 'button';
        purgeBtn.className = 'purge-btn';
        purgeBtn.textContent = '❌ Назавжди';
        purgeBtn.onclick = () => permanentlyDeleteBook(book.id);

        actions.append(restoreBtn, purgeBtn);
        card.append(img, info, actions);
        container.appendChild(card);
    });
}

window.restoreDeletedBook = (id, isHiddenOnly) => {
    if (!requireEditor('відновлювати книги')) return;

    if (isHiddenOnly) {
        database.ref(`user_data/${currentUser}/${id}`).update({
            hidden: false,
            inWishlist: true
        }).then(() => renderDeletedBooks());
    } else {
        database.ref(`books/${id}`).update({
            deleted: false,
            deletedAt: null
        }).then(() => renderDeletedBooks());
    }
};

window.permanentlyDeleteBook = (id) => {
    if (!requireEditor('остаточно видаляти книги')) return;
    if (!confirm('Видалити цю книгу назавжди? Відновити її вже буде неможливо!')) return;

    database.ref(`books/${id}`).remove();
    database.ref(`user_data/${currentUser}/${id}`).remove();
};

document.getElementById('goToEditBtn').onclick = function() {
    if (!requireEditor('редагувати книги')) return;

    if (currentDetailsId) {
        const bookId = currentDetailsId;
        closeDetailsModal();
        openEditModal(bookId);
    }
};

document.getElementById('wishlistToggleBtn').onclick = function() {
    if (!requireEditor('змінювати список бажань')) return;

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
const auth = firebase.auth();
auth.getRedirectResult().catch(error => {
    if (error.code && error.code !== 'auth/no-auth-event') {
        console.error('Redirect error:', error);
    }
});

// ДОДАТИ після getRedirectResult блоку:
window.toggleAuth = () => {
    if (currentAuthUser) {
        auth.signOut();
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    auth.signInWithPopup(provider).catch(error => {
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
            auth.signInWithRedirect(provider);
        } else {
            alert('❌ Помилка входу:\n' + error.code + '\n' + error.message);
        }
    });
};

auth.onAuthStateChanged(user => {
    currentAuthUser = user;
    setEditingEnabled(isAllowedEditor(user));
    updateAuthUI();

    if (user && !canEditLibrary) {
        console.warn(`Signed in email is not allowed to edit this library: ${user.email}`);
    }
});

setEditingEnabled(false);
updateAuthUI();

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

    const month = new Date().getMonth() + 1;
    const expected = (goal / 12) * month;
    const isOnTrack = count >= expected;
    const paceText = count >= goal
        ? 'Ціль року виконано! 🏆'
        : (isOnTrack ? 'Ви йдете за графіком! 🎉' : `Потрібно наздогнати: ще ${Math.ceil(expected - count)} кн.`);

    const goalProgressEl = document.getElementById('yearGoalProgress');
    if (!goalProgressEl) return;

    goalProgressEl.innerHTML = goal > 0 ? `
        <div class="ring-widget">
            ${buildProgressRingSVG(percent, `${currentYear} рік`, isOnTrack)}
            <div class="ring-details">
                <p>Прочитано: <strong>${count}</strong> з <strong>${goal}</strong></p>
                <p>Залишилось до цілі: <strong>${Math.max(0, goal - count)}</strong> кн.</p>
                <p style="color:${isOnTrack ? 'var(--success)' : 'var(--danger)'}; font-size:0.8rem; margin-top:4px;">${paceText}</p>
            </div>
        </div>
    ` : '<p style="color:var(--text-muted); font-size:0.85rem; margin:0;">Встановіть ціль, щоб відстежувати прогрес за рік</p>';
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
            const coverEl = document.getElementById('currentlyReadingCover');
            if (coverEl) {
                let coverUrl = current.imageURL || '';
                if (coverUrl.startsWith('http://')) coverUrl = coverUrl.replace('http://', 'https://');
                if (coverUrl) {
                    coverEl.src = coverUrl;
                    coverEl.style.display = 'block';
                    coverEl.onerror = () => { coverEl.style.display = 'none'; };
                } else {
                    coverEl.style.display = 'none';
                }
            }
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
