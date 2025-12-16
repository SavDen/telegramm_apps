// Данные автомобилей (имитация будущего API)
const carsData = [
    {
        id: 1,
        category: 'premium',
        brand: 'Genesis',
        model: 'G90',
        year: 2023,
        price: 85000,
        mileage: 15000,
        transmission: 'Автомат',
        fuel: 'Бензин',
        description: 'Флагманский седан с максимальной комплектацией'
    },
    {
        id: 2,
        category: 'premium',
        brand: 'Genesis',
        model: 'GV80',
        year: 2022,
        price: 72000,
        mileage: 25000,
        transmission: 'Автомат',
        fuel: 'Бензин',
        description: 'Премиальный кроссовер с полным приводом'
    },
    {
        id: 3,
        category: 'family',
        brand: 'Hyundai',
        model: 'Tucson',
        year: 2023,
        price: 32000,
        mileage: 12000,
        transmission: 'Автомат',
        fuel: 'Гибрид',
        description: 'Семейный кроссовер с экономичным двигателем'
    },
    {
        id: 4,
        category: 'family',
        brand: 'Kia',
        model: 'Sorento',
        year: 2022,
        price: 38000,
        mileage: 20000,
        transmission: 'Автомат',
        fuel: 'Дизель',
        description: 'Семизместный кроссовер для большой семьи'
    },
    {
        id: 5,
        category: 'family',
        brand: 'Hyundai',
        model: 'Santa Fe',
        year: 2023,
        price: 35000,
        mileage: 18000,
        transmission: 'Автомат',
        fuel: 'Гибрид',
        description: 'Просторный семейный внедорожник'
    },
    {
        id: 6,
        category: 'business',
        brand: 'Genesis',
        model: 'G80',
        year: 2023,
        price: 55000,
        mileage: 10000,
        transmission: 'Автомат',
        fuel: 'Бензин',
        description: 'Бизнес-седан премиум-класса'
    },
    {
        id: 7,
        category: 'business',
        brand: 'Hyundai',
        model: 'Sonata',
        year: 2022,
        price: 28000,
        mileage: 22000,
        transmission: 'Автомат',
        fuel: 'Гибрид',
        description: 'Современный бизнес-седан'
    },
    {
        id: 8,
        category: 'deal',
        brand: 'Kia',
        model: 'Rio',
        year: 2021,
        price: 15000,
        mileage: 35000,
        transmission: 'Механика',
        fuel: 'Бензин',
        description: 'Экономичный компактный седан'
    },
    {
        id: 9,
        category: 'deal',
        brand: 'Hyundai',
        model: 'Elantra',
        year: 2021,
        price: 18000,
        mileage: 30000,
        transmission: 'Автомат',
        fuel: 'Бензин',
        description: 'Надежный седан по выгодной цене'
    },
    {
        id: 10,
        category: 'deal',
        brand: 'Kia',
        model: 'Cerato',
        year: 2020,
        price: 14000,
        mileage: 40000,
        transmission: 'Автомат',
        fuel: 'Бензин',
        description: 'Отличное соотношение цена-качество'
    }
];

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
let filteredCars = [...carsData];
let currentCurrency = 'USD';

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
        const card = document.createElement('div');
        card.className = 'car-card';
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.cursor = 'pointer';
        
        const formattedPrice = formatPrice(car.price, currentCurrency);
        
        card.innerHTML = `
            <div class="car-image"></div>
            <div class="car-info">
                <div class="car-title">${car.brand} ${car.model}</div>
                <div class="car-year">${car.year} год</div>
                <div class="car-price">${formattedPrice}</div>
                <div class="car-specs">
                    <div class="car-spec-item">
                        <span>📏</span>
                        <span>${car.mileage.toLocaleString()} км</span>
                    </div>
                    <div class="car-spec-item">
                        <span>⚙️</span>
                        <span>${car.transmission}</span>
                    </div>
                    <div class="car-spec-item">
                        <span>⛽</span>
                        <span>${car.fuel}</span>
                    </div>
                </div>
                <div class="car-question-section">
                    <textarea 
                        class="car-question-input" 
                        id="question-${car.id}" 
                        placeholder="Задайте вопрос о машине..."
                        rows="2"
                        onclick="event.stopPropagation();"
                    ></textarea>
                    <button 
                        class="contact-btn" 
                        onclick="event.stopPropagation(); handleContact(${car.id})"
                    >
                        Связаться по этой машине
                    </button>
                </div>
            </div>
        `;
        
        // Обработчик клика на карточку (но не на кнопку)
        card.addEventListener('click', (e) => {
            // Проверяем, что клик не был на кнопке
            if (!e.target.closest('.contact-btn')) {
                openCarModal(car.id);
            }
        });
        
        carsGrid.appendChild(card);
        
        // Анимация появления с задержкой
        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
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
    const yearFrom = parseInt(document.getElementById('yearFrom')?.value) || 0;
    const yearTo = parseInt(document.getElementById('yearTo')?.value) || 9999;
    const priceFromInput = parseFloat(document.getElementById('priceFrom')?.value) || 0;
    const priceToInput = parseFloat(document.getElementById('priceTo')?.value) || 999999999;
    
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
        
        // Фильтр по году
        if (car.year < yearFrom || car.year > yearTo) {
            return false;
        }
        
        // Фильтр по цене (сравниваем в USD)
        if (car.price < priceFromUSD || car.price > priceToUSD) {
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
    document.getElementById('brandFilter').value = '';
    document.getElementById('yearFrom').value = '';
    document.getElementById('yearTo').value = '';
    document.getElementById('priceFrom').value = '';
    document.getElementById('priceTo').value = '';
    
    // Применяем фильтры (показываем все)
    applyFilters();
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
    document.getElementById('modalCarPrice').textContent = formattedPrice;
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

// Конфигурация - URL вашего сервера с ботом
// ЗАМЕНИТЕ на реальный URL вашего сервера (например: 'https://your-server.com:5000')
const SERVER_URL = 'https://savd.pythonanywhere.com';

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
    
    // Назначаем обработчик кнопки "Показать"
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyFilters);
    }
    
    // Назначаем обработчик кнопки "Сбросить"
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
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
    
    // Закрытие полноэкранной страницы по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCarModal();
        }
    });
    
    // Первоначальная загрузка всех автомобилей
    renderCars(carsData);
}

// Запуск приложения после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

