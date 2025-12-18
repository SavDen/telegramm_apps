// Данные автомобилей (загружаются с API)
let carsData = [];
let isLoading = false;
let currentPage = 1;
let hasMore = true;
let availableFilters = {
    brands: [],
    fuelTypes: [],
    transmissions: [],
    minYear: null,
    maxYear: null,
    minPrice: null,
    maxPrice: null
};

// Курсы валют (относительно USD)
const exchangeRates = {
    USD: 1,
    RUB: 95,      // 1 USD = 95 RUB
    EUR: 0.92,    // 1 USD = 0.92 EUR
    KRW: 1320     // 1 USD = 1320 KRW
};

// Символы валют
const currencySymbols = {
    USD: '$',
    RUB: '₽',
    EUR: '€',
    KRW: '₩'
};

// Форматы отображения цен
const currencyFormats = {
    USD: (value) => value.toLocaleString('en-US', { maximumFractionDigits: 0 }),
    RUB: (value) => value.toLocaleString('ru-RU', { maximumFractionDigits: 0 }),
    EUR: (value) => value.toLocaleString('de-DE', { maximumFractionDigits: 0 }),
    KRW: (value) => value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
};

// Состояние приложения
let currentCategory = null;
let filteredCars = [];
let currentCurrency = 'USD';
let selectedFilters = {
    minYear: null,
    maxYear: null,
    fuelType: null,
    brand: null
};

// Инициализация Telegram Web App
function initTelegramWebApp() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        // Расширяем на весь экран в Telegram
        Telegram.WebApp.expand();
        
        // Настраиваем тему
        Telegram.WebApp.ready();
        
        // Применяем тему Telegram
        const theme = Telegram.WebApp.themeParams;
        if (theme.bg_color) {
            document.documentElement.style.setProperty('--bg-color', theme.bg_color);
        }
        if (theme.text_color) {
            document.documentElement.style.setProperty('--text-color', theme.text_color);
        }
        
        console.log('Telegram Web App инициализирован');
    } else {
        // Если открыто не в Telegram, показываем кнопку закрытия
        const closeBtn = document.getElementById('closeBtn');
        if (closeBtn) {
            closeBtn.style.display = 'block';
            closeBtn.addEventListener('click', () => {
                if (confirm('Закрыть приложение?')) {
                    window.close();
                }
            });
        }
        console.log('Приложение открыто в браузере');
    }
}

// Конвертация цены из USD в выбранную валюту
function convertPrice(priceUSD, currency) {
    return priceUSD * exchangeRates[currency];
}

// Форматирование цены для отображения
function formatPrice(priceUSD, currency) {
    const convertedPrice = convertPrice(priceUSD, currency);
    const symbol = currencySymbols[currency];
    const formatted = currencyFormats[currency](convertedPrice);
    return `${symbol}${formatted}`;
}

