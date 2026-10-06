import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      loading: 'Loading...',
      back: 'Back',
      home: 'Home',
      events: 'Events',
      brands: 'Brands',
      users: 'User Manager',
      login: 'Login',
      profile: 'Profile',
      registerForEvent: 'Register for Event',
      unregisterFromEvent: 'Unregister from Event',
      loginToRegister: 'Login to Register',
      attendingBrands: 'Attending Brands',
      eventLayouts: 'Event Layouts',
      allEvents: 'All Events',
      addEvent: 'Add Event',
      searchEventsPlaceholder: 'Search events by name or location...',
      showAllBrands: 'Show all {{count}} brands',
      showLessBrands: 'Show fewer brands',
      noBrandsFound: 'No brands assigned to this event yet.',
      noLayoutImages: 'No layout images available',
      addNewLayout: 'Add New Layout',
      startTreasureHunt: 'Start Treasure Hunt',
      treasureHuntAvailable: 'Treasure Hunt Available',
      treasureHuntDesc: 'Join the Treasure Hunt to collect stamps from brand booths and win prizes!',
    },
  },
  vi: {
    translation: {
      loading: 'Đang tải...',
      back: 'Quay lại',
      home: 'Trang chủ',
      events: 'Sự kiện',
      brands: 'Thương hiệu',
      users: 'Quản lý người dùng',
      login: 'Đăng nhập',
      profile: 'Hồ sơ',
      registerForEvent: 'Đăng ký tham gia',
      unregisterFromEvent: 'Hủy đăng ký',
      loginToRegister: 'Đăng nhập để đăng ký',
      attendingBrands: 'Thương hiệu tham gia',
      eventLayouts: 'Sơ đồ sự kiện',
      allEvents: 'Tất cả sự kiện',
      addEvent: 'Thêm sự kiện',
      searchEventsPlaceholder: 'Tìm kiếm sự kiện theo tên hoặc địa điểm...',
      showAllBrands: 'Xem tất cả {{count}} thương hiệu',
      showLessBrands: 'Thu gọn danh sách',
      noBrandsFound: 'Chưa có thương hiệu nào tham gia sự kiện này.',
      noLayoutImages: 'Chưa có sơ đồ sự kiện',
      addNewLayout: 'Thêm sơ đồ mới',
      startTreasureHunt: 'Bắt đầu Săn kho báu',
      treasureHuntAvailable: 'Trò chơi Săn kho báu',
      treasureHuntDesc: 'Tham gia Săn kho báu để thu thập con dấu từ gian hàng và nhận quà!',
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
