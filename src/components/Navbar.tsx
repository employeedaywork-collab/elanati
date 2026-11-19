import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Menu, X } from 'lucide-react';

interface NavbarProps {
  siteName: string;
  onAddAd: () => void;
  onOpenPortal: () => void;
}

export default function Navbar({ siteName, onAddAd, onOpenPortal }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 right-0 left-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-6">
          <a
            href="#home"
            className="text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
          >
            {siteName}
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#home"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              الرئيسية
            </a>
            <a
              href="#features"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              المميزات
            </a>
            <a
              href="#packages"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              الباقات
            </a>
            <a
              href="#ads"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              الإعلانات
            </a>
            <a
              href="#contact"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              تواصل معنا
            </a>
            <Link
              to="/admin"
              className="text-slate-700 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              لوحة المدير
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenPortal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
            >
              <Clock className="w-4 h-4 text-blue-700" />
              متابعة اشتراكي
            </button>
            <button
              type="button"
              onClick={onAddAd}
              className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              أضف إعلانك
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            className="md:hidden p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden pb-5 pt-3 border-t border-slate-100">
            <div className="flex flex-col gap-2">
              <a
                href="#home"
                onClick={() => setIsOpen(false)}
                className="text-slate-700 hover:text-blue-700 font-medium px-3 py-2.5 rounded-lg hover:bg-slate-50"
              >
                الرئيسية
              </a>
              <a
                href="#features"
                onClick={() => setIsOpen(false)}
                className="text-slate-700 hover:text-blue-700 font-medium px-3 py-2.5 rounded-lg hover:bg-slate-50"
              >
                المميزات
              </a>
              <a
                href="#packages"
                onClick={() => setIsOpen(false)}
                className="text-slate-700 hover:text-blue-700 font-medium px-3 py-2.5 rounded-lg hover:bg-slate-50"
              >
                الباقات
              </a>
              <a
                href="#ads"
                onClick={() => setIsOpen(false)}
                className="text-slate-700 hover:text-blue-700 font-medium px-3 py-2.5 rounded-lg hover:bg-slate-50"
              >
                الإعلانات
              </a>
              <a
                href="#contact"
                onClick={() => setIsOpen(false)}
                className="text-slate-700 hover:text-blue-700 font-medium px-3 py-2.5 rounded-lg hover:bg-slate-50"
              >
                تواصل معنا
              </a>
              <Link
                to="/admin"
                onClick={() => setIsOpen(false)}
                className="text-slate-700 hover:text-blue-700 font-medium px-3 py-2.5 rounded-lg hover:bg-slate-50"
              >
                لوحة المدير
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenPortal();
                }}
                className="border border-slate-200 text-slate-800 px-6 py-3 rounded-xl font-bold text-center inline-flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4 text-blue-700" />
                متابعة اشتراكي وإعلاناتي
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onAddAd();
                }}
                className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-bold mt-1 text-center"
              >
                أضف إعلانك
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
