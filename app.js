// Данные автомобилей (загружаются с API)
let carsData = [];
let isLoading = false;
let currentPage = 1;
let hasMore = true;
const PAGE_SIZE = 10; // Размер страницы пагинации

// Кэш для переводов
const translationCache = new Map();

// Функция для безопасной обработки HTML в описании
function sanitizeDescription(html) {
    if (!html) return '';
    
    let text = html;
    
    // Нормализуем переносы строк перед обработкой
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    
    // Заменяем HTML-теги на безопасные аналоги
    // <b> и <strong> - жирный текст (оставляем как <strong>)
    text = text.replace(/<b\s*\/?>/gi, '<strong>');
    text = text.replace(/<\/b>/gi, '</strong>');
    
    // <i> и <em> - курсив (оставляем как <em>)
    text = text.replace(/<i\s*\/?>/gi, '<em>');
    text = text.replace(/<\/i>/gi, '</em>');
    
    // <u> - подчеркивание (оставляем)
    text = text.replace(/<u\s*\/?>/gi, '<u>');
    text = text.replace(/<\/u>/gi, '</u>');
    
    // <br/> и <br> - перенос строки (нормализуем)
    text = text.replace(/<br\s*\/?>/gi, '<br>');
    
    // <p> и </p> - параграфы (заменяем на переносы строк)
    text = text.replace(/<p\s*[^>]*>/gi, '');
    text = text.replace(/<\/p>/gi, '<br>');
    
    // <div> и </div> - блоки (заменяем на переносы строк)
    text = text.replace(/<div\s*[^>]*>/gi, '');
    text = text.replace(/<\/div>/gi, '<br>');
    
    // Удаляем все остальные HTML-теги и их атрибуты (для безопасности)
    // Но сохраняем разрешенные теги: strong, em, u, br
    text = text.replace(/<(?!\/?(?:strong|em|u|br)\b)[^>]+>/gi, '');
    
    // Нормализуем множественные переносы строк
    text = text.replace(/(<br>\s*){3,}/gi, '<br><br>');
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Убираем пробелы в начале и конце
    text = text.trim();
    
    return text;
}

// Функция перевода текста с корейского на русский
async function translateFromKorean(text) {
    if (!text || text.trim().length === 0) {
        return text;
    }
    
    // Проверяем кэш
    if (translationCache.has(text)) {
        return translationCache.get(text);
    }
    
    // Проверяем, нужно ли переводить (если текст уже на русском/английском, не переводим)
    const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    if (!koreanRegex.test(text)) {
        translationCache.set(text, text);
        return text;
    }
    
    try {
        // Используем Google Translate через бесплатный прокси
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=ru&dt=t&q=${encodeURIComponent(text)}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                const translated = data[0][0][0];
                translationCache.set(text, translated);
                return translated;
            }
        }
    } catch (error) {
        console.warn('Ошибка перевода:', error);
    }
    
    // Если перевод не удался, возвращаем оригинальный текст
    translationCache.set(text, text);
    return text;
}
let availableFilters = {
    brands: [],
    fuelTypes: [],
    transmissions: [],
    minYear: null,
    maxYear: null,
    minPrice: null,
    maxPrice: null
};

// Курсы валют (относительно USD) - загружаются динамически
let exchangeRates = {
    USD: 1,
    RUB: 95,      // Значения по умолчанию (будут обновлены)
    EUR: 0.92,
    KRW: 1320
};

// Время последнего обновления курсов
let exchangeRatesLastUpdate = 0;
const EXCHANGE_RATES_CACHE_TTL = 60 * 60 * 1000; // 1 час

// Загрузка актуальных курсов валют
async function loadExchangeRates() {
    const now = Date.now();
    
    // Проверяем кэш (обновляем раз в час)
    if (exchangeRatesLastUpdate > 0 && (now - exchangeRatesLastUpdate) < EXCHANGE_RATES_CACHE_TTL) {
        console.log('Используем кэшированные курсы валют');
        return;
    }
    
    try {
        // Используем бесплатный API exchangerate-api.com
        // Альтернатива: можно использовать fixer.io, openexchangerates.org и т.д.
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.rates) {
                // Обновляем курсы для нужных валют
                exchangeRates.RUB = data.rates.RUB || exchangeRates.RUB;
                exchangeRates.EUR = data.rates.EUR || exchangeRates.EUR;
                exchangeRates.KRW = data.rates.KRW || exchangeRates.KRW;
                
                exchangeRatesLastUpdate = now;
                console.log('✅ Курсы валют обновлены:', {
                    RUB: exchangeRates.RUB,
                    EUR: exchangeRates.EUR,
                    KRW: exchangeRates.KRW
                });
            }
        } else {
            console.warn('Не удалось загрузить курсы валют, используем значения по умолчанию');
        }
    } catch (error) {
        console.warn('Ошибка загрузки курсов валют:', error, 'Используем значения по умолчанию');
    }
}

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

