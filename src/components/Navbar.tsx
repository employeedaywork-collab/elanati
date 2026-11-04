import { useState } from 'react';

interface NavbarProps { onAddAd: () => void; }

export default function Navbar({ onAddAd }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <nav className="fixed top-0 right-0 left-0 z-50 bg-white/90 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">إ</span>
            </div>
            <span className="text-xl font-bold text-gray-800">إعلاناتي</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#home" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">الرئيسية</a>
            <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">المميزات</a>
            <a href="#packages" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">الباقات</a>
            <a href="#ads" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">الإعلانات</a>
            <a href="#contact" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">تواصل معنا</a>
          </div>
          <div className="hidden md:block">
            <button onClick={onAddAd} className="bg-gradient-to-l from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300">أضف إعلانك</button>
          </div>
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {isOpen && (
          <div className="md:hidden pb-4 border-t">
            <div className="flex flex-col gap-3 pt-4">
              <a href="#home" className="text-gray-600 hover:text-blue-600 font-medium px-2 py-1">الرئيسية</a>
              <a href="#features" className="text-gray-600 hover:text-blue-600 font-medium px-2 py-1">المميزات</a>
              <a href="#packages" className="text-gray-600 hover:text-blue-600 font-medium px-2 py-1">الباقات</a>
              <a href="#ads" className="text-gray-600 hover:text-blue-600 font-medium px-2 py-1">الإعلانات</a>
              <a href="#contact" className="text-gray-600 hover:text-blue-600 font-medium px-2 py-1">تواصل معنا</a>
              <button onClick={onAddAd} className="bg-gradient-to-l from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl font-medium mt-2">أضف إعلانك</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}