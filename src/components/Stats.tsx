import { useEffect, useRef, useState } from 'react';
import { SiteSettings } from '../types';

function AnimatedCounter({
  end,
  duration = 1400,
  suffix = '',
}: {
  end: number;
  duration?: number;
  suffix?: string;
}) {
  const [count, setCount] = useState(end);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
        }
      },
      { threshold: 0.25 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasAnimated]);

  useEffect(() => {
    if (!hasAnimated) {
      setCount(end);
      return;
    }
    let startTime = 0;
    let rafId = 0;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [hasAnimated, end, duration]);

  return (
    <div ref={ref} className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tabular-nums">
      {count.toLocaleString('en-US')}
      {suffix}
    </div>
  );
}

interface StatsProps {
  settings: SiteSettings;
}

export default function Stats({ settings }: StatsProps) {
  return (
    <section className="relative -mt-14 z-20 max-w-6xl mx-auto px-4">
      <div className="bg-blue-700 rounded-3xl p-8 md:p-10 shadow-xl border border-blue-600">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <AnimatedCounter end={settings.stat_advertisers} suffix="+" />
            <p className="text-blue-100 mt-2 text-sm md:text-base font-medium">معلن نشط</p>
          </div>
          <div>
            <AnimatedCounter end={settings.stat_visits} suffix="+" />
            <p className="text-blue-100 mt-2 text-sm md:text-base font-medium">زيارة شهرية</p>
          </div>
          <div>
            <AnimatedCounter end={settings.stat_traders} suffix="+" />
            <p className="text-blue-100 mt-2 text-sm md:text-base font-medium">تاجر وموزع</p>
          </div>
          <div>
            <AnimatedCounter end={settings.stat_satisfaction} suffix="%" />
            <p className="text-blue-100 mt-2 text-sm md:text-base font-medium">نسبة رضا العملاء</p>
          </div>
        </div>
      </div>
    </section>
  );
}