// Определение категории машины на основе её характеристик
function getCarCategory(car) {
    const brand = (car.brand || '').toLowerCase();
    const type = (car.type || '').toLowerCase();
    const price = car.price || 0;
    const model = (car.model || '').toLowerCase();
    
    // 1. Премиум: дорогие марки (Genesis, Mercedes, BMW, Audi, Lexus и т.д.) или дорогие машины (выше 30 млн)
    const premiumBrands = ['genesis', 'mercedes', 'bmw', 'audi', 'lexus', 'porsche', 'bentley', 'rolls-royce', 'maserati', 'jaguar'];
    const isPremiumBrand = premiumBrands.some(pb => brand.includes(pb));
    if (isPremiumBrand || price > 30000000) {
        return 'premium';
    }
    
    // 2. Выгодные: самые недорогие машины (до 15 млн) или дешевые модели (Rio, Picanto, i10, i20 и т.д.)
    const budgetModels = ['rio', 'picanto', 'i10', 'i20', 'getz', 'accent', 'solaris', 'elantra'];
    const isBudgetModel = budgetModels.some(bb => model.includes(bb));
    if (price < 15000000 || isBudgetModel) {
        return 'deal';
    }
    
    // 3. Бизнес: премиум модели высокого класса, минивэны, внедорожники (выше 15 млн),
    //    или седаны/кроссоверы среднего и высокого класса (15-30 млн)
    const businessModels = ['g90', 'g80', 's-class', '7 series', 'a8', 'ls', 'e-class', '5 series', 'sonata', 'k5', 'camry', 'accord'];
    const isBusinessModel = businessModels.some(bm => model.includes(bm));
    const businessTypes = ['минивэн', 'minivan'];
    const isBusinessType = businessTypes.some(bt => type.includes(bt));
    const isExpensiveSUV = (type.includes('внедорожник') || type.includes('suv')) && price > 15000000;
    const isMidRangeCar = price >= 15000000 && price <= 30000000 && (type.includes('седан') || type.includes('sedan') || type.includes('кроссовер') || type.includes('crossover'));
    
    if (isBusinessModel || isBusinessType || isExpensiveSUV || isMidRangeCar) {
        return 'business';
    }
    
    // 4. Семейные: большие машины (минивэны, внедорожники, кроссоверы) 
    //    или недорогие марки Kia/Hyundai (до 30 млн), или любые кроссоверы/внедорожники
    const familyTypes = ['минивэн', 'minivan', 'внедорожник', 'suv', 'кроссовер', 'crossover'];
    const isFamilyType = familyTypes.some(ft => type.includes(ft));
    const familyBrands = ['kia', 'hyundai'];
    const isFamilyBrand = familyBrands.some(fb => brand.includes(fb));
    
    if (isFamilyType || (isFamilyBrand && price < 30000000)) {
        return 'family';
    }
    
    // 5. По умолчанию - бизнес для среднего сегмента
    return 'business';
}

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
    if (!priceUSD || priceUSD <= 0) return 0;
    return priceUSD * exchangeRates[currency];
}

