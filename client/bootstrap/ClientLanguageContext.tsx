import React from 'react';
import { useClientApp } from './ClientAppContext';
import { ClientUiLanguage } from '../types';

type TranslationParams = Record<string, string | number>;

type TranslationMap = Record<string, Record<ClientUiLanguage, string>>;

const translations: TranslationMap = {
  "nav.home": { uz: "Bosh sahifa", ru: "Главная", en: "Home" },
  "nav.products": { uz: "Mahsulotlar", ru: "Товары", en: "Products" },
  "nav.cart": { uz: "Savatcha", ru: "Корзина", en: "Cart" },
  "nav.preview": { uz: "Ko'rish", ru: "Предпросмотр", en: "Preview" },
  "nav.orders": { uz: "Buyurtmalar", ru: "Заказы", en: "Orders" },
  "nav.bottles": { uz: "Idishlar", ru: "Тара", en: "Bottles" },
  "nav.profile": { uz: "Profil", ru: "Профиль", en: "Profile" },

  "layout.badge": { uz: "Mijoz WebApp", ru: "Клиентский WebApp", en: "Client WebApp" },
  "layout.title": { uz: "Zomin Suv", ru: "Zomin Water", en: "Zomin Water" },
  "layout.telegram_verified": { uz: "Telegram uchun tasdiqlangan mijoz oynasi.", ru: "Подтвержденный клиентский интерфейс для Telegram.", en: "Verified Telegram-first client surface." },
  "layout.preview_shell": { uz: "Telegram tashqarisidagi sinov qobigi ishlamoqda.", ru: "Запущен режим предпросмотра вне Telegram.", en: "Preview shell is running outside Telegram." },
  "layout.refresh_title": { uz: "Bootstrapni yangilash", ru: "Обновить bootstrap", en: "Refresh bootstrap" },
  "layout.mode": { uz: "Rejim", ru: "Режим", en: "Mode" },
  "layout.session": { uz: "Sessiya", ru: "Сессия", en: "Session" },
  "layout.deposit_held": { uz: "Ushlab turilgan depozit", ru: "Удерживаемый депозит", en: "Deposit held" },
  "layout.active_session": { uz: "Faol sessiya", ru: "Активная сессия", en: "Active session" },
  "layout.telegram_detected": { uz: "Telegram muhiti aniqlandi.", ru: "Контекст Telegram обнаружен.", en: "Telegram context detected." },
  "layout.telegram_missing": { uz: "Bu sinov rejimida Telegram muhiti ulanmagan.", ru: "В этом режиме предпросмотра контекст Telegram не подключен.", en: "Telegram context is not attached in this preview." },
  "layout.profile": { uz: "Profil", ru: "Профиль", en: "Profile" },
  "layout.active_order": { uz: "Faol buyurtma", ru: "Активный заказ", en: "Active order" },
  "layout.awaiting_delivery": { uz: "Yetkazib berish manzili kutilmoqda", ru: "Ожидаются данные доставки", en: "Awaiting delivery details" },
  "layout.session_valid_until": { uz: "Sessiya amal qilish muddati:", ru: "Сессия действует до:", en: "Session valid until" },
  "layout.mode.telegram": { uz: "telegram", ru: "telegram", en: "telegram" },
  "layout.mode.preview": { uz: "sinov", ru: "preview", en: "preview" },
  "layout.status.loading": { uz: "yuklanmoqda", ru: "загрузка", en: "loading" },
  "layout.status.ready": { uz: "tayyor", ru: "готово", en: "ready" },
  "layout.status.error": { uz: "xato", ru: "ошибка", en: "error" },
  "layout.telegram_client": { uz: "Telegram mijozi", ru: "Клиент Telegram", en: "Telegram client" },

  "home.title": { uz: "Bosh sahifa", ru: "Главная", en: "Home" },
  "home.subtitle": { uz: "Telegram ichidagi mijoz oqimi va jonli WebApp ma'lumotlari.", ru: "Клиентский Telegram-поток и живые данные WebApp.", en: "Client-first Telegram flow with live WebApp data." },
  "home.open_in_telegram": { uz: "Buni Telegram ichida oching", ru: "Откройте это внутри Telegram", en: "Open this inside Telegram" },
  "home.open_in_telegram_cta": { uz: "Telegramda ochish", ru: "Открыть в Telegram", en: "Open in Telegram" },
  "home.preview_mode": { uz: "Sinov rejimi faol. Haqiqiy mijoz ma'lumotlari Telegram WebApp bootstrap muvaffaqiyatli otgach chiqadi.", ru: "Режим предпросмотра активен. Реальные данные клиента появятся после успешного bootstrap Telegram WebApp.", en: "Preview mode is active. Real client data will appear after Telegram WebApp bootstrap succeeds." },
  "home.verifying": { uz: "Mijoz sessiyasi hali tekshirilmoqda.", ru: "Сессия клиента еще проверяется.", en: "Client session is still being verified." },
  "home.cart_items": { uz: "Savatchadagi mahsulotlar", ru: "Товары в корзине", en: "Cart items" },
  "home.product_subtotal": { uz: "Mahsulotlar summasi", ru: "Сумма товаров", en: "Product subtotal" },
  "home.bottle_balance": { uz: "Idish balansi", ru: "Баланс тары", en: "Bottle balance" },
  "home.session": { uz: "Sessiya", ru: "Сессия", en: "Session" },
  "home.current_active_order": { uz: "Joriy faol buyurtma", ru: "Текущий активный заказ", en: "Current active order" },
  "home.delivery_placeholder": { uz: "Yetkazib berish manzili shu yerda ko'rinadi.", ru: "Здесь появится адрес доставки.", en: "Delivery address will appear here." },
  "home.open_orders": { uz: "Buyurtmalarni ochish", ru: "Открыть заказы", en: "Open orders" },
  "home.quick.products.title": { uz: "Mahsulotlarni ko'rish", ru: "Посмотреть товары", en: "Browse products" },
  "home.quick.products.description": { uz: "Mijoz katalogi /client/webapp/products/ orqali yuklanadi.", ru: "Каталог клиента загружается через /client/webapp/products/.", en: "Real client catalog backed by /client/webapp/products/." },
  "home.quick.cart.title": { uz: "Savatcha va ko'rish", ru: "Корзина и предпросмотр", en: "Cart and preview" },
  "home.quick.cart.description": { uz: "Avval ko'rish, keyin buyurtma: mahsulot summasi va depozit alohida hisoblanadi.", ru: "Сначала предпросмотр: сумма товаров и депозит считаются отдельно.", en: "Preview-first checkout with product subtotal and bottle deposit split." },
  "home.quick.orders.title": { uz: "Mening buyurtmalarim", ru: "Мои заказы", en: "My orders" },
  "home.quick.orders.description": { uz: "WebApp ichida faqat shu mijozning buyurtmalari ko'rinadi.", ru: "В WebApp видны только заказы текущего клиента.", en: "Only current client orders are visible in the WebApp." },
  "home.quick.bottles.title": { uz: "Idish balansi", ru: "Баланс тары", en: "Bottle balance" },
  "home.quick.bottles.description": { uz: "Depozit jamlanmasi va harakatlar tarixi faqat oqish rejimida.", ru: "Сводка по депозиту и история движений только для чтения.", en: "Read-only deposit summary and movement history." },
  "home.checkout_flow": { uz: "Buyurtma oqimi endi togri ishlaydi: mahsulot tanlash, sonni boshqarish, summa va depozitni ko'rish, so'ng buyurtma yaratish. Barcha so'rovlar faqat /client/webapp/... orqali yuboriladi.", ru: "Теперь поток заказа работает правильно: выбор товара, управление количеством, предпросмотр суммы и депозита, затем создание заказа. Все запросы идут только через /client/webapp/...", en: "The client app now follows the correct order flow: select products, manage quantities, preview subtotal and deposit, then create the order using only /client/webapp/... endpoints." },
  "home.checkout_flow_title": { uz: "Buyurtma oqimi", ru: "Поток заказа", en: "Checkout flow" },

  "products.title": { uz: "Mahsulotlar", ru: "Товары", en: "Products" },
  "products.subtitle": { uz: "Faol katalog mahsulotlari /client/webapp/products/ orqali yuklanadi.", ru: "Активные товары каталога загружаются через /client/webapp/products/.", en: "Active catalog products from /client/webapp/products/." },
  "products.unauth_subtitle": { uz: "Mijoz katalogini ko'rish uchun Telegram WebAppni oching.", ru: "Откройте Telegram WebApp, чтобы увидеть каталог клиента.", en: "Open the Telegram WebApp to load your client catalog." },
  "products.unauth_description": { uz: "Mijoz mahsulotlari faqat Telegram WebApp bootstrap mijoz sessiya tokenini qaytargandan keyin ochiladi.", ru: "Товары клиента доступны только после того, как Telegram WebApp bootstrap вернет токен клиентской сессии.", en: "Client products are available only after Telegram WebApp bootstrap returns a client session token." },
  "products.cart": { uz: "Savatcha", ru: "Корзина", en: "Cart" },
  "products.loading": { uz: "Mahsulotlar yuklanmoqda...", ru: "Загрузка товаров...", en: "Loading products..." },
  "products.empty": { uz: "Hozircha faol mahsulotlar mavjud emas.", ru: "Сейчас нет активных товаров.", en: "No active products are available right now." },
  "products.error_load": { uz: "Mahsulotlarni yuklab bo'lmadi.", ru: "Не удалось загрузить товары.", en: "Failed to load products." },
  "products.price": { uz: "Narx", ru: "Цена", en: "Price" },
  "products.deposit": { uz: "Idish depoziti", ru: "Депозит за тару", en: "Bottle deposit" },
  "products.no_deposit": { uz: "Depozit yo'q", ru: "Без депозита", en: "No deposit" },
  "products.available_count": { uz: "Mavjud son: {count}", ru: "В наличии: {count}", en: "Available count: {count}" },
  "products.add": { uz: "Qo'shish", ru: "Добавить", en: "Add" },

  "cart.title": { uz: "Savatcha", ru: "Корзина", en: "Cart" },
  "cart.subtitle": { uz: "Yetkazib berish ma'lumotlarini shu yerda kiriting, keyin aniq depozit hisobini ko'rish uchun oldindan ko'rishga oting.", ru: "Укажите данные доставки здесь, затем перейдите к предпросмотру для точного расчета депозита.", en: "Set delivery details here, then move to preview for exact bottle deposit calculation." },
  "cart.preview": { uz: "Ko'rish", ru: "Предпросмотр", en: "Preview" },
  "cart.empty": { uz: "Savatcha bosh. Avval mahsulot qo'shing, keyin summa va depozitni ko'rib buyurtma yarating.", ru: "Корзина пуста. Сначала добавьте товары, затем проверьте сумму и депозит перед созданием заказа.", en: "Cart is empty. Add products first, then preview subtotal and deposit before creating an order." },
  "cart.unit_price": { uz: "Dona narxi", ru: "Цена за единицу", en: "Unit price" },
  "cart.remove": { uz: "Olib tashlash", ru: "Удалить", en: "Remove" },
  "cart.line_total": { uz: "Jami", ru: "Сумма строки", en: "Line total" },
  "cart.delivery_address": { uz: "Yetkazib berish manzili", ru: "Адрес доставки", en: "Delivery address" },
  "cart.delivery_address_placeholder": { uz: "Toliq yetkazib berish manzilini kiriting", ru: "Введите полный адрес доставки", en: "Enter full delivery address" },
  "cart.payment_method": { uz: "To'lov usuli", ru: "Способ оплаты", en: "Payment method" },
  "cart.delivery_time": { uz: "Yetkazib berish vaqti", ru: "Время доставки", en: "Delivery time" },
  "cart.latitude": { uz: "Kenglik", ru: "Широта", en: "Latitude" },
  "cart.longitude": { uz: "Uzunlik", ru: "Долгота", en: "Longitude" },
  "cart.optional": { uz: "Ixtiyoriy", ru: "Необязательно", en: "Optional" },
  "cart.items": { uz: "Mahsulotlar", ru: "Позиции", en: "Items" },
  "cart.deposit_preview": { uz: "Ko'rishda hisoblanadi", ru: "Рассчитывается на предпросмотре", en: "Calculated on preview" },

  "checkout.title": { uz: "Oldindan ko'rish", ru: "Предпросмотр заказа", en: "Checkout Preview" },
  "checkout.subtitle": { uz: "Buyurtma yaratishdan oldin mahsulot summasi, depozit va yakuniy to'lovni tekshiring.", ru: "Проверьте сумму товаров, депозит и итог перед созданием заказа.", en: "Preview exact product subtotal, bottle deposit, and total payable before creating the order." },
  "checkout.unauth_subtitle": { uz: "Buyurtmani ko'rish va yuborish uchun Telegram WebAppni oching.", ru: "Откройте Telegram WebApp, чтобы просматривать и отправлять заказы.", en: "Open the Telegram WebApp to preview and submit orders." },
  "checkout.unauth_description": { uz: "Oldindan ko'rish faqat tasdiqlangan Telegram sessiyasida ishlaydi.", ru: "Предпросмотр доступен только для подтвержденной Telegram-сессии.", en: "Client preview requires a verified Telegram session." },
  "checkout.empty_subtitle": { uz: "Ko'rish uchun hali hech narsa yo'q.", ru: "Пока нечего просматривать.", en: "There is nothing to preview yet." },
  "checkout.empty_description": { uz: "Avval mahsulotlarni savatchaga qo'shing, keyin aniq depozit hisobini shu yerda ko'rasiz.", ru: "Сначала добавьте товары в корзину, затем здесь появится точный расчет депозита.", en: "Add products to the cart first, then return here for exact deposit-aware pricing." },
  "checkout.address_required_subtitle": { uz: "Ko'rishdan oldin yetkazib berish manzili kerak.", ru: "Перед предпросмотром нужен адрес доставки.", en: "Delivery details are required before preview." },
  "checkout.address_required_description": { uz: "Buyurtma ko'rishidan oldin savatcha sahifasida manzil kiriting.", ru: "Перед предпросмотром укажите адрес на странице корзины.", en: "Add a delivery address in the cart page before requesting preview." },
  "checkout.back_to_cart": { uz: "Savatchaga qaytish", ru: "Назад в корзину", en: "Back to cart" },
  "checkout.loading": { uz: "Ko'rish hisoblanmoqda...", ru: "Рассчитываем предпросмотр...", en: "Calculating preview..." },
  "checkout.blocked_title": { uz: "Yangi buyurtma bloklangan", ru: "Новый заказ заблокирован", en: "New order is blocked" },
  "checkout.blocked_description": { uz: "Sizda allaqachon faol buyurtma bor. Yangi buyurtma yaratishdan oldin uni oching.", ru: "У вас уже есть активный заказ. Откройте его перед созданием нового.", en: "You already have an active order. Open it first before creating a new one." },
  "checkout.delivery_pending": { uz: "Yetkazib berish manzili kutilmoqda", ru: "Ожидается адрес доставки", en: "Delivery address pending" },
  "checkout.open_orders": { uz: "Buyurtmalarni ochish", ru: "Открыть заказы", en: "Open orders" },
  "checkout.product_subtotal": { uz: "Mahsulotlar summasi", ru: "Сумма товаров", en: "Product subtotal" },
  "checkout.deposit": { uz: "Idish depoziti", ru: "Депозит за тару", en: "Bottle deposit" },
  "checkout.total_payable": { uz: "Jami to'lov", ru: "Итого к оплате", en: "Total payable" },
  "checkout.coverage_summary": { uz: "Idish qoplama jamlanmasi", ru: "Сводка покрытия тары", en: "Bottle coverage summary" },
  "checkout.outstanding_bottles": { uz: "Qolgan idishlar", ru: "Незакрытые бутылки", en: "Outstanding bottles" },
  "checkout.deposit_held": { uz: "Ushlab turilgan depozit", ru: "Удерживаемый депозит", en: "Deposit held" },
  "checkout.covered_bottles": { uz: "Qoplangan idishlar: {count}", ru: "Покрыто бутылок: {count}", en: "Covered bottles: {count}" },
  "checkout.deposit_charge_qty": { uz: "Depozit olinadigan son: {count}", ru: "Количество с депозитом: {count}", en: "Deposit charge qty: {count}" },
  "checkout.delivery_payment": { uz: "Yetkazib berish va to'lov", ru: "Доставка и оплата", en: "Delivery and payment" },
  "checkout.payment_method": { uz: "To'lov usuli", ru: "Способ оплаты", en: "Payment method" },
  "checkout.requested_delivery": { uz: "So'ralgan yetkazib berish vaqti", ru: "Желаемое время доставки", en: "Requested delivery" },
  "checkout.create_order": { uz: "Buyurtma yaratish", ru: "Создать заказ", en: "Create order" },
  "checkout.creating_order": { uz: "Buyurtma yaratilmoqda...", ru: "Создаем заказ...", en: "Creating order..." },
  "checkout.error_preview": { uz: "Buyurtma ko'rigini yuklab bo'lmadi.", ru: "Не удалось загрузить предпросмотр заказа.", en: "Failed to preview order." },
  "checkout.error_create": { uz: "Buyurtma yaratib bo'lmadi.", ru: "Не удалось создать заказ.", en: "Failed to create order." },

  "orders.title": { uz: "Buyurtmalar", ru: "Заказы", en: "Orders" },
  "orders.subtitle": { uz: "Faqat shu mijozga tegishli /client/webapp/orders/ buyurtmalari.", ru: "Только заказы текущего клиента из /client/webapp/orders/.", en: "Only your client orders from /client/webapp/orders/." },
  "orders.unauth_subtitle": { uz: "Buyurtmalar tarixini ko'rish uchun Telegram WebAppni oching.", ru: "Откройте Telegram WebApp, чтобы увидеть историю заказов.", en: "Open Telegram WebApp to view your order history." },
  "orders.unauth_description": { uz: "Buyurtmalar faqat tasdiqlangan mijoz sessiyasi uchun ochiladi.", ru: "Заказы доступны только для подтвержденных клиентских сессий.", en: "Orders are available only for verified client sessions." },
  "orders.refresh": { uz: "Yangilash", ru: "Обновить", en: "Refresh" },
  "orders.loading": { uz: "Buyurtmalar yuklanmoqda...", ru: "Загрузка заказов...", en: "Loading orders..." },
  "orders.empty": { uz: "Hali buyurtmalar yo'q. Birinchi buyurtmani Mahsulotlar yoki Savatcha orqali yarating.", ru: "Пока нет заказов. Создайте первый заказ через Товары или Корзину.", en: "No orders yet. Create your first order from Products or Cart." },
  "orders.delivery_pending": { uz: "Yetkazib berish manzili kutilmoqda", ru: "Ожидается адрес доставки", en: "Delivery address pending" },
  "orders.selected_order": { uz: "Tanlangan buyurtma", ru: "Выбранный заказ", en: "Selected order" },
  "orders.product_subtotal": { uz: "Mahsulotlar summasi", ru: "Сумма товаров", en: "Product subtotal" },
  "orders.deposit": { uz: "Idish depoziti", ru: "Депозит за тару", en: "Bottle deposit" },
  "orders.payment_method": { uz: "To'lov usuli", ru: "Способ оплаты", en: "Payment method" },
  "orders.deposit_item": { uz: "Depozit {amount}", ru: "Депозит {amount}", en: "Deposit {amount}" },
  "orders.refreshing_details": { uz: "Buyurtma tafsilotlari yangilanmoqda...", ru: "Обновляем детали заказа...", en: "Refreshing order details..." },
  "orders.last_updated": { uz: "Oxirgi yangilanish {value}", ru: "Обновлено {value}", en: "Last updated {value}" },
  "orders.qty": { uz: "Soni {count}", ru: "Кол-во {count}", en: "Qty {count}" },
  "orders.error_load": { uz: "Buyurtmalarni yuklab bo'lmadi.", ru: "Не удалось загрузить заказы.", en: "Failed to load orders." },

  "bottles.title": { uz: "Idishlar", ru: "Тара", en: "Bottles" },
  "bottles.subtitle": { uz: "Idish balansi, ushlab turilgan depozit va harakatlar tarixi faqat oqish rejimida.", ru: "Баланс тары, удерживаемый депозит и история движений доступны только для чтения.", en: "Read-only bottle balance, deposit held, and movement history." },
  "bottles.unauth_subtitle": { uz: "Idish balansini ko'rish uchun Telegram WebAppni oching.", ru: "Откройте Telegram WebApp, чтобы увидеть баланс тары.", en: "Open Telegram WebApp to view bottle balances." },
  "bottles.unauth_description": { uz: "Idish jamlanmasi faqat tasdiqlangan mijoz sessiyasida ochiladi.", ru: "Сводка по таре доступна только для подтвержденной клиентской сессии.", en: "Bottle summary is available only for verified client sessions." },
  "bottles.loading": { uz: "Idish balansi yuklanmoqda...", ru: "Загрузка баланса тары...", en: "Loading bottle balances..." },
  "bottles.outstanding": { uz: "Qolgan idishlar", ru: "Незакрытые бутылки", en: "Outstanding bottles" },
  "bottles.deposit_held": { uz: "Ushlab turilgan depozit", ru: "Удерживаемый депозит", en: "Deposit held" },
  "bottles.total_charged": { uz: "Jami olingan depozit", ru: "Всего начислено", en: "Total charged" },
  "bottles.total_refunded": { uz: "Jami qaytarilgan", ru: "Всего возвращено", en: "Total refunded" },
  "bottles.balances_by_product": { uz: "Mahsulot bo'yicha balans", ru: "Баланс по товару", en: "Balances by product" },
  "bottles.balances_description": { uz: "Har bir mahsulot uchun joriy qaytarma idish qoplovi.", ru: "Текущее покрытие возвратной тары по каждому товару.", en: "Current reusable bottle coverage for each product." },
  "bottles.count_label": { uz: "{count} ta idish", ru: "{count} бут.", en: "{count} bottles" },
  "bottles.no_balances": { uz: "Hozircha idish balansi yo'q.", ru: "Пока нет баланса тары.", en: "No bottle balances yet." },
  "bottles.recent_movements": { uz: "So'nggi harakatlar", ru: "Последние движения", en: "Recent movements" },
  "bottles.no_order_reference": { uz: "Buyurtma bog'lanmagan", ru: "Нет привязки к заказу", en: "No order reference" },
  "bottles.delta_label": { uz: "{count} ta idish", ru: "{count} бут.", en: "{count} bottles" },
  "bottles.balance_transition": { uz: "Balans: {from} -> {to}", ru: "Баланс: {from} -> {to}", en: "Balance: {from} -> {to}" },
  "bottles.deposit_transition": { uz: "Depozit: {from} -> {to}", ru: "Депозит: {from} -> {to}", en: "Deposit: {from} -> {to}" },
  "bottles.no_movements": { uz: "Hozircha idish harakatlari yo'q.", ru: "Пока нет движений тары.", en: "No bottle movements yet." },
  "bottles.error_load": { uz: "Idish balansini yuklab bo'lmadi.", ru: "Не удалось загрузить баланс тары.", en: "Failed to load bottle balances." },

  "profile.title": { uz: "Profil", ru: "Профиль", en: "Profile" },
  "profile.subtitle": { uz: "Telegram identifikatsiyasi, tasdiqlangan mijoz profili va WebApp sessiyasi.", ru: "Идентификация Telegram, подтвержденный профиль клиента и сессия WebApp.", en: "Telegram identity, verified client profile, and WebApp session context." },
  "profile.context_detected": { uz: "Telegram WebApp muhiti aniqlandi.", ru: "Контекст Telegram WebApp обнаружен.", en: "Telegram WebApp context detected." },
  "profile.context_preview": { uz: "Telegram WebApp tashqarisidagi sinov rejimi.", ru: "Режим предпросмотра вне Telegram WebApp.", en: "Preview mode outside Telegram WebApp." },
  "profile.username": { uz: "Username", ru: "Username", en: "Username" },
  "profile.phone": { uz: "Telefon", ru: "Телефон", en: "Phone" },
  "profile.address": { uz: "Manzil", ru: "Адрес", en: "Address" },
  "profile.preferred_language": { uz: "Til", ru: "Язык", en: "Preferred language" },
  "profile.platform_user_id": { uz: "Platforma foydalanuvchi ID", ru: "ID пользователя платформы", en: "Platform user ID" },
  "profile.client_created": { uz: "Bootstrap paytida mijoz yaratildi", ru: "Клиент создан во время bootstrap", en: "Client created on bootstrap" },
  "profile.yes": { uz: "Ha", ru: "Да", en: "Yes" },
  "profile.no": { uz: "Yo'q", ru: "Нет", en: "No" },
  "profile.refreshing": { uz: "Profil yangilanmoqda...", ru: "Профиль обновляется...", en: "Refreshing profile..." },
  "profile.client_session": { uz: "Mijoz sessiyasi", ru: "Клиентская сессия", en: "Client session" },
  "profile.client_session_description": { uz: "Mijoz ilovasi endi /client/webapp/bootstrap/ va qaytgan bearer token orqali ishlaydi. Bu yerda admin /internal/... APIlari ishlatilmaydi.", ru: "Клиентское приложение теперь использует /client/webapp/bootstrap/ и возвращенный bearer token. Админские /internal/... API здесь не используются.", en: "The client app now uses /client/webapp/bootstrap/ and the returned bearer token for all WebApp requests. Admin /internal/... APIs are not used here." },
  "profile.api_base": { uz: "API manzil", ru: "API база", en: "API base" },
  "profile.token_expires_at": { uz: "Token amal qilish muddati", ru: "Срок действия токена", en: "Token expires at" },
  "profile.initdata_missing": { uz: "Telegram initData sinov rejimida mavjud emas.", ru: "Telegram initData недоступен в режиме предпросмотра.", en: "Telegram initData is not available in preview mode." },
  "profile.error_load": { uz: "Profilni yuklab bo'lmadi.", ru: "Не удалось загрузить профиль.", en: "Failed to load profile." },

  "payment.CASH": { uz: "Naqd pul", ru: "Наличные", en: "Cash" },
  "payment.TRANSFER": { uz: "O'tkazma", ru: "Перевод", en: "Transfer" },
  "payment.UNKNOWN": { uz: "Noma'lum", ru: "Неизвестно", en: "Unknown" },

  "language.uz": { uz: "O'zbekcha", ru: "Узбекский", en: "Uzbek" },
  "language.ru": { uz: "Ruscha", ru: "Русский", en: "Russian" },
  "language.en": { uz: "Inglizcha", ru: "Английский", en: "English" },
};

