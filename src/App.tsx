import { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Packages from './components/Packages';
import Advertisements from './components/Advertisements';
import AddAdForm from './components/AddAdForm';
import Stats from './components/Stats';
import Testimonials from './components/Testimonials';
import Contact from './components/Contact';
import Footer from './components/Footer';

function App() {
  const [showAddAd, setShowAddAd] = useState(false);
  const [ads, setAds] = useState([
    { id: 1, title: 'توزيع مواد غذائية بالجملة', category: 'توزيع', description: 'نوفر جميع المواد الغذائية بالجملة بأسعار تنافسية مع خدمة توصيل لجميع المحافظات', contact: '01007008707', city: 'القاهرة', date: '2024-01-15', featured: true, image: '📦' },
    { id: 2, title: 'عروض خاصة على الأجهزة الإلكترونية', category: 'تجارة', description: 'خصومات تصل إلى 40% على جميع الأجهزة الإلكترونية - عرض محدود', contact: '01012345678', city: 'الإسكندرية', date: '2024-01-14', featured: true, image: '💻' },
    { id: 3, title: 'محل ملابس رجالي - تشكيلة جديدة', category: 'محلات', description: 'وصلتنا تشكيلة جديدة من الملابس الرجالية العصرية بأسعار مناسبة', contact: '01098765432', city: 'المنصورة', date: '2024-01-13', featured: false, image: '👔' },
    { id: 4, title: 'وكالة توزيع مستحضرات تجميل', category: 'توزيع', description: 'وكالة حصرية لتوزيع مستحضرات التجميل العالمية - أسعار خاصة للتجار', contact: '01155566778', city: 'الجيزة', date: '2024-01-12', featured: false, image: '💄' },
    { id: 5, title: 'معرض أثاث ومفروشات', category: 'محلات', description: 'أحدث تصاميم الأثاث والمفروشات المنزلية والمكتبية بأسعار الجملة', contact: '01234567890', city: 'طنطا', date: '2024-01-11', featured: true, image: '🪑' },
    { id: 6, title: 'توزيع مواد بناء', category: 'توزيع', description: 'جميع مواد البناء والتشييد بأسعار الجملة مع التوصيل للمواقع', contact: '01556789012', city: 'المنيا', date: '2024-01-10', featured: false, image: '🏗️' }
  ]);

  const handleAddAd = (newAd: any) => {
    setAds([{ ...newAd, id: ads.length + 1, date: new Date().toISOString().split('T')[0], featured: false }, ...ads]);
    setShowAddAd(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onAddAd={() => setShowAddAd(true)} />
      <Hero onAddAd={() => setShowAddAd(true)} />
      <Stats />
      <Features />
      <Packages onAddAd={() => setShowAddAd(true)} />
      <Advertisements ads={ads} />
      <Testimonials />
      <Contact />
      <Footer />
      {showAddAd && <AddAdForm onSubmit={handleAddAd} onClose={() => setShowAddAd(false)} />}
    </div>
  );
}

export default App;