// Форматирование цены для отображения с округлением до целого числа
function formatPrice(priceUSD, currency) {
    if (!priceUSD || priceUSD <= 0) return 'Цена не указана';
    
    const convertedPrice = convertPrice(priceUSD, currency);
    // Округляем до целого числа
    const roundedPrice = Math.round(convertedPrice);
    const symbol = currencySymbols[currency];
    const formatted = currencyFormats[currency](roundedPrice);
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
    
    // Форматируем цену (если цена 0 или null, показываем "Цена не указана")
    let formattedPrice = 'Цена не указана';
    if (car.price && car.price > 0) {
        formattedPrice = formatPrice(car.price, currentCurrency);
    }
    
    // Формируем HTML для фото
    let photoHTML = '';
    let hasPhoto = false;
    
    // Для первой карточки логируем
    if (index === 0) {
        console.log('Создание карточки:', {
            brand: car.brand,
            model: car.model,
            photo_url: car.photo_url ? car.photo_url.substring(0, 50) + '...' : 'нет',
            hasPhotoUrl: !!car.photo_url
        });
    }
    
    if (car.photo_url && car.photo_url.trim()) {
        // Показываем фото, если не загрузится - покажем плейсхолдер
        photoHTML = `<img src="${car.photo_url}" alt="${car.brand} ${car.model}" class="car-photo" onerror="this.onerror=null; this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) placeholder.style.display='flex';">`;
        photoHTML += '<div class="car-image-placeholder" style="display: none;">🚗</div>';
        hasPhoto = true;
    } else {
        // Если фото нет, показываем плейсхолдер
        photoHTML = '<div class="car-image-placeholder">🚗</div>';
    }
    
    const imageClass = hasPhoto ? 'car-image has-photo' : 'car-image';
        
        card.innerHTML = `
        <div class="${imageClass}">
            ${photoHTML}
        </div>
            <div class="car-info">
            <div class="car-title">${car.brand || ''} ${car.model || ''}</div>
            <div class="car-year">${car.year || ''} ${car.year ? 'год' : ''}${car.configuration ? ` · ${car.configuration}` : ''}</div>
            <div class="car-price ${getCarCategory(car) === 'deal' ? 'car-price-deal' : ''}">${formattedPrice}</div>
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
            </div>
        `;
        
    // Обработчик клика на карточку
    card.addEventListener('click', () => {
        openCarModal(car.id);
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
        // Фильтр по категории (определяем категорию динамически)
        if (currentCategory) {
            const carCategory = getCarCategory(car);
            if (carCategory !== currentCategory) {
            return false;
            }
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
    
    // Форматируем цену
    let formattedPrice = 'Цена не указана';
    if (car.price && car.price > 0) {
        formattedPrice = formatPrice(car.price, currentCurrency);
    }
    
    const categoryNames = {
        'premium': 'Премиум',
        'family': 'Семейные',
        'business': 'Бизнес',
        'deal': 'Выгодные'
    };
    
    // Заполняем модальное окно данными
    document.getElementById('modalCarTitle').textContent = `${car.brand || ''} ${car.model || ''}`;
    document.getElementById('modalCarYear').textContent = `${car.year || ''} ${car.year ? 'год' : ''}${car.configuration ? ` · ${car.configuration}` : ''}`;
    
    const modalPriceElement = document.getElementById('modalCarPrice');
    modalPriceElement.textContent = formattedPrice;
    const carCategory = getCarCategory(car);
    if (carCategory === 'deal') {
        modalPriceElement.classList.add('car-price-deal');
    } else {
        modalPriceElement.classList.remove('car-price-deal');
    }
    
    // Переводим описание если оно на корейском и безопасно обрабатываем HTML
    const descriptionElement = document.getElementById('modalCarDescription');
    if (descriptionElement) {
        descriptionElement.textContent = 'Загрузка...';
        const originalDescription = car.description || 'Описание отсутствует';
        
        translateFromKorean(originalDescription).then(translated => {
            // Обрабатываем HTML-теги в описании (оставляем только безопасные)
            const sanitized = sanitizeDescription(translated);
            
            // Используем innerHTML для отображения форматирования (strong, em, u, br)
            descriptionElement.innerHTML = sanitized;
        });
    }
    document.getElementById('modalCarMileage').textContent = `${(car.mileage || 0).toLocaleString()} км`;
    document.getElementById('modalCarTransmission').textContent = car.transmission || 'Не указано';
    document.getElementById('modalCarFuel').textContent = car.fuel || 'Не указано';
    document.getElementById('modalCarCategory').textContent = categoryNames[carCategory] || carCategory || 'Не указано';
    
    // Заполняем фото
    const modalPhoto = document.getElementById('modalCarPhoto');
    const modalImageContainer = document.getElementById('modalCarImage');
    const modalImagePlaceholder = document.querySelector('.modal-car-image-placeholder');
    
    if (car.photo_url) {
        modalPhoto.src = car.photo_url;
        modalPhoto.alt = `${car.brand} ${car.model}`;
        modalPhoto.style.display = 'block';
        if (modalImageContainer) {
            modalImageContainer.classList.add('has-photo');
        }
        if (modalImagePlaceholder) {
            modalImagePlaceholder.style.display = 'none';
        }
        modalPhoto.onerror = () => {
            modalPhoto.style.display = 'none';
            if (modalImageContainer) {
                modalImageContainer.classList.remove('has-photo');
            }
            if (modalImagePlaceholder) {
                modalImagePlaceholder.style.display = 'flex';
            }
        };
    } else {
        modalPhoto.style.display = 'none';
        if (modalImageContainer) {
            modalImageContainer.classList.remove('has-photo');
        }
        if (modalImagePlaceholder) {
            modalImagePlaceholder.style.display = 'flex';
        }
    }
    
    // Очищаем форму
    document.getElementById('modalQuestion').value = '';
    document.getElementById('modalPhone').value = '';
    
    // Настраиваем переключатель метода связи
    const phoneInput = document.getElementById('modalPhone');
    const phoneRequired = document.getElementById('phoneRequired');
    
    // Функция обновления состояния переключателя
    const updateContactMethod = () => {
        const contactMethodRadios = document.querySelectorAll('input[name="contactMethod"]');
        const selectedMethod = Array.from(contactMethodRadios).find(r => r.checked);
        const method = selectedMethod ? selectedMethod.value : 'whatsapp';
        
        // Обновляем визуальное состояние
        contactMethodRadios.forEach(r => {
            const option = r.closest('.contact-method-option');
            if (option) {
                if (r.checked) {
                    option.classList.add('checked');
                    console.log('Добавлен класс checked к опции:', option.className, 'метод:', method);
                } else {
                    option.classList.remove('checked');
                }
            }
        });
        
        // Обновляем требования к телефону
        if (method === 'whatsapp') {
            phoneInput.required = true;
            phoneRequired.style.display = 'inline';
        } else {
            phoneInput.required = false;
            phoneRequired.style.display = 'none';
        }
    };
    
    // Используем делегирование событий на контейнере формы
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        // Удаляем старый обработчик если есть
        const oldHandler = contactForm._contactMethodHandler;
        if (oldHandler) {
            contactForm.removeEventListener('change', oldHandler);
        }
        
        // Создаем новый обработчик
        const handler = (e) => {
            if (e.target.name === 'contactMethod') {
                updateContactMethod();
            }
        };
        contactForm.addEventListener('change', handler);
        contactForm._contactMethodHandler = handler;
    }
    
    // Устанавливаем WhatsApp по умолчанию
    const whatsappRadio = document.querySelector('input[name="contactMethod"][value="whatsapp"]');
    if (whatsappRadio) {
        whatsappRadio.checked = true;
    }
    updateContactMethod();
    
    // Обновляем обработчик кнопки отправки
    const modalContactBtn = document.getElementById('modalContactBtn');
    if (modalContactBtn) {
        // Удаляем старый обработчик если есть
        const newBtn = modalContactBtn.cloneNode(true);
        modalContactBtn.parentNode.replaceChild(newBtn, modalContactBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Кнопка отправки нажата, вызываем handleContact...');
            handleContact(carId);
        });
        
        console.log('Обработчик кнопки установлен для carId:', carId);
    } else {
        console.error('Кнопка modalContactBtn не найдена!');
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

// Конфигурация - URL вашего сервера с ботом
// ВАЖНО: Используется ТОЛЬКО для отправки сообщений менеджеру через /api/webapp/contact
// Загрузка машин происходит напрямую из Google Sheets CSV (без бэкенда)
const SERVER_URL = 'https://tgappbackend-e4rk.onrender.com';

// Массив для хранения логов (для отладки) - определяется раньше для использования
const debugLogs = [];
const MAX_LOGS = 50;

// Функция для логирования с сохранением (определяется раньше для использования)
function debugLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        data: data ? JSON.stringify(data, null, 2) : null
    };
    
    debugLogs.push(logEntry);
    if (debugLogs.length > MAX_LOGS) {
        debugLogs.shift(); // Удаляем старые логи
    }
    
    // Выводим в консоль
    const logMessage = `[${timestamp}] ${level}: ${message}`;
    if (data) {
        console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](logMessage, data);
    } else {
        console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](logMessage);
    }
    
    // Сохраняем в localStorage для отладки
    try {
        localStorage.setItem('debugLogs', JSON.stringify(debugLogs.slice(-20))); // Последние 20
    } catch (e) {
        // Игнорируем ошибки localStorage
    }
}

// Логируем конфигурацию при загрузке
debugLog('INFO', 'Конфигурация приложения', {
    SERVER_URL: SERVER_URL,
    timestamp: new Date().toISOString()
});

// URL к CSV экспорту Google Sheets
// Важно: Таблица должна быть опубликована для экспорта!
// Инструкция: Файл → Опубликовать в интернете → CSV → Опубликовать
// Попробуем несколько вариантов ссылок
const CSV_URLS = [
    'https://docs.google.com/spreadsheets/d/14cuDxW6YdKnf3cFd18JhnwQ5v4gnOKhrCTZDVo96VCc/export?format=csv&gid=0', // Первый лист
    'https://docs.google.com/spreadsheets/d/14cuDxW6YdKnf3cFd18JhnwQ5v4gnOKhrCTZDVo96VCc/export?format=csv', // Без gid
    'https://docs.google.com/spreadsheets/d/14cuDxW6YdKnf3cFd18JhnwQ5v4gnOKhrCTZDVo96VCc/export?format=csv&gid=1644141353' // С gid из URL
];
let currentCSVUrlIndex = 0;
const CSV_URL = CSV_URLS[currentCSVUrlIndex];

// Кэш для всех машин
let allCarsData = [];