// Рендеринг карточек автомобилей
// Создание карточки машины
function createCarCard(car, index) {
    const card = document.createElement('div');
    card.className = 'car-card';
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.cursor = 'pointer';
    
    const formattedPrice = formatPrice(car.price || 0, currentCurrency);
    
    // Формируем HTML для фото
    let photoHTML = '';
    let hasPhoto = false;
    if (car.photo_url) {
        photoHTML = `<img src="${car.photo_url}" alt="${car.brand} ${car.model}" class="car-photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
        hasPhoto = true;
    }
    photoHTML += '<div class="car-image-placeholder" style="display: none;">🚗</div>';
    
    const imageClass = hasPhoto ? 'car-image has-photo' : 'car-image';
    
    card.innerHTML = `
        <div class="${imageClass}">
            ${photoHTML}
        </div>
        <div class="car-info">
            <div class="car-title">${car.brand || ''} ${car.model || ''}</div>
            <div class="car-year">${car.year || ''} ${car.year ? 'год' : ''}</div>
            <div class="car-price ${car.category === 'deal' ? 'car-price-deal' : ''}">${formattedPrice}</div>
            <div class="car-specs">
                <div class="car-spec-item">
                    <span>📏</span>
                    <span>${(car.mileage || 0).toLocaleString()} км</span>
                </div>
                <div class="car-spec-item">
                    <span>⚙️</span>
                    <span>${car.transmission || ''}</span>
                </div>
                <div class="car-spec-item">
                    <span>⛽</span>
                    <span>${car.fuel || ''}</span>
                </div>
            </div>
            <div class="car-question-section" onclick="event.stopPropagation();">
                <textarea 
                    class="car-question-input" 
                    id="question-${car.id}" 
                    placeholder="Задайте вопрос о машине..."
                    rows="2"
                ></textarea>
                <button 
                    class="contact-btn" 
                    onclick="event.stopPropagation(); handleContact('${car.id}')"
                >
                    Связаться по этой машине
                </button>
            </div>
        </div>
    `;
    
    // Обработчик клика на карточку
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.contact-btn') && !e.target.closest('.car-question-section')) {
            openCarModal(car.id);
        }
    });
    
    // Анимация появления с задержкой
    setTimeout(() => {
        card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, index * 100);
    
    return card;
}

function renderCars(cars) {
    const carsGrid = document.getElementById('carsGrid');
    const noResults = document.getElementById('noResults');
    const resultsCount = document.getElementById('resultsCount');
    
    if (!carsGrid) return;
    
    // Обновляем счетчик
    if (resultsCount) {
        resultsCount.textContent = cars.length;
    }
    
    // Очищаем сетку
    carsGrid.innerHTML = '';
    
    if (cars.length === 0) {
        if (noResults) {
            noResults.style.display = 'block';
        }
        return;
    }
    
    if (noResults) {
        noResults.style.display = 'none';
    }
    
    // Создаем карточки с анимацией
    cars.forEach((car, index) => {
        const card = createCarCard(car, index);
        carsGrid.appendChild(card);
    });
}

// Обработка нажатия на категорию
function handleCategoryClick(category) {
    // Убираем активный класс со всех кнопок
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Если выбрана та же категория, снимаем фильтр
    if (currentCategory === category) {
        currentCategory = null;
        applyFilters();
        return;
    }
    
    // Устанавливаем новую категорию
    currentCategory = category;
    
    // Добавляем активный класс к выбранной кнопке
    const clickedBtn = document.querySelector(`[data-category="${category}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // Применяем фильтры
    applyFilters();
}

// Применение фильтров
function applyFilters() {
    const brandFilter = document.getElementById('brandFilter')?.value || '';
    const fuelFilter = document.getElementById('fuelFilter')?.value || '';
    const transmissionFilter = document.getElementById('transmissionFilter')?.value || '';
    const yearFrom = parseInt(document.getElementById('yearFrom')?.value) || 0;
    const yearTo = parseInt(document.getElementById('yearTo')?.value) || 9999;
    const priceFromInput = parseFloat(document.getElementById('priceFrom')?.value) || 0;
    const priceToInput = parseFloat(document.getElementById('priceTo')?.value) || 999999999;
    const mileageFrom = parseInt(document.getElementById('mileageFrom')?.value) || 0;
    const mileageTo = parseInt(document.getElementById('mileageTo')?.value) || 999999999;
    
    // Конвертируем введенные цены из текущей валюты в USD для сравнения
    const priceFromUSD = priceFromInput / exchangeRates[currentCurrency];
    const priceToUSD = priceToInput / exchangeRates[currentCurrency];
    
    // Фильтруем автомобили
    filteredCars = carsData.filter(car => {
        // Фильтр по категории
        if (currentCategory && car.category !== currentCategory) {
            return false;
        }
        
        // Фильтр по марке
        if (brandFilter && car.brand !== brandFilter) {
            return false;
        }
        
        // Фильтр по типу топлива
        if (fuelFilter && car.fuel !== fuelFilter) {
            return false;
        }
        
        // Фильтр по коробке передач
        if (transmissionFilter && car.transmission !== transmissionFilter) {
            return false;
        }
        
        // Фильтр по году
        if (car.year < yearFrom || car.year > yearTo) {
            return false;
        }
        
        // Фильтр по цене (сравниваем в USD)
        if (car.price < priceFromUSD || car.price > priceToUSD) {
            return false;
        }
        
        // Фильтр по пробегу
        if (car.mileage < mileageFrom || car.mileage > mileageTo) {
            return false;
        }
        
        return true;
    });
    
    // Обновляем заголовок результатов
    updateResultsTitle();
    
    // Обновляем плейсхолдеры фильтров цен
    updatePricePlaceholders();
    
    // Плавная прокрутка к результатам
    const resultsSection = document.querySelector('.results-section');
    if (resultsSection) {
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
    
    // Рендерим отфильтрованные автомобили
    renderCars(filteredCars);
}

// Открытие полноэкранного окна фильтров
function openFiltersModal() {
    const modal = document.getElementById('filtersModal');
    if (!modal) return;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

// Закрытие полноэкранного окна фильтров
function closeFiltersModal() {
    const modal = document.getElementById('filtersModal');
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Применение фильтров из модального окна
function applyFiltersFromModal() {
    // Сохраняем выбранные фильтры для запросов к API
    const brandFilter = document.getElementById('brandFilter')?.value || '';
    const fuelFilter = document.getElementById('fuelFilter')?.value || '';
    const yearFrom = parseInt(document.getElementById('yearFrom')?.value) || null;
    const yearTo = parseInt(document.getElementById('yearTo')?.value) || null;
    
    selectedFilters = {
        brand: brandFilter || null,
        fuelType: fuelFilter || null,
        minYear: yearFrom,
        maxYear: yearTo
    };
    
    closeFiltersModal();
    
    // Сбрасываем и загружаем заново с новыми фильтрами
    currentPage = 1;
    carsData = [];
    loadCars(true);
}

// Обновление UI фильтров на основе доступных данных
function updateFiltersUI() {
    // Обновляем список марок
    const brandSelect = document.getElementById('brandFilter');
    if (brandSelect && availableFilters.brands) {
        const currentValue = brandSelect.value;
        brandSelect.innerHTML = '<option value="">Все марки</option>';
        
        availableFilters.brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = brand;
            brandSelect.appendChild(option);
        });
        
        if (currentValue) {
            brandSelect.value = currentValue;
        }
    }
    
    // Обновляем список типов топлива
    const fuelSelect = document.getElementById('fuelFilter');
    if (fuelSelect && availableFilters.fuelTypes) {
        const currentValue = fuelSelect.value;
        fuelSelect.innerHTML = '<option value="">Все типы</option>';
        
        availableFilters.fuelTypes.forEach(fuel => {
            const option = document.createElement('option');
            option.value = fuel;
            option.textContent = fuel;
            fuelSelect.appendChild(option);
        });
        
        if (currentValue) {
            fuelSelect.value = currentValue;
        }
    }
    
    // Обновляем список коробок передач
    const transmissionSelect = document.getElementById('transmissionFilter');
    if (transmissionSelect && availableFilters.transmissions) {
        const currentValue = transmissionSelect.value;
        transmissionSelect.innerHTML = '<option value="">Все типы</option>';
        
        availableFilters.transmissions.forEach(transmission => {
            const option = document.createElement('option');
            option.value = transmission;
            option.textContent = transmission;
            transmissionSelect.appendChild(option);
        });
        
        if (currentValue) {
            transmissionSelect.value = currentValue;
        }
    }
    
    // Обновляем диапазоны года
    const yearFromInput = document.getElementById('yearFrom');
    const yearToInput = document.getElementById('yearTo');
    if (availableFilters.minYear && availableFilters.maxYear) {
        if (yearFromInput) {
            yearFromInput.min = availableFilters.minYear;
            yearFromInput.max = availableFilters.maxYear;
        }
        if (yearToInput) {
            yearToInput.min = availableFilters.minYear;
            yearToInput.max = availableFilters.maxYear;
        }
    }
    
    // Обновляем диапазоны цены
    const priceFromInput = document.getElementById('priceFrom');
    const priceToInput = document.getElementById('priceTo');
    if (availableFilters.minPrice && availableFilters.maxPrice) {
        if (priceFromInput) {
            priceFromInput.min = availableFilters.minPrice;
            priceFromInput.max = availableFilters.maxPrice;
        }
        if (priceToInput) {
            priceToInput.min = availableFilters.minPrice;
            priceToInput.max = availableFilters.maxPrice;
        }
    }
}

// Обновление заголовка результатов
function updateResultsTitle() {
    const resultsTitle = document.getElementById('resultsTitle');
    if (!resultsTitle) return;
    
    const categoryNames = {
        'premium': 'Премиум',
        'family': 'Семейные',
        'business': 'Бизнес',
        'deal': 'Выгодные'
    };
    
    if (currentCategory) {
        resultsTitle.textContent = `Автомобили: ${categoryNames[currentCategory]}`;
    } else {
        resultsTitle.textContent = 'Все автомобили';
    }
}

// Сброс фильтров
function resetFilters() {
    currentCategory = null;
    
    // Сбрасываем активные классы категорий
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Сбрасываем значения фильтров
    const brandFilter = document.getElementById('brandFilter');
    const fuelFilter = document.getElementById('fuelFilter');
    const transmissionFilter = document.getElementById('transmissionFilter');
    const yearFrom = document.getElementById('yearFrom');
    const yearTo = document.getElementById('yearTo');
    const priceFrom = document.getElementById('priceFrom');
    const priceTo = document.getElementById('priceTo');
    const mileageFrom = document.getElementById('mileageFrom');
    const mileageTo = document.getElementById('mileageTo');
    
    if (brandFilter) brandFilter.value = '';
    if (fuelFilter) fuelFilter.value = '';
    if (transmissionFilter) transmissionFilter.value = '';
    if (yearFrom) yearFrom.value = '';
    if (yearTo) yearTo.value = '';
    if (priceFrom) priceFrom.value = '';
    if (priceTo) priceTo.value = '';
    if (mileageFrom) mileageFrom.value = '';
    if (mileageTo) mileageTo.value = '';
    
    // Сбрасываем selectedFilters для API запросов
    selectedFilters = {
        minYear: null,
        maxYear: null,
        fuelType: null,
        brand: null
    };
    
    // Сбрасываем и загружаем заново
    currentPage = 1;
    carsData = [];
    loadCars(true);
}

// Обновление плейсхолдеров фильтров цен
function updatePricePlaceholders() {
    const priceFrom = document.getElementById('priceFrom');
    const priceTo = document.getElementById('priceTo');
    const currencySymbol = currencySymbols[currentCurrency];
    
    if (priceFrom) {
        priceFrom.placeholder = `Цена от (${currencySymbol})`;
    }
    if (priceTo) {
        priceTo.placeholder = `Цена до (${currencySymbol})`;
    }
}

// Обработка изменения валюты
function handleCurrencyChange() {
    const currencySelect = document.getElementById('currencySelect');
    if (!currencySelect) return;
    
    currentCurrency = currencySelect.value;
    
    // Обновляем плейсхолдеры фильтров
    updatePricePlaceholders();
    
    // Перерисовываем карточки с новыми ценами
    renderCars(filteredCars);
}

// Открытие модального окна с детальной информацией
function openCarModal(carId) {
    const car = carsData.find(c => c.id === carId);
    if (!car) return;
    
    const modal = document.getElementById('carModal');
    if (!modal) return;
    
    const formattedPrice = formatPrice(car.price, currentCurrency);
    const categoryNames = {
        'premium': 'Премиум',
        'family': 'Семейные',
        'business': 'Бизнес',
        'deal': 'Выгодные'
    };
    
    // Заполняем модальное окно данными
    document.getElementById('modalCarTitle').textContent = `${car.brand} ${car.model}`;
    document.getElementById('modalCarYear').textContent = `${car.year} год`;
    const modalPriceElement = document.getElementById('modalCarPrice');
    modalPriceElement.textContent = formattedPrice;
    // Добавляем класс для зеленого цвета, если категория "deal"
    if (car.category === 'deal') {
        modalPriceElement.classList.add('car-price-deal');
    } else {
        modalPriceElement.classList.remove('car-price-deal');
    }
    document.getElementById('modalCarDescription').textContent = car.description;
    document.getElementById('modalCarMileage').textContent = `${car.mileage.toLocaleString()} км`;
    document.getElementById('modalCarTransmission').textContent = car.transmission;
    document.getElementById('modalCarFuel').textContent = car.fuel;
    document.getElementById('modalCarCategory').textContent = categoryNames[car.category] || car.category;
    
    // Обновляем обработчик кнопки связи
    const modalContactBtn = document.getElementById('modalContactBtn');
    if (modalContactBtn) {
        modalContactBtn.onclick = () => {
            closeCarModal();
            handleContact(carId);
        };
    }
    
    // Показываем модальное окно
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Анимация появления
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

// Закрытие модального окна
function closeCarModal() {
    const modal = document.getElementById('carModal');
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Конфигурация - URL вашего сервера с ботом (только для отправки сообщений)
const SERVER_URL = 'https://tgappbackend-e4rk.onrender.com';

// URL к CSV экспорту Google Sheets
const CSV_URL = 'https://docs.google.com/spreadsheets/d/14cuDxW6YdKnf3cFd18JhnwQ5v4gnOKhrCTZDVo96VCc/export?format=csv&gid=1644141353';

// Кэш для всех машин
let allCarsData = [];
let csvCacheTime = 0;
const CSV_CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Функция парсинга CSV
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    // Парсим заголовки
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const cars = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        try {
            // Парсим строку CSV (учитываем кавычки и запятые внутри значений)
            const values = [];
            let current = '';
            let inQuotes = false;
            
            for (let j = 0; j < lines[i].length; j++) {
                const char = lines[i][j];
                
                if (char === '"') {
                    if (inQuotes && lines[i][j + 1] === '"') {
                        current += '"';
                        j++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim()); // Последнее значение
            
            // Создаем объект машины
            const row = {};
            headers.forEach((header, index) => {
                let value = values[index] || '';
                // Убираем кавычки если есть
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                row[header] = value;
            });
            
            // Парсим данные из колонок
            const brand = (row['B'] || '').trim();
            const model = (row['C'] || '').trim();
            
            // Пропускаем пустые строки
            if (!brand && !model) continue;
            
            // Парсим цену (колонка I)
            let price = null;
            const priceStr = (row['I'] || '').trim();
            if (priceStr) {
                const priceNum = parseInt(priceStr.replace(/[\s,.]/g, ''));
                if (!isNaN(priceNum)) price = priceNum;
            }
            
            // Парсим пробег (колонка J)
            let mileage = null;
            const mileageStr = (row['J'] || '').trim();
            if (mileageStr) {
                const mileageNum = parseInt(mileageStr.replace(/[\s,.]/g, ''));
                if (!isNaN(mileageNum)) mileage = mileageNum;
            }
            
            // Парсим год (колонка Y - формат "202012")
            let year = null;
            const yearStr = (row['Y'] || '').trim();
            if (yearStr) {
                if (yearStr.length === 6) {
                    year = parseInt(yearStr.substring(0, 4));
                } else if (yearStr.length >= 4) {
                    year = parseInt(yearStr.substring(0, 4));
                }
            }
            
            // Парсим фото (колонка V - JSON массив)
            let photo_url = null;
            let photo_urls = [];
            const photosStr = (row['V'] || '').trim();
            if (photosStr) {
                try {
                    // Пытаемся распарсить как JSON
                    let photosJson = photosStr;
                    // Убираем экранированные кавычки если есть
                    if (photosJson.startsWith('"[')) {
                        photosJson = photosJson.slice(1, -1).replace(/\\"/g, '"');
                    }
                    if (photosJson.startsWith('[')) {
                        photo_urls = JSON.parse(photosJson);
                        if (Array.isArray(photo_urls) && photo_urls.length > 0) {
                            photo_url = photo_urls[0];
                        }
                    }
                } catch (e) {
                    // Если не JSON, пытаемся найти URL
                    const urlMatch = photosStr.match(/https?:\/\/[^\s"]+/);
                    if (urlMatch) {
                        photo_url = urlMatch[0];
                        photo_urls = [photo_url];
                    }
                }
            }
            
            const car = {
                id: `car_${i}`,
                brand: brand,
                model: model,
                year: year,
                price: price,
                mileage: mileage,
                transmission: (row['L'] || '').trim(),
                fuel: (row['K'] || '').trim(),
                category: price && price < 5000000 ? 'deal' : 'premium',
                description: (row['U'] || '').substring(0, 500),
                photo_url: photo_url,
                photo_urls: photo_urls,
                type: (row['M'] || '').trim()
            };
            
            cars.push(car);
        } catch (error) {
            console.warn(`Ошибка парсинга строки ${i}:`, error);
            continue;
        }
    }
    
    return cars;
}

// Загрузка машин из CSV
async function loadCars(reset = true) {
    if (isLoading) return;
    
    isLoading = true;
    
    const carsGrid = document.getElementById('carsGrid');
    
    if (reset) {
        currentPage = 1;
        carsData = [];
        hasMore = true;
        
        if (carsGrid) {
            carsGrid.innerHTML = '<div class="loading">Загрузка машин...</div>';
        }
    }
    
    try {
        // Проверяем кэш
        const now = Date.now();
        if (reset && allCarsData.length > 0 && (now - csvCacheTime) < CSV_CACHE_TTL) {
            console.log('Используем кэшированные данные');
        } else {
            // Загружаем CSV из Google Sheets
            const response = await fetch(CSV_URL);
            
            if (!response.ok) {
                throw new Error(`Ошибка загрузки CSV: ${response.status}`);
            }
            
            const csvText = await response.text();
            
            // Парсим CSV
            allCarsData = parseCSV(csvText);
            csvCacheTime = now;
            
            console.log(`Загружено ${allCarsData.length} машин из CSV`);
            
            // Извлекаем доступные фильтры
            extractAvailableFilters();
        }
        
        // Применяем фильтры
        let filteredCars = [...allCarsData];
        
        if (selectedFilters.minYear) {
            filteredCars = filteredCars.filter(c => c.year && c.year >= selectedFilters.minYear);
        }
        if (selectedFilters.maxYear) {
            filteredCars = filteredCars.filter(c => c.year && c.year <= selectedFilters.maxYear);
        }
        if (selectedFilters.fuelType) {
            filteredCars = filteredCars.filter(c => c.fuel === selectedFilters.fuelType);
        }
        if (selectedFilters.brand) {
            filteredCars = filteredCars.filter(c => c.brand === selectedFilters.brand);
        }
        
        // Пагинация
        const pageSize = 20;
        let paginatedCars;
        
        if (reset) {
            carsData = filteredCars;
            const start = (currentPage - 1) * pageSize;
            const end = start + pageSize;
            paginatedCars = filteredCars.slice(start, end);
            hasMore = end < filteredCars.length;
            currentPage++;
            
            // Применяем фильтры (категория и другие фронтенд фильтры)
            applyFilters();
        } else {
            // Для "Загрузить еще" добавляем к существующим
            const start = carsData.length;
            const end = start + pageSize;
            paginatedCars = filteredCars.slice(start, end);
            hasMore = end < filteredCars.length;
            currentPage++;
            
            // Добавляем новые карточки
            appendCars(paginatedCars);
            updateLoadMoreButton();
        }
        
    } catch (error) {
        console.error('Ошибка загрузки машин:', error);
        
        if (carsGrid && reset) {
            carsGrid.innerHTML = `
                <div class="error-message">
                    <p>Не удалось загрузить данные</p>
                    <p class="error-hint">${error.message}</p>
                    <button onclick="loadCars(true)" class="retry-btn">Повторить</button>
                </div>
            `;
        }
    } finally {
        isLoading = false;
    }
}

// Добавление новых карточек (для пагинации)
function appendCars(cars) {
    const carsGrid = document.getElementById('carsGrid');
    if (!carsGrid) return;
    
    cars.forEach((car, index) => {
        const card = createCarCard(car, carsData.length + index);
        carsGrid.appendChild(card);
    });
}

// Извлечение доступных фильтров из данных
function extractAvailableFilters() {
    const brands = [...new Set(allCarsData.map(c => c.brand).filter(b => b))].sort();
    const years = [...new Set(allCarsData.map(c => c.year).filter(y => y))].sort((a, b) => b - a);
    const fuelTypes = [...new Set(allCarsData.map(c => c.fuel).filter(f => f))].sort();
    const transmissions = [...new Set(allCarsData.map(c => c.transmission).filter(t => t))].sort();
    
    availableFilters = {
        brands: brands,
        years: years,
        fuel_types: fuelTypes,
        transmissions: transmissions
    };
    
    updateFiltersUI();
}

// Загрузка еще машин
async function loadMoreCars() {
    if (isLoading || !hasMore) return;
    await loadCars(false);
}

// Загрузка доступных фильтров (теперь извлекается из загруженных данных)
async function loadAvailableFilters() {
    // Фильтры извлекаются автоматически при загрузке CSV
    // Эта функция оставлена для совместимости
    if (allCarsData.length > 0) {
        extractAvailableFilters();
    }
}

// Обновление кнопки "Загрузить еще"
function updateLoadMoreButton() {
    let loadMoreBtn = document.getElementById('loadMoreBtn');
    const carsGrid = document.getElementById('carsGrid');
    
    if (!hasMore) {
        if (loadMoreBtn) {
            loadMoreBtn.remove();
        }
        return;
    }
    
    if (!loadMoreBtn && carsGrid) {
        loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'loadMoreBtn';
        loadMoreBtn.className = 'load-more-btn';
        loadMoreBtn.textContent = 'Загрузить еще';
        loadMoreBtn.onclick = loadMoreCars;
        carsGrid.parentElement.appendChild(loadMoreBtn);
    }
}

// Обработка контакта по автомобилю
async function handleContact(carId) {
    const car = carsData.find(c => c.id === carId);
    if (!car) return;
    
    // Получаем вопрос пользователя
    const questionInput = document.getElementById(`question-${carId}`);
    const question = questionInput ? questionInput.value.trim() : '';
    
    if (!question) {
        alert('Пожалуйста, задайте вопрос о машине');
        if (questionInput) {
            questionInput.focus();
        }
        return;
    }
    
    // Получаем данные пользователя из Telegram
    let userData = {
        userId: null,
        username: null,
        firstName: null,
        lastName: null,
        userLink: null
    };
    
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        const initData = Telegram.WebApp.initDataUnsafe;
        if (initData.user) {
            userData.userId = initData.user.id;
            userData.username = initData.user.username || null;
            userData.firstName = initData.user.first_name || null;
            userData.lastName = initData.user.last_name || null;
            
            // Формируем ссылку на пользователя
            if (userData.username) {
                userData.userLink = `https://t.me/${userData.username}`;
            } else {
                userData.userLink = `tg://user?id=${userData.userId}`;
            }
        }
    }
    
    // Формируем ссылку на объявление
    const carLink = `${window.location.origin}${window.location.pathname}?car=${carId}`;
    
    const formattedPrice = formatPrice(car.price, currentCurrency);
    
    // Формируем данные для отправки
        const requestData = {
        car: {
            id: car.id,
            brand: car.brand,
            model: car.model,
            year: car.year,
            price: car.price,
            priceFormatted: formattedPrice,
            mileage: car.mileage,
            transmission: car.transmission,
            fuel: car.fuel,
            category: car.category,
            link: carLink
        },
        user: userData,
        question: question,
            timestamp: new Date().toISOString()
        };
        
    // Показываем индикатор загрузки
    const contactBtn = document.querySelector(`#question-${carId}`)?.nextElementSibling;
    const originalText = contactBtn?.textContent;
    if (contactBtn) {
        contactBtn.disabled = true;
        contactBtn.textContent = 'Отправка...';
    }
    
    try {
        // Отправляем на endpoint вашего бота
        const response = await fetch(`${SERVER_URL}/api/webapp/contact`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert('Спасибо! Ваш вопрос отправлен. Мы свяжемся с вами в ближайшее время.');
            // Очищаем поле вопроса
            if (questionInput) {
                questionInput.value = '';
            }
        } else {
            throw new Error(result.error || 'Ошибка при отправке');
        }
    } catch (error) {
        console.error('Ошибка отправки:', error);
        alert('Произошла ошибка при отправке сообщения. Попробуйте позже.');
    } finally {
        if (contactBtn) {
            contactBtn.disabled = false;
            contactBtn.textContent = originalText;
        }
    }
}

// Инициализация приложения
function init() {
    // Инициализируем Telegram Web App
    initTelegramWebApp();
    
    // Назначаем обработчики категорий
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-category');
            handleCategoryClick(category);
        });
    });
    
    // Назначаем обработчик кнопки открытия фильтров
    const openFiltersBtn = document.getElementById('openFiltersBtn');
    if (openFiltersBtn) {
        openFiltersBtn.addEventListener('click', openFiltersModal);
    }
    
    // Назначаем обработчик изменения валюты
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
        currencySelect.addEventListener('change', handleCurrencyChange);
    }
    
    // Применяем Enter в полях фильтров
    ['yearFrom', 'yearTo', 'priceFrom', 'priceTo'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        }
    });
    
    // Обновляем плейсхолдеры цен при инициализации
    updatePricePlaceholders();
    
    // Закрытие модальных окон по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCarModal();
            closeFiltersModal();
        }
    });
    
    // Закрытие модального окна фильтров при клике вне его
    const filtersModal = document.getElementById('filtersModal');
    if (filtersModal) {
        filtersModal.addEventListener('click', (e) => {
            if (e.target === filtersModal) {
                closeFiltersModal();
            }
        });
    }
    
    // Загружаем машины с API при старте
    loadCars();
    
    // Автообновление каждые 5 минут
    setInterval(loadCars, 5 * 60 * 1000);
}

// Запуск приложения после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

