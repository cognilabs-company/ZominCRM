import React from 'react';
import { useClientApp } from './ClientAppContext';
import { ClientUiLanguage } from '../types';

type TranslationParams = Record<string, string | number>;

type TranslationMap = Record<string, Record<ClientUiLanguage, string>>;

const translations: TranslationMap = {
  "nav.home": { uz: "Bosh sahifa", ru: "???????", en: "Home" },
  "nav.products": { uz: "Mahsulotlar", ru: "??????", en: "Products" },
  "nav.cart": { uz: "Savatcha", ru: "???????", en: "Cart" },
  "nav.checkout": { uz: "Buyurtma", ru: "??????????", en: "Checkout" },
  "nav.preview": { uz: "Ko\'rish", ru: "????????", en: "Preview" },
  "nav.orders": { uz: "Buyurtmalar", ru: "??????", en: "Orders" },
  "nav.bottles": { uz: "Idishlar", ru: "??????", en: "Bottles" },
  "nav.profile": { uz: "Profil", ru: "???????", en: "Profile" },

  "layout.badge": { uz: "Mijoz sahifasi", ru: "???????? ???????", en: "Client page" },
  "layout.title": { uz: "Zomin Suv", ru: "Zomin Suv", en: "Zomin Water" },
  "layout.telegram_verified": { uz: "Buyurtma berish uchun sahifa tayyor.", ru: "Страница заказа готова.", en: "Your order page is ready." },
  "layout.preview_shell": { uz: "To\'liq foydalanish uchun Telegram ichida oching.", ru: "Откройте внутри Telegram для полного доступа.", en: "Open inside Telegram for full access." },
  "layout.refresh_title": { uz: "Yangilash", ru: "????????", en: "Refresh" },
  "layout.mode": { uz: "Rejim", ru: "?????", en: "Mode" },
  "layout.session": { uz: "Sessiya", ru: "??????", en: "Session" },
  "layout.deposit_held": { uz: "Ushlab turilgan depozit", ru: "Депозит удержан", en: "Deposit held" },
  "layout.active_session": { uz: "Faol sessiya", ru: "Активная сессия", en: "Active session" },
  "layout.telegram_detected": { uz: "Telegram orqali ochildi.", ru: "Открыт через Telegram.", en: "Opened through Telegram." },
  "layout.telegram_missing": { uz: "To\'liq ishlashi uchun Telegram ichida oching.", ru: "Откройте в Telegram для полного доступа.", en: "Open in Telegram for full access." },
  "layout.profile": { uz: "Profil", ru: "???????", en: "Profile" },
  "layout.language_label": { uz: "Til", ru: "????", en: "Language" },
  "layout.active_order": { uz: "Faol buyurtma", ru: "Активный заказ", en: "Active order" },
  "layout.awaiting_delivery": { uz: "Yetkazib berish manzili kutilmoqda", ru: "Ждем подробностей о доставке", en: "Awaiting delivery details" },
  "layout.session_valid_until": { uz: "Sessiya amal qilish muddati:", ru: "Сессия действительна до", en: "Session valid until" },
  "layout.mode.telegram": { uz: "telegram", ru: "telegram", en: "telegram" },
  "layout.mode.preview": { uz: "sinov", ru: "????????????", en: "preview" },
  "layout.status.loading": { uz: "yuklanmoqda", ru: "????????", en: "loading" },
  "layout.status.ready": { uz: "tayyor", ru: "??????", en: "ready" },
  "layout.status.error": { uz: "xato", ru: "??????", en: "error" },
  "layout.telegram_client": { uz: "Telegram mijozi", ru: "Телеграм клиент", en: "Telegram client" },

  "home.title": { uz: "Bosh sahifa", ru: "Дом", en: "Home" },
  "home.subtitle": { uz: "Buyurtma qilish, mahsulotlarni ko\'rish va holatni kuzatish uchun qulay sahifa.", ru: "Простое место для заказа воды, просмотра продуктов и отслеживания статуса.", en: "A simple place to order water, browse products, and track status." },
  "home.open_in_telegram": { uz: "Buni Telegram ichida oching", ru: "Откройте это внутри Telegram", en: "Open this inside Telegram" },
  "home.open_in_telegram_cta": { uz: "Telegramda ochish", ru: "??????? ? Telegram", en: "Open in Telegram" },
  "home.preview_mode": { uz: "To\'liq foydalanish uchun ilovani Telegram ichida oching.", ru: "Откройте приложение внутри Telegram, чтобы использовать все.", en: "Open the app inside Telegram to use everything." },
  "home.verifying": { uz: "Ma\'lumotlar tayyorlanmoqda.", ru: "Подготовка ваших данных.", en: "Preparing your data." },
  "home.cart_items": { uz: "Savatchadagi mahsulotlar", ru: "Товары в корзине", en: "Cart items" },
  "home.product_subtotal": { uz: "Mahsulotlar summasi", ru: "Итого по продукту", en: "Product subtotal" },
  "home.bottle_balance": { uz: "Idish balansi", ru: "Баланс бутылки", en: "Bottle balance" },
  "home.session": { uz: "Sessiya", ru: "Сессия", en: "Session" },
  "home.current_active_order": { uz: "Joriy faol buyurtma", ru: "Текущий активный ордер", en: "Current active order" },
  "home.delivery_placeholder": { uz: "Yetkazib berish manzili shu yerda ko\'rinadi.", ru: "Здесь появится адрес доставки.", en: "Delivery address will appear here." },
  "home.open_orders": { uz: "Buyurtmalarni ochish", ru: "Открытые ордера", en: "Open orders" },
  "home.quick.products.title": { uz: "Mahsulotlarni ko\'rish", ru: "Обзор продуктов", en: "Browse products" },
  "home.quick.products.description": { uz: "Barcha suv mahsulotlari va narxlarini ko\'ring.", ru: "Посмотреть все товары и цены в одном месте.", en: "See all products and prices in one place." },
  "home.quick.cart.title": { uz: "Buyurtmani davom ettirish", ru: "Продолжить заказ", en: "Continue order" },
  "home.quick.cart.description": { uz: "Savatchani tekshirib, manzilni tanlang va davom eting.", ru: "Просмотрите корзину, выберите адрес и продолжайте.", en: "Review your cart, choose the address, and continue." },
  "home.quick.orders.title": { uz: "Mening buyurtmalarim", ru: "Мои заказы", en: "My orders" },
  "home.quick.orders.description": { uz: "Eski va joriy buyurtmalaringizni shu yerda ko\'ring.", ru: "Здесь вы можете просмотреть свои текущие и предыдущие заказы.", en: "View your current and previous orders here." },
  "home.quick.bottles.title": { uz: "Idish balansi", ru: "Баланс бутылки", en: "Bottle balance" },
  "home.quick.bottles.description": { uz: "Qaytariladigan idishlar va depozit holatini kuzating.", ru: "Отслеживайте возвратные бутылки и баланс депозита.", en: "Track returnable bottles and deposit balance." },
  "home.checkout_flow": { uz: "Mahsulot tanlang, savatchani tekshiring va buyurtmani yuboring.", ru: "Выберите товары, просмотрите корзину и оформите заказ.", en: "Pick products, review your cart, and place the order." },
  "home.checkout_flow_title": { uz: "Buyurtma oqimi", ru: "Порядок оформления заказа", en: "Checkout flow" },

  "products.title": { uz: "Mahsulotlar", ru: "Продукты", en: "Products" },
  "products.subtitle": { uz: "Siz uchun mavjud mahsulotlar va narxlar.", ru: "Доступные товары и цены для вас.", en: "Available products and prices for you." },
  "products.unauth_subtitle": { uz: "Mahsulotlarni ko\'rish uchun Telegram ichida oching.", ru: "Откройте Telegram, чтобы просмотреть продукты.", en: "Open inside Telegram to view products." },
  "products.unauth_description": { uz: "Mahsulotlarni ko\'rish uchun ilovani Telegram ichida oching.", ru: "Откройте приложение в Telegram, чтобы просмотреть продукты.", en: "Open the app inside Telegram to view products." },
  "products.cart": { uz: "Savatcha", ru: "Корзина", en: "Cart" },
  "products.loading": { uz: "Mahsulotlar yuklanmoqda...", ru: "Загрузка товаров...", en: "Loading products..." },
  "products.empty": { uz: "Hozircha faol mahsulotlar mavjud emas.", ru: "На данный момент активных продуктов нет.", en: "No active products are available right now." },
  "products.error_load": { uz: "Mahsulotlarni yuklab bo\'lmadi.", ru: "Не удалось загрузить товары.", en: "Failed to load products." },
  "products.price": { uz: "Narx", ru: "Цена", en: "Price" },
  "products.deposit": { uz: "Idish depoziti", ru: "Залог за бутылку", en: "Bottle deposit" },
  "products.no_deposit": { uz: "Depozit yo\'q", ru: "Без депозита", en: "No deposit" },
  "products.available_count": { uz: "Mavjud son: {count}", ru: "Доступное количество: {count}", en: "Available count: {count}" },
  "products.add": { uz: "Qo\'shish", ru: "Добавлять", en: "Add" },
  "products.cart_ready": { uz: "Savatchada mahsulot bor", ru: "В корзине есть товары", en: "Cart has items" },
  "products.open_cart": { uz: "Savatchani ochish", ru: "Открыть корзину", en: "Open cart" },
  "products.photo_none": { uz: "Rasm yo\'q", ru: "Нет фото", en: "No photo" },
  "products.photo_badge_ready": { uz: "Tayyor", ru: "Готовый", en: "Ready" },
  "products.photo_badge_new": { uz: "Yangi", ru: "Новый", en: "New" },
  "products.photo_badge_gallery": { uz: "{count} foto", ru: "{count} картинки", en: "{count} pics" },
  "products.photo_status_ready": { uz: "Mahsulot rasmi tayyor", ru: "Фото товара готово.", en: "Product photo ready" },
  "products.photo_status_empty": { uz: "Rasm shu yerda ko\'rinadi", ru: "Фотография появится здесь", en: "Photo will appear here" },
  "products.photo_status_gallery": { uz: "{count} ta galereya rasmi", ru: "{count} галерея фотографий", en: "{count} gallery photos" },
  "products.gallery_hint": { uz: "Galereyani aylantiring", ru: "Просмотреть галерею", en: "Browse the gallery" },
  "products.gallery_position": { uz: "{current}/{total} rasm", ru: "Фотографии {current}/{total}", en: "{current}/{total} photos" },

  "cart.title": { uz: "Savatcha", ru: "Корзина", en: "Cart" },
  "cart.subtitle": { uz: "Mahsulotlarni tekshiring, manzilni tanlang va davom eting.", ru: "Просмотрите свои товары, выберите адрес и продолжайте.", en: "Review your items, choose the address, and continue." },
  "cart.preview": { uz: "Davom etish", ru: "Продолжать", en: "Continue" },
  "cart.empty": { uz: "Savatcha hozircha bo\'sh. Avval mahsulot qo\'shing.", ru: "Ваша корзина пуста. Сначала добавьте товары.", en: "Your cart is empty. Add products first." },
  "cart.unit_price": { uz: "Dona narxi", ru: "Цена за единицу товара", en: "Unit price" },
  "cart.remove": { uz: "Olib tashlash", ru: "Удалять", en: "Remove" },
  "cart.line_total": { uz: "Jami", ru: "Итого по строке", en: "Line total" },
  "cart.delivery_address": { uz: "Yetkazib berish manzili", ru: "Адрес доставки", en: "Delivery address" },
  "cart.delivery_address_placeholder": { uz: "Mahalla, ko\'cha, uy raqamini yozing", ru: "Введите район, улицу и номер дома", en: "Enter area, street, and house number" },
  "cart.map_picker": { uz: "Xaritadan tanlash", ru: "Выбрать на карте", en: "Choose on map" },
  "cart.map_description": { uz: "Xaritadan yetkazib berish manzilini tanlang.", ru: "Выберите адрес доставки на карте.", en: "Choose the delivery address on the map." },
  "cart.map_open": { uz: "Xaritani ochish", ru: "Открыть карту", en: "Open map" },
  "cart.map_close": { uz: "Yopish", ru: "Закрывать", en: "Close" },
  "cart.map_use_current": { uz: "Joriy joylashuv", ru: "Использовать текущее местоположение", en: "Use current location" },
  "cart.map_select_hint": { uz: "Pinni qo\'yish uchun xaritada bosing.", ru: "Коснитесь карты, чтобы разместить отметку.", en: "Tap the map to place the pin." },
  "cart.map_confirm": { uz: "Shu joyni tanlash", ru: "Выберите это место", en: "Choose this spot" },
  "cart.map_selected_coords": { uz: "Tanlangan nuqta: {lat}, {lng}", ru: "Выбранная точка: {lat}, {lng}", en: "Selected point: {lat}, {lng}" },
  "cart.map_loading_address": { uz: "Manzil aniqlanmoqda...", ru: "Разрешение адреса...", en: "Resolving address..." },
  "cart.map_geolocation_error": { uz: "Joriy joylashuvni topib bo\'lmadi.", ru: "Не удалось получить текущее местоположение.", en: "Could not get current location." },
  "cart.map_reverse_error": { uz: "Aniq manzil topilmadi, lekin tanlangan nuqta saqlandi.", ru: "Точный адрес не найден, но выбранная точка сохранена.", en: "Exact address was not found, but the selected point was saved." },
  "cart.map_selected_title": { uz: "Tanlangan joy", ru: "Выбранное местоположение", en: "Selected location" },
  "cart.map_selected_empty": { uz: "Xaritadan joy tanlang yoki manzilni yozing.", ru: "Выберите точку на карте или введите адрес.", en: "Choose a point on the map or enter the address." },
  "cart.payment_method": { uz: "To\'lov usuli", ru: "Способ оплаты", en: "Payment method" },
  "cart.delivery_time": { uz: "Yetkazib berish vaqti", ru: "Срок поставки", en: "Delivery time" },
  "cart.latitude": { uz: "Kenglik", ru: "Широта", en: "Latitude" },
  "cart.longitude": { uz: "Uzunlik", ru: "Долгота", en: "Longitude" },
  "cart.optional": { uz: "Ixtiyoriy", ru: "Необязательный", en: "Optional" },
  "cart.items": { uz: "Mahsulotlar", ru: "Предметы", en: "Items" },
  "cart.deposit_preview": { uz: "Keyingi bosqichda chiqadi", ru: "Показано на следующем шаге", en: "Shown on the next step" },
  "cart.ready_title": { uz: "Buyurtma tayyor", ru: "Заказ готов", en: "Order is ready" },
  "cart.ready_description": { uz: "Hammasi tayyor. Keyingi bosqichda jami narxni ko\'rasiz.", ru: "Все готово. На следующем шаге вы увидите общую сумму.", en: "Everything is ready. You will see the total on the next step." },
  "cart.continue_checkout": { uz: "Buyurtmani davom ettirish", ru: "Продолжить заказ", en: "Continue order" },

  "checkout.title": { uz: "Buyurtmani tasdiqlash", ru: "Подтвердить заказ", en: "Confirm order" },
  "checkout.subtitle": { uz: "Buyurtmani yuborishdan oldin jami narx va manzilni tekshiring.", ru: "Перед отправкой заказа проверьте сумму и адрес.", en: "Check the total and address before sending the order." },
  "checkout.unauth_subtitle": { uz: "Buyurtma yuborish uchun Telegram ichida oching.", ru: "Откройте Telegram, чтобы разместить заказ.", en: "Open inside Telegram to place the order." },
  "checkout.unauth_description": { uz: "Buyurtma yuborish faqat Telegram ichida ishlaydi.", ru: "Отправка заказа работает только внутри Telegram.", en: "Order submission works only inside Telegram." },
  "checkout.empty_subtitle": { uz: "Hali mahsulot tanlanmagan.", ru: "Товары еще не выбраны.", en: "No products selected yet." },
  "checkout.empty_description": { uz: "Avval mahsulotlarni savatchaga qo\'shing.", ru: "Сначала добавьте товары в корзину.", en: "Add products to the cart first." },
  "checkout.address_required_subtitle": { uz: "Avval manzilni tanlang.", ru: "Сначала выберите адрес.", en: "Choose the address first." },
  "checkout.address_required_description": { uz: "Savatcha sahifasida manzilni kiriting yoki xaritadan tanlang.", ru: "Введите адрес или выберите его на карте со страницы корзины.", en: "Enter the address or choose it on the map from the cart page." },
  "checkout.back_to_cart": { uz: "Savatchaga qaytish", ru: "Вернуться в корзину", en: "Back to cart" },
  "checkout.loading": { uz: "Buyurtma ma\'lumotlari tayyorlanmoqda...", ru: "Подготовка деталей заказа...", en: "Preparing order details..." },
  "checkout.blocked_title": { uz: "Yangi buyurtma bloklangan", ru: "Новый заказ заблокирован", en: "New order is blocked" },
  "checkout.blocked_description": { uz: "Sizda allaqachon faol buyurtma bor. Yangi buyurtma yaratishdan oldin uni oching.", ru: "У вас уже есть активный заказ. Сначала откройте его, прежде чем создавать новый.", en: "You already have an active order. Open it first before creating a new one." },
  "checkout.delivery_pending": { uz: "Yetkazib berish manzili kutilmoqda", ru: "Адрес доставки ожидается", en: "Delivery address pending" },
  "checkout.open_orders": { uz: "Buyurtmalarni ochish", ru: "Открытые ордера", en: "Open orders" },
  "checkout.product_subtotal": { uz: "Mahsulotlar summasi", ru: "Итого по продукту", en: "Product subtotal" },
  "checkout.deposit": { uz: "Idish depoziti", ru: "Залог за бутылку", en: "Bottle deposit" },
  "checkout.total_payable": { uz: "Jami to\'lov", ru: "Итого к оплате", en: "Total payable" },
  "checkout.coverage_summary": { uz: "Idish qoplama jamlanmasi", ru: "Сводная информация по покрытию бутылок", en: "Bottle coverage summary" },
  "checkout.outstanding_bottles": { uz: "Qolgan idishlar", ru: "Выдающиеся бутылки", en: "Outstanding bottles" },
  "checkout.deposit_held": { uz: "Ushlab turilgan depozit", ru: "Депозит удержан", en: "Deposit held" },
  "checkout.covered_bottles": { uz: "Qoplangan idishlar: {count}", ru: "Бутылки с крышкой: {count}", en: "Covered bottles: {count}" },
  "checkout.deposit_charge_qty": { uz: "Depozit olinadigan son: {count}", ru: "Количество залога: {count}", en: "Deposit charge qty: {count}" },
  "checkout.delivery_payment": { uz: "Yetkazib berish va to\'lov", ru: "Доставка и оплата", en: "Delivery and payment" },
  "checkout.payment_method": { uz: "To\'lov usuli", ru: "Способ оплаты", en: "Payment method" },
  "checkout.requested_delivery": { uz: "So\'ralgan yetkazib berish vaqti", ru: "Запрошенная доставка", en: "Requested delivery" },
  "checkout.create_order": { uz: "Buyurtmani yuborish", ru: "Разместить заказ", en: "Place order" },
  "checkout.creating_order": { uz: "Buyurtma yuborilmoqda...", ru: "Размещение заказа...", en: "Placing order..." },
  "checkout.error_preview": { uz: "Buyurtma ma\'lumotlarini ochib bo\'lmadi.", ru: "Не удалось загрузить сведения о заказе.", en: "Failed to load order details." },
  "checkout.error_create": { uz: "Buyurtma yaratib bo\'lmadi.", ru: "Не удалось создать заказ.", en: "Failed to create order." },

  "orders.title": { uz: "Buyurtmalar", ru: "Заказы", en: "Orders" },
  "orders.subtitle": { uz: "Joriy va oldingi buyurtmalaringiz shu yerda.", ru: "Здесь находятся ваши текущие и предыдущие заказы.", en: "Your current and previous orders are here." },
  "orders.unauth_subtitle": { uz: "Buyurtmalar tarixini ko\'rish uchun Telegram WebAppni oching.", ru: "Откройте веб-приложение Telegram, чтобы просмотреть историю своих заказов.", en: "Open Telegram WebApp to view your order history." },
  "orders.unauth_description": { uz: "Buyurtmalar faqat tasdiqlangan mijoz sessiyasi uchun ochiladi.", ru: "Заказы доступны только для проверенных клиентских сессий.", en: "Orders are available only for verified client sessions." },
  "orders.refresh": { uz: "Yangilash", ru: "Обновить", en: "Refresh" },
  "orders.loading": { uz: "Buyurtmalar yuklanmoqda...", ru: "Загрузка заказов...", en: "Loading orders..." },
  "orders.empty": { uz: "Hali buyurtmalar yo\'q. Birinchi buyurtmani Mahsulotlar yoki Savatcha orqali yarating.", ru: "Заказов пока нет. Создайте свой первый заказ из продуктов или корзины.", en: "No orders yet. Create your first order from Products or Cart." },
  "orders.delivery_pending": { uz: "Yetkazib berish manzili kutilmoqda", ru: "Адрес доставки ожидается", en: "Delivery address pending" },
  "orders.selected_order": { uz: "Tanlangan buyurtma", ru: "Выбранный заказ", en: "Selected order" },
  "orders.product_subtotal": { uz: "Mahsulotlar summasi", ru: "Итого по продукту", en: "Product subtotal" },
  "orders.deposit": { uz: "Idish depoziti", ru: "Залог за бутылку", en: "Bottle deposit" },
  "orders.payment_method": { uz: "To\'lov usuli", ru: "Способ оплаты", en: "Payment method" },
  "orders.deposit_item": { uz: "Depozit {amount}", ru: "Депозит {amount}", en: "Deposit {amount}" },
  "orders.refreshing_details": { uz: "Buyurtma tafsilotlari yangilanmoqda...", ru: "Обновление сведений о заказе...", en: "Refreshing order details..." },
  "orders.last_updated": { uz: "Oxirgi yangilanish {value}", ru: "Последнее обновление {value}", en: "Last updated {value}" },
  "orders.qty": { uz: "Soni {count}", ru: "Кол-во {count}", en: "Qty {count}" },
  "orders.error_load": { uz: "Buyurtmalarni yuklab bo\'lmadi.", ru: "Не удалось загрузить заказы.", en: "Failed to load orders." },
  "orders.open_detail": { uz: "Tafsilotlar", ru: "Подробности", en: "Details" },
  "orders.detail.title": { uz: "Buyurtma tafsiloti", ru: "Детали заказа", en: "Order detail" },
  "orders.detail.subtitle": { uz: "Buyurtmaning to\'liq tarkibi, holati va to\'lov havolalari.", ru: "Полное содержание заказа, статус и ссылки для оплаты.", en: "Full order contents, status, and payment links." },
  "orders.detail.back": { uz: "Buyurtmalarga qaytish", ru: "Вернуться к заказам", en: "Back to orders" },
  "orders.detail.reference": { uz: "Buyurtma raqami", ru: "Номер заказа", en: "Order reference" },
  "orders.detail.created_at": { uz: "Yaratilgan vaqt", ru: "Создано в", en: "Created at" },
  "orders.detail.delivery_time": { uz: "So\'ralgan yetkazish vaqti", ru: "Запрошенная доставка", en: "Requested delivery" },
  "orders.detail.items_title": { uz: "Buyurtma tarkibi", ru: "Заказать товары", en: "Order items" },
  "orders.detail.items_subtitle": { uz: "Faqat shu mijozga tegishli satrlar ko\'rsatiladi.", ru: "Показаны только позиции, относящиеся к этому заказу клиента.", en: "Only items that belong to this client order are shown." },
  "orders.detail.error_title": { uz: "Buyurtma yuklanmadi", ru: "Не удалось загрузить заказ", en: "Order failed to load" },
  "orders.detail.error_load": { uz: "Buyurtma tafsilotlarini yuklab bo\'lmadi.", ru: "Не удалось загрузить детали заказа.", en: "Failed to load order detail." },
  "orders.detail.empty_title": { uz: "Buyurtma topilmadi", ru: "Заказ не найден", en: "Order not found" },
  "orders.detail.empty_description": { uz: "Bu buyurtma mavjud emas yoki shu mijozga tegishli emas.", ru: "Этот заказ не существует или не принадлежит текущему клиенту.", en: "This order does not exist or does not belong to the current client." },
  "orders.payment.title": { uz: "Onlayn to\'lov havolalari", ru: "Ссылки для онлайн-оплаты", en: "Online payment links" },
  "orders.payment.subtitle": { uz: "Payme va Click orqali to\'lov uchun havolalar.", ru: "Платежные ссылки для Payme и Click.", en: "Payment links for Payme and Click." },
  "orders.payment.load": { uz: "To\'lov havolalarini olish", ru: "Загрузить ссылки для оплаты", en: "Load payment links" },
  "orders.payment.refresh": { uz: "Havolalarni yangilash", ru: "Обновить ссылки", en: "Refresh links" },
  "orders.payment.loading": { uz: "Havolalar yuklanmoqda...", ru: "Загрузка ссылок...", en: "Loading links..." },
  "orders.payment.error_title": { uz: "To\'lov havolalari yuklanmadi", ru: "Ссылки на оплату не удалось загрузить.", en: "Payment links failed to load" },
  "orders.payment.error_load": { uz: "To\'lov havolalarini yuklab bo\'lmadi.", ru: "Не удалось загрузить ссылки для оплаты.", en: "Failed to load payment links." },
  "orders.payment.expires_at": { uz: "Amal qiladi", ru: "Действительно до", en: "Valid until" },
  "orders.payment.open_provider": { uz: "{provider} ni ochish", ru: "Открыть {provider}", en: "Open {provider}" },
  "orders.payment.window_title": { uz: "To\'lov oynasi", ru: "Окно оплаты", en: "Payment window" },
  "orders.payment.window_range": { uz: "Boshlanish: {start}. Tugash: {end}.", ru: "Начало: {start}. Конец: {end}.", en: "Start: {start}. End: {end}." },
  "orders.payment.window_status": { uz: "Holat: {status}", ru: "Статус: {status}", en: "Status: {status}" },

  "bottles.title": { uz: "Idishlar", ru: "Бутылки", en: "Bottles" },
  "bottles.subtitle": { uz: "Idish balansi, ushlab turilgan depozit va harakatlar tarixi faqat oqish rejimida.", ru: "Доступны только для чтения баланс бутылки, удерживаемый депозит и история движения.", en: "Read-only bottle balance, deposit held, and movement history." },
  "bottles.unauth_subtitle": { uz: "Idish balansini ko\'rish uchun Telegram WebAppni oching.", ru: "Откройте веб-приложение Telegram, чтобы просмотреть остатки бутылок.", en: "Open Telegram WebApp to view bottle balances." },
  "bottles.unauth_description": { uz: "Idish jamlanmasi faqat tasdiqlangan mijoz sessiyasida ochiladi.", ru: "Сводная информация по бутылкам доступна только для подтвержденных клиентских сеансов.", en: "Bottle summary is available only for verified client sessions." },
  "bottles.loading": { uz: "Idish balansi yuklanmoqda...", ru: "Загрузка остатков бутылок...", en: "Loading bottle balances..." },
  "bottles.outstanding": { uz: "Qolgan idishlar", ru: "Выдающиеся бутылки", en: "Outstanding bottles" },
  "bottles.deposit_held": { uz: "Ushlab turilgan depozit", ru: "Депозит удержан", en: "Deposit held" },
  "bottles.total_charged": { uz: "Jami olingan depozit", ru: "Всего списано", en: "Total charged" },
  "bottles.total_refunded": { uz: "Jami qaytarilgan", ru: "Всего возвращено", en: "Total refunded" },
  "bottles.balances_by_product": { uz: "Mahsulot bo\'yicha balans", ru: "Остатки по продуктам", en: "Balances by product" },
  "bottles.balances_description": { uz: "Har bir mahsulot uchun joriy qaytarma idish qoplovi.", ru: "Текущее покрытие многоразовых бутылок для каждого продукта.", en: "Current reusable bottle coverage for each product." },
  "bottles.count_label": { uz: "{count} ta idish", ru: "{count} бутылки", en: "{count} bottles" },
  "bottles.no_balances": { uz: "Hozircha idish balansi yo\'q.", ru: "Баллонов пока нет.", en: "No bottle balances yet." },
  "bottles.recent_movements": { uz: "So\'nggi harakatlar", ru: "Недавние движения", en: "Recent movements" },
  "bottles.no_order_reference": { uz: "Buyurtma bog\'lanmagan", ru: "Нет ссылки на заказ", en: "No order reference" },
  "bottles.delta_label": { uz: "{count} ta idish", ru: "{count} бутылки", en: "{count} bottles" },
  "bottles.balance_transition": { uz: "Balans: {from} -> {to}", ru: "Баланс: {from} -> {to}", en: "Balance: {from} -> {to}" },
  "bottles.deposit_transition": { uz: "Depozit: {from} -> {to}", ru: "Депозит: {from} -> {to}", en: "Deposit: {from} -> {to}" },
  "bottles.no_movements": { uz: "Hozircha idish harakatlari yo\'q.", ru: "Никаких движений бутылки пока нет.", en: "No bottle movements yet." },
  "bottles.error_load": { uz: "Idish balansini yuklab bo\'lmadi.", ru: "Не удалось загрузить остатки бутылей.", en: "Failed to load bottle balances." },

  "profile.title": { uz: "Profil", ru: "Профиль", en: "Profile" },
  "profile.subtitle": { uz: "Shaxsiy ma\'lumotlar va aloqa holati.", ru: "Личные данные и статус контакта.", en: "Personal details and contact status." },
  "profile.context_detected": { uz: "Telegram WebApp muhiti aniqlandi.", ru: "Обнаружен контекст Telegram WebApp.", en: "Telegram WebApp context detected." },
  "profile.context_preview": { uz: "Telegram WebApp tashqarisidagi sinov rejimi.", ru: "Режим предварительного просмотра вне Telegram WebApp.", en: "Preview mode outside Telegram WebApp." },
  "profile.username": { uz: "Username", ru: "Имя пользователя", en: "Username" },
  "profile.phone": { uz: "Telefon", ru: "Телефон", en: "Phone" },
  "profile.address": { uz: "Manzil", ru: "Адрес", en: "Address" },
  "profile.preferred_language": { uz: "Til", ru: "Предпочитаемый язык", en: "Preferred language" },
  "profile.platform_user_id": { uz: "Platforma foydalanuvchi ID", ru: "Идентификатор пользователя платформы", en: "Platform user ID" },
  "profile.client_created": { uz: "Bootstrap paytida mijoz yaratildi", ru: "Клиент создан при начальной загрузке", en: "Client created on bootstrap" },
  "profile.yes": { uz: "Ha", ru: "Да", en: "Yes" },
  "profile.no": { uz: "Yo\'q", ru: "Нет", en: "No" },
  "profile.refreshing": { uz: "Profil yangilanmoqda...", ru: "Обновление профиля...", en: "Refreshing profile..." },
  "profile.client_session": { uz: "Mijoz sessiyasi", ru: "Клиентская сессия", en: "Client session" },
  "profile.client_session_description": { uz: "Bu bo\'limda profilingiz va joriy ilova holati ko\'rsatiladi.", ru: "В этом разделе показан ваш профиль и текущий статус приложения.", en: "This section shows your profile and current app status." },
  "profile.api_base": { uz: "API manzil", ru: "База API", en: "API base" },
  "profile.token_expires_at": { uz: "Token amal qilish muddati", ru: "Срок действия токена истекает в", en: "Token expires at" },
  "profile.initdata_missing": { uz: "Telegram initData sinov rejimida mavjud emas.", ru: "Telegram initData недоступен в режиме предварительного просмотра.", en: "Telegram initData is not available in preview mode." },
  "profile.error_load": { uz: "Profilni yuklab bo\'lmadi.", ru: "Не удалось загрузить профиль.", en: "Failed to load profile." },
  "profile.has_phone": { uz: "Telefon mavjud", ru: "Телефон в файле", en: "Phone on file" },
  "profile.identity_verified": { uz: "Platforma identifikatsiyasi tasdiqlangan", ru: "Идентичность платформы подтверждена", en: "Platform identity verified" },
  "profile.can_receive_telegram": { uz: "Telegram qabul qila oladi", ru: "Можно получить Telegram", en: "Can receive Telegram" },
  "profile.session_status": { uz: "Sessiya holati", ru: "Статус сеанса", en: "Session status" },
  "profile.telegram_language": { uz: "Telegram tili", ru: "Язык телеграммы", en: "Telegram language" },
  "profile.platform": { uz: "Platforma", ru: "Платформа", en: "Platform" },

  "payment.CASH": { uz: "Naqd pul", ru: "Наличные", en: "Cash" },
  "payment.TRANSFER": { uz: "O\'tkazma", ru: "Передача", en: "Transfer" },
  "payment.UNKNOWN": { uz: "Noma\'lum", ru: "Неизвестный", en: "Unknown" },

  "language.uz": { uz: "O\'zbekcha", ru: "Узбекский", en: "Uzbek" },
  "language.ru": { uz: "Ruscha", ru: "Русский", en: "Russian" },
  "language.en": { uz: "Inglizcha", ru: "Английский", en: "English" },
  "common.error_title": { uz: "Xatolik yuz berdi", ru: "Что-то пошло не так", en: "Something went wrong" },
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
  setLanguage: (language: ClientUiLanguage) => void;
  t: (key: string, params?: TranslationParams) => string;
}

const ClientLanguageContext = React.createContext<ClientLanguageContextValue | undefined>(undefined);
const CLIENT_LANGUAGE_OVERRIDE_KEY = 'client_webapp_language_override_v1';

export const ClientLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { client, telegramUser } = useClientApp();
  const [languageOverride, setLanguageOverride] = React.useState<ClientUiLanguage | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = window.localStorage.getItem(CLIENT_LANGUAGE_OVERRIDE_KEY);
    return saved ? normalizeClientLanguage(saved) : null;
  });

  const language = React.useMemo(
    () => languageOverride || normalizeClientLanguage(client?.preferred_language || telegramUser?.language_code || 'uz'),
    [client?.preferred_language, languageOverride, telegramUser?.language_code]
  );

  const value = React.useMemo<ClientLanguageContextValue>(() => ({
    language,
    locale: localeMap[language],
    setLanguage: (nextLanguage) => {
      setLanguageOverride(nextLanguage);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CLIENT_LANGUAGE_OVERRIDE_KEY, nextLanguage);
      }
    },
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