// ТЕСТОВЫЕ ДАННЫЕ (для локального тестирования без CSV)
// Установите USE_TEST_DATA = true для использования тестовых данных
const USE_TEST_DATA = false; // Измените на false для использования реального CSV

const TEST_CARS_DATA = [
    {
        id: 'test_car_1',
        brand: 'Hyundai',
        model: 'Sonata',
        year: 2022,
        price: 25000000,
        mileage: 15000,
        transmission: 'Автоматическая',
        fuel: 'Бензин',
        category: 'premium',
        description: 'Отличное состояние, один владелец, полная комплектация. Машина в идеальном состоянии, без ДТП, все документы в порядке.',
        photo_url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop',
        photo_urls: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop'],
        type: 'Седан',
        configuration: 'Премиум',
        color: 'Белый',
        displacement: '2.0',
        link: 'https://example.com/car/1'
    },
    {
        id: 'test_car_2',
        brand: 'Kia',
        model: 'Sportage',
        year: 2021,
        price: 18000000,
        mileage: 35000,
        transmission: 'Автоматическая',
        fuel: 'Дизель',
        category: 'family',
        description: 'Просторный кроссовер для семьи. Отличный выбор для дальних поездок. Все опции, включая камеру заднего вида и навигацию.',
        photo_url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop',
        photo_urls: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop'],
        type: 'Кроссовер',
        configuration: 'Стандартная',
        color: 'Серый',
        displacement: '2.0',
        link: 'https://example.com/car/2'
    },
    {
        id: 'test_car_3',
        brand: 'Genesis',
        model: 'G90',
        year: 2023,
        price: 45000000,
        mileage: 5000,
        transmission: 'Автоматическая',
        fuel: 'Бензин',
        category: 'premium',
        description: 'Роскошный седан премиум-класса. Максимальная комплектация, все опции. Идеальное состояние, как новый.',
        photo_url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop',
        photo_urls: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop'],
        type: 'Седан',
        configuration: 'Люкс',
        color: 'Черный',
        displacement: '3.3',
        link: 'https://example.com/car/3'
    },
    {
        id: 'test_car_4',
        brand: 'Hyundai',
        model: 'Tucson',
        year: 2020,
        price: 12000000,
        mileage: 60000,
        transmission: 'Механическая',
        fuel: 'Бензин',
        category: 'deal',
        description: 'Выгодное предложение! Надежный кроссовер с хорошей проходимостью. Отличное состояние для своего возраста.',
        photo_url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop',
        photo_urls: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop'],
        type: 'Кроссовер',
        configuration: 'Стандартная',
        color: 'Синий',
        displacement: '1.6',
        link: 'https://example.com/car/4'
    },
    {
        id: 'test_car_5',
        brand: 'Kia',
        model: 'K5',
        year: 2022,
        price: 22000000,
        mileage: 20000,
        transmission: 'Автоматическая',
        fuel: 'Гибрид',
        category: 'business',
        description: 'Современный бизнес-седан с гибридным двигателем. Экономичный расход, стильный дизайн. Все документы в порядке.',
        photo_url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop',
        photo_urls: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop'],
        type: 'Седан',
        configuration: 'Бизнес',
        color: 'Белый',
        displacement: '2.0',
        link: 'https://example.com/car/5'
    },
    {
        id: 'test_car_6',
        brand: 'Hyundai',
        model: 'Santa Fe',
        year: 2021,
        price: 28000000,
        mileage: 40000,
        transmission: 'Автоматическая',
        fuel: 'Дизель',
        category: 'family',
        description: 'Просторный 7-местный внедорожник. Идеален для большой семьи. Все опции, включая третий ряд сидений.',
        photo_url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop',
        photo_urls: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop'],
        type: 'Внедорожник',
        configuration: 'Стандартная',
        color: 'Серебристый',
        displacement: '2.2',
        link: 'https://example.com/car/6'
    },
    {
        id: 'test_car_7',
        brand: 'Genesis',
        model: 'GV80',
        year: 2023,
        price: 50000000,
        mileage: 3000,
        transmission: 'Автоматическая',
        fuel: 'Бензин',
        category: 'premium',
        description: 'Премиальный внедорожник. Максимальная комплектация, все опции. Практически новый автомобиль.',
        photo_url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop',
        photo_urls: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop'],
        type: 'Внедорожник',
        configuration: 'Люкс',
        color: 'Черный',
        displacement: '3.5',
        link: 'https://example.com/car/7'
    },
    {
        id: 'test_car_8',
        brand: 'Kia',
        model: 'Rio',
        year: 2020,
        price: 8500000,
        mileage: 70000,
        transmission: 'Механическая',
        fuel: 'Бензин',
        category: 'deal',
        description: 'Экономичный компактный седан. Отличное состояние, идеален для города. Низкий расход топлива.',
        photo_url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop',
        photo_urls: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0ad6?w=800&h=600&fit=crop'],
        type: 'Седан',
        configuration: 'Стандартная',
        color: 'Красный',
        displacement: '1.4',
        link: 'https://example.com/car/8'
    }
];
let csvCacheTime = 0;
const CSV_CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Функция парсинга CSV строки (правильная обработка кавычек и запятых)
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
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
    values.push(current.trim());
    
    return values;
}

