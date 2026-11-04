import { useEffect, useState, useRef } from 'react';

function AnimatedCounter({ end, duration = 2000, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true); }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!isVisible) return;
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);
  return <div ref={ref} className="text-4xl md:text-5xl font-bold text-white">{count.toLocaleString('ar-SA')}{suffix}</div>;
}

export default function Stats() {
  return (
    <section className="relative -mt-16 z-20 max-w-6xl mx-auto px-4">
      <div className="bg-gradient-to-l from-blue-600 to-purple-600 rounded-3xl p-8 md:p-12 shadow-2xl shadow-blue-500/20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div><AnimatedCounter end={5000} suffix="+" /><p className="text-blue-100 mt-2 font-medium">معلن نشط</p></div>
          <div><AnimatedCounter end={12000} suffix="+" /><p className="text-blue-100 mt-2 font-medium">زيارة شهرية</p></div>
          <div><AnimatedCounter end={3500} suffix="+" /><p className="text-blue-100 mt-2 font-medium">تاجر وموزع</p></div>
          <div><AnimatedCounter end={98} suffix="%" /><p className="text-blue-100 mt-2 font-medium">نسبة الرضا</p></div>
        </div>
      </div>
    </section>
  );
}