const localeMap: Record<ClientUiLanguage, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
};

const normalizeClientLanguage = (value?: string | null): ClientUiLanguage => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized.startsWith('ru')) return 'ru';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('uz')) return 'uz';
  return 'uz';
};

const interpolate = (template: string, params?: TranslationParams) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''));
};

interface ClientLanguageContextValue {
  language: ClientUiLanguage;
  locale: string;
  t: (key: string, params?: TranslationParams) => string;
}

const ClientLanguageContext = React.createContext<ClientLanguageContextValue | undefined>(undefined);

export const ClientLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { client, telegramUser } = useClientApp();

  const language = React.useMemo(() => normalizeClientLanguage(client?.preferred_language || telegramUser?.language_code || 'uz'), [client?.preferred_language, telegramUser?.language_code]);

  const value = React.useMemo<ClientLanguageContextValue>(() => ({
    language,
    locale: localeMap[language],
    t: (key, params) => {
      const template = translations[key]?.[language] || translations[key]?.uz || key;
      return interpolate(template, params);
    },
  }), [language]);

  return <ClientLanguageContext.Provider value={value}>{children}</ClientLanguageContext.Provider>;
};

export const useClientLanguage = () => {
  const context = React.useContext(ClientLanguageContext);
  if (!context) {
    throw new Error('useClientLanguage must be used within ClientLanguageProvider.');
  }
  return context;
};