// Функция парсинга CSV
function parseCSV(csvText) {
    console.log('Начинаем парсинг CSV...');
    console.log('Длина CSV:', csvText.length);
    
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        console.warn('CSV пустой');
        return [];
    }
    
    console.log('Всего строк:', lines.length);
    
    // Парсим заголовки (первая строка)
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, '').trim());
    console.log('Заголовки:', headers);
    console.log('Первые 5 заголовков:', headers.slice(0, 5));
    
    // Проверяем, что это действительно заголовки (содержат текстовые названия)
    // Если первая строка похожа на данные (только цифры), то это не заголовки
    const firstHeader = headers[0] || '';
    const looksLikeHeaders = headers.some(h => 
        h && (
            h.toLowerCase().includes('mark') || 
            h.toLowerCase().includes('model') || 
            h.toLowerCase().includes('price') ||
            h.toLowerCase().includes('year') ||
            h.toLowerCase().includes('id') ||
            h.toLowerCase().includes('url')
        )
    );
    
    if (!looksLikeHeaders && !isNaN(parseInt(firstHeader))) {
        console.warn('Первая строка похожа на данные, а не заголовки. Пропускаем её.');
        // Если первая строка - данные, используем индексы по умолчанию
        // Но лучше попробовать найти строку с заголовками
    }
    
    // Создаем индекс колонок по названиям
    const getColumnIndex = (name) => {
        const index = headers.findIndex(h => h && h.toLowerCase() === name.toLowerCase());
        if (index < 0) {
            // Пробуем найти похожие названия
            const similar = headers.findIndex(h => h && (
                h.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(h.toLowerCase())
            ));
            if (similar >= 0) {
                console.log(`Найдена похожая колонка для "${name}": "${headers[similar]}" (индекс ${similar})`);
                return similar;
            }
        }
        return index >= 0 ? index : null;
    };
    
    const cars = [];
    
    // Парсим данные (начиная со второй строки)
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        try {
            // Парсим строку CSV
            const values = parseCSVLine(lines[i]);
            
            // Функция для получения значения по названию колонки
            const getValue = (columnName) => {
                const idx = getColumnIndex(columnName);
                if (idx === null) {
                    console.warn(`Колонка "${columnName}" не найдена. Доступные колонки:`, headers);
                    return '';
                }
                if (idx >= values.length) {
                    console.warn(`Индекс ${idx} для "${columnName}" выходит за пределы массива значений (длина: ${values.length})`);
                    return '';
                }
                const value = (values[idx] || '').replace(/^"|"$/g, '').trim();
                return value;
            };
            
            // Для первой строки выводим отладочную информацию
            if (i === 1) {
                console.log('Первая строка данных:', values.slice(0, 10));
                console.log('Заголовки:', headers.slice(0, 10));
                console.log('Индексы колонок:', {
                    mark: getColumnIndex('mark'),
                    model: getColumnIndex('model'),
                    price: getColumnIndex('price'),
                    year: getColumnIndex('year'),
                    km_age: getColumnIndex('km_age'),
                    engine_type: getColumnIndex('engine_type'),
                    transmission_type: getColumnIndex('transmission_type')
                });
            }
            
            // Получаем данные по названиям колонок
            const brand = getValue('mark');
            const model = getValue('model');
            
            // Для первой строки выводим что получили
            if (i === 1) {
                console.log('Парсинг первой машины:', {
                    brand,
                    model,
                    price: getValue('price'),
                    year: getValue('year'),
                    mileage: getValue('km_age'),
                    fuel: getValue('engine_type'),
                    transmission: getValue('transmission_type')
                });
            }
            
            // Пропускаем пустые строки
            if (!brand && !model) continue;
            
            // Парсим цену (используем price, если нет - price_won)
            let price = null;
            const priceStr = getValue('price');
            if (priceStr && priceStr.trim()) {
                // Убираем пробелы и запятые, заменяем запятую на точку для десятичных
                const cleanPrice = priceStr.replace(/[\s]/g, '').replace(',', '.');
                const priceNum = parseFloat(cleanPrice);
                if (!isNaN(priceNum) && priceNum > 0) {
                    price = Math.round(priceNum);
                }
            }
            // Если цена не найдена, пробуем price_won
            if (!price || price === 0) {
                const priceWonStr = getValue('price_won');
                if (priceWonStr && priceWonStr.trim()) {
                    const cleanPrice = priceWonStr.replace(/[\s]/g, '').replace(',', '.');
                    const priceNum = parseFloat(cleanPrice);
                    if (!isNaN(priceNum) && priceNum > 0) {
                        // Конвертируем воны в рубли (примерно 1 вон = 0.07 рубля)
                        price = Math.round(priceNum * 0.07);
                    }
                }
            }
            
            // Парсим пробег (km_age)
            let mileage = null;
            const mileageStr = getValue('km_age');
            if (mileageStr) {
                const mileageNum = parseInt(mileageStr.replace(/[\s,.]/g, ''));
                if (!isNaN(mileageNum) && mileageNum > 0) mileage = mileageNum;
            }
            
            // Парсим год
            let year = null;
            const yearStr = getValue('year');
            if (yearStr) {
                const yearNum = parseInt(yearStr);
                if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
                    year = yearNum;
                }
            }
            
            // Парсим фото (images - JSON массив)
            let photo_url = null;
            let photo_urls = [];
            const imagesStr = getValue('images');
            if (imagesStr && imagesStr.trim()) {
                try {
                    let imagesJson = imagesStr.trim();
                    // Убираем экранированные кавычки если есть
                    if (imagesJson.startsWith('"[')) {
                        imagesJson = imagesJson.slice(1, -1).replace(/\\"/g, '"');
                    }
                    if (imagesJson.startsWith('[')) {
                        photo_urls = JSON.parse(imagesJson);
                        if (Array.isArray(photo_urls) && photo_urls.length > 0) {
                            // Фильтруем только валидные URL
                            photo_urls = photo_urls.filter(url => url && typeof url === 'string' && url.startsWith('http'));
                            if (photo_urls.length > 0) {
                                photo_url = photo_urls[0];
                                // Для первой машины логируем
                                if (i === 1) {
                                    console.log('Найдено фото:', photo_url.substring(0, 50) + '...');
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`Ошибка парсинга фото в строке ${i + 1}:`, e, 'Строка:', imagesStr.substring(0, 100));
                    // Если не JSON, пытаемся найти URL
                    const urlMatch = imagesStr.match(/https?:\/\/[^\s"\[\]]+/);
                    if (urlMatch) {
                        photo_url = urlMatch[0];
                        photo_urls = [photo_url];
                    }
                }
            }
            
            // Топливо (engine_type)
            const fuel = getValue('engine_type') || '';
            
            // Коробка передач (transmission_type)
            const transmission = getValue('transmission_type') || '';
            
            // Тип кузова (body_type)
            const type = getValue('body_type') || '';
            
            // Комплектация (configuration или complectation)
            let configuration = getValue('configuration') || getValue('complectation') || '';
            if (!configuration) {
                configuration = 'Стандартная';
            }
            
            // Описание
            const description = getValue('description') || '';
            
            // URL объявления
            const link = getValue('url') || '';
            
            // Цвет
            const color = getValue('color') || '';
            
            // Объем двигателя
            const displacement = getValue('displacement') || '';
            
            const car = {
                id: `car_${i}`,
                brand: brand,
                model: model,
                year: year,
                price: price,
                mileage: mileage,
                transmission: transmission,
                fuel: fuel,
                // Категория будет определяться динамически через getCarCategory()
                description: description.substring(0, 500),
                photo_url: photo_url,
                photo_urls: photo_urls,
                type: type,
                configuration: configuration,
                color: color,
                displacement: displacement,
                link: link
            };
            
            cars.push(car);
        } catch (error) {
            console.warn(`Ошибка парсинга строки ${i + 1}:`, error, lines[i].substring(0, 100));
            continue;
        }
    }
    
    console.log(`Успешно распарсено ${cars.length} машин`);
    if (cars.length > 0) {
        console.log('Пример первой машины (полный объект):', cars[0]);
        console.log('Первая машина - детали:', {
            id: cars[0].id,
            brand: cars[0].brand,
            model: cars[0].model,
            year: cars[0].year,
            price: cars[0].price,
            mileage: cars[0].mileage,
            transmission: cars[0].transmission,
            fuel: cars[0].fuel,
            photo_url: cars[0].photo_url ? cars[0].photo_url.substring(0, 50) + '...' : 'нет'
        });
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
        // ТЕСТОВЫЙ РЕЖИМ: Используем локальные данные
        if (USE_TEST_DATA) {
            console.log('📦 Используем тестовые данные (USE_TEST_DATA = true)');
            allCarsData = [...TEST_CARS_DATA];
            csvCacheTime = Date.now();
            
            // Применяем фильтры
            let filteredCars = [...allCarsData];
            
            // Фильтры по категории (определяем категорию динамически)
            if (currentCategory) {
                filteredCars = filteredCars.filter(c => getCarCategory(c) === currentCategory);
            }
            
            // Другие фильтры
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
            let paginatedCars;
            
            if (reset) {
                carsData = filteredCars;
                const start = (currentPage - 1) * PAGE_SIZE;
                const end = start + PAGE_SIZE;
                paginatedCars = filteredCars.slice(start, end);
                hasMore = end < filteredCars.length;
                currentPage++;
                
                // Применяем фильтры (категория и другие фронтенд фильтры)
                applyFilters();
            } else {
                // Для автоматической загрузки добавляем к существующим
                const start = carsData.length;
                const end = start + PAGE_SIZE;
                paginatedCars = filteredCars.slice(start, end);
                hasMore = end < filteredCars.length;
                currentPage++;
                
                // Добавляем новые карточки
                appendCars(paginatedCars);
            }
            
            // Извлекаем доступные фильтры
            extractAvailableFilters();
            
            if (reset) {
                renderCars(paginatedCars);
            }
            
            isLoading = false;
            return;
        }
        
        // Проверяем кэш
        const now = Date.now();
        if (reset && allCarsData.length > 0 && (now - csvCacheTime) < CSV_CACHE_TTL) {
            console.log('Используем кэшированные данные');
        } else {
            console.log('Загружаем CSV из Google Sheets...', CSV_URL);
            
            // Пробуем загрузить CSV (можем попробовать несколько ссылок)
            let response;
            let csvText;
            let success = false;
            
            for (let i = 0; i < CSV_URLS.length; i++) {
                try {
                    console.log(`Попытка ${i + 1}: загрузка с URL`, CSV_URLS[i]);
                    response = await fetch(CSV_URLS[i]);
                    
                    if (response.ok) {
                        csvText = await response.text();
                        if (csvText && csvText.trim().length > 0) {
                            currentCSVUrlIndex = i;
                            success = true;
                            console.log(`✅ Успешно загружено с URL ${i + 1}`);
                            break;
                        }
                    }
                } catch (e) {
                    console.warn(`Ошибка при загрузке с URL ${i + 1}:`, e);
                    continue;
                }
            }
            
            if (!success) {
                let errorMessage = 'Не удалось загрузить CSV';
                if (response) {
                    try {
                        const errorText = await response.text();
                        console.error('Ошибка загрузки CSV:', response.status, errorText.substring(0, 200));
                        if (response.status === 500 || response.status === 403) {
                            errorMessage = 'Таблица не опубликована для экспорта. Откройте таблицу → Файл → Опубликовать в интернете → CSV → Опубликовать';
                        } else {
                            errorMessage = `Ошибка загрузки (${response.status}). Убедитесь, что таблица опубликована для экспорта.`;
                        }
                    } catch (e) {
                        console.error('Ошибка при чтении ответа:', e);
                        errorMessage = `Ошибка загрузки (${response.status}). Убедитесь, что таблица опубликована для экспорта.`;
                    }
                } else {
                    errorMessage = 'Не удалось подключиться к Google Sheets. Проверьте интернет-соединение.';
                }
                throw new Error(errorMessage);
            }
            
            console.log('CSV загружен, длина:', csvText.length);
            console.log('Первые 500 символов:', csvText.substring(0, 500));
            
            if (!csvText || csvText.trim().length === 0) {
                throw new Error('CSV файл пустой');
            }
            
            // Парсим CSV
            allCarsData = parseCSV(csvText);
            csvCacheTime = now;
            
            if (allCarsData.length === 0) {
                console.warn('Не удалось распарсить ни одной машины из CSV');
                if (carsGrid) {
                    carsGrid.innerHTML = `
                        <div class="error-message">
                            <p>Не удалось загрузить данные</p>
                            <p class="error-hint">CSV файл пустой или имеет неправильный формат. Проверьте консоль браузера для деталей.</p>
                            <button onclick="loadCars(true)" class="retry-btn">Повторить</button>
                        </div>
                    `;
                }
                isLoading = false;
                return;
            }
            
            console.log(`✅ Загружено ${allCarsData.length} машин из CSV`);
            
            // Извлекаем доступные фильтры
            extractAvailableFilters();
        }
        
        // Проверяем что есть данные
        if (allCarsData.length === 0) {
            console.warn('Нет данных для отображения');
            if (carsGrid) {
                carsGrid.innerHTML = `
                    <div class="error-message">
                        <p>Нет данных</p>
                        <button onclick="loadCars(true)" class="retry-btn">Повторить</button>
                    </div>
                `;
            }
            isLoading = false;
            return;
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
        let paginatedCars;
        
        if (reset) {
            carsData = filteredCars;
            const start = (currentPage - 1) * PAGE_SIZE;
            const end = start + PAGE_SIZE;
            paginatedCars = filteredCars.slice(start, end);
            hasMore = end < filteredCars.length;
            currentPage++;
            
            // Применяем фильтры (категория и другие фронтенд фильтры)
            applyFilters();
        } else {
            // Для автоматической загрузки добавляем к существующим
            const start = carsData.length;
            const end = start + PAGE_SIZE;
            paginatedCars = filteredCars.slice(start, end);
            hasMore = end < filteredCars.length;
            currentPage++;
            
            // Добавляем новые карточки
            appendCars(paginatedCars);
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
    // Марки (убираем пустые и дубликаты)
    const brands = [...new Set(allCarsData.map(c => c.brand).filter(b => b && b.trim()))].sort();
    
    // Годы (убираем пустые и сортируем по убыванию)
    const years = [...new Set(allCarsData.map(c => c.year).filter(y => y && y > 1900 && y < 2100))].sort((a, b) => b - a);
    
    // Типы топлива (engine_type)
    const fuelTypes = [...new Set(allCarsData.map(c => c.fuel).filter(f => f && f.trim()))].sort();
    
    // Коробки передач (transmission_type)
    const transmissions = [...new Set(allCarsData.map(c => c.transmission).filter(t => t && t.trim()))].sort();
    
    // Типы кузова (body_type)
    const bodyTypes = [...new Set(allCarsData.map(c => c.type).filter(t => t && t.trim()))].sort();
    
    availableFilters = {
        brands: brands,
        years: years,
        fuel_types: fuelTypes,
        transmissions: transmissions,
        body_types: bodyTypes
    };
    
    console.log('Доступные фильтры:', availableFilters);
    updateFiltersUI();
}

// Обработчик прокрутки для автоматической загрузки
let scrollTimeout = null;
function handleScroll() {
    // Throttle: проверяем не чаще чем раз в 200ms
    if (scrollTimeout) return;
    
    scrollTimeout = setTimeout(() => {
        scrollTimeout = null;
        
        // Проверяем, доскроллили ли до конца страницы
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Загружаем еще, если до конца осталось меньше 300px
        if (documentHeight - (scrollTop + windowHeight) < 300) {
            if (!isLoading && hasMore) {
                console.log('Автоматическая загрузка при прокрутке');
                loadMoreCars();
            }
        }
    }, 200);
}

// Загрузка еще машин (для автоматической загрузки при прокрутке)
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

// Функция updateLoadMoreButton удалена - теперь используется автоматическая загрузка при прокрутке

// Обработка контакта по автомобилю

// Функция для показа кастомного уведомления с деталями ошибки
function showNotification(message, duration = 3000, errorDetails = null) {
    const notification = document.getElementById('customNotification');
    const notificationText = notification.querySelector('.custom-notification-text');
    
    if (!notification || !notificationText) {
        console.warn('Элемент уведомления не найден');
        return;
    }
    
    // Если есть детали ошибки, добавляем их
    let fullMessage = message;
    if (errorDetails) {
        fullMessage += `\n\nДетали: ${errorDetails}`;
        duration = Math.max(duration, 6000); // Увеличиваем время для ошибок
    }
    
    notificationText.textContent = fullMessage;
    
    // Меняем цвет для ошибок
    if (message.includes('❌') || message.includes('Ошибка')) {
        notification.style.background = 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)';
    } else {
        notification.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
    }
    
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

async function handleContact(carId) {
    debugLog('INFO', '=== НАЧАЛО ОТПРАВКИ ЗАЯВКИ ===');
    debugLog('INFO', 'handleContact вызвана', { carId });
    
    const car = carsData.find(c => c.id === carId);
    if (!car) {
        debugLog('ERROR', 'Машина не найдена', { carId, availableIds: carsData.slice(0, 5).map(c => c.id) });
        showNotification('❌ Ошибка: машина не найдена', 3000);
        return;
    }
    
    debugLog('INFO', 'Машина найдена', {
        id: car.id,
        brand: car.brand,
        model: car.model,
        year: car.year
    });
    
    // Получаем данные из формы
    const questionInput = document.getElementById('modalQuestion');
    const phoneInput = document.getElementById('modalPhone');
    const contactMethodRadios = document.querySelectorAll('input[name="contactMethod"]');
    
    const question = questionInput ? questionInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const selectedMethod = Array.from(contactMethodRadios).find(r => r.checked);
    const contactMethod = selectedMethod ? selectedMethod.value : 'whatsapp';
    
    debugLog('INFO', 'Данные формы', {
        questionLength: question.length,
        hasPhone: !!phone,
        contactMethod: contactMethod
    });
    
    // Валидация
    if (!question) {
        debugLog('WARN', 'Валидация не пройдена: вопрос не указан');
        showNotification('Пожалуйста, задайте вопрос о машине', 3000);
        if (questionInput) {
            questionInput.focus();
        }
        return;
    }
    
    if (contactMethod === 'whatsapp' && !phone) {
        debugLog('WARN', 'Валидация не пройдена: телефон не указан для WhatsApp');
        showNotification('Для связи через WhatsApp необходимо указать номер телефона', 3000);
        if (phoneInput) {
            phoneInput.focus();
        }
        return;
    }
    
    debugLog('INFO', 'Валидация пройдена');
    
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
        debugLog('INFO', 'Данные пользователя Telegram', {
            userId: userData.userId,
            username: userData.username || 'не указан',
            hasFirstName: !!userData.firstName,
            hasLastName: !!userData.lastName
        });
    } else {
        debugLog('WARN', 'Telegram WebApp API недоступен');
    }
    
    // Форматируем цену
    let formattedPrice = 'Цена не указана';
    if (car.price && car.price > 0) {
        formattedPrice = formatPrice(car.price, currentCurrency);
    }
    
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
            category: getCarCategory(car),
            link: car.link || ''
        },
        user: userData,
        question: question,
        phone: phone || null,
        contactMethod: contactMethod,
        timestamp: new Date().toISOString()
    };
    
    debugLog('INFO', 'Данные для отправки подготовлены', {
        car: `${requestData.car.brand} ${requestData.car.model}`,
        userId: requestData.user.userId,
        contactMethod: requestData.contactMethod,
        hasQuestion: !!requestData.question,
        hasPhone: !!requestData.phone,
        questionLength: requestData.question.length
    });
    
    // Показываем индикатор загрузки
    const contactBtn = document.getElementById('modalContactBtn');
    const originalText = contactBtn ? contactBtn.textContent : '';
    if (contactBtn) {
        contactBtn.disabled = true;
        contactBtn.textContent = 'Отправка...';
    }
    
    const requestUrl = `${SERVER_URL}/api/webapp/contact`;
    const startTime = Date.now();
    
    try {
        debugLog('INFO', 'Отправка запроса на сервер', {
            url: requestUrl,
            method: 'POST',
            serverUrl: SERVER_URL
        });
        
        // ЕДИНСТВЕННОЕ место, где используется бэкенд - отправка сообщения менеджеру
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        const responseTime = Date.now() - startTime;
        debugLog('INFO', `Ответ получен за ${responseTime}ms`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        
        if (!response.ok) {
            let errorText = '';
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Не удалось прочитать текст ошибки';
            }
            
            debugLog('ERROR', 'Ошибка ответа сервера', {
                status: response.status,
                statusText: response.statusText,
                responseTime: responseTime,
                errorText: errorText.substring(0, 500),
                url: requestUrl
            });
            
            // Формируем понятное сообщение об ошибке
            let errorMessage = `Ошибка ${response.status}`;
            let errorDetails = '';
            
            if (response.status === 500) {
                errorMessage = 'Ошибка сервера';
                errorDetails = 'Сервер вернул ошибку 500. Проверьте логи бэкенда.';
            } else if (response.status === 404) {
                errorMessage = 'Endpoint не найден';
                errorDetails = `URL ${requestUrl} не найден. Проверьте настройки сервера.`;
            } else if (response.status === 400) {
                errorMessage = 'Неверный запрос';
                errorDetails = 'Сервер не смог обработать запрос. Проверьте данные.';
            } else if (response.status === 0 || response.status === 'Failed to fetch') {
                errorMessage = 'Нет подключения к серверу';
                errorDetails = `Не удалось подключиться к ${SERVER_URL}. Проверьте интернет-соединение.`;
            } else {
                errorDetails = errorText.substring(0, 200);
            }
            
            throw new Error(`${errorMessage}: ${errorDetails}`);
        }
        
        let result;
        try {
            result = await response.json();
        } catch (e) {
            debugLog('ERROR', 'Ошибка парсинга JSON ответа', { error: e.message });
            throw new Error('Сервер вернул некорректный ответ');
        }
        
        debugLog('INFO', 'Ответ сервера получен', { success: result.success, hasError: !!result.error });
        
        if (result.success) {
            debugLog('INFO', '✅ Запрос успешно отправлен', {
                carId: car.id,
                userId: userData.userId,
                contactMethod: contactMethod,
                timestamp: new Date().toISOString(),
                responseTime: responseTime
            });
            
            // Показываем кастомное уведомление
            showNotification('✅ Ваша заявка отправлена! Мы свяжемся с вами в ближайшее время.', 4000);
            
            // Очищаем форму
            if (questionInput) questionInput.value = '';
            if (phoneInput) phoneInput.value = '';
            
            // Сбрасываем выбор метода связи на WhatsApp
            const whatsappRadio = document.querySelector('input[name="contactMethod"][value="whatsapp"]');
            if (whatsappRadio) {
                whatsappRadio.checked = true;
            }
            
            // Закрываем модальное окно с небольшой задержкой для показа уведомления
            setTimeout(() => {
                closeCarModal();
            }, 500);
        } else {
            debugLog('ERROR', 'Сервер вернул success: false', { result });
            throw new Error(result.error || 'Ошибка при отправке');
        }
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        debugLog('ERROR', '❌ ОШИБКА отправки сообщения менеджеру', {
            error: error.message,
            name: error.name,
            carId: car.id,
            userId: userData.userId,
            timestamp: new Date().toISOString(),
            serverUrl: SERVER_URL,
            requestUrl: requestUrl,
            responseTime: responseTime
        });
        
        // Формируем понятное сообщение для пользователя
        let userMessage = '❌ Произошла ошибка при отправке. ';
        let errorDetails = '';
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('Network request failed')) {
            userMessage += 'Нет подключения к серверу.';
            errorDetails = `Проверьте подключение к интернету и доступность сервера ${SERVER_URL}`;
        } else if (error.message.includes('404')) {
            userMessage += 'Сервер недоступен.';
            errorDetails = `Endpoint не найден: ${requestUrl}`;
        } else if (error.message.includes('500')) {
            userMessage += 'Ошибка на сервере.';
            errorDetails = 'Сервер вернул ошибку 500. Обратитесь к администратору.';
        } else if (error.message.includes('CORS') || error.message.includes('CORS policy')) {
            userMessage += 'Проблема с CORS.';
            errorDetails = 'Сервер не разрешает запросы с этого домена.';
        } else {
            errorDetails = error.message;
        }
        
        showNotification(userMessage, 5000, errorDetails);
    } finally {
        if (contactBtn) {
            contactBtn.disabled = false;
            contactBtn.textContent = originalText;
        }
        debugLog('INFO', '=== КОНЕЦ ОТПРАВКИ ЗАЯВКИ ===');
    }
}

// Инициализация приложения
function init() {
    // Инициализируем Telegram Web App
    initTelegramWebApp();
    
    // Загружаем актуальные курсы валют
    loadExchangeRates();
    
    // Обновляем курсы валют каждый час
    setInterval(loadExchangeRates, EXCHANGE_RATES_CACHE_TTL);
    
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
    
    // Добавляем обработчик прокрутки для автоматической загрузки
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Также обрабатываем прокрутку в контейнере результатов (для мобильных устройств)
    const resultsSection = document.querySelector('.results-section');
    if (resultsSection) {
        resultsSection.addEventListener('scroll', handleScroll, { passive: true });
    }
}

// Запуск приложения после